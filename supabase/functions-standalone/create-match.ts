// STANDALONE EDGE FUNCTION: create-match
// Copy this entire file into Supabase Dashboard > Edge Functions > New Function
// Name it: create-match

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============ SHARED CONSTANTS ============
const PLAYER_COLORS = [
  '#FF6B35', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA',
];

const ENTRY_TIERS = [
  { id: 1, amount: 0.25, label: '$0.25', description: '4x4 Beginner', gridSize: 4, minPlayers: 2, maxPlayers: 2 },
  { id: 2, amount: 0.50, label: '$0.50', description: '6x6 Board', gridSize: 6, minPlayers: 2, maxPlayers: 4 },
  { id: 3, amount: 1.00, label: '$1.00', description: '8x8 Board', gridSize: 8, minPlayers: 2, maxPlayers: 6 },
];

const CELL_SIZE = 60;
const PADDING = 40;

// ============ SHARED GRID UTILS ============
type NodeID = string;
type EdgeID = string;
type SliceID = string;

interface Node { id: NodeID; x: number; y: number; }
interface Edge { id: EdgeID; nodeA: NodeID; nodeB: NodeID; claimedBy: string | null; }
interface PizzaSlice { id: SliceID; edgeIds: [EdgeID, EdgeID, EdgeID]; nodeIds: [NodeID, NodeID, NodeID]; capturedBy: string | null; }

function getEdgeId(nodeA: NodeID, nodeB: NodeID): EdgeID {
  const sorted = [nodeA, nodeB].sort();
  return `edge_${sorted[0]}_${sorted[1]}`;
}

function getSliceId(nodeA: NodeID, nodeB: NodeID, nodeC: NodeID): SliceID {
  const sorted = [nodeA, nodeB, nodeC].sort();
  return `slice_${sorted[0]}_${sorted[1]}_${sorted[2]}`;
}

function createGrid(size: number, cellSize: number, padding: number): Node[] {
  const nodes: Node[] = [];
  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      nodes.push({ id: `node_${x}_${y}`, x: padding + x * cellSize, y: padding + y * cellSize });
    }
  }
  return nodes;
}

function areNodesAdjacent(nodeA: Node, nodeB: Node, cellSize: number): boolean {
  const dx = Math.abs(nodeA.x - nodeB.x);
  const dy = Math.abs(nodeA.y - nodeB.y);
  return (dx === cellSize && dy === 0) || (dx === 0 && dy === cellSize) || (dx === cellSize && dy === cellSize);
}

function generateAllPossibleEdges(nodes: Node[], cellSize: number): Edge[] {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();
  for (const nodeA of nodes) {
    for (const nodeB of nodes) {
      if (nodeA.id === nodeB.id) continue;
      if (areNodesAdjacent(nodeA, nodeB, cellSize)) {
        const edgeId = getEdgeId(nodeA.id, nodeB.id);
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({ id: edgeId, nodeA: nodeA.id, nodeB: nodeB.id, claimedBy: null });
        }
      }
    }
  }
  return edges;
}

function findAllPossibleSlices(nodes: Node[], edges: Edge[]): PizzaSlice[] {
  const slices: PizzaSlice[] = [];
  const sliceSet = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      for (let k = j + 1; k < nodes.length; k++) {
        const nodeA = nodes[i], nodeB = nodes[j], nodeC = nodes[k];
        const edgeAB = getEdgeId(nodeA.id, nodeB.id);
        const edgeBC = getEdgeId(nodeB.id, nodeC.id);
        const edgeCA = getEdgeId(nodeC.id, nodeA.id);
        const hasAB = edges.some(e => e.id === edgeAB);
        const hasBC = edges.some(e => e.id === edgeBC);
        const hasCA = edges.some(e => e.id === edgeCA);
        if (hasAB && hasBC && hasCA) {
          const sliceId = getSliceId(nodeA.id, nodeB.id, nodeC.id);
          if (!sliceSet.has(sliceId)) {
            sliceSet.add(sliceId);
            slices.push({ id: sliceId, edgeIds: [edgeAB, edgeBC, edgeCA], nodeIds: [nodeA.id, nodeB.id, nodeC.id], capturedBy: null });
          }
        }
      }
    }
  }
  return slices;
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

    const { tier, playerFids } = await req.json();

    const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
    if (!tierConfig) {
      return new Response(JSON.stringify({ error: 'Invalid tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!playerFids || playerFids.length < tierConfig.minPlayers) {
      return new Response(JSON.stringify({ error: 'Not enough players' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({ tier, grid_size: tierConfig.gridSize, status: 'countdown' })
      .select()
      .single();

    if (matchError) throw new Error(`Failed to create match: ${matchError.message}`);

    // Create match players
    const matchPlayersData = playerFids.map((fid: number, index: number) => ({
      match_id: match.id,
      player_fid: fid,
      color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      player_index: index,
      is_bot: false,
      is_connected: true,
    }));

    const { error: playersError } = await supabase.from('match_players').insert(matchPlayersData);
    if (playersError) {
      await supabase.from('matches').delete().eq('id', match.id);
      throw new Error(`Failed to add players: ${playersError.message}`);
    }

    // Initialize game state
    const nodes = createGrid(tierConfig.gridSize, CELL_SIZE, PADDING);
    const edges = generateAllPossibleEdges(nodes, CELL_SIZE);
    const possibleSlices = findAllPossibleSlices(nodes, edges);

    const { error: stateError } = await supabase.from('game_states').insert({
      match_id: match.id, nodes, edges, possible_slices: possibleSlices,
      captured_slices: [], dice_roll: null, moves_remaining: 0,
    });

    if (stateError) {
      await supabase.from('matches').delete().eq('id', match.id);
      throw new Error(`Failed to create game state: ${stateError.message}`);
    }

    // Update queue
    await supabase.from('match_queue')
      .update({ status: 'matched', match_id: match.id })
      .in('player_fid', playerFids)
      .eq('tier', tier)
      .eq('status', 'waiting');

    // Start match after countdown
    setTimeout(async () => {
      await supabase.from('matches')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', match.id)
        .eq('status', 'countdown');
    }, 5000);

    return new Response(JSON.stringify({ matchId: match.id, gridSize: tierConfig.gridSize, playerCount: playerFids.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Create match error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
