import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BOT_FID, BOT_DISPLAY_NAME, PLAYER_COLORS, ENTRY_TIERS, CELL_SIZE, PADDING } from '../_shared/constants.ts';
import {
  createGrid,
  generateAllPossibleEdges,
  findAllPossibleSlices,
} from '../_shared/gridUtils.ts';

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

    const { tier, humanFid } = await req.json();

    if (!tier || !humanFid) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tier, humanFid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tier
    const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
    if (!tierConfig) {
      return new Response(
        JSON.stringify({ error: 'Invalid tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify human is in queue and ready
    const { data: humanEntry, error: queueError } = await supabase
      .from('match_queue')
      .select('id, is_ready')
      .eq('player_fid', humanFid)
      .eq('tier', tier)
      .eq('status', 'waiting')
      .order('joined_at', { ascending: false })
      .limit(1)
      .single();

    if (queueError || !humanEntry) {
      return new Response(
        JSON.stringify({ error: 'Human player not found in queue' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!humanEntry.is_ready) {
      return new Response(
        JSON.stringify({ error: 'Human player is not ready' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert bot player into players table
    await supabase
      .from('players')
      .upsert({
        fid: BOT_FID,
        display_name: BOT_DISPLAY_NAME,
        pfp_url: '',
        address: '0x0000000000000000000000000000000000000000',
        username: 'pizza_bot',
      }, { onConflict: 'fid' });

    // Create the match directly (inline, since we need bot-specific handling)
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        tier,
        grid_size: tierConfig.gridSize,
        status: 'countdown',
      })
      .select()
      .single();

    if (matchError || !match) {
      throw new Error(`Failed to create match: ${matchError?.message}`);
    }

    // Create match players — human first, then bot
    const playerFids = [humanFid, BOT_FID];
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

    // Update human's queue entry to matched
    await supabase
      .from('match_queue')
      .update({ status: 'matched', match_id: match.id })
      .eq('id', humanEntry.id);

    // Activate match after brief countdown
    setTimeout(async () => {
      try {
        await supabase
          .from('matches')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
          })
          .eq('id', match.id)
          .eq('status', 'countdown');
      } catch (err) {
        console.error('Failed to activate match:', err);
      }
    }, 3000);

    return new Response(
      JSON.stringify({
        matchId: match.id,
        gridSize: tierConfig.gridSize,
        playerCount: 2,
        hasBot: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Add bot player error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
