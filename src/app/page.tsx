'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  PizzaLogo,
  PizzaShapesLogo,
  WalletDisplay,
  EntryTierSelector,
  PrizeBreakdown,
  FreeRollModal,
  Background,
} from '@/components';
import { useWallet, useFarcaster } from '@/hooks';
import { ENTRY_TIERS } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { address, balance, isConnected, connect, isLoading } = useWallet();
  const { context, viewToken } = useFarcaster();

  const [selectedTier, setSelectedTier] = useState(1);
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
    <main className="min-h-screen relative">
      <Background />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 p-4 safe-area-top">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <PizzaShapesLogo />
          <WalletDisplay
            address={address}
            balance={balance}
            isConnected={isConnected}
            onConnect={connect}
            onViewToken={() => viewToken()}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="pt-24 pb-32 px-4 max-w-lg mx-auto">
        {/* Hero */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-center mb-4">
            <PizzaLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">Capture Pizza Slices</span>
          </h1>
          <p className="text-gray-400">
            Dots & Boxes with a tasty twist. Earn $PIZZA on Base!
          </p>
        </motion.div>

        {/* Game info card */}
        <motion.div
          className="card mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-game-primary">2-6</p>
              <p className="text-xs text-gray-400">Players</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-game-secondary">🎲</p>
              <p className="text-xs text-gray-400">Dice Rolls</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-game-primary">🍕</p>
              <p className="text-xs text-gray-400">Capture Slices</p>
            </div>
          </div>
        </motion.div>

        {/* Entry tier selection */}
        <motion.div
          className="mb-6"
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
          className="card mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold mb-3">How to Play</h3>
          <ol className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-game-primary font-bold">1.</span>
              Roll the dice to determine your moves
            </li>
            <li className="flex gap-2">
              <span className="text-game-primary font-bold">2.</span>
              Draw lines between dots (horizontal, vertical, diagonal)
            </li>
            <li className="flex gap-2">
              <span className="text-game-primary font-bold">3.</span>
              Complete the 3rd side of a triangle to capture a slice
            </li>
            <li className="flex gap-2">
              <span className="text-game-primary font-bold">4.</span>
              Capturing gives you an extra turn!
            </li>
            <li className="flex gap-2">
              <span className="text-game-primary font-bold">5.</span>
              Most slices wins the prize pool
            </li>
          </ol>
        </motion.div>

        {/* Stats (if connected) */}
        {isConnected && context && (
          <motion.div
            className="card mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-3">
              <img
                src={context.pfpUrl}
                alt={context.displayName}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <p className="font-semibold">{context.displayName}</p>
                <p className="text-xs text-gray-400">FID: {context.fid}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-white/5 rounded-lg p-2">
                <p className="font-bold">42</p>
                <p className="text-xs text-gray-400">Games</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="font-bold">15</p>
                <p className="text-xs text-gray-400">Wins</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <p className="font-bold">156</p>
                <p className="text-xs text-gray-400">Slices</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div className="max-w-lg mx-auto space-y-3">
          <motion.button
            onClick={handlePlayNow}
            disabled={isLoading}
            className="w-full btn-primary text-lg py-4"
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
              className="flex-1 btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🎲 Free Roll
            </motion.button>
            <motion.button
              onClick={() => router.push('/leaderboard')}
              className="flex-1 btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🏆 Leaderboard
            </motion.button>
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
