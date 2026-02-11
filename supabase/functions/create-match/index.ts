import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PLAYER_COLORS, ENTRY_TIERS, CELL_SIZE, PADDING } from '../_shared/constants.ts';
import {
  createGrid,
  generateAllPossibleEdges,
  findAllPossibleSlices,
} from '../_shared/gridUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Queue entries older than 5 minutes are considered stale
const STALE_ENTRY_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { tier, playerFid } = await req.json();
    console.log('[create-match] Request:', { tier, playerFid });

    // Validate inputs
    if (!tier || !playerFid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tier, playerFid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
    if (!tierConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this player is ALREADY matched to an active game (prevent duplicates)
    const recentThreshold = new Date(Date.now() - STALE_ENTRY_MS).toISOString();
    const { data: alreadyMatched } = await supabase
      .from('match_queue')
      .select('match_id')
      .eq('player_fid', playerFid)
      .eq('tier', tier)
      .eq('status', 'matched')
      .gte('joined_at', recentThreshold)
      .limit(1);

    if (alreadyMatched && alreadyMatched.length > 0 && alreadyMatched[0].match_id) {
      // Verify the match is still active
      const { data: matchData } = await supabase
        .from('matches')
        .select('id, status')
        .eq('id', alreadyMatched[0].match_id)
        .single();

      if (matchData && (matchData.status === 'active' || matchData.status === 'countdown')) {
        console.log('[create-match] Player already in active game:', matchData.id);
        return new Response(
          JSON.stringify({ matchId: matchData.id, alreadyMatched: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Stale match — cancel it
      console.log('[create-match] Cleaning stale matched entry:', alreadyMatched[0].match_id);
      await supabase
        .from('match_queue')
        .update({ status: 'cancelled' })
        .eq('match_id', alreadyMatched[0].match_id)
        .eq('status', 'matched');
    }

    // Verify this player is in queue, waiting, and ready
    const { data: callerEntry } = await supabase
      .from('match_queue')
      .select('id, is_ready')
      .eq('player_fid', playerFid)
      .eq('tier', tier)
      .eq('status', 'waiting')
      .gte('joined_at', recentThreshold)
      .order('joined_at', { ascending: false })
      .limit(1);

    if (!callerEntry || callerEntry.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Player not found in queue', waiting: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!callerEntry[0].is_ready) {
      return new Response(
        JSON.stringify({ error: 'Player is not ready (payment required)', waiting: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === SERVER-SIDE FIFO MATCHMAKING ===
    // Grab ALL ready, waiting, non-stale players in this tier, ordered by join time (FIFO)
    const { data: readyPlayers, error: queueError } = await supabase
      .from('match_queue')
      .select('id, player_fid, joined_at')
      .eq('tier', tier)
      .eq('status', 'waiting')
      .eq('is_ready', true)
      .gte('joined_at', recentThreshold)
      .order('joined_at', { ascending: true })
      .limit(tierConfig.maxPlayers);

    if (queueError) {
      throw new Error(`Failed to query queue: ${queueError.message}`);
    }

    console.log('[create-match] Ready players in queue:', readyPlayers?.length, readyPlayers?.map(p => p.player_fid));

    // Not enough players yet — tell the client to keep waiting
    if (!readyPlayers || readyPlayers.length < tierConfig.minPlayers) {
      console.log('[create-match] Not enough ready players:', readyPlayers?.length, '/', tierConfig.minPlayers);
      return new Response(
        JSON.stringify({ waiting: true, readyCount: readyPlayers?.length || 0, needed: tierConfig.minPlayers }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Make sure the calling player is in the batch (they should be since they're ready+waiting)
    const callerInBatch = readyPlayers.some(p => p.player_fid === playerFid);
    if (!callerInBatch) {
      console.log('[create-match] Caller not in FIFO batch — they may have been matched by another call');
      return new Response(
        JSON.stringify({ waiting: true, readyCount: readyPlayers.length, needed: tierConfig.minPlayers }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Take up to maxPlayers from the FIFO queue
    const matchPlayers = readyPlayers.slice(0, tierConfig.maxPlayers);
    const matchPlayerFids = matchPlayers.map(p => p.player_fid);
    const matchQueueIds = matchPlayers.map(p => p.id);

    console.log('[create-match] Creating match with players:', matchPlayerFids);

    // === ATOMIC MATCH CREATION ===
    // Step 1: Atomically claim these queue entries by setting status='matched'
    // Use a conditional update — only update entries that are still 'waiting'
    // This prevents two concurrent create-match calls from double-matching the same players
    const { data: claimedEntries, error: claimError } = await supabase
      .from('match_queue')
      .update({ status: 'matched' })
      .in('id', matchQueueIds)
      .eq('status', 'waiting')
      .eq('is_ready', true)
      .select('id, player_fid');

    if (claimError) {
      throw new Error(`Failed to claim queue entries: ${claimError.message}`);
    }

    // Check how many we actually claimed (another call may have grabbed some)
    if (!claimedEntries || claimedEntries.length < tierConfig.minPlayers) {
      console.log('[create-match] Race condition — only claimed', claimedEntries?.length, 'entries, need', tierConfig.minPlayers);
      // Release the ones we did claim
      if (claimedEntries && claimedEntries.length > 0) {
        await supabase
          .from('match_queue')
          .update({ status: 'waiting' })
          .in('id', claimedEntries.map(e => e.id));
      }
      return new Response(
        JSON.stringify({ waiting: true, readyCount: 0, needed: tierConfig.minPlayers }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the actually-claimed players (may be fewer than maxPlayers if some were grabbed)
    const finalPlayerFids = claimedEntries.map(e => e.player_fid);
    const finalQueueIds = claimedEntries.map(e => e.id);

    console.log('[create-match] Claimed', finalPlayerFids.length, 'players:', finalPlayerFids);

    // Step 2: Create the match
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
      // Release claimed entries
      await supabase
        .from('match_queue')
        .update({ status: 'waiting' })
        .in('id', finalQueueIds);
      throw new Error(`Failed to create match: ${matchError.message}`);
    }

    // Step 3: Initial dice roll-off to determine turn order
    // Each player rolls 1-6, highest goes first. Ties are re-rolled.
    const initialRolls: { fid: number; roll: number }[] = finalPlayerFids.map((fid: number) => ({
      fid,
      roll: Math.floor(Math.random() * 6) + 1,
    }));
    // Sort by roll descending (highest first). Ties broken by random (shuffle first)
    initialRolls.sort((a, b) => b.roll - a.roll);

    console.log('[create-match] Initial roll-off:', initialRolls);

    // Create match players with turn order based on roll-off
    const matchPlayersData = initialRolls.map((entry, index: number) => ({
      match_id: match.id,
      player_fid: entry.fid,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      player_index: index,
      is_bot: false,
      is_connected: true,
    }));

    const { error: playersError } = await supabase
      .from('match_players')
      .insert(matchPlayersData);

    if (playersError) {
      // Rollback: delete match and release queue entries
      await supabase.from('matches').delete().eq('id', match.id);
      await supabase
        .from('match_queue')
        .update({ status: 'waiting' })
        .in('id', finalQueueIds);
      throw new Error(`Failed to add players: ${playersError.message}`);
    }

    // Step 4: Initialize game state
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
      await supabase
        .from('match_queue')
        .update({ status: 'waiting' })
        .in('id', finalQueueIds);
      throw new Error(`Failed to create game state: ${stateError.message}`);
    }

    // Step 5: Set match_id on the claimed queue entries
    await supabase
      .from('match_queue')
      .update({ match_id: match.id })
      .in('id', finalQueueIds);

    // Step 6: Activate match immediately
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

    console.log('[create-match] Match created successfully:', match.id, 'players:', initialRolls.map(r => r.fid));
    return new Response(
      JSON.stringify({
        matchId: match.id,
        gridSize: tierConfig.gridSize,
        playerCount: finalPlayerFids.length,
        initialRolls, // { fid, roll }[] sorted by roll desc — first player goes first
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
