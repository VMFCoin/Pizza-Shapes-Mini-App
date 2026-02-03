/**
 * Triangle Detection Algorithm for Pizza Dots
 *
 * Detects newly formed triangles when an edge is added between two nodes.
 * Uses adjacency list for efficient lookup.
 */

export type NodeId = string;
export type TriangleId = string;

/**
 * Detect triangles formed by adding edge (a, b)
 *
 * @param a First node of the new edge
 * @param b Second node of the new edge
 * @param adjacency Map of node -> connected nodes
 * @param captured Set of already captured triangle IDs
 * @returns Array of newly formed triangle IDs
 */
export function detectTriangles(
  a: NodeId,
  b: NodeId,
  adjacency: Map<NodeId, Set<NodeId>>,
  captured: Set<TriangleId>
): TriangleId[] {
  const triangles: TriangleId[] = [];

  // Get neighbors of both nodes
  const neighborsA = adjacency.get(a) ?? new Set();
  const neighborsB = adjacency.get(b) ?? new Set();

  // Find common neighbors - these form triangles with (a, b)
  for (const c of neighborsA) {
    if (neighborsB.has(c)) {
      // Triangle found: (a, b, c)
      const id = createTriangleId(a, b, c);
      if (!captured.has(id)) {
        triangles.push(id);
      }
    }
  }

  return triangles;
}

/**
 * Create a canonical triangle ID from three nodes
 * Sorted to ensure same triangle always has same ID
 */
export function createTriangleId(a: NodeId, b: NodeId, c: NodeId): TriangleId {
  return [a, b, c].sort().join("-");
}

/**
 * Parse triangle ID back to node IDs
 */
export function parseTriangleId(id: TriangleId): [NodeId, NodeId, NodeId] {
  const parts = id.split("-");
  return [parts[0], parts[1], parts[2]];
}

/**
 * Build adjacency list from edges
 */
export function buildAdjacencyList(
  edges: Array<{ nodeA: NodeId; nodeB: NodeId; claimed: boolean }>
): Map<NodeId, Set<NodeId>> {
  const adjacency = new Map<NodeId, Set<NodeId>>();

  for (const edge of edges) {
    if (!edge.claimed) continue;

    if (!adjacency.has(edge.nodeA)) {
      adjacency.set(edge.nodeA, new Set());
    }
    if (!adjacency.has(edge.nodeB)) {
      adjacency.set(edge.nodeB, new Set());
    }

    adjacency.get(edge.nodeA)!.add(edge.nodeB);
    adjacency.get(edge.nodeB)!.add(edge.nodeA);
  }

  return adjacency;
}

/**
 * Find all possible triangles in a grid
 * Used for pre-computing capturable slices
 */
export function findAllPossibleTriangles(
  nodes: Array<{ id: NodeId; x: number; y: number }>,
  edges: Array<{ id: string; nodeA: NodeId; nodeB: NodeId }>
): TriangleId[] {
  const triangles: TriangleId[] = [];
  const triangleSet = new Set<TriangleId>();

  // Build edge lookup
  const edgeExists = new Set<string>();
  for (const edge of edges) {
    const key1 = `${edge.nodeA}-${edge.nodeB}`;
    const key2 = `${edge.nodeB}-${edge.nodeA}`;
    edgeExists.add(key1);
    edgeExists.add(key2);
  }

  // Check all combinations of 3 nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      for (let k = j + 1; k < nodes.length; k++) {
        const a = nodes[i].id;
        const b = nodes[j].id;
        const c = nodes[k].id;

        // Check if all three edges exist
        const hasAB = edgeExists.has(`${a}-${b}`);
        const hasBC = edgeExists.has(`${b}-${c}`);
        const hasCA = edgeExists.has(`${c}-${a}`);

        if (hasAB && hasBC && hasCA) {
          const id = createTriangleId(a, b, c);
          if (!triangleSet.has(id)) {
            triangleSet.add(id);
            triangles.push(id);
          }
        }
      }
    }
  }

  return triangles;
}

/**
 * Calculate triangle centroid for rendering
 */
export function getTriangleCentroid(
  triangleId: TriangleId,
  nodePositions: Map<NodeId, { x: number; y: number }>
): { x: number; y: number } {
  const [a, b, c] = parseTriangleId(triangleId);

  const posA = nodePositions.get(a)!;
  const posB = nodePositions.get(b)!;
  const posC = nodePositions.get(c)!;

  return {
    x: (posA.x + posB.x + posC.x) / 3,
    y: (posA.y + posB.y + posC.y) / 3,
  };
}
