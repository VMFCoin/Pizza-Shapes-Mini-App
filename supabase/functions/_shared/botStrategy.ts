/**
 * Bot Strategy Module for Pizza Shapes
 *
 * Implements intelligent Dots-and-Boxes strategy adapted for triangle grids:
 * 1. Always capture triangles when possible (greedy)
 * 2. Prefer safe moves that don't set up opponent captures
 * 3. When forced to set up, minimize chain length for opponent
 */

import { Edge, PizzaSlice, EdgeID, getCrossingDiagonal } from './gridUtils.ts';

/**
 * Choose the best edge to claim using strategic scoring.
 * Returns null if no edges are available.
 */
export function chooseBestEdge(
  edges: Edge[],
  possibleSlices: PizzaSlice[],
  _botPlayerId: string,
  capturedSlices?: PizzaSlice[]
): EdgeID | null {
  // Build set of sealed edges (edges belonging to captured slices)
  const sealedEdges = new Set<string>();
  if (capturedSlices) {
    for (const slice of capturedSlices) {
      for (const edgeId of slice.edgeIds) {
        sealedEdges.add(edgeId);
      }
    }
  }

  const availableEdges = edges.filter(e => {
    if (e.claimedBy !== null) return false;
    if (sealedEdges.has(e.id)) return false;
    // Block diagonals whose crossing diagonal is already claimed
    const crossingId = getCrossingDiagonal(e.id, edges);
    if (crossingId) {
      const crossingEdge = edges.find(ce => ce.id === crossingId);
      if (crossingEdge && crossingEdge.claimedBy !== null) return false;
    }
    return true;
  });
  if (availableEdges.length === 0) return null;

  let bestEdgeId: EdgeID | null = null;
  let bestScore = -Infinity;

  for (const edge of availableEdges) {
    const score = scoreEdge(edge.id, edges, possibleSlices);
    if (score > bestScore) {
      bestScore = score;
      bestEdgeId = edge.id;
    }
  }

  return bestEdgeId;
}

/**
 * Score an edge based on strategic value.
 * Higher score = better move.
 */
function scoreEdge(
  edgeId: EdgeID,
  edges: Edge[],
  possibleSlices: PizzaSlice[]
): number {
  const adjacentSlices = getAdjacentUncapturedSlices(edgeId, possibleSlices);

  let completions = 0;
  let setups = 0;

  for (const slice of adjacentSlices) {
    const remaining = countRemainingEdgesAfterClaim(slice, edgeId, edges);

    if (remaining === 0) {
      // This edge completes the triangle — instant capture!
      completions++;
    } else if (remaining === 1) {
      // After claiming, opponent can complete this triangle in one move
      setups++;
    }
    // remaining >= 2 is safe — opponent needs 2+ moves to complete
  }

  let score = 0;

  if (completions > 0) {
    // Heavily prioritize captures (each capture also gives an extra turn)
    score = 10000 + completions * 1000;
  } else if (setups === 0) {
    // Safe move — no triangles become completable by opponent
    score = 500;
  } else {
    // Forced to give opponent captures — minimize damage
    // Use chain awareness to pick the least damaging setup
    const chainLength = countChainLength(edgeId, edges, possibleSlices);
    score = -(setups * 100) - (chainLength * 50);
  }

  // Small random factor for variety so bot doesn't play identically each game
  score += Math.random() * 10;

  return score;
}

/**
 * Get all uncaptured slices that include the given edge.
 */
function getAdjacentUncapturedSlices(
  edgeId: EdgeID,
  possibleSlices: PizzaSlice[]
): PizzaSlice[] {
  return possibleSlices.filter(
    slice => slice.capturedBy === null && slice.edgeIds.includes(edgeId)
  );
}

/**
 * Count how many unclaimed edges remain in a slice AFTER claiming the given edge.
 */
function countRemainingEdgesAfterClaim(
  slice: PizzaSlice,
  claimedEdgeId: EdgeID,
  edges: Edge[]
): number {
  let remaining = 0;
  for (const eid of slice.edgeIds) {
    if (eid === claimedEdgeId) continue; // This one is being claimed
    const edge = edges.find(e => e.id === eid);
    if (edge && edge.claimedBy === null) {
      remaining++;
    }
  }
  return remaining;
}

/**
 * Count how many sequential captures the opponent could chain
 * if we claim this edge (creating a setup).
 *
 * A chain occurs when completing one triangle leaves another adjacent
 * triangle with exactly 1 remaining edge, allowing consecutive captures.
 */
function countChainLength(
  edgeId: EdgeID,
  edges: Edge[],
  possibleSlices: PizzaSlice[]
): number {
  // Simulate claiming this edge
  const simEdges = edges.map(e =>
    e.id === edgeId ? { ...e, claimedBy: 'sim' } : e
  );

  // Find triangles that now have exactly 1 unclaimed edge (vulnerable)
  const vulnerable = possibleSlices.filter(slice => {
    if (slice.capturedBy !== null) return false;
    const unclaimed = slice.edgeIds.filter(eid => {
      const edge = simEdges.find(e => e.id === eid);
      return edge && edge.claimedBy === null;
    });
    return unclaimed.length === 1;
  });

  // BFS to count chain — each vulnerable triangle, when completed,
  // may make another adjacent triangle vulnerable
  const visited = new Set<string>();
  const queue = [...vulnerable];
  let chainLength = 0;

  // Work on a mutable copy for chain simulation
  const chainEdges = simEdges.map(e => ({ ...e }));

  while (queue.length > 0) {
    const slice = queue.shift()!;
    if (visited.has(slice.id)) continue;
    visited.add(slice.id);
    chainLength++;

    // Find the last unclaimed edge of this triangle
    const lastEdgeId = slice.edgeIds.find(eid => {
      const edge = chainEdges.find(e => e.id === eid);
      return edge && edge.claimedBy === null;
    });

    if (!lastEdgeId) continue;

    // Simulate claiming it (opponent completes this triangle)
    const lastEdge = chainEdges.find(e => e.id === lastEdgeId);
    if (lastEdge) lastEdge.claimedBy = 'sim_chain';

    // Check if completing this creates more vulnerable triangles
    const newVulnerable = possibleSlices.filter(s => {
      if (visited.has(s.id)) return false;
      if (s.capturedBy !== null) return false;
      if (!s.edgeIds.includes(lastEdgeId)) return false;
      const unclaimed = s.edgeIds.filter(eid => {
        const edge = chainEdges.find(e => e.id === eid);
        return edge && edge.claimedBy === null;
      });
      return unclaimed.length === 1;
    });

    queue.push(...newVulnerable);
  }

  return chainLength;
}
