'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SquareGrid,
  Dice,
  PlayerCard,
  PlayerCardCompact,
  CaptureNotification,
  WalletDisplayCompact,
  Confetti,
  Background,
} from '@/components';
import { useGameState, useWallet, useFarcaster } from '@/hooks';
import { Player, PizzaSlice, PLAYER_COLORS } from '@/types';

export default function GamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId') || 'demo_match';
  const tier = searchParams.get('tier') || '1';

  const { balance } = useWallet();
  const { context, viewToken, viewProfile, shareCaptureStreak } = useFarcaster();

  const {
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
  } = useGameState();

  const [isRolling, setIsRolling] = useState(false);
  const [captureNotification, setCaptureNotification] = useState<{
    playerName: string;
    playerColor: string;
    sliceCount: number;
  } | null>(null);
  const [captureStreak, setCaptureStreak] = useState(0);

  // Initialize game on mount
  useEffect(() => {
    if (!gameState && context) {
      // Create players (current player + demo opponents)
      const players: Player[] = [
        {
          id: `player_${context.fid}`,
          fid: context.fid,
          displayName: context.displayName,
          pfpUrl: context.pfpUrl,
          address: '',
          color: PLAYER_COLORS[0],
        },
        {
          id: 'bot_1',
          fid: 100001,
          displayName: 'PizzaBot',
          pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=bot1',
          address: '',
          color: PLAYER_COLORS[1],
        },
      ];

      initializeGame(matchId, players, 4);
    }
  }, [gameState, context, matchId, initializeGame]);

  // Navigate to game over when game ends
  useEffect(() => {
    if (isGameOver && winner) {
      setTimeout(() => {
        router.push(`/game-over?matchId=${matchId}&winner=${winner}`);
      }, 2000);
    }
  }, [isGameOver, winner, matchId, router]);

  // Auto-end turn when no moves remaining (and in drawing phase)
  useEffect(() => {
    if (gameState && gamePhase === 'drawing' && gameState.movesRemaining === 0 && !isGameOver) {
      const timer = setTimeout(() => {
        endTurn();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState, gamePhase, isGameOver, endTurn]);

  const handleRoll = useCallback(() => {
    if (gamePhase !== 'rolling') return;

    setIsRolling(true);
    setTimeout(() => {
      rollDice();
      setIsRolling(false);
    }, 1500);
  }, [gamePhase, rollDice]);

  const handleEdgeClick = useCallback((edgeId: string) => {
    if (!canDrawEdge(edgeId) || !currentPlayer) return;

    const result = drawEdge(edgeId);

    if (result.captured.length > 0) {
      // Show capture notification
      setCaptureNotification({
        playerName: currentPlayer.displayName,
        playerColor: currentPlayer.color,
        sliceCount: result.captured.length,
      });

      // Track capture streak
      const newStreak = captureStreak + result.captured.length;
      setCaptureStreak(newStreak);

      // Share streak achievement
      if (newStreak >= 5) {
        shareCaptureStreak(newStreak);
      }

      // Extra turn granted - do NOT end turn
      // The movesRemaining is already incremented in useGameState
    } else {
      setCaptureStreak(0);
      // No capture - check if turn should end
      // Note: movesRemaining is decremented in useGameState.drawEdge
      // so we check if it was 1 before (now 0 after decrement)
    }

    // Don't auto-end here - let the useGameState handle movesRemaining
    // The player can continue if they have moves or got an extra turn
  }, [canDrawEdge, currentPlayer, drawEdge, captureStreak, shareCaptureStreak]);

  const handleEndTurn = useCallback(() => {
    setCaptureStreak(0);
    endTurn();
  }, [endTurn]);

  const scores = getScores();
  const isMyTurn = currentPlayer?.id === `player_${context?.fid}`;

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-game-dark">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          🍕
        </motion.div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      <Background />

      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 p-3 safe-area-top bg-gradient-to-b from-game-dark to-transparent">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-gray-400">Turn </span>
            <span className="font-bold text-white">{gameState.turnNumber}</span>
          </div>
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Players sidebar */}
      <div className="fixed left-2 top-20 z-30 space-y-2 max-w-[120px]">
        {gameState.players.map((player) => (
          <PlayerCardCompact
            key={player.id}
            player={player}
            score={scores[player.id] || 0}
            isActive={currentPlayer?.id === player.id}
          />
        ))}
      </div>

      {/* Main game area */}
      <div className="pt-16 pb-48 px-4 flex flex-col items-center justify-center min-h-screen">
        {/* Current turn indicator */}
        <motion.div
          className="mb-4 px-4 py-2 rounded-full"
          style={{ backgroundColor: currentPlayer?.color + '30' }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <p className="text-sm font-semibold" style={{ color: currentPlayer?.color }}>
            {isMyTurn ? "Your Turn!" : `${currentPlayer?.displayName}'s Turn`}
          </p>
        </motion.div>

        {/* Game grid */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <SquareGrid
            nodes={gameState.nodes}
            edges={gameState.edges}
            capturedSlices={gameState.capturedSlices}
            players={gameState.players}
            currentPlayerId={currentPlayer?.id || ''}
            onEdgeClick={handleEdgeClick}
            canDrawEdge={canDrawEdge}
            gridSize={4}
          />

          {/* Moves remaining indicator */}
          {gameState.movesRemaining > 0 && (
            <motion.div
              className="absolute -top-2 -right-2 bg-game-primary rounded-full w-8 h-8 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              key={gameState.movesRemaining}
            >
              <span className="text-white font-bold text-sm">
                {gameState.movesRemaining}
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Score summary */}
        <div className="mt-4 flex gap-4">
          {gameState.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center gap-2 px-3 py-1 rounded-lg"
              style={{ backgroundColor: player.color + '20' }}
            >
              <span className="text-lg">🍕</span>
              <span className="font-bold" style={{ color: player.color }}>
                {scores[player.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div>
          {/* Dice roll phase */}
          {gamePhase === 'rolling' && isMyTurn && (
            <div className="flex flex-col items-center">
              <Dice
                value={gameState.diceRoll}
                isRolling={isRolling}
                onRoll={handleRoll}
                disabled={!isMyTurn}
              />
            </div>
          )}

          {/* Drawing phase */}
          {gamePhase === 'drawing' && isMyTurn && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-gray-400">
                {gameState.movesRemaining} move{gameState.movesRemaining !== 1 ? 's' : ''} remaining
              </p>
              <motion.button
                onClick={handleEndTurn}
                className="btn-secondary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                End Turn
              </motion.button>
            </div>
          )}

          {/* Waiting for opponent */}
          {!isMyTurn && (
            <div className="text-center">
              <motion.p
                className="text-gray-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Waiting for {currentPlayer?.displayName}...
              </motion.p>
            </div>
          )}

          {/* Game over indicator */}
          {isGameOver && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <p className="text-2xl font-bold text-game-secondary">Game Over!</p>
              <p className="text-gray-400">Calculating results...</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Capture notification */}
      <AnimatePresence>
        {captureNotification && (
          <CaptureNotification
            playerName={captureNotification.playerName}
            playerColor={captureNotification.playerColor}
            sliceCount={captureNotification.sliceCount}
            onClose={() => setCaptureNotification(null)}
          />
        )}
      </AnimatePresence>

      {/* Confetti on capture streak */}
      <Confetti isActive={captureStreak >= 3} />
    </main>
  );
}
