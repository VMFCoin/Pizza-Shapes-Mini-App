'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Node, Edge, PizzaSlice, Player, NodeID } from '@/types';
import { getEdgeCoordinates, getSlicePath, getSliceCenter } from '@/lib/gridUtils';

interface SquareGridProps {
  nodes: Node[];
  edges: Edge[];
  capturedSlices: PizzaSlice[];
  players: Player[];
  currentPlayerId: string;
  onEdgeClick: (edgeId: string) => void;
  canDrawEdge: (edgeId: string) => boolean;
  gridSize: number;
}

export function SquareGrid({
  nodes,
  edges,
  capturedSlices,
  players,
  currentPlayerId,
  onEdgeClick,
  canDrawEdge,
  gridSize,
}: SquareGridProps) {
  const [selectedNode, setSelectedNode] = useState<NodeID | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  // Calculate SVG dimensions
  const cellSize = 60;
  const padding = 40;
  const svgWidth = gridSize * cellSize + padding * 2;
  const svgHeight = gridSize * cellSize + padding * 2;

  // Get player color by ID
  const getPlayerColor = useCallback((playerId: string | null) => {
    if (!playerId) return '#666';
    const player = players.find(p => p.id === playerId);
    return player?.color || '#666';
  }, [players]);

  // Current player color
  const currentPlayerColor = getPlayerColor(currentPlayerId);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: NodeID) => {
    if (selectedNode === null) {
      setSelectedNode(nodeId);
    } else if (selectedNode === nodeId) {
      setSelectedNode(null);
    } else {
      // Try to find and draw edge between nodes
      const edgeId = edges.find(e =>
        (e.nodeA === selectedNode && e.nodeB === nodeId) ||
        (e.nodeA === nodeId && e.nodeB === selectedNode)
      )?.id;

      if (edgeId && canDrawEdge(edgeId)) {
        onEdgeClick(edgeId);
        setSelectedNode(null);
      } else {
        // Edge not drawable — switch selection to the tapped node so user can try a different pair
        setSelectedNode(nodeId);
      }
    }
  }, [selectedNode, edges, canDrawEdge, onEdgeClick]);

  // Render captured slices
  const renderedSlices = useMemo(() => {
    return capturedSlices.map(slice => {
      const path = getSlicePath(slice, nodes);
      const center = getSliceCenter(slice, nodes);
      const color = getPlayerColor(slice.capturedBy);

      return (
        <motion.g key={slice.id}>
          <motion.path
            d={path}
            fill={color}
            fillOpacity={0.3}
            stroke={color}
            strokeWidth={2}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: "backOut" }}
            style={{ transformOrigin: `${center.x}px ${center.y}px` }}
          />
          {/* Pizza emoji at center */}
          <motion.text
            x={center.x}
            y={center.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={16}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
          >
            🍕
          </motion.text>
        </motion.g>
      );
    });
  }, [capturedSlices, nodes, getPlayerColor]);

  // Compute which edges connect to the selected node and can be drawn
  const drawableFromSelected = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>();
    for (const edge of edges) {
      if ((edge.nodeA === selectedNode || edge.nodeB === selectedNode) && canDrawEdge(edge.id)) {
        set.add(edge.id);
      }
    }
    return set;
  }, [selectedNode, edges, canDrawEdge]);

  // Render edges
  const renderedEdges = useMemo(() => {
    return edges.map(edge => {
      const coords = getEdgeCoordinates(edge, nodes);
      if (!coords) return null;

      const isClaimed = edge.claimedBy !== null;
      const isHovered = hoveredEdge === edge.id;
      const canDraw = canDrawEdge(edge.id);
      const isDrawableFromSelected = drawableFromSelected.has(edge.id);
      const color = isClaimed ? getPlayerColor(edge.claimedBy) : currentPlayerColor;

      return (
        <motion.line
          key={edge.id}
          x1={coords.x1}
          y1={coords.y1}
          x2={coords.x2}
          y2={coords.y2}
          stroke={isClaimed ? color : (isHovered && canDraw) || isDrawableFromSelected ? color : '#444'}
          strokeWidth={isClaimed ? 4 : (isHovered && canDraw) || isDrawableFromSelected ? 3 : 1}
          strokeLinecap="round"
          opacity={isClaimed ? 1 : isDrawableFromSelected ? 0.6 : isHovered && canDraw ? 0.8 : 0.3}
          className={canDraw && !isClaimed ? 'cursor-pointer' : ''}
          onClick={() => canDraw && !isClaimed && onEdgeClick(edge.id)}
          onMouseEnter={() => setHoveredEdge(edge.id)}
          onMouseLeave={() => setHoveredEdge(null)}
          initial={isClaimed ? { pathLength: 0 } : {}}
          animate={isClaimed ? { pathLength: 1 } : {}}
          transition={{ duration: 0.3 }}
        />
      );
    });
  }, [edges, nodes, hoveredEdge, canDrawEdge, drawableFromSelected, getPlayerColor, currentPlayerColor, onEdgeClick]);

  // Compute which nodes are connectable from the selected node
  const connectableNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>();
    for (const edge of edges) {
      if (canDrawEdge(edge.id)) {
        if (edge.nodeA === selectedNode) set.add(edge.nodeB);
        if (edge.nodeB === selectedNode) set.add(edge.nodeA);
      }
    }
    return set;
  }, [selectedNode, edges, canDrawEdge]);

  // Render nodes (dots)
  const renderedNodes = useMemo(() => {
    return nodes.map(node => {
      const isSelected = selectedNode === node.id;
      const isConnectable = connectableNodes.has(node.id);

      return (
        <motion.circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={isSelected ? 10 : isConnectable ? 9 : 8}
          fill={isSelected ? currentPlayerColor : isConnectable ? `${currentPlayerColor}80` : '#fff'}
          stroke={isSelected || isConnectable ? currentPlayerColor : '#333'}
          strokeWidth={isSelected || isConnectable ? 3 : 2}
          className="cursor-pointer"
          onClick={() => handleNodeClick(node.id)}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          animate={isSelected ? {
            boxShadow: `0 0 20px ${currentPlayerColor}`,
          } : isConnectable ? {
            scale: [1, 1.1, 1],
          } : {}}
          transition={isConnectable ? { duration: 1, repeat: Infinity } : undefined}
        />
      );
    });
  }, [nodes, selectedNode, connectableNodes, currentPlayerColor, handleNodeClick]);

  return (
    <div
      className="relative p-2 rounded-3xl"
      style={{
        background: 'linear-gradient(145deg, rgba(30, 30, 50, 0.95), rgba(20, 20, 35, 0.98))',
        border: '3px solid rgba(78, 205, 196, 0.4)',
        boxShadow: `
          0 0 30px rgba(78, 205, 196, 0.2),
          0 0 60px rgba(78, 205, 196, 0.1),
          inset 0 0 30px rgba(0, 0, 0, 0.5),
          0 10px 40px rgba(0, 0, 0, 0.6)
        `,
      }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        className="rounded-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(26, 26, 46, 0.9), rgba(15, 15, 30, 0.95))',
        }}
      >
        {/* Background grid pattern */}
        <defs>
          <pattern
            id="grid-pattern"
            width={cellSize}
            height={cellSize}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${padding}, ${padding})`}
          >
            <rect width={cellSize} height={cellSize} fill="none" stroke="#333" strokeWidth={0.5} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" opacity={0.3} />

        {/* Captured slices (render first, behind edges) */}
        <AnimatePresence>
          {renderedSlices}
        </AnimatePresence>

        {/* Edges */}
        {renderedEdges}

        {/* Nodes */}
        {renderedNodes}

        {/* Connection preview line when node is selected */}
        {selectedNode && (
          <motion.circle
            cx={nodes.find(n => n.id === selectedNode)?.x}
            cy={nodes.find(n => n.id === selectedNode)?.y}
            r={15}
            fill="none"
            stroke={currentPlayerColor}
            strokeWidth={2}
            strokeDasharray="4 4"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: 360 }}
            transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" } }}
          />
        )}
      </svg>

      {/* Instructions overlay */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 px-3 py-1 rounded-full"
        >
          <p className="text-xs text-white">Tap another dot to connect</p>
        </motion.div>
      )}
    </div>
  );
}
