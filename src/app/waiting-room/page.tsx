'use client';

import { useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PizzaShapesLogo,
  PlayerCard,
  Background,
  WalletDisplayCompact,
} from '@/components';
import { useWallet, useFarcaster, useMatchmaking } from '@/hooks';
import { ENTRY_TIERS, Player } from '@/types';

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const tier = tierParam ? parseInt(tierParam) : 1;

  const { address, balance, isConnected } = useWallet();
  const { context, viewToken, viewProfile } = useFarcaster();

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
    joinQueue,
    leaveQueue,
  } = useMatchmaking(currentPlayer);

  const currentTier = ENTRY_TIERS.find(t => t.id === tier);

  // Auto-join queue when page loads
  useEffect(() => {
    if (currentPlayer && !isInQueue && isConnected) {
      joinQueue(tier, currentPlayer);
    }
  }, [currentPlayer, isInQueue, isConnected, tier, joinQueue]);

  // Navigate to game when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && matchId) {
      router.push(`/game?matchId=${matchId}&tier=${tier}`);
    }
  }, [countdown, matchId, tier, router]);

  const handleLeave = () => {
    leaveQueue();
    router.push('/');
  };

  return (
    <main className="min-h-[100svh] relative">
      <Background />

      {/* Header */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <PizzaShapesLogo />
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Main content */}
      <div className="pt-24 pb-32 px-4 min-h-[100svh] flex flex-col justify-center">
        <div className="w-full max-w-lg mx-auto space-y-2">
          {/* Status card */}
          <motion.div
            className="card text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {!isMatchReady ? (
              <>
                <motion.div
                  className="text-6xl mb-4"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  🍕
                </motion.div>
                <h2 className="text-xl font-bold mb-2">Finding Players...</h2>
                <p className="text-gray-400 text-sm">
                  {currentTier?.label} tier - {currentTier?.description}
                </p>
                <div className="mt-4 flex justify-center">
                  <motion.div
                    className="flex gap-1"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="w-2 h-2 bg-game-primary rounded-full" />
                    <span className="w-2 h-2 bg-game-primary rounded-full" />
                    <span className="w-2 h-2 bg-game-primary rounded-full" />
                  </motion.div>
                </div>
              </>
            ) : (
              <>
                <motion.div
                  className="text-6xl mb-4"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  🎮
                </motion.div>
                <h2 className="text-xl font-bold mb-2">Match Found!</h2>
                <p className="text-gray-400 text-sm mb-4">Get ready to play...</p>
                <motion.div
                  className="text-5xl font-bold text-game-secondary"
                  key={countdown}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  {countdown}
                </motion.div>
              </>
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
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div>
          <motion.button
            onClick={handleLeave}
            className="w-full btn-secondary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isMatchReady}
          >
            {isMatchReady ? 'Starting...' : 'Leave Queue'}
          </motion.button>
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
