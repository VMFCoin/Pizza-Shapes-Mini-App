// STANDALONE EDGE FUNCTION: validate-move
// Copy this entire file into Supabase Dashboard > Edge Functions > New Function
// Name it: validate-move

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============ SHARED TYPES & UTILS ============
type EdgeID = string;
interface Edge { id: EdgeID; nodeA: string; nodeB: string; claimedBy: string | null; }
interface PizzaSlice { id: string; edgeIds: [EdgeID, EdgeID, EdgeID]; nodeIds: [string, string, string]; capturedBy: string | null; }

function isSliceCompleted(slice: PizzaSlice, edges: Edge[]): boolean {
  return slice.edgeIds.every(edgeId => {
    const edge = edges.find(e => e.id === edgeId);
    return edge && edge.claimedBy !== null;
  });
}

function findNewlyCompletedSlices(newEdgeId: EdgeID, possibleSlices: PizzaSlice[], edges: Edge[]): PizzaSlice[] {
  return possibleSlices.filter(slice => {
    if (!slice.edgeIds.includes(newEdgeId)) return false;
    if (slice.capturedBy !== null) return false;
    return isSliceCompleted(slice, edges);
  });
}

function countAvailableMoves(edges: Edge[]): number {
  return edges.filter(e => e.claimedBy === null).length;
}

function hasRemainingSlices(possibleSlices: PizzaSlice[], edges: Edge[]): boolean {
  return possibleSlices.some(slice => {
    if (slice.capturedBy !== null) return false;
    return slice.edgeIds.some(edgeId => {
      const edge = edges.find(e => e.id === edgeId);
      return edge && edge.claimedBy === null;
    });
  });
}

function getPlayerScore(playerId: string, capturedSlices: PizzaSlice[]): number {
  return capturedSlices.filter(s => s.capturedBy === playerId).length;
}

interface WinnerResult {
  winnerId: string | null;
  isTied: boolean;
  tiedPlayerIds: string[];
  maxScore: number;
}

function determineWinner(players: { id: string }[], capturedSlices: PizzaSlice[]): WinnerResult {
  if (players.length === 0) return { winnerId: null, isTied: false, tiedPlayerIds: [], maxScore: 0 };
  const scores = players.map(p => ({ id: p.id, score: getPlayerScore(p.id, capturedSlices) }));
  const maxScore = Math.max(...scores.map(s => s.score));
  const topPlayers = scores.filter(s => s.score === maxScore);
  if (topPlayers.length === 1) return { winnerId: topPlayers[0].id, isTied: false, tiedPlayerIds: [], maxScore };
  return { winnerId: null, isTied: true, tiedPlayerIds: topPlayers.map(p => p.id), maxScore };
}

// ============ MAIN FUNCTION ============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
      return new Response(JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch match and game state
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select(`*, match_players (player_fid, player_index, is_bot), game_states (*)`)
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return new Response(JSON.stringify({ error: 'Match not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (match.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Match is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const gameState = match.game_states;
    if (!gameState) {
      return new Response(JSON.stringify({ error: 'Game state not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sortedPlayers = match.match_players.sort((a: any, b: any) => a.player_index - b.player_index);
    const currentPlayer = sortedPlayers[match.current_player_index];

    if (currentPlayer.player_fid !== playerFid) {
      return new Response(JSON.stringify({ error: 'Not your turn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result: any = {};

    // Handle move types
    if (moveType === 'roll_dice') {
      const roll = Math.floor(Math.random() * 6) + 1;
      const edges = gameState.edges as Edge[];
      const availableMoves = countAvailableMoves(edges);

      if (roll > availableMoves) {
        const nextPlayerIndex = (match.current_player_index + 1) % sortedPlayers.length;
        await supabase.from('matches').update({ current_player_index: nextPlayerIndex, turn_number: match.turn_number + 1 }).eq('id', match.id);
        await supabase.from('game_states').update({ dice_roll: roll, moves_remaining: 0, updated_at: new Date().toISOString() }).eq('match_id', match.id);
        result = { diceRoll: roll, movesRemaining: 0, turnSkipped: true, availableMoves, nextPlayerIndex };
      } else {
        await supabase.from('game_states').update({ dice_roll: roll, moves_remaining: roll, updated_at: new Date().toISOString() }).eq('match_id', match.id);
        result = { diceRoll: roll, movesRemaining: roll, turnSkipped: false, availableMoves };
      }
    } else if (moveType === 'draw_edge') {
      const edges = gameState.edges as Edge[];
      const possibleSlices = gameState.possible_slices as PizzaSlice[];
      const capturedSlices = gameState.captured_slices as PizzaSlice[];
      const edgeId = moveData.edgeId;

      const edge = edges.find((e: Edge) => e.id === edgeId);
      if (!edge) throw new Error('Edge not found');
      if (edge.claimedBy !== null) throw new Error('Edge already claimed');
      if (gameState.moves_remaining <= 0) throw new Error('No moves remaining');

      const playerId = `player_${playerFid}`;
      const updatedEdges = edges.map((e: Edge) => e.id === edgeId ? { ...e, claimedBy: playerId } : e);
      const newlyCompleted = findNewlyCompletedSlices(edgeId, possibleSlices, updatedEdges);
      const updatedPossibleSlices = possibleSlices.map((slice: PizzaSlice) => {
        const isNewlyCompleted = newlyCompleted.some((nc: PizzaSlice) => nc.id === slice.id);
        return isNewlyCompleted ? { ...slice, capturedBy: playerId } : slice;
      });
      const newCapturedSlices = [...capturedSlices, ...newlyCompleted.map((slice: PizzaSlice) => ({ ...slice, capturedBy: playerId }))];

      const extraTurn = newlyCompleted.length > 0;
      const newMovesRemaining = gameState.moves_remaining - 1 + (extraTurn ? 1 : 0);
      const gameEnded = !hasRemainingSlices(updatedPossibleSlices, updatedEdges);

      if (gameEnded) {
        const players = match.match_players.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
        const winnerResult = determineWinner(players, newCapturedSlices);
        const winnerFid = winnerResult.winnerId ? parseInt(winnerResult.winnerId.replace('player_', '')) : null;
        await supabase.from('matches').update({ status: 'completed', winner_fid: winnerFid, ended_at: new Date().toISOString() }).eq('id', match.id);
      }

      await supabase.from('game_states').update({
        edges: updatedEdges, possible_slices: updatedPossibleSlices, captured_slices: newCapturedSlices,
        moves_remaining: newMovesRemaining, updated_at: new Date().toISOString(),
      }).eq('match_id', match.id);

      const playerScore = newCapturedSlices.filter((s: PizzaSlice) => s.capturedBy === playerId).length;
      await supabase.from('match_players').update({ score: playerScore }).eq('match_id', match.id).eq('player_fid', playerFid);

      result = { edgeId, capturedSlices: newlyCompleted, extraTurn, movesRemaining: newMovesRemaining, gameOver: gameEnded, playerScore };
    } else if (moveType === 'end_turn') {
      const edges = gameState.edges as Edge[];
      const possibleSlices = gameState.possible_slices as PizzaSlice[];
      const capturedSlices = gameState.captured_slices as PizzaSlice[];
      const gameEnded = !hasRemainingSlices(possibleSlices, edges);

      if (gameEnded) {
        const players = match.match_players.map((mp: any) => ({ id: `player_${mp.player_fid}` }));
        const winnerResult = determineWinner(players, capturedSlices);
        const winnerFid = winnerResult.winnerId ? parseInt(winnerResult.winnerId.replace('player_', '')) : null;
        await supabase.from('matches').update({ status: 'completed', winner_fid: winnerFid, ended_at: new Date().toISOString() }).eq('id', match.id);
        result = { turnEnded: true, gameOver: true };
      } else {
        const nextPlayerIndex = (match.current_player_index + 1) % sortedPlayers.length;
        await supabase.from('matches').update({ current_player_index: nextPlayerIndex, turn_number: match.turn_number + 1 }).eq('id', match.id);
        await supabase.from('game_states').update({ dice_roll: null, moves_remaining: 0, updated_at: new Date().toISOString() }).eq('match_id', match.id);
        result = { turnEnded: true, gameOver: false, nextPlayerIndex };
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid move type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Log move
    await supabase.from('move_history').insert({ match_id: matchId, player_fid: playerFid, turn_number: match.turn_number, move_type: moveType, move_data: moveData || {} });

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Validate move error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
