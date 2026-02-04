import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DISCONNECT_TIMEOUT_MS } from '../_shared/constants.ts';
import { Edge, countAvailableMoves } from '../_shared/gridUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find disconnected players who have exceeded timeout
    const timeoutThreshold = new Date(Date.now() - DISCONNECT_TIMEOUT_MS).toISOString();

    const { data: disconnectedPlayers, error } = await supabase
      .from('match_players')
      .select(`
        *,
        matches!inner (
          id,
          status,
          current_player_index,
          turn_number
        )
      `)
      .eq('is_connected', false)
      .eq('is_bot', false)
      .lte('disconnected_at', timeoutThreshold)
      .eq('matches.status', 'active');

    if (error) {
      throw new Error(`Failed to query disconnected players: ${error.message}`);
    }

    let processedCount = 0;

    for (const player of disconnectedPlayers || []) {
      try {
        // Convert player to bot
        await supabase
          .from('match_players')
          .update({ is_bot: true })
          .eq('match_id', player.match_id)
          .eq('player_fid', player.player_fid);

        // Log bot takeover
        await supabase.from('move_history').insert({
          match_id: player.match_id,
          player_fid: player.player_fid,
          turn_number: player.matches.turn_number || 1,
          move_type: 'bot_takeover',
          move_data: { reason: 'disconnect_timeout' },
        });

        // If it's currently this player's turn, execute bot move
        if (player.player_index === player.matches.current_player_index) {
          await executeBotTurn(supabase, player.match_id, player.player_fid);
        }

        processedCount++;
      } catch (err) {
        console.error(`Failed to process player ${player.player_fid}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        total: disconnectedPlayers?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Bot takeover error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeBotTurn(supabase: any, matchId: string, botFid: number) {
  // Fetch current game state
  const { data: gameState, error: stateError } = await supabase
    .from('game_states')
    .select('*')
    .eq('match_id', matchId)
    .single();

  if (stateError || !gameState) {
    console.error('Failed to fetch game state for bot turn');
    return;
  }

  const edges = gameState.edges as Edge[];

  // Roll dice if needed
  if (!gameState.dice_roll || gameState.moves_remaining === 0) {
    try {
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          matchId,
          playerFid: botFid,
          moveType: 'roll_dice',
          moveData: {},
        }),
      });

      const rollResult = await response.json();

      // If turn was skipped due to high roll, we're done
      if (rollResult.turnSkipped) {
        return;
      }
    } catch (err) {
      console.error('Bot failed to roll dice:', err);
      return;
    }
  }

  // Refresh game state after roll
  const { data: updatedState } = await supabase
    .from('game_states')
    .select('*')
    .eq('match_id', matchId)
    .single();

  if (!updatedState) return;

  // Simple bot strategy: draw available edges until no moves remaining
  let movesRemaining = updatedState.moves_remaining;
  const updatedEdges = updatedState.edges as Edge[];

  while (movesRemaining > 0) {
    // Find first available edge
    const availableEdge = updatedEdges.find((e: Edge) => e.claimedBy === null);
    if (!availableEdge) break;

    try {
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          matchId,
          playerFid: botFid,
          moveType: 'draw_edge',
          moveData: { edgeId: availableEdge.id },
        }),
      });

      const drawResult = await response.json();

      if (drawResult.gameOver) {
        return; // Game ended
      }

      movesRemaining = drawResult.movesRemaining;

      // Mark edge as claimed locally to avoid re-selecting
      availableEdge.claimedBy = `player_${botFid}`;

      // Small delay between moves for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Bot failed to draw edge:', err);
      break;
    }
  }

  // End turn if we still have the turn
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        matchId,
        playerFid: botFid,
        moveType: 'end_turn',
        moveData: {},
      }),
    });
  } catch (err) {
    console.error('Bot failed to end turn:', err);
  }
}
