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
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl mb-4"
        >
          {"🍕"}
        </motion.div>
        <p className="text-stone-400 font-medium">Loading game...</p>
      </div>
    );
  }

  // Error state
  if (error && !gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-game-dark p-4">
        <div className="text-6xl mb-4">{"😅"}</div>
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
          {"🍕"}
        </motion.div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative overflow-hidden">
      <Background />

      {/* Connection status banner - keycap style */}
      {connectionStatus !== 'connected' && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 text-center py-2 text-sm font-bold"
          style={{
            background: 'linear-gradient(180deg, #FFE066 0%, #FFD426 100%)',
            color: '#1C1917',
            boxShadow: '0 2px 0 0 #CCB352',
          }}
          initial={{ y: -40 }}
          animate={{ y: 0 }}
        >
          {connectionStatus === 'connecting' && 'Connecting to server...'}
          {connectionStatus === 'disconnected' && 'Connection lost. Reconnecting...'}
          {connectionStatus === 'reconnecting' && 'Reconnecting...'}
        </motion.div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-3 pt-3 safe-area-top bg-gradient-to-b from-game-dark via-game-dark/80 to-transparent">
        <div className={`flex items-center justify-between ${connectionStatus !== 'connected' ? 'mt-8' : ''}`}>
          <div 
            className="px-3 py-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(180deg, #3D3835 0%, #292524 100%)',
              boxShadow: '0 2px 0 0 #1C1917, inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <span className="text-stone-400 text-xs">Turn </span>
            <span className="font-bold text-game-light">{gameState.turnNumber}</span>
          </div>
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Players sidebar - Updated styling */}
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
        {/* Current turn indicator - Keycap pill style */}
        <motion.div
          className="mb-4 px-5 py-2 rounded-xl"
          style={{ 
            background: `linear-gradient(180deg, ${currentPlayer?.color}40 0%, ${currentPlayer?.color}20 100%)`,
            border: `1px solid ${currentPlayer?.color}50`,
            boxShadow: `0 2px 8px ${currentPlayer?.color}30`,
          }}
          animate={{ 
            scale: [1, 1.02, 1],
            boxShadow: [
              `0 2px 8px ${currentPlayer?.color}30`,
              `0 4px 16px ${currentPlayer?.color}50`,
              `0 2px 8px ${currentPlayer?.color}30`,
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <p className="text-sm font-bold" style={{ color: currentPlayer?.color }}>
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

          {/* Moves remaining indicator - Keycap badge */}
          {gameState.movesRemaining > 0 && (
            <motion.div
              className="absolute -top-3 -right-3 w-10 h-10 flex items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(180deg, #FF8C5A 0%, #FF6B35 100%)',
                boxShadow: '0 3px 0 0 #CC5429, 0 4px 12px rgba(255, 107, 53, 0.4)',
              }}
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              key={gameState.movesRemaining}
            >
              <span className="text-white font-bold text-lg">
                {gameState.movesRemaining}
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* Score summary - Keycap style pills */}
        <div className="mt-5 flex gap-3">
          {gameState.players.map((player) => (
            <motion.div
              key={player.id}
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ 
                background: `linear-gradient(180deg, ${player.color}30 0%, ${player.color}15 100%)`,
                border: `1px solid ${player.color}40`,
                boxShadow: currentPlayer?.id === player.id 
                  ? `0 0 12px ${player.color}50, 0 2px 0 0 ${player.color}30`
                  : `0 2px 0 0 ${player.color}20`,
              }}
              animate={currentPlayer?.id === player.id ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <span className="text-lg">{"🍕"}</span>
              <span className="font-bold text-lg" style={{ color: player.color }}>
                {scores[player.id] || 0}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom controls - Updated with keycap styling */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-3 pb-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div className="card p-4">
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
              <div className="flex items-center gap-2">
                <span 
                  className="number-badge"
                  style={{
                    background: 'linear-gradient(180deg, #4ECDC4 0%, #3EA89D 100%)',
                    color: '#1C1917',
                    boxShadow: '0 2px 0 0 #2D7A73',
                  }}
                >
                  {gameState.movesRemaining}
                </span>
                <span className="text-stone-400 font-medium">
                  move{gameState.movesRemaining !== 1 ? 's' : ''} remaining
                </span>
              </div>
              <motion.button
                onClick={handleEndTurn}
                className="btn-secondary px-8"
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
            <div className="text-center py-2">
              <motion.p
                className="text-stone-400 font-medium flex items-center justify-center gap-2"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  {"🎲"}
                </motion.span>
                Waiting for {currentPlayer?.displayName}...
              </motion.p>
            </div>
          )}

          {/* Game over indicator */}
          {isGameOver && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-2"
            >
              <p 
                className="text-2xl font-bold text-game-secondary mb-1"
                style={{ fontFamily: 'var(--font-lilita), cursive' }}
              >
                Game Over!
              </p>
              <p className="text-stone-400">Calculating results...</p>
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
