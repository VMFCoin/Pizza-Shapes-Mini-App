import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  Edge,
  PizzaSlice,
  findNewlyCompletedSlices,
  countAvailableMoves,
  hasRemainingSlices,
  determineWinner,
} from '../_shared/gridUtils.ts';

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

    const { matchId, playerFid, moveType, moveData } = await req.json();

    if (!matchId || !playerFid || !moveType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current match and game state
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        match_players (
          player_fid,
          player_index,
          is_bot
        ),
        game_states (*)
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

    const gameState = match.game_states;
    if (!gameState) {
      return new Response(
        JSON.stringify({ error: 'Game state not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current player
    const sortedPlayers = match.match_players.sort(
      (a: any, b: any) => a.player_index - b.player_index
    );
    const currentPlayer = sortedPlayers[match.current_player_index];

    // Validate it's the player's turn
    if (currentPlayer.player_fid !== playerFid) {
      return new Response(
        JSON.stringify({ error: 'Not your turn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any = {};

    switch (moveType) {
      case 'roll_dice':
        result = await handleRollDice(supabase, match, gameState);
        break;
      case 'draw_edge':
        result = await handleDrawEdge(supabase, match, gameState, moveData.edgeId, playerFid);
        break;
      case 'end_turn':
        result = await handleEndTurn(supabase, match, gameState);
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid move type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log move to history
    await supabase.from('move_history').insert({
      match_id: matchId,
      player_fid: playerFid,
      turn_number: match.turn_number,
      move_type: moveType,
      move_data: moveData || {},
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Validate move error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleRollDice(supabase: any, match: any, gameState: any) {
  // Prevent rolling if player already rolled this turn
  if (gameState.moves_remaining > 0 || gameState.dice_roll !== null) {
    return {
      diceRoll: gameState.dice_roll,
      movesRemaining: gameState.moves_remaining,
      turnSkipped: false,
      availableMoves: countAvailableMoves(gameState.edges as Edge[]),
      alreadyRolled: true,
    };
  }

  const roll = Math.floor(Math.random() * 6) + 1;
  const edges = gameState.edges as Edge[];
  const availableMoves = countAvailableMoves(edges);

  // If roll is higher than available moves, skip turn
  if (roll > availableMoves) {
    const sortedPlayers = match.match_players.sort(
      (a: any, b: any) => a.player_index - b.player_index
    );
    const nextPlayerIndex = (match.current_player_index + 1) % sortedPlayers.length;

    // Update match - advance to next player
    await supabase
      .from('matches')
      .update({
        current_player_index: nextPlayerIndex,
        turn_number: match.turn_number + 1,
      })
      .eq('id', match.id);

    // Update game state — reset dice_roll to null so the next player can roll
    await supabase
      .from('game_states')
      .update({
        dice_roll: null,
        moves_remaining: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('match_id', match.id);

    return {
      diceRoll: roll,
      movesRemaining: 0,
      turnSkipped: true,
      availableMoves,
      nextPlayerIndex,
    };
  }

  // Normal roll - player can make moves
  await supabase
    .from('game_states')
    .update({
      dice_roll: roll,
      moves_remaining: roll,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', match.id);

  return {
    diceRoll: roll,
    movesRemaining: roll,
    turnSkipped: false,
    availableMoves,
  };
}

async function handleDrawEdge(
  supabase: any,
  match: any,
  gameState: any,
  edgeId: string,
  playerFid: number
) {
  const edges = gameState.edges as Edge[];
  const possibleSlices = gameState.possible_slices as PizzaSlice[];
  const capturedSlices = gameState.captured_slices as PizzaSlice[];

  // Validate edge exists and is available
  const edge = edges.find((e: Edge) => e.id === edgeId);
  if (!edge) {
    throw new Error('Edge not found');
  }
  if (edge.claimedBy !== null) {
    throw new Error('Edge already claimed');
  }

  // Validate moves remaining
  if (gameState.moves_remaining <= 0) {
    throw new Error('No moves remaining');
  }

  const playerId = `player_${playerFid}`;

  // Update edge
  const updatedEdges = edges.map((e: Edge) =>
    e.id === edgeId ? { ...e, claimedBy: playerId } : e
  );

  // Find newly completed slices
  const newlyCompleted = findNewlyCompletedSlices(edgeId, possibleSlices, updatedEdges);

  // Update possible slices with captures
  const updatedPossibleSlices = possibleSlices.map((slice: PizzaSlice) => {
    const isNewlyCompleted = newlyCompleted.some((nc: PizzaSlice) => nc.id === slice.id);
    return isNewlyCompleted ? { ...slice, capturedBy: playerId } : slice;
  });

  // Add to captured slices
  const newCapturedSlices = [
    ...capturedSlices,
    ...newlyCompleted.map((slice: PizzaSlice) => ({ ...slice, capturedBy: playerId })),
  ];

  const extraTurn = newlyCompleted.length > 0;
  const newMovesRemaining = gameState.moves_remaining - 1 + (extraTurn ? 1 : 0);

  // Check game end condition
  const gameEnded = !hasRemainingSlices(updatedPossibleSlices, updatedEdges);

  if (gameEnded) {
    // Determine winner
    const players = match.match_players.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
    const winnerId = determineWinner(players, newCapturedSlices);
    const winnerFid = winnerId ? parseInt(winnerId.replace('player_', '')) : null;

    // Update match as completed
    await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_fid: winnerFid,
        ended_at: new Date().toISOString(),
      })
      .eq('id', match.id);
  }

  // Update game state
  await supabase
    .from('game_states')
    .update({
      edges: updatedEdges,
      possible_slices: updatedPossibleSlices,
      captured_slices: newCapturedSlices,
      moves_remaining: newMovesRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', match.id);

  // Update player score
  const playerScore = newCapturedSlices.filter((s: PizzaSlice) => s.capturedBy === playerId).length;
  await supabase
    .from('match_players')
    .update({ score: playerScore })
    .eq('match_id', match.id)
    .eq('player_fid', playerFid);

  return {
    edgeId,
    capturedSlices: newlyCompleted,
    extraTurn,
    movesRemaining: newMovesRemaining,
    gameOver: gameEnded,
    playerScore,
  };
}

async function handleEndTurn(supabase: any, match: any, gameState: any) {
  const edges = gameState.edges as Edge[];
  const possibleSlices = gameState.possible_slices as PizzaSlice[];
  const capturedSlices = gameState.captured_slices as PizzaSlice[];

  // Check game end condition
  const gameEnded = !hasRemainingSlices(possibleSlices, edges);

  if (gameEnded) {
    const players = match.match_players.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
    const winnerId = determineWinner(players, capturedSlices);
    const winnerFid = winnerId ? parseInt(winnerId.replace('player_', '')) : null;

    await supabase
      .from('matches')
      .update({
        status: 'completed',
        winner_fid: winnerFid,
        ended_at: new Date().toISOString(),
      })
      .eq('id', match.id);

    return { turnEnded: true, gameOver: true };
  }

  // Advance to next player
  const sortedPlayers = match.match_players.sort(
    (a: any, b: any) => a.player_index - b.player_index
  );
  const nextPlayerIndex = (match.current_player_index + 1) % sortedPlayers.length;

  await supabase
    .from('matches')
    .update({
      current_player_index: nextPlayerIndex,
      turn_number: match.turn_number + 1,
    })
    .eq('id', match.id);

  await supabase
    .from('game_states')
    .update({
      dice_roll: null,
      moves_remaining: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('match_id', match.id);

  return {
    turnEnded: true,
    gameOver: false,
    nextPlayerIndex,
  };
}
