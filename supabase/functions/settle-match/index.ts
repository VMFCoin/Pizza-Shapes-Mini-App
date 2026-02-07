// Supabase Edge Function: settle-match
// Handles on-chain match settlement and prize distribution

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';
import { ethers } from 'https://esm.sh/ethers@6.16.0';

// Constants
const PIZZA_TOKEN = '0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07';
const SETTLEMENT_CONTRACT = Deno.env.get('SETTLEMENT_CONTRACT_ADDRESS') || '';
const OPERATOR_PRIVATE_KEY = Deno.env.get('OPERATOR_PRIVATE_KEY') || '';
const BASE_RPC_URL = Deno.env.get('BASE_RPC_URL') || 'https://mainnet.base.org';
const BOT_ADDRESS = '0x0000000000000000000000000000000000000000';

// Prize distribution (basis points)
const PRIZE_DISTRIBUTION = {
  winner: 7700,      // 77%
  weekly: 1000,      // 10%
  burn: 700,         // 7%
  freeRoll: 300,     // 3%
  charity: 300,      // 3%
};

// Settlement ABI (minimal for settleMatch + settleBotMatch)
const SETTLEMENT_ABI = [
  'function settleMatch(bytes32 matchId, address winner, address[] players, uint256[] slices) external',
  'function settleBotMatch(bytes32 matchId, address[] players, uint256[] slices) external',
  'function getMatch(bytes32 matchId) view returns (tuple(bytes32 matchId, address[] players, uint256 entryAmount, uint256 totalPool, bool settled, uint256 createdAt, uint8 tier))',
  'event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 winnerPrize, uint256 totalPool)',
  'event BotMatchSettled(bytes32 indexed matchId, uint256 freeRollAmount, uint256 burnedToPizza, uint256 totalPool)',
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SettleMatchRequest {
  matchId: string;
  winner: string;
  players: string[];
  scores: Record<string, number>;
}

interface SettleMatchResponse {
  success: boolean;
  transactionHash?: string;
  winnerPrize?: string;
  distribution?: {
    winner: string;
    weeklyTop3: string;
    burned: string;
    dailyFreeRoll: string;
    charities: string;
  };
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate environment
    if (!SETTLEMENT_CONTRACT || !OPERATOR_PRIVATE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Parse request
    const body: SettleMatchRequest = await req.json();
    const { matchId, winner, players, scores } = body;

    // Validate input
    if (!matchId || !winner || !players || !scores) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify match exists in database and is not already settled
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return new Response(
        JSON.stringify({ success: false, error: 'Match not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (match.status === 'completed') {
      return new Response(
        JSON.stringify({ success: false, error: 'Match already settled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(OPERATOR_PRIVATE_KEY, provider);

    // Initialize settlement contract
    const settlement = new ethers.Contract(SETTLEMENT_CONTRACT, SETTLEMENT_ABI, signer);

    // Convert matchId to bytes32
    const matchIdBytes = matchId.startsWith('0x')
      ? matchId
      : ethers.id(matchId); // keccak256 hash if not already hex

    // Prepare slices array (in same order as players)
    const slicesArray = players.map(player => scores[player] || 0);

    // Check if match exists on-chain and not already settled
    try {
      const onChainMatch = await settlement.getMatch(matchIdBytes);
      if (onChainMatch.settled) {
        return new Response(
          JSON.stringify({ success: false, error: 'Match already settled on-chain' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (e) {
      // Match might not exist on-chain yet (if using off-chain entry)
      console.log('Match not found on-chain, proceeding with settlement');
    }

    // Determine if bot won — route to bot-aware settlement path
    const isBotWinner = winner.toLowerCase() === BOT_ADDRESS.toLowerCase();

    let tx;
    if (isBotWinner) {
      // Bot won: 77% winner portion split 50/50 between free roll vault and PIZZA burn
      tx = await settlement.settleBotMatch(
        matchIdBytes,
        players,
        slicesArray,
        {
          gasLimit: 600000,
        }
      );
    } else {
      // Human won: standard settlement
      tx = await settlement.settleMatch(
        matchIdBytes,
        winner,
        players,
        slicesArray,
        {
          gasLimit: 500000,
        }
      );
    }

    // Wait for confirmation
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    // Parse settlement event for prize amounts
    let winnerPrize = '0';
    let totalPool = '0';

    for (const log of receipt.logs) {
      try {
        const parsed = settlement.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (parsed?.name === 'MatchSettled') {
          winnerPrize = ethers.formatEther(parsed.args.winnerPrize);
          totalPool = ethers.formatEther(parsed.args.totalPool);
        }
      } catch {
        // Not our event, skip
      }
    }

    // Calculate distribution amounts for response
    const totalPoolBigInt = BigInt(totalPool.replace('.', '').padEnd(19, '0'));
    const distribution = {
      winner: ethers.formatEther((totalPoolBigInt * BigInt(PRIZE_DISTRIBUTION.winner)) / BigInt(10000)),
      weeklyTop3: ethers.formatEther((totalPoolBigInt * BigInt(PRIZE_DISTRIBUTION.weekly)) / BigInt(10000)),
      burned: ethers.formatEther((totalPoolBigInt * BigInt(PRIZE_DISTRIBUTION.burn)) / BigInt(10000)),
      dailyFreeRoll: ethers.formatEther((totalPoolBigInt * BigInt(PRIZE_DISTRIBUTION.freeRoll)) / BigInt(10000)),
      charities: ethers.formatEther((totalPoolBigInt * BigInt(PRIZE_DISTRIBUTION.charity)) / BigInt(10000)),
    };

    // Update match status in database
    await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_id: winner,
        settled_at: new Date().toISOString(),
        settlement_tx: receipt.hash,
      })
      .eq('id', matchId);

    // Update player stats in database (skip bot players — they don't appear on leaderboard)
    for (const player of players) {
      if (player.toLowerCase() === BOT_ADDRESS.toLowerCase()) {
        continue; // Bot is excluded from stats and leaderboard
      }

      const isWinner = player.toLowerCase() === winner.toLowerCase();
      const slices = scores[player] || 0;

      await supabase.rpc('update_player_stats', {
        p_address: player,
        p_is_winner: isWinner,
        p_slices: slices,
        p_earnings: isWinner ? winnerPrize : '0',
      });
    }

    const response: SettleMatchResponse = {
      success: true,
      transactionHash: receipt.hash,
      winnerPrize,
      distribution,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Settlement error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
