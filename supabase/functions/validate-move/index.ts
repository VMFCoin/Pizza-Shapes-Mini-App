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
import { chooseBestEdge } from '../_shared/botStrategy.ts';

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

  const edges = gameState.edges as Edge[];
  const possibleSlices = gameState.possible_slices as PizzaSlice[];

  // Check if the game should end — no remaining slices means no point rolling.
  // Without this check, when availableMoves=0, every roll > 0 skips turn infinitely.
  if (!hasRemainingSlices(possibleSlices, edges)) {
    const players = match.match_players.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
    const capturedSlices = gameState.captured_slices as PizzaSlice[];
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

    return {
      diceRoll: null,
      movesRemaining: 0,
      turnSkipped: false,
      availableMoves: 0,
      gameOver: true,
    };
  }

  const roll = Math.floor(Math.random() * 6) + 1;
  const availableMoves = countAvailableMoves(edges);

  // If roll is higher than available moves, skip turn
  if (roll > availableMoves) {
    const sortedPlayers = match.match_players.sort(
      (a: any, b: any) => a.player_index - b.player_index
    );
    const nextPlayerIndex = (match.current_player_index + 1) % sortedPlayers.length;
    const nextPlayer = sortedPlayers[nextPlayerIndex];

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

    // If the next player is a bot, execute bot turn inline
    if (nextPlayer?.is_bot) {
      try {
        await executeBotTurn(supabase, match.id, nextPlayer.player_fid, nextPlayerIndex, sortedPlayers, match.turn_number + 1, gameState);
      } catch (err: any) {
        console.error('Inline bot turn error (turn_skip):', err);
      }
    }

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
  const nextPlayer = sortedPlayers[nextPlayerIndex];

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

  // If the next player is a bot, execute the bot's turn inline.
  // Previous approach (calling trigger-bot-turn via fetch) failed because:
  // - Awaiting blocked the response and caused timeout
  // - Fire-and-forget was killed by Deno runtime after response sent
  // Inline approach: bot plays its entire turn within this single invocation.
  if (nextPlayer?.is_bot) {
    try {
      await executeBotTurn(supabase, match.id, nextPlayer.player_fid, nextPlayerIndex, sortedPlayers, match.turn_number + 1, gameState);
    } catch (err: any) {
      console.error('Inline bot turn error:', err);
      // Don't fail the human's end_turn — bot error is non-fatal
    }
  }

  return {
    turnEnded: true,
    gameOver: false,
    nextPlayerIndex,
    nextPlayerIsBot: nextPlayer?.is_bot ?? false,
  };
}

/**
 * Execute a bot's entire turn inline: roll dice, draw edges, end turn.
 * Processes all moves IN MEMORY then writes final state to DB in 2 writes
 * (game_states + matches). This keeps the function fast and avoids
 * per-move DB round-trips that could cause timeouts.
 */
async function executeBotTurn(
  supabase: any,
  matchId: string,
  botFid: number,
  botPlayerIndex: number,
  sortedPlayers: any[],
  currentTurnNumber: number,
  gameState: any
) {
  const botPlayerId = `player_${botFid}`;
  console.log(`[bot-inline] Starting bot turn for FID=${botFid}, index=${botPlayerIndex}, turn=${currentTurnNumber}`);

  let edges = gameState.edges as Edge[];
  let possibleSlices = gameState.possible_slices as PizzaSlice[];
  let capturedSlices = gameState.captured_slices as PizzaSlice[];
  const availableMoves = countAvailableMoves(edges);

  // Check if game should end (no remaining slices)
  if (!hasRemainingSlices(possibleSlices, edges)) {
    console.log('[bot-inline] No remaining slices, ending game');
    const players = sortedPlayers.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
    const winnerId = determineWinner(players, capturedSlices);
    const winnerFid = winnerId ? parseInt(winnerId.replace('player_', '')) : null;
    await supabase.from('matches').update({
      status: 'completed', winner_fid: winnerFid, ended_at: new Date().toISOString(),
    }).eq('id', matchId);
    return;
  }

  // Step 1: Roll dice
  const roll = Math.floor(Math.random() * 6) + 1;
  console.log(`[bot-inline] Rolled ${roll}, available=${availableMoves}`);

  // If roll > available moves, skip turn (advance to next player)
  if (roll > availableMoves) {
    console.log(`[bot-inline] Roll ${roll} > ${availableMoves} available, skipping`);
    const nextIdx = (botPlayerIndex + 1) % sortedPlayers.length;
    await supabase.from('matches').update({
      current_player_index: nextIdx,
      turn_number: currentTurnNumber + 1,
    }).eq('id', matchId);
    await supabase.from('game_states').update({
      dice_roll: null, moves_remaining: 0, updated_at: new Date().toISOString(),
    }).eq('match_id', matchId);
    console.log(`[bot-inline] Turn skipped, next player index=${nextIdx}`);
    return;
  }

  // Step 2: Draw edges in memory using strategy
  let movesRemaining = roll;
  let movesPlayed = 0;

  while (movesRemaining > 0) {
    const bestEdgeId = chooseBestEdge(edges, possibleSlices, botPlayerId);
    if (!bestEdgeId) break;

    // Claim the edge in memory
    edges = edges.map((e: Edge) =>
      e.id === bestEdgeId ? { ...e, claimedBy: botPlayerId } : e
    );

    // Check for captures
    const newlyCompleted = findNewlyCompletedSlices(bestEdgeId, possibleSlices, edges);
    possibleSlices = possibleSlices.map((s: PizzaSlice) => {
      const captured = newlyCompleted.some((nc: PizzaSlice) => nc.id === s.id);
      return captured ? { ...s, capturedBy: botPlayerId } : s;
    });
    if (newlyCompleted.length > 0) {
      capturedSlices = [
        ...capturedSlices,
        ...newlyCompleted.map((s: PizzaSlice) => ({ ...s, capturedBy: botPlayerId })),
      ];
    }

    const extraTurn = newlyCompleted.length > 0;
    movesRemaining = movesRemaining - 1 + (extraTurn ? 1 : 0);
    movesPlayed++;

    // Check game end
    if (!hasRemainingSlices(possibleSlices, edges)) {
      console.log(`[bot-inline] Game ended during bot turn after ${movesPlayed} moves`);
      // Write final state and end game
      await supabase.from('game_states').update({
        edges, possible_slices: possibleSlices, captured_slices: capturedSlices,
        dice_roll: roll, moves_remaining: 0, updated_at: new Date().toISOString(),
      }).eq('match_id', matchId);
      const botScore = capturedSlices.filter((s: PizzaSlice) => s.capturedBy === botPlayerId).length;
      await supabase.from('match_players').update({ score: botScore })
        .eq('match_id', matchId).eq('player_fid', botFid);
      const players = sortedPlayers.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
      const winnerId = determineWinner(players, capturedSlices);
      const winnerFid = winnerId ? parseInt(winnerId.replace('player_', '')) : null;
      await supabase.from('matches').update({
        status: 'completed', winner_fid: winnerFid, ended_at: new Date().toISOString(),
      }).eq('id', matchId);
      return;
    }
  }

  // Step 3: Write final board state + end bot's turn in 2 DB writes
  const nextIdx = (botPlayerIndex + 1) % sortedPlayers.length;
  const botScore = capturedSlices.filter((s: PizzaSlice) => s.capturedBy === botPlayerId).length;

  await supabase.from('game_states').update({
    edges, possible_slices: possibleSlices, captured_slices: capturedSlices,
    dice_roll: null, moves_remaining: 0, updated_at: new Date().toISOString(),
  }).eq('match_id', matchId);

  await supabase.from('match_players').update({ score: botScore })
    .eq('match_id', matchId).eq('player_fid', botFid);

  await supabase.from('matches').update({
    current_player_index: nextIdx,
    turn_number: currentTurnNumber + 1,
  }).eq('id', matchId);

  console.log(`[bot-inline] Bot turn complete: ${movesPlayed} moves, score=${botScore}, next player=${nextIdx}`);
}
