// Supabase Edge Function: distribute-weekly
// Handles weekly top 3 leaderboard prize distribution
// Should be called by a cron job at the end of each week (Sunday UTC midnight)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';
import { ethers } from 'https://esm.sh/ethers@6.16.0';

// Constants
const WEEKLY_VAULT_CONTRACT = Deno.env.get('WEEKLY_VAULT_CONTRACT_ADDRESS') || '';
const STATS_CONTRACT = Deno.env.get('STATS_CONTRACT_ADDRESS') || '';
const OPERATOR_PRIVATE_KEY = Deno.env.get('OPERATOR_PRIVATE_KEY') || '';
const BASE_RPC_URL = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';

// Distribution percentages for top 3
const WEEKLY_PERCENTAGES = [50, 30, 20]; // 1st: 50%, 2nd: 30%, 3rd: 20%

// Contract ABIs
const WEEKLY_VAULT_ABI = [
  'function distributeWeeklyRewards(address[3] winners, uint256[3] percentages) external',
  'function getBalance() view returns (uint256)',
  'function weekNumber() view returns (uint256)',
];

const STATS_ABI = [
  'function getWeeklyTopPlayers(uint256 count) view returns (address[], uint256[])',
  'function resetWeeklySlices() external',
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklyDistributionResponse {
  success: boolean;
  weekNumber?: number;
  totalDistributed?: string;
  winners?: {
    address: string;
    slices: number;
    prize: string;
    rank: number;
  }[];
  transactionHash?: string;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment
    if (!WEEKLY_VAULT_CONTRACT || !STATS_CONTRACT || !OPERATOR_PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

    // Initialize contracts
    const weeklyVault = new ethers.Contract(WEEKLY_VAULT_CONTRACT, WEEKLY_VAULT_ABI, signer);
    const stats = new ethers.Contract(STATS_CONTRACT, STATS_ABI, signer);

    // Get current week number
    const weekNumber = await weeklyVault.weekNumber();

    // Check pool balance
    const poolBalance = await weeklyVault.getBalance();
    if (poolBalance === BigInt(0)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Weekly pool is empty',
          weekNumber: Number(weekNumber),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get top 3 players from stats contract
    const [addresses, slices] = await stats.getWeeklyTopPlayers(3);

    // Prepare winners array (pad with zero addresses if less than 3 players)
    const winners: [string, string, string] = [
      addresses[0] || ethers.ZeroAddress,
      addresses[1] || ethers.ZeroAddress,
      addresses[2] || ethers.ZeroAddress,
    ];

    // Calculate prizes
    const prizes = winners.map((winner, i) => {
      if (winner === ethers.ZeroAddress) return BigInt(0);
      return (poolBalance * BigInt(WEEKLY_PERCENTAGES[i])) / BigInt(100);
    });

    // Distribute rewards on-chain
    const tx = await weeklyVault.distributeWeeklyRewards(
      winners,
      WEEKLY_PERCENTAGES.map(BigInt),
      {
        gasLimit: 300000,
      }
    );

    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error('Distribution transaction failed');
    }

    // Reset weekly stats on stats contract
    const resetTx = await stats.resetWeeklySlices({ gasLimit: 200000 });
    await resetTx.wait();

    // Prepare response data
    const winnersData = winners.map((address, i) => ({
      address,
      slices: Number(slices[i] || 0),
      prize: ethers.formatEther(prizes[i]),
      rank: i + 1,
    })).filter(w => w.address !== ethers.ZeroAddress);

    const totalDistributed = prizes.reduce((a, b) => a + b, BigInt(0));

    // Record in database
    await supabase.from('weekly_distributions').insert({
      week_number: Number(weekNumber),
      total_distributed: ethers.formatEther(totalDistributed),
      winners: winnersData,
      transaction_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    const response: WeeklyDistributionResponse = {
      success: true,
      weekNumber: Number(weekNumber),
      totalDistributed: ethers.formatEther(totalDistributed),
      winners: winnersData,
      transactionHash: receipt.hash,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Weekly distribution error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
