import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Edge, PizzaSlice } from '../_shared/gridUtils.ts';
import { chooseBestEdge } from '../_shared/botStrategy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOT_MOVE_DELAY_MS = 800;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { matchId } = await req.json();

    if (!matchId) {
      return new Response(
        JSON.stringify({ error: 'Missing matchId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch match with players
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        match_players (
          player_fid,
          player_index,
          is_bot
        )
      `)
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return new Response(
        JSON.stringify({ error: 'Match not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (match.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Match is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current player and verify it's a bot
    const sortedPlayers = match.match_players.sort(
      (a: any, b: any) => a.player_index - b.player_index
    );
    const currentPlayer = sortedPlayers[match.current_player_index];

    if (!currentPlayer || !currentPlayer.is_bot) {
      return new Response(
        JSON.stringify({ error: 'Current player is not a bot' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botFid = currentPlayer.player_fid;
    const botPlayerId = `player_${botFid}`;
    let movesPlayed = 0;

    // Step 1: Roll dice
    const rollResponse = await callValidateMove(matchId, botFid, 'roll_dice', {});

    if (rollResponse.error) {
      // Might be "Not your turn" if turn already changed — not a real error
      return new Response(
        JSON.stringify({ success: false, error: rollResponse.error, movesPlayed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (rollResponse.turnSkipped) {
      return new Response(
        JSON.stringify({ success: true, movesPlayed: 0, turnSkipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Draw edges using strategy
    let continueDrawing = true;

    while (continueDrawing) {
      // Re-fetch game state for latest board
      const { data: gameState } = await supabase
        .from('game_states')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (!gameState || gameState.moves_remaining <= 0) {
        break;
      }

      const edges = gameState.edges as Edge[];
      const possibleSlices = gameState.possible_slices as PizzaSlice[];

      // Use intelligent strategy to pick best edge
      const bestEdgeId = chooseBestEdge(edges, possibleSlices, botPlayerId);

      if (!bestEdgeId) {
        break; // No available edges
      }

      // Delay for UX — let human see each move
      await new Promise(resolve => setTimeout(resolve, BOT_MOVE_DELAY_MS));

      const drawResult = await callValidateMove(matchId, botFid, 'draw_edge', { edgeId: bestEdgeId });

      if (drawResult.error) {
        console.error('Bot draw edge error:', drawResult.error);
        break;
      }

      movesPlayed++;

      if (drawResult.gameOver) {
        return new Response(
          JSON.stringify({ success: true, movesPlayed, gameOver: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Continue if there are moves remaining
      if (drawResult.movesRemaining <= 0) {
        continueDrawing = false;
      }
    }

    // Step 3: End turn
    await callValidateMove(matchId, botFid, 'end_turn', {});

    return new Response(
      JSON.stringify({ success: true, movesPlayed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Trigger bot turn error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Call the validate-move edge function internally.
 */
async function callValidateMove(
  matchId: string,
  playerFid: number,
  moveType: string,
  moveData: Record<string, unknown>
): Promise<any> {
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-move`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          matchId,
          playerFid,
          moveType,
          moveData,
        }),
      }
    );

    return await response.json();
  } catch (err: any) {
    return { error: err.message || 'Failed to call validate-move' };
  }
}
