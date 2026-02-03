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
import { useWallet, useFarcaster } from '@/hooks';
import { ENTRY_TIERS } from '@/types';

// Colorful dot colors for the theme
const DOT_COLORS = ['#FF6B6B', '#4ECDC4', '#F7DC6F', '#BB8FCE', '#58D68D', '#5DADE2'];

export default function HomePage() {
  const router = useRouter();
  const { address, balance, isConnected, connect, isLoading } = useWallet();
  const { context, viewToken } = useFarcaster();

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

      {/* Vertically centered content (when space allows). */}
      <div className="relative z-10 min-h-[100svh] flex flex-col justify-center px-2 py-10 safe-area-top safe-area-bottom">
        <div className="w-full max-w-md mx-auto space-y-2">
          {/* Hero */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Dot-connected title with pizza emojis */}
            <div className="flex items-center justify-center gap-4 mb-2">
              <motion.span
                className="text-5xl"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(247, 220, 111, 0.8))',
                }}
                animate={{
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                🍕
              </motion.span>
              <DotText text="PIZZA" color="#F7DC6F" dotColor="#FF6B6B" size={1.8} />
              <motion.span
                className="text-5xl"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(247, 220, 111, 0.8))',
                }}
                animate={{
                  rotate: [0, -5, 5, 0],
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              >
                🍕
              </motion.span>
            </div>
            <div className="h-2" />
            <div className="flex justify-center mb-6">
              <DotText text="DOTS" color="#4ECDC4" dotColor="#BB8FCE" size={1.5} />
            </div>

            <p
              className="text-lg"
              style={{
                color: '#E0E0E0',
                textShadow: '0 0 10px rgba(78, 205, 196, 0.5)',
              }}
            >
              Connect the dots. Capture slices. Win{' '}
              <GlowText color="#F7DC6F" glowColor="#F7DC6F">$PIZZA</GlowText>!
            </p>
          </motion.div>

          {/* Game info card */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(78, 205, 196, 0.3)',
              boxShadow: '0 0 20px rgba(78, 205, 196, 0.1)',
            }}
          >
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex justify-center gap-1 mb-1">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full"
                      style={{
                        backgroundColor: DOT_COLORS[i],
                        boxShadow: `0 0 10px ${DOT_COLORS[i]}`,
                      }}
                    />
                  ))}
                </div>
                <GlowText color="#FFFFFF" className="text-xl font-bold">
                  2-6
                </GlowText>
                <p className="text-xs text-gray-400">Players</p>
              </div>
              <div>
                <p
                  className="text-3xl mb-1"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(247, 220, 111, 0.8))' }}
                >
                  🎲
                </p>
                <GlowText color="#FFFFFF" className="text-xl font-bold">
                  Roll
                </GlowText>
                <p className="text-xs text-gray-400">Dice</p>
              </div>
              <div>
                <p
                  className="text-3xl mb-1"
                  style={{ filter: 'drop-shadow(0 0 10px rgba(255, 107, 107, 0.8))' }}
                >
                  🍕
                </p>
                <GlowText color="#FFFFFF" className="text-xl font-bold">
                  Win
                </GlowText>
                <p className="text-xs text-gray-400">Slices</p>
              </div>
            </div>
          </motion.div>

          {/* Entry tier selection */}
          <motion.div
            className=""
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <EntryTierSelector
              selectedTier={selectedTier}
              onSelectTier={setSelectedTier}
              disabled={isLoading}
            />
            <PrizeBreakdown entryAmount={currentTier.amount} />
          </motion.div>

          {/* How to play */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(78, 205, 196, 0.3)',
            }}
          >
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: '#4ECDC4',
                  boxShadow: '0 0 10px #4ECDC4',
                }}
              />
              <GlowText color="#FFFFFF" glowColor="#4ECDC4">
                How to Play
              </GlowText>
            </h3>
            <ol className="space-y-3 text-sm">
              {[
                { color: '#FF6B6B', text: 'Roll the dice to determine your moves' },
                { color: '#F7DC6F', text: 'Draw lines between dots (any direction)', textColor: '#000' },
                { color: '#4ECDC4', text: 'Complete triangles to capture pizza slices' },
                { color: '#BB8FCE', text: 'Capturing gives you an extra turn!' },
                { color: '#58D68D', text: 'Most slices wins the $PIZZA prize pool' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span
                    className="w-6 h-6 rounded-full text-xs flex items-center justify-center shrink-0 font-bold"
                    style={{
                      backgroundColor: item.color,
                      color: item.textColor || '#FFF',
                      boxShadow: `0 0 10px ${item.color}80`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: '#D0D0D0' }}>{item.text}</span>
                </li>
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
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(78, 205, 196, 0.3)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={context.pfpUrl}
                  alt={context.displayName}
                  className="w-10 h-10 rounded-full"
                  style={{
                    boxShadow: '0 0 15px rgba(78, 205, 196, 0.6)',
                    border: '2px solid #4ECDC4',
                  }}
                />
                <div>
                  <GlowText color="#FFFFFF" className="font-semibold">
                    {context.displayName}
                  </GlowText>
                  <p className="text-xs text-gray-400">FID: {context.fid}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                {[
                  { value: '42', label: 'Games', color: '#FF6B6B' },
                  { value: '15', label: 'Wins', color: '#F7DC6F' },
                  { value: '156', label: 'Slices', color: '#4ECDC4' },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-2"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${stat.color}40`,
                    }}
                  >
                    <GlowText color={stat.color} className="font-bold">
                      {stat.value}
                    </GlowText>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bottom buttons */}
          <div className="space-y-3">
            <motion.button
              onClick={handlePlayNow}
              disabled={isLoading}
              className="w-full py-4 rounded-xl font-bold text-lg text-white"
              style={{
                background: 'linear-gradient(135deg, #FF6B6B, #F7DC6F, #4ECDC4)',
                boxShadow: '0 0 30px rgba(247, 220, 111, 0.4), 0 0 60px rgba(78, 205, 196, 0.2)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    🍕
                  </motion.span>
                  Loading...
                </span>
              ) : !isConnected ? (
                'Connect Wallet to Play'
              ) : (
                `Play Now - ${currentTier.label}`
              )}
            </motion.button>

            <div className="flex gap-3">
              <motion.button
                onClick={() => setShowFreeRoll(true)}
                className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(247, 220, 111, 0.15)',
                  border: '1px solid rgba(247, 220, 111, 0.3)',
                  color: '#F7DC6F',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#F7DC6F', boxShadow: '0 0 8px #F7DC6F' }}
                />
                Free Roll
              </motion.button>
              <motion.button
                onClick={() => router.push('/leaderboard')}
                className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(78, 205, 196, 0.15)',
                  border: '1px solid rgba(78, 205, 196, 0.3)',
                  color: '#4ECDC4',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: '#4ECDC4', boxShadow: '0 0 8px #4ECDC4' }}
                />
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
