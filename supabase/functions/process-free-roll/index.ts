// Supabase Edge Function: process-free-roll
// Handles daily free roll with VRF-style randomness

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';
import { ethers } from 'https://esm.sh/ethers@6.16.0';

// Constants
const FREE_ROLL_CONTRACT = Deno.env.get('FREE_ROLL_CONTRACT_ADDRESS') || '';
const OPERATOR_PRIVATE_KEY = Deno.env.get('OPERATOR_PRIVATE_KEY') || '';
const BASE_RPC_URL = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';

// Free Roll ABI
const FREE_ROLL_ABI = [
  'function hasRolledToday(uint256 fid) view returns (bool)',
  'function processRoll(uint256 fid, address playerAddress, uint8 selection, uint8 result) external',
  'function getPoolBalance() view returns (uint256)',
  'function getLastRoll(uint256 fid) view returns (uint8 selection, uint8 result, bool won, uint256 prize, uint256 timestamp)',
  'event FreeRollWin(uint256 indexed fid, address indexed wallet, uint8 selection, uint8 result, uint256 prize)',
  'event FreeRollLoss(uint256 indexed fid, uint8 selection, uint8 result)',
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FreeRollRequest {
  fid: number;
  walletAddress: string;
  selection: number; // 1-6
}

interface FreeRollResponse {
  success: boolean;
  result?: number;
  won?: boolean;
  prize?: string;
  transactionHash?: string;
  error?: string;
}

// Generate cryptographically secure random number 1-6
function generateRandomResult(): number {
  const array = new Uint8Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 6) + 1;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment
    if (!FREE_ROLL_CONTRACT || !OPERATOR_PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Parse request
    const body: FreeRollRequest = await req.json();
    const { fid, walletAddress, selection } = body;

    // Validate input
    if (!fid || !walletAddress || !selection) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (selection < 1 || selection > 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Selection must be 1-6' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

    // Initialize free roll contract
    const freeRoll = new ethers.Contract(FREE_ROLL_CONTRACT, FREE_ROLL_ABI, signer);

    // Check if already rolled today (on-chain check)
    const hasRolled = await freeRoll.hasRolledToday(fid);
    if (hasRolled) {
      // Get last roll from contract
      const lastRoll = await freeRoll.getLastRoll(fid);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Already rolled today',
          lastRoll: {
            selection: lastRoll.selection,
            result: lastRoll.result,
            won: lastRoll.won,
            prize: ethers.formatEther(lastRoll.prize),
          },
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate random result (VRF-style using crypto.getRandomValues)
    const result = generateRandomResult();
    const won = selection === result;

    // Get current pool balance for prize calculation
    const poolBalance = await freeRoll.getPoolBalance();
    const potentialPrize = poolBalance / BigInt(6); // 1/6 of pool

    // Process roll on-chain
    const tx = await freeRoll.processRoll(
      fid,
      walletAddress,
      selection,
      result,
      {
        gasLimit: 200000,
      }
    );

    // Wait for confirmation
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // Parse event for actual prize amount
    let actualPrize = '0';
    for (const log of receipt.logs) {
      try {
        const parsed = freeRoll.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed?.name === 'FreeRollWin') {
          actualPrize = ethers.formatEther(parsed.args.prize);
        }
      } catch {
        // Not our event
      }
    }

    // Record in database
    await supabase.from('free_rolls').insert({
      fid,
      wallet_address: walletAddress,
      selection,
      result,
      won,
      prize: won ? actualPrize : '0',
      transaction_hash: receipt.hash,
      created_at: new Date().toISOString(),
    });

    const response: FreeRollResponse = {
      success: true,
      result,
      won,
      prize: won ? actualPrize : '0',
      transactionHash: receipt.hash,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Free roll error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
