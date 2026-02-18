// Types
export type NodeID = string;
export type EdgeID = string;
export type SliceID = string;
export type PlayerID = string;

export interface Node {
  id: NodeID;
  x: number;
  y: number;
}

export interface Edge {
  id: EdgeID;
  nodeA: NodeID;
  nodeB: NodeID;
  claimedBy: PlayerID | null;
}

export interface PizzaSlice {
  id: SliceID;
  edgeIds: [EdgeID, EdgeID, EdgeID];
  nodeIds: [NodeID, NodeID, NodeID];
  capturedBy: PlayerID | null;
}

// Generate a unique edge ID from two node IDs (order-independent)
export function getEdgeId(nodeA: NodeID, nodeB: NodeID): EdgeID {
  const sorted = [nodeA, nodeB].sort();
  return `edge_${sorted[0]}_${sorted[1]}`;
}

// Generate a unique slice ID from three node IDs (order-independent)
export function getSliceId(nodeA: NodeID, nodeB: NodeID, nodeC: NodeID): SliceID {
  const sorted = [nodeA, nodeB, nodeC].sort();
  return `slice_${sorted[0]}_${sorted[1]}_${sorted[2]}`;
}

// Create a square grid of nodes
export function createGrid(size: number, cellSize: number, padding: number): Node[] {
  const nodes: Node[] = [];
  for (let y = 0; y <= size; y++) {
    for (let x = 0; x <= size; x++) {
      nodes.push({
        id: `node_${x}_${y}`,
        x: padding + x * cellSize,
        y: padding + y * cellSize,
      });
    }
  }
  return nodes;
}

// Check if two nodes are adjacent (including diagonals)
export function areNodesAdjacent(nodeA: Node, nodeB: Node, cellSize: number): boolean {
  const dx = Math.abs(nodeA.x - nodeB.x);
  const dy = Math.abs(nodeA.y - nodeB.y);

  const isHorizontal = dx === cellSize && dy === 0;
  const isVertical = dx === 0 && dy === cellSize;
  const isDiagonal = dx === cellSize && dy === cellSize;

  return isHorizontal || isVertical || isDiagonal;
}

// Generate all possible edges for a grid
export function generateAllPossibleEdges(nodes: Node[], cellSize: number): Edge[] {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const nodeA of nodes) {
    for (const nodeB of nodes) {
      if (nodeA.id === nodeB.id) continue;

      if (areNodesAdjacent(nodeA, nodeB, cellSize)) {
        const edgeId = getEdgeId(nodeA.id, nodeB.id);
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            nodeA: nodeA.id,
            nodeB: nodeB.id,
            claimedBy: null,
          });
        }
      }
    }
  }

  return edges;
}

// Find all possible triangles (pizza slices) that can be formed
export function findAllPossibleSlices(nodes: Node[], edges: Edge[]): PizzaSlice[] {
  const slices: PizzaSlice[] = [];
  const sliceSet = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      for (let k = j + 1; k < nodes.length; k++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const nodeC = nodes[k];

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
            slices.push({
              id: sliceId,
              edgeIds: [edgeAB, edgeBC, edgeCA],
              nodeIds: [nodeA.id, nodeB.id, nodeC.id],
              capturedBy: null,
            });
          }
        }
      }
    }
  }

  return slices;
}

// Parse grid coordinates from a node ID like "node_3_2" → { x: 3, y: 2 }
function parseNodeCoords(nodeId: NodeID): { x: number; y: number } {
  const parts = nodeId.split('_');
  return { x: parseInt(parts[1]), y: parseInt(parts[2]) };
}

// Find the crossing diagonal edge ID for a given diagonal edge.
// In each grid cell, the \ and / diagonals visually cross.
// Returns null if the edge is not diagonal.
export function getCrossingDiagonal(edgeId: EdgeID, edges: Edge[]): EdgeID | null {
  const edge = edges.find(e => e.id === edgeId);
  if (!edge) return null;

  const a = parseNodeCoords(edge.nodeA);
  const b = parseNodeCoords(edge.nodeB);

  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx !== 1 || dy !== 1) return null;

  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);

  const crossA = `node_${minX + 1}_${minY}`;
  const crossB = `node_${minX}_${minY + 1}`;
  const crossId1 = getEdgeId(crossA, crossB);

  if (crossId1 === edgeId) {
    const bsA = `node_${minX}_${minY}`;
    const bsB = `node_${minX + 1}_${minY + 1}`;
    return getEdgeId(bsA, bsB);
  } else {
    return crossId1;
  }
}

// Check if an edge can still contribute to capturing an uncaptured slice.
// Returns false if every possible triangle containing this edge is already captured.
export function isEdgeUseful(edgeId: EdgeID, possibleSlices: PizzaSlice[]): boolean {
  return possibleSlices.some(slice =>
    slice.edgeIds.includes(edgeId) && slice.capturedBy === null
  );
}

// Check if a slice is completed (all three edges claimed)
export function isSliceCompleted(slice: PizzaSlice, edges: Edge[]): boolean {
  return slice.edgeIds.every(edgeId => {
    const edge = edges.find(e => e.id === edgeId);
    return edge && edge.claimedBy !== null;
  });
}

// Find newly completed slices after an edge is claimed
export function findNewlyCompletedSlices(
  newEdgeId: EdgeID,
  possibleSlices: PizzaSlice[],
  edges: Edge[]
): PizzaSlice[] {
  return possibleSlices.filter(slice => {
    if (!slice.edgeIds.includes(newEdgeId)) return false;
    if (slice.capturedBy !== null) return false;
    return isSliceCompleted(slice, edges);
  });
}

// Count available moves (unclaimed edges that aren't sealed or blocked by crossing diagonals)
export function countAvailableMoves(edges: Edge[], capturedSlices?: PizzaSlice[]): number {
  return edges.filter(e => {
    if (e.claimedBy !== null) return false;
    if (capturedSlices) {
      const isSealed = capturedSlices.some(s => s.edgeIds.includes(e.id));
      if (isSealed) return false;
    }
    // Block diagonals whose crossing diagonal is already claimed
    const crossingId = getCrossingDiagonal(e.id, edges);
    if (crossingId) {
      const crossingEdge = edges.find(ce => ce.id === crossingId);
      if (crossingEdge && crossingEdge.claimedBy !== null) return false;
    }
    return true;
  }).length;
}

// Check if any uncaptured slices can still be completed.
// Edges that belong to captured slices are considered sealed and unavailable.
export function hasRemainingSlices(possibleSlices: PizzaSlice[], edges: Edge[], capturedSlices?: PizzaSlice[]): boolean {
  // Build a set of sealed edge IDs (edges belonging to captured slices)
  const sealedEdges = new Set<string>();
  if (capturedSlices) {
    for (const slice of capturedSlices) {
      for (const edgeId of slice.edgeIds) {
        sealedEdges.add(edgeId);
      }
    }
  }

  // Build a set of blocked edge IDs (crossing diagonal is claimed)
  const blockedEdges = new Set<string>();
  for (const edge of edges) {
    if (edge.claimedBy !== null) {
      const crossingId = getCrossingDiagonal(edge.id, edges);
      if (crossingId) blockedEdges.add(crossingId);
    }
  }

  return possibleSlices.some(slice => {
    if (slice.capturedBy !== null) return false;
    // At least one edge must be unclaimed, not sealed, and not blocked by crossing diagonal
    return slice.edgeIds.some(edgeId => {
      const edge = edges.find(e => e.id === edgeId);
      return edge && edge.claimedBy === null && !sealedEdges.has(edgeId) && !blockedEdges.has(edgeId);
    });
  });
}

// Get player's score
export function getPlayerScore(playerId: string, capturedSlices: PizzaSlice[]): number {
  return capturedSlices.filter(s => s.capturedBy === playerId).length;
}

// Winner result with tie detection
export interface WinnerResult {
  winnerId: string | null;  // null if tied
  isTied: boolean;
  tiedPlayerIds: string[];
  maxScore: number;
}

// Determine the winner (detects ties instead of silently favoring first player)
export function determineWinner(
  players: { id: string }[],
  capturedSlices: PizzaSlice[]
): WinnerResult {
  if (players.length === 0) return { winnerId: null, isTied: false, tiedPlayerIds: [], maxScore: 0 };

  const scores = players.map(p => ({
    id: p.id,
    score: getPlayerScore(p.id, capturedSlices),
  }));

  const maxScore = Math.max(...scores.map(s => s.score));
  const topPlayers = scores.filter(s => s.score === maxScore);

  if (topPlayers.length === 1) {
    return { winnerId: topPlayers[0].id, isTied: false, tiedPlayerIds: [], maxScore };
  }

  // Tie detected
  return { winnerId: null, isTied: true, tiedPlayerIds: topPlayers.map(p => p.id), maxScore };
}

// Convenience helper for code that only needs the winner ID (non-tie case)
export function getWinnerId(result: WinnerResult): string | null {
  return result.winnerId;
}
