'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
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
    turnTimeRemaining,
  } = useRealtimeGame(matchId, context?.fid || null);

  const [isRolling, setIsRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  // Ref-based lock to prevent double-tap race condition (refs aren't stale in closures)
  const rollLockRef = useRef(false);
  // Stores the dice result during the animation so realtime updates can't erase it
  const diceResultRef = useRef<number | null>(null);
  // Keep dice visible briefly after roll animation ends (for turn-skip visibility)
  const [showDiceResult, setShowDiceResult] = useState(false);
  const [captureNotification, setCaptureNotification] = useState<{
    playerName: string;
    playerColor: string;
    sliceCount: number;
  } | null>(null);
  const [captureStreak, setCaptureStreak] = useState(0);

  // Navigate to game over when game ends
  useEffect(() => {
    if (isGameOver && winner) {
      const timer = setTimeout(() => {
        router.push(`/game-over?matchId=${matchId}&winner=${winner.id}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isGameOver, winner, matchId, router]);

  // Auto-end turn when no moves remaining (and in drawing phase)
  // Use 1500ms delay to allow server realtime updates (e.g. extra turn from capture) to arrive first
  useEffect(() => {
    if (gameState && gamePhase === 'drawing' && gameState.movesRemaining === 0 && !isGameOver && isMyTurn) {
      const timer = setTimeout(() => {
        endTurn();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, gamePhase, isGameOver, isMyTurn, endTurn]);

  // Reset roll state when it becomes a new turn for this player
  useEffect(() => {
    if (gamePhase === 'rolling' && isMyTurn && gameState?.diceRoll === null) {
      setHasRolled(false);
      rollLockRef.current = false;
      diceResultRef.current = null;
    }
  }, [gamePhase, isMyTurn, gameState?.diceRoll]);

  const handleRoll = useCallback(async () => {
    // Ref-based lock prevents double-tap even if React hasn't re-rendered yet
    if (rollLockRef.current) return;
    if (gamePhase !== 'rolling' || !isMyTurn || isRolling || hasRolled) return;
    rollLockRef.current = true;

    setIsRolling(true);
    setHasRolled(true);
    diceResultRef.current = null;

    // Start server call immediately (runs in parallel with animation)
    const rollPromise = rollDice();

    // Wait for the animation to finish (1500ms)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Capture the result so realtime updates can't erase it during reveal
    // -1 means no roll happened (bail-out), so don't display it
    const result = await rollPromise;
    diceResultRef.current = result > 0 ? result : null;

    // Stop the rolling animation — show the dice result briefly
    setIsRolling(false);
    setShowDiceResult(true);

    // Keep the dice result visible for 800ms before allowing phase transition
    await new Promise(resolve => setTimeout(resolve, 800));
    setShowDiceResult(false);
  }, [gamePhase, isMyTurn, isRolling, hasRolled, rollDice]);

  const handleEdgeClick = useCallback(async (edgeId: string) => {
    // drawEdge validates via gameStateRef (always-current), so we don't need
    // to duplicate checks here that can go stale in the closure.
    const result = await drawEdge(edgeId);

    if (result.captured.length > 0 && currentPlayer) {
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
    } else if (result.captured.length === 0) {
      setCaptureStreak(0);
    }
  }, [drawEdge, currentPlayer, captureStreak, shareCaptureStreak]);

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
          <div className="flex items-center gap-2">
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
        {/* Turn indicator + Timer — visible to ALL players */}
        <div className="mb-4 flex flex-col items-center gap-2">
          {/* Turn timer — prominent, above grid */}
          {turnTimeRemaining !== null && (
            <motion.div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                background: turnTimeRemaining <= 10
                  ? 'linear-gradient(180deg, #FF4444 0%, #CC2222 100%)'
                  : turnTimeRemaining <= 20
                  ? 'linear-gradient(180deg, #FF8C5A 0%, #FF6B35 100%)'
                  : 'linear-gradient(180deg, #3D3835 0%, #292524 100%)',
                boxShadow: turnTimeRemaining <= 10
                  ? '0 3px 0 0 #991111, 0 4px 16px rgba(255, 68, 68, 0.4)'
                  : turnTimeRemaining <= 20
                  ? '0 3px 0 0 #CC5429, 0 4px 12px rgba(255, 107, 53, 0.3)'
                  : '0 2px 0 0 #1C1917, inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
              animate={turnTimeRemaining <= 10 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              key={turnTimeRemaining}
              initial={{ scale: 1.1, opacity: 0.8 }}
            >
              <span className="text-lg">{"⏱️"}</span>
              <span
                className="font-bold text-2xl tabular-nums"
                style={{
                  color: turnTimeRemaining <= 10 ? '#FFF' : turnTimeRemaining <= 20 ? '#FFF' : '#E7E5E4',
                  fontFamily: 'var(--font-lilita), cursive',
                }}
              >
                {turnTimeRemaining}s
              </span>
            </motion.div>
          )}

          {/* Current turn player indicator */}
          <motion.div
            className="px-5 py-2 rounded-xl"
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
        </div>

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
        <div className="mt-5 flex gap-2 flex-wrap justify-center">
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
          {/* Dice roll phase — keep visible while isRolling OR showDiceResult so
              animation completes and result is briefly visible (even on turn skip) */}
          {(isRolling || showDiceResult || (gamePhase === 'rolling' && isMyTurn)) && (
            <div className="flex flex-col items-center">
              <Dice
                value={diceResultRef.current ?? gameState.diceRoll}
                isRolling={isRolling}
                onRoll={handleRoll}
                disabled={!isMyTurn || connectionStatus !== 'connected' || hasRolled}
              />
            </div>
          )}

          {/* Drawing phase — only show when dice animation and result display are done */}
          {!isRolling && !showDiceResult && gamePhase === 'drawing' && isMyTurn && (
            <div className="flex flex-col items-center gap-2">
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

          {/* Waiting for opponent — hide while dice is still animating or showing result */}
          {!isRolling && !showDiceResult && !isMyTurn && !isGameOver && (
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
                  {currentPlayer?.isBot ? "🤖" : "🎲"}
                </motion.span>
                {currentPlayer?.isBot
                  ? 'Bot is thinking...'
                  : `Waiting for ${currentPlayer?.displayName}...`}
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
