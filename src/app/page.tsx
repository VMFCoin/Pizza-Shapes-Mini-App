'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  WalletDisplay,
  EntryTierSelector,
  PrizeBreakdown,
  FreeRollModal,
  Background,
  DotText,
  GlowText,
} from '@/components';
import { useWallet, useFarcaster, useOnChainStats } from '@/hooks';
import { ENTRY_TIERS } from '@/types';

// Playful dot colors matching our theme
const DOT_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE066', '#BB8FCE', '#58D68D', '#5DADE2'];

export default function HomePage() {
  const router = useRouter();
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { context, viewProfile } = useFarcaster();
  const { stats: onChainStats, isLoading: statsLoading } = useOnChainStats(address);

  const [selectedTier, setSelectedTier] = useState(2);
  const [showFreeRoll, setShowFreeRoll] = useState(false);

  const currentTier = ENTRY_TIERS.find(t => t.id === selectedTier)!;

  const handlePlayNow = async () => {
    if (!isConnected) {
      await connect();
      return;
    }
    router.push(`/waiting-room?tier=${selectedTier}`);
  };

  const handleFreeRollClaim = (selection: number, result: number) => {
    console.log(`Free roll: selected ${selection}, rolled ${result}`);
    setShowFreeRoll(false);
  };

  return (
    <main className="min-h-[100svh] relative">
      <Background />

      {/* Vertically centered content */}
      <div className="relative z-10 min-h-[100svh] flex flex-col justify-center px-2 py-10 safe-area-top safe-area-bottom">
        <div className="w-full max-w-md mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Hero Section */}
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Fun animated pizza logo */}
            <motion.div
              className="relative inline-block mb-4"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <span 
                className="text-7xl block"
                style={{ 
                  filter: 'drop-shadow(0 8px 16px rgba(255, 107, 53, 0.4))',
                }}
              >
                {"🍕"}
              </span>
            </motion.div>

            {/* Title with playful keycap-style letters */}
            <div className="flex items-center justify-center gap-2 mb-3">
              {['P', 'I', 'Z', 'Z', 'A'].map((letter, i) => (
                <motion.span
                  key={i}
                  className="keycap-primary text-xl px-3 py-2"
                  initial={{ opacity: 0, y: -20, rotate: -10 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
                  style={{ 
                    display: 'inline-block',
                    fontFamily: 'var(--font-lilita), cursive',
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mb-5">
              {['D', 'O', 'T', 'S'].map((letter, i) => (
                <motion.span
                  key={i}
                  className="keycap-teal text-lg px-3 py-2"
                  initial={{ opacity: 0, y: -20, rotate: 10 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ delay: 0.5 + i * 0.1, type: "spring", stiffness: 300 }}
                  style={{ 
                    display: 'inline-block',
                    fontFamily: 'var(--font-lilita), cursive',
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </div>

            <p className="text-base text-stone-300 leading-relaxed">
              Connect the dots. Capture slices. Win{' '}
              <span className="font-bold text-game-secondary">$PIZZA</span>!
            </p>
          </motion.div>

          {/* Game Info - Playful keycap style cards */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1].map((i) => (
                    <motion.div
                      key={i}
                      className="dot-decoration"
                      style={{ backgroundColor: DOT_COLORS[i] }}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
                <span className="text-xl font-bold text-game-light">2-6</span>
                <span className="text-xs text-stone-400">Players</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.span
                  className="text-3xl"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {"🎲"}
                </motion.span>
                <span className="text-xl font-bold text-game-light">Roll</span>
                <span className="text-xs text-stone-400">Dice</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <motion.span
                  className="text-3xl"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {"🏆"}
                </motion.span>
                <span className="text-xl font-bold text-game-light">Win</span>
                <span className="text-xs text-stone-400">$PIZZA</span>
              </div>
            </div>
          </motion.div>

          {/* Entry tier selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <EntryTierSelector
              selectedTier={selectedTier}
              onSelectTier={setSelectedTier}
              disabled={isConnecting}
            />
            <PrizeBreakdown entryAmount={currentTier.amount} />
          </motion.div>

          {/* How to play - with fun numbered dots */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-bold mb-4 flex items-center gap-2 text-game-light">
              <span className="text-lg">{"💡"}</span>
              How to Play
            </h3>
            <ol className="space-y-4 text-sm">
              {[
                { color: '#FF6B6B', text: 'Roll the dice to determine your moves' },
                { color: '#FFE066', text: 'Draw lines between dots (any direction)' },
                { color: '#4ECDC4', text: 'Complete triangles to capture pizza slices' },
                { color: '#BB8FCE', text: 'Capturing gives you an extra turn!' },
                { color: '#58D68D', text: 'Most slices wins the $PIZZA prize pool' },
              ].map((item, i) => (
                <motion.li 
                  key={i} 
                  className="flex gap-2 items-center"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <span
                    className="number-badge shrink-0"
                    style={{
                      background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}DD 100%)`,
                      color: item.color === '#FFE066' ? '#1C1917' : '#FFF',
                      boxShadow: `0 2px 0 0 ${item.color}99, 0 3px 8px ${item.color}40`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-stone-300">{item.text}</span>
                </motion.li>
              ))}
            </ol>
          </motion.div>

          {/* Stats (if connected) */}
          {isConnected && context && (
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <button
                onClick={() => viewProfile(context.fid)}
                className="flex items-center gap-2 mb-4 w-full text-left hover:opacity-80 transition-opacity"
              >
                <img
                  src={context.pfpUrl}
                  alt={context.displayName}
                  className="w-12 h-12 rounded-full ring-2 ring-game-primary"
                />
                <div className="flex-1">
                  <span className="font-bold text-game-light block">
                    {context.displayName}
                  </span>
                  <span className="text-xs text-stone-400">FID: {context.fid}</span>
                </div>
                <span className="text-stone-400 text-xs">{"View →"}</span>
              </button>
              {statsLoading ? (
                <div className="flex justify-center py-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="text-2xl"
                  >
                    {"🍕"}
                  </motion.div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { value: onChainStats?.gamesPlayed ?? 0, label: 'Games', color: '#FF6B6B' },
                    { value: onChainStats?.wins ?? 0, label: 'Wins', color: '#FFE066' },
                    { value: onChainStats?.slicesCaptured ?? 0, label: 'Slices', color: '#4ECDC4' },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-3"
                      style={{
                        background: `${stat.color}15`,
                        border: `1px solid ${stat.color}30`,
                      }}
                    >
                      <span 
                        className="text-2xl font-bold block"
                        style={{ color: stat.color }}
                      >
                        {stat.value}
                      </span>
                      <span className="text-xs text-stone-400">{stat.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Action Buttons - 3D keycap style */}
          <div className="space-y-4 pt-4">
            <motion.button
              onClick={handlePlayNow}
              disabled={isConnecting}
              className="w-full btn-primary py-4 text-lg disabled:opacity-50 mb-6"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    {"🍕"}
                  </motion.span>
                  Connecting...
                </span>
              ) : !isConnected ? (
                'Connect Wallet to Play'
              ) : (
                `Play Now - ${currentTier.label}`
              )}
            </motion.button>

            <div className="flex gap-4 mt-4">
              <motion.button
                onClick={() => setShowFreeRoll(true)}
                className="flex-1 keycap-secondary py-3 text-sm flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-lg">{"🎲"}</span>
                Free Roll
              </motion.button>
              <motion.button
                onClick={() => router.push('/leaderboard')}
                className="flex-1 keycap-teal py-3 text-sm flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-lg">{"🏆"}</span>
                Leaderboard
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Free roll modal */}
      <FreeRollModal
        isOpen={showFreeRoll}
        onClose={() => setShowFreeRoll(false)}
        onClaim={handleFreeRollClaim}
        prizePool={BigInt(5000) * BigInt(10 ** 18)}
      />
    </main>
  );
}
