'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PizzaShapesLogo,
  PlayerCard,
  Background,
  WalletDisplayCompact,
} from '@/components';
import { useWallet, useFarcaster, usePayment } from '@/hooks';
import { useRealtimeMatchmaking } from '@/hooks/useRealtimeMatchmaking';
import { getPaymentStepMessage, isPaymentLoading } from '@/hooks/usePayment';
import { ENTRY_TIERS, Player } from '@/types';
import { type Address } from 'viem';

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const tier = tierParam ? parseInt(tierParam) : 1;

  const { address, balance, isConnected } = useWallet();
  const { context, viewToken, viewProfile } = useFarcaster();
  const { paymentState, enterMatchWithPayment, formatPizzaAmount, resetPayment } = usePayment();

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Create current player from context
  const currentPlayer: Player | null = context
    ? {
        id: `player_${context.fid}`,
        fid: context.fid,
        displayName: context.displayName,
        pfpUrl: context.pfpUrl,
        address: address || '',
        color: '',
      }
    : null;

  const {
    isInQueue,
    queuePlayers,
    matchId,
    isMatchReady,
    countdown,
    queuePosition,
    error,
    connectionStatus,
    isCurrentPlayerReady,
    readyPlayerCount,
    joinQueue,
    leaveQueue,
    markPlayerReady,
  } = useRealtimeMatchmaking(currentPlayer);

  const currentTier = ENTRY_TIERS.find(t => t.id === tier);

  // Auto-join queue when page loads
  useEffect(() => {
    if (currentPlayer && !isInQueue && isConnected) {
      joinQueue(tier, currentPlayer);
    }
  }, [currentPlayer, isInQueue, isConnected, tier, joinQueue]);

  // Navigate to game when countdown reaches 0 and player is ready
  useEffect(() => {
    if (countdown === 0 && isCurrentPlayerReady && readyPlayerCount >= 2) {
      // Generate a match ID for the ready players
      const newMatchId = `match_${Date.now()}_${tier}`;
      router.push(`/game?matchId=${newMatchId}&tier=${tier}`);
    }
  }, [countdown, isCurrentPlayerReady, readyPlayerCount, tier, router]);

  // Handle Enter Game payment
  const handleEnterGame = async () => {
    if (!address || !currentPlayer || isProcessingPayment) return;

    setIsProcessingPayment(true);
    resetPayment();

    try {
      // Generate a match ID for payment tracking
      const paymentMatchId = `match_${Date.now()}_${tier}`;

      const success = await enterMatchWithPayment(paymentMatchId, tier, address as Address);

      if (success) {
        // Mark player as ready in the queue
        await markPlayerReady();
      }
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleLeave = () => {
    leaveQueue();
    router.push('/');
  };

  return (
    <main className="min-h-[100svh] relative">
      <Background />

      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-2 pt-4 safe-area-top">
        <div className="flex items-center justify-between">
          <PizzaShapesLogo />
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Main content */}
      <div className="pt-24 pb-32 px-2 min-h-[100svh] flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto space-y-2">
          {/* Error display */}
          {error && (
            <motion.div
              className="bg-red-500/20 border border-red-500 rounded-xl p-3"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Connection status */}
          {connectionStatus !== 'connected' && (
            <motion.div
              className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-3 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-yellow-400 text-sm">
                {connectionStatus === 'connecting' ? 'Connecting to server...' : 'Reconnecting...'}
              </p>
            </motion.div>
          )}

          {/* Status card */}
          <motion.div
            className="card text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              className="text-6xl mb-4"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🍕
            </motion.div>
            <h2 className="text-xl font-bold mb-2">
              {countdown !== null && countdown > 0
                ? `Game starts in ${countdown}s`
                : countdown === 0
                  ? (isCurrentPlayerReady ? 'Starting...' : 'Time\'s up!')
                  : 'Finding Players...'}
            </h2>
            <p className="text-gray-400 text-sm">
              {currentTier?.label} tier - {currentTier?.description}
            </p>
            {readyPlayerCount > 0 && (
              <p className="text-xs text-green-400 mt-2">
                {readyPlayerCount} player{readyPlayerCount !== 1 ? 's' : ''} ready
              </p>
            )}
            {countdown !== null && countdown > 0 && (
              <motion.div
                className="mt-4 text-4xl font-bold text-game-secondary"
                key={countdown}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {countdown}
              </motion.div>
            )}
          </motion.div>

          {/* Players list */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Players ({queuePlayers.length}/6)</h3>
              <span className="text-xs text-gray-400">Min 2 players to start</span>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {queuePlayers.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <PlayerCard
                      player={player}
                      score={0}
                      isActive={false}
                      isCurrentUser={player.id === currentPlayer?.id}
                      isReady={player.isReady}
                      showReadyStatus={true}
                      onClick={() => viewProfile(player.fid)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Empty slots */}
              {Array.from({ length: 6 - queuePlayers.length }).map((_, i) => (
                <motion.div
                  key={`empty-${i}`}
                  className="p-3 rounded-xl border-2 border-dashed border-white/10 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <p className="text-gray-500 text-sm">Waiting for player...</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Tips */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h4 className="font-semibold mb-2 text-sm">💡 Pro Tips</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Complete triangles to capture pizza slices</li>
              <li>• Capturing gives you an extra turn!</li>
              <li>• Diagonal lines open up more possibilities</li>
              <li>• Watch out for setups from other players</li>
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-2 pb-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div className="space-y-3">
          {/* Payment status message */}
          {isPaymentLoading(paymentState.step) && (
            <motion.div
              className="bg-game-primary/20 rounded-xl p-3 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm text-white">{getPaymentStepMessage(paymentState.step)}</p>
            </motion.div>
          )}

          {paymentState.step === 'error' && (
            <motion.div
              className="bg-red-500/20 rounded-xl p-3 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm text-red-400">{paymentState.error}</p>
            </motion.div>
          )}

          {/* Enter Game / Ready button */}
          {isCurrentPlayerReady ? (
            <motion.div
              className="w-full py-4 rounded-xl font-bold text-lg text-center bg-green-500/20 border-2 border-green-500 text-green-400"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <span className="flex items-center justify-center gap-2">
                <span>✓</span> Ready!
              </span>
            </motion.div>
          ) : (
            <motion.button
              onClick={handleEnterGame}
              className="w-full btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isProcessingPayment || countdown === 0}
            >
              {isProcessingPayment
                ? 'Processing...'
                : `Enter Game - $${currentTier?.amount.toFixed(2) || '0.50'}`}
            </motion.button>
          )}

          {/* Leave Queue button - only show if not ready */}
          {!isCurrentPlayerReady && (
            <motion.button
              onClick={handleLeave}
              className="w-full btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isProcessingPayment}
            >
              Leave Queue
            </motion.button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function WaitingRoomPage() {
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
      <WaitingRoomContent />
    </Suspense>
  );
}
