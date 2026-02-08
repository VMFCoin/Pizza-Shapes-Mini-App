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
      is_bot: false,
      is_connected: true,
    }));

    const { error: playersError } = await supabase
      .from('match_players')
      .insert(matchPlayersData);

    if (playersError) {
      // Rollback match creation
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
      // Rollback
      await supabase.from('matches').delete().eq('id', match.id);
      throw new Error(`Failed to create game state: ${stateError.message}`);
    }

    // Update queue entries to matched status
    const { error: queueError } = await supabase
      .from('match_queue')
      .update({ status: 'matched', match_id: match.id })
      .in('player_fid', playerFids)
      .eq('tier', tier)
      .eq('status', 'waiting');

    if (queueError) {
      console.error('Failed to update queue entries:', queueError);
      // Non-fatal error, continue
    }

    // Activate match immediately — setTimeout won't reliably run after
    // the response is sent in Deno edge functions
    const { error: activateError } = await supabase
      .from('matches')
      .update({
        status: 'active',
        started_at: new Date().toISOString(),
      })
      .eq('id', match.id)
      .eq('status', 'countdown');

    if (activateError) {
      console.error('Failed to activate match:', activateError);
    }

    return new Response(
      JSON.stringify({
        matchId: match.id,
        gridSize: tierConfig.gridSize,
        playerCount: playerFids.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Create match error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
