'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SquareGrid,
  Dice,
  PlayerCardCompact,
  CaptureNotification,
  WalletDisplayCompact,
  Confetti,
  Background,
} from '@/components';
import { useWallet, useFarcaster } from '@/hooks';
import { useRealtimeGame } from '@/hooks/useRealtimeGame';
import { ENTRY_TIERS } from '@/types';

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId');
  const tierParam = searchParams.get('tier');
  const tier = tierParam ? parseInt(tierParam) : 1;

  const { balance } = useWallet();
  const { context, viewToken, shareCaptureStreak } = useFarcaster();

  const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
  const gridSize = tierConfig?.gridSize || 4;

  const {
    gameState,
    gamePhase,
    currentPlayer,
    isMyTurn,
    isLoading,
    error,
    connectionStatus,
    rollDice,
    drawEdge,
    endTurn,
    getScores,
    canDrawEdge,
    isGameOver,
    winner,
  } = useRealtimeGame(matchId, context?.fid || null);

  const [isRolling, setIsRolling] = useState(false);
  const [captureNotification, setCaptureNotification] = useState<{
    playerName: string;
    playerColor: string;
    sliceCount: number;
  } | null>(null);
  const [captureStreak, setCaptureStreak] = useState(0);

  // Navigate to game over when game ends
  useEffect(() => {
    if (isGameOver && winner) {
      setTimeout(() => {
        router.push(`/game-over?matchId=${matchId}&winner=${winner.id}`);
      }, 2000);
    }
  }, [isGameOver, winner, matchId, router]);

  // Auto-end turn when no moves remaining (and in drawing phase)
  useEffect(() => {
    if (gameState && gamePhase === 'drawing' && gameState.movesRemaining === 0 && !isGameOver && isMyTurn) {
      const timer = setTimeout(() => {
        endTurn();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState, gamePhase, isGameOver, isMyTurn, endTurn]);

  const handleRoll = useCallback(async () => {
    if (gamePhase !== 'rolling' || !isMyTurn) return;

    setIsRolling(true);
    setTimeout(async () => {
      await rollDice();
      setIsRolling(false);
    }, 1500);
  }, [gamePhase, isMyTurn, rollDice]);

  const handleEdgeClick = useCallback(async (edgeId: string) => {
    if (!canDrawEdge(edgeId) || !currentPlayer || !isMyTurn) return;

    const result = await drawEdge(edgeId);

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
    } else {
      setCaptureStreak(0);
    }
  }, [canDrawEdge, currentPlayer, isMyTurn, drawEdge, captureStreak, shareCaptureStreak]);

  const handleEndTurn = useCallback(async () => {
    setCaptureStreak(0);
    await endTurn();
  }, [endTurn]);

  const scores = getScores();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-game-dark">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl mb-4"
        >
          🍕
        </motion.div>
        <p className="text-gray-400">Loading game...</p>
      </div>
    );
  }

  // Error state
  if (error && !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-game-dark p-4">
        <div className="text-6xl mb-4">😕</div>
        <p className="text-red-400 mb-4 text-center">{error}</p>
        <motion.button
          onClick={() => router.push('/')}
          className="btn-secondary"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Return Home
        </motion.button>
      </div>
    );
  }

  // No game state yet
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

      {/* Connection status banner */}
      {connectionStatus !== 'connected' && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 text-black text-center py-2 text-sm font-medium"
          initial={{ y: -40 }}
          animate={{ y: 0 }}
        >
          {connectionStatus === 'connecting' && 'Connecting to server...'}
          {connectionStatus === 'disconnected' && 'Connection lost. Reconnecting...'}
          {connectionStatus === 'reconnecting' && 'Reconnecting...'}
        </motion.div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-2 pt-3 safe-area-top bg-gradient-to-b from-game-dark to-transparent">
        <div className={`flex items-center justify-between ${connectionStatus !== 'connected' ? 'mt-8' : ''}`}>
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
            gridSize={gridSize}
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
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-2 pb-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div>
          {/* Dice roll phase */}
          {gamePhase === 'rolling' && isMyTurn && (
            <div className="flex flex-col items-center">
              <Dice
                value={gameState.diceRoll}
                isRolling={isRolling}
                onRoll={handleRoll}
                disabled={!isMyTurn || connectionStatus !== 'connected'}
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
                disabled={connectionStatus !== 'connected'}
              >
                End Turn
              </motion.button>
            </div>
          )}

          {/* Waiting for opponent */}
          {!isMyTurn && !isGameOver && (
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

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-game-dark">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="text-6xl"
          >
            🍕
          </motion.div>
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
