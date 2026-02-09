import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PLAYER_COLORS, ENTRY_TIERS, CELL_SIZE, PADDING, BOT_FID } from '../_shared/constants.ts';
import {
  createGrid,
  generateAllPossibleEdges,
  findAllPossibleSlices,
} from '../_shared/gridUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Only consider matched entries from the last 2 minutes as "active" (not stale)
const ACTIVE_MATCH_WINDOW_MS = 2 * 60 * 1000;

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

    const { tier, playerFids } = await req.json();
    console.log('[create-match] Request:', { tier, playerFids });

    // Validate tier
    const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
    if (!tierConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate player count
    if (!playerFids || playerFids.length < tierConfig.minPlayers) {
      return new Response(
        JSON.stringify({ error: 'Not enough players' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (playerFids.length > tierConfig.maxPlayers) {
      return new Response(
        JSON.stringify({ error: 'Too many players' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if any of these players were RECENTLY matched (prevent duplicate matches)
    // Only look at entries from the last 2 minutes — old matched entries are stale
    const recentThreshold = new Date(Date.now() - ACTIVE_MATCH_WINDOW_MS).toISOString();
    const { data: alreadyMatched } = await supabase
      .from('match_queue')
      .select('player_fid, match_id, joined_at')
      .in('player_fid', playerFids)
      .eq('tier', tier)
      .eq('status', 'matched')
      .gte('joined_at', recentThreshold)
      .limit(1);

    if (alreadyMatched && alreadyMatched.length > 0 && alreadyMatched[0].match_id) {
      // Verify the match is actually still active (not completed/abandoned)
      const { data: matchData } = await supabase
        .from('matches')
        .select('id, status')
        .eq('id', alreadyMatched[0].match_id)
        .single();

      if (matchData && (matchData.status === 'active' || matchData.status === 'countdown')) {
        console.log('[create-match] Already matched to active game:', matchData.id);
        return new Response(
          JSON.stringify({ matchId: matchData.id, alreadyMatched: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Match is completed/abandoned — cancel the stale queue entry and proceed
      console.log('[create-match] Stale matched entry found, cancelling:', alreadyMatched[0].match_id);
      await supabase
        .from('match_queue')
        .update({ status: 'cancelled' })
        .eq('match_id', alreadyMatched[0].match_id)
        .eq('status', 'matched');
    }

    // Cancel any stale waiting entries for these players in this tier
    // (in case they had old sessions that weren't cleaned up)
    const staleWaitingThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from('match_queue')
      .update({ status: 'cancelled' })
      .in('player_fid', playerFids)
      .eq('tier', tier)
      .eq('status', 'waiting')
      .lt('joined_at', staleWaitingThreshold);

    // Create the match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        tier,
        grid_size: tierConfig.gridSize,
        status: 'countdown',
      })
      .select()
      .single();

    if (matchError) {
      throw new Error(`Failed to create match: ${matchError.message}`);
    }

    // Create match players with assigned colors
    const matchPlayersData = playerFids.map((fid: number, index: number) => ({
      match_id: match.id,
      player_fid: fid,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      player_index: index,
      is_bot: fid === BOT_FID,
      is_connected: true,
    }));

    const { error: playersError } = await supabase
      .from('match_players')
      .insert(matchPlayersData);

    if (playersError) {
      await supabase.from('matches').delete().eq('id', match.id);
      throw new Error(`Failed to add players: ${playersError.message}`);
    }

    // Initialize game state
    const nodes = createGrid(tierConfig.gridSize, CELL_SIZE, PADDING);
    const edges = generateAllPossibleEdges(nodes, CELL_SIZE);
    const possibleSlices = findAllPossibleSlices(nodes, edges);

    const { error: stateError } = await supabase
      .from('game_states')
      .insert({
        match_id: match.id,
        nodes,
        edges,
        possible_slices: possibleSlices,
        captured_slices: [],
        dice_roll: null,
        moves_remaining: 0,
      });

    if (stateError) {
      await supabase.from('matches').delete().eq('id', match.id);
      throw new Error(`Failed to create game state: ${stateError.message}`);
    }

    // Update queue entries to matched status — only update RECENT waiting entries
    const { data: updatedQueue, error: queueError } = await supabase
      .from('match_queue')
      .update({ status: 'matched', match_id: match.id })
      .in('player_fid', playerFids)
      .eq('tier', tier)
      .eq('status', 'waiting')
      .select('id, player_fid, status, match_id');

    console.log('[create-match] Queue update result:', {
      updatedCount: updatedQueue?.length ?? 0,
      queueError: queueError?.message
    });

    if (queueError) {
      console.error('[create-match] Failed to update queue entries:', queueError);
    }

    // Activate match immediately
    const { error: activateError } = await supabase
      .from('matches')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', match.id)
      .eq('status', 'countdown');

    if (activateError) {
      console.error('[create-match] Failed to activate match:', activateError);
    }

    console.log('[create-match] Match created successfully:', match.id, 'players:', playerFids);
    return new Response(
      JSON.stringify({
        matchId: match.id,
        gridSize: tierConfig.gridSize,
        playerCount: playerFids.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-match] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
