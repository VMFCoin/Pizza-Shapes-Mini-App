'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  GameState,
  Player,
  Edge,
  PizzaSlice,
  PlayerID,
  EdgeID,
  MatchID,
  GamePhase,
  PLAYER_COLORS,
} from '@/types';
import {
  createGrid,
  generateAllPossibleEdges,
  findAllPossibleSlices,
  findNewlyCompletedSlices,
  getPlayerScore,
  determineWinner,
  hasRemainingSlices,
  countAvailableMoves,
} from '@/lib/gridUtils';

interface UseGameStateReturn {
  gameState: GameState | null;
  gamePhase: GamePhase;
  currentPlayer: Player | null;
  initializeGame: (matchId: MatchID, players: Player[], gridSize?: number) => void;
  rollDice: () => number;
  drawEdge: (edgeId: EdgeID) => { captured: PizzaSlice[]; extraTurn: boolean };
  endTurn: () => void;
  getScores: () => Record<PlayerID, number>;
  canDrawEdge: (edgeId: EdgeID) => boolean;
  isGameOver: boolean;
  winner: Player | null;
}

const CELL_SIZE = 60;
const PADDING = 40;

export function useGameState(): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');

  const initializeGame = useCallback(
    (matchId: MatchID, players: Player[], gridSize: number = 4) => {
      const nodes = createGrid(gridSize, CELL_SIZE, PADDING);
      const edges = generateAllPossibleEdges(nodes, CELL_SIZE);
      const possibleSlices = findAllPossibleSlices(nodes, edges);

      // Assign colors to players
      const coloredPlayers = players.map((player, index) => ({
        ...player,
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
      }));

      const newGameState: GameState = {
        matchId,
        players: coloredPlayers,
        currentPlayerIndex: 0,
        nodes,
        edges,
        possibleSlices,
        capturedSlices: [],
        diceRoll: null,
        movesRemaining: 0,
        turnNumber: 1,
        gameOver: false,
        winner: null,
      };

      setGameState(newGameState);
      setGamePhase('rolling');
    },
    []
  );

  const rollDice = useCallback((): number => {
    if (!gameState || gameState.gameOver) return 0;

    const roll = Math.floor(Math.random() * 6) + 1;
    const availableMoves = countAvailableMoves(gameState.edges);

    // If roll is higher than available moves, skip turn
    if (roll > availableMoves) {
      setGameState(prev => {
        if (!prev) return prev;
        const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
        return {
          ...prev,
          diceRoll: roll,
          movesRemaining: 0,
          currentPlayerIndex: nextPlayerIndex,
          turnNumber: prev.turnNumber + 1,
        };
      });
      setGamePhase('rolling');
      return roll;
    }

    setGameState(prev =>
      prev
        ? {
            ...prev,
            diceRoll: roll,
            movesRemaining: roll,
          }
        : prev
    );
    setGamePhase('drawing');
    return roll;
  }, [gameState]);

  const canDrawEdge = useCallback(
    (edgeId: EdgeID): boolean => {
      if (!gameState || gameState.gameOver) return false;
      if (gameState.movesRemaining <= 0) return false;

      const edge = gameState.edges.find(e => e.id === edgeId);
      return edge !== undefined && edge.claimedBy === null;
    },
    [gameState]
  );

  const drawEdge = useCallback(
    (edgeId: EdgeID): { captured: PizzaSlice[]; extraTurn: boolean } => {
      if (!gameState || !canDrawEdge(edgeId)) {
        return { captured: [], extraTurn: false };
      }

      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      let capturedSlices: PizzaSlice[] = [];
      let extraTurn = false;

      setGameState(prev => {
        if (!prev) return prev;

        // Update the edge
        const updatedEdges = prev.edges.map(edge =>
          edge.id === edgeId ? { ...edge, claimedBy: currentPlayer.id } : edge
        );

        // Find newly completed slices
        const newlyCompleted = findNewlyCompletedSlices(
          edgeId,
          prev.possibleSlices,
          updatedEdges
        );

        // Update possible slices with captures
        const updatedPossibleSlices = prev.possibleSlices.map(slice => {
          const isNewlyCompleted = newlyCompleted.some(nc => nc.id === slice.id);
          return isNewlyCompleted ? { ...slice, capturedBy: currentPlayer.id } : slice;
        });

        // Add to captured slices
        const newCapturedSlices = [
          ...prev.capturedSlices,
          ...newlyCompleted.map(slice => ({ ...slice, capturedBy: currentPlayer.id })),
        ];

        capturedSlices = newlyCompleted;
        extraTurn = newlyCompleted.length > 0;

        const newMovesRemaining = prev.movesRemaining - 1;

        // Check game end condition
        const gameEnded = !hasRemainingSlices(updatedPossibleSlices, updatedEdges);
        const winnerId = gameEnded
          ? determineWinner(prev.players, newCapturedSlices)
          : null;

        return {
          ...prev,
          edges: updatedEdges,
          possibleSlices: updatedPossibleSlices,
          capturedSlices: newCapturedSlices,
          movesRemaining: extraTurn ? newMovesRemaining + 1 : newMovesRemaining,
          gameOver: gameEnded,
          winner: winnerId,
        };
      });

      if (capturedSlices.length > 0) {
        setGamePhase('capturing');
        setTimeout(() => {
          if (gameState?.gameOver) {
            setGamePhase('gameOver');
          } else {
            setGamePhase('drawing');
          }
        }, 1000);
      }

      return { captured: capturedSlices, extraTurn };
    },
    [gameState, canDrawEdge]
  );

  const endTurn = useCallback(() => {
    if (!gameState || gameState.gameOver) return;

    setGameState(prev => {
      if (!prev) return prev;

      // Check game end condition
      if (!hasRemainingSlices(prev.possibleSlices, prev.edges)) {
        const winnerId = determineWinner(prev.players, prev.capturedSlices);
        return {
          ...prev,
          gameOver: true,
          winner: winnerId,
          movesRemaining: 0,
          diceRoll: null,
        };
      }

      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      return {
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        movesRemaining: 0,
        diceRoll: null,
        turnNumber: prev.turnNumber + 1,
      };
    });

    setGamePhase('rolling');
  }, [gameState]);

  const getScores = useCallback((): Record<PlayerID, number> => {
    if (!gameState) return {};

    const scores: Record<PlayerID, number> = {};
    for (const player of gameState.players) {
      scores[player.id] = getPlayerScore(player.id, gameState.capturedSlices);
    }
    return scores;
  }, [gameState]);

  const currentPlayer = useMemo(() => {
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex];
  }, [gameState]);

  const isGameOver = gameState?.gameOver ?? false;

  const winner = useMemo(() => {
    if (!gameState || !gameState.winner) return null;
    return gameState.players.find(p => p.id === gameState.winner) ?? null;
  }, [gameState]);

  return {
    gameState,
    gamePhase,
    currentPlayer,
    initializeGame,
    rollDice,
    drawEdge,
    endTurn,
    getScores,
    canDrawEdge,
    isGameOver,
    winner,
  };
}

// Hook interface for external use
export interface UseGameState {
  players: PlayerID[];
  currentPlayer: PlayerID;
  rollDice: () => number;
  drawEdge: (edgeId: EdgeID) => void;
  gameOver: boolean;
  capturedSlices: Record<PlayerID, number>;
}
