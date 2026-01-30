'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  PizzaShapesLogo,
  Background,
  WalletDisplayCompact,
} from '@/components';
import { useLeaderboard, useWallet, useFarcaster } from '@/hooks';
import { LeaderboardEntry } from '@/types';

type TabType = 'weekly' | 'lifetime';

export default function LeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('weekly');

  const { weekly, lifetime, isLoading, refreshLeaderboard } = useLeaderboard();
  const { balance } = useWallet();
  const { context, viewToken, viewProfile, shareLeaderboardRank } = useFarcaster();

  const currentData = activeTab === 'weekly' ? weekly : lifetime;

  const handlePlayerClick = (entry: LeaderboardEntry) => {
    viewProfile(entry.player.fid);
  };

  const handleShareRank = (rank: number) => {
    shareLeaderboardRank(rank);
  };

  const formatEarnings = (amount: bigint) => {
    const value = Number(amount) / 10 ** 18;
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
  };

  return (
    <main className="min-h-screen relative">
      <Background />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 p-4 safe-area-top bg-gradient-to-b from-game-dark to-transparent">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <motion.button
            onClick={() => router.push('/')}
            className="p-2 rounded-lg bg-white/10"
            whileTap={{ scale: 0.95 }}
          >
            ← Back
          </motion.button>
          <h1 className="text-lg font-bold">🏆 Leaderboard</h1>
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Main content */}
      <div className="pt-24 pb-8 px-4 max-w-lg mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['weekly', 'lifetime'] as TabType[]).map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-game-primary to-game-secondary text-white'
                  : 'bg-white/10 text-gray-400'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {tab === 'weekly' ? '📅 Weekly' : '🌟 All Time'}
            </motion.button>
          ))}
        </div>

        {/* Prize info */}
        {activeTab === 'weekly' && (
          <motion.div
            className="card mb-6 text-center"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-gray-400 mb-1">Weekly Prize Pool</p>
            <p className="text-2xl font-bold text-game-secondary">10,000 $PIZZA</p>
            <p className="text-xs text-gray-400 mt-1">
              Top 3 players share the prize!
            </p>
          </motion.div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-4xl"
            >
              🍕
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              {/* Top 3 podium */}
              {currentData.length >= 3 && (
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {/* 2nd place */}
                  <motion.div
                    className="card text-center pt-8"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="text-3xl mb-2">🥈</div>
                    <img
                      src={currentData[1].player.pfpUrl}
                      alt={currentData[1].player.displayName}
                      className="w-12 h-12 rounded-full mx-auto mb-2 ring-2 ring-gray-400"
                    />
                    <p className="text-xs font-semibold truncate px-1">
                      {currentData[1].player.displayName}
                    </p>
                    <p className="text-lg font-bold text-gray-400">
                      {activeTab === 'weekly'
                        ? currentData[1].stats.weeklySlices
                        : currentData[1].stats.slicesCaptured}
                    </p>
                    <p className="text-xs text-gray-500">slices</p>
                  </motion.div>

                  {/* 1st place */}
                  <motion.div
                    className="card text-center bg-gradient-to-br from-game-secondary/20 to-game-primary/20 border border-game-secondary/30"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                  >
                    <div className="text-4xl mb-2">🥇</div>
                    <img
                      src={currentData[0].player.pfpUrl}
                      alt={currentData[0].player.displayName}
                      className="w-14 h-14 rounded-full mx-auto mb-2 ring-2 ring-game-secondary"
                    />
                    <p className="text-sm font-semibold truncate px-1">
                      {currentData[0].player.displayName}
                    </p>
                    <p className="text-xl font-bold text-game-secondary">
                      {activeTab === 'weekly'
                        ? currentData[0].stats.weeklySlices
                        : currentData[0].stats.slicesCaptured}
                    </p>
                    <p className="text-xs text-gray-400">slices</p>
                  </motion.div>

                  {/* 3rd place */}
                  <motion.div
                    className="card text-center pt-8"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="text-3xl mb-2">🥉</div>
                    <img
                      src={currentData[2].player.pfpUrl}
                      alt={currentData[2].player.displayName}
                      className="w-12 h-12 rounded-full mx-auto mb-2 ring-2 ring-amber-700"
                    />
                    <p className="text-xs font-semibold truncate px-1">
                      {currentData[2].player.displayName}
                    </p>
                    <p className="text-lg font-bold text-amber-700">
                      {activeTab === 'weekly'
                        ? currentData[2].stats.weeklySlices
                        : currentData[2].stats.slicesCaptured}
                    </p>
                    <p className="text-xs text-gray-500">slices</p>
                  </motion.div>
                </div>
              )}

              {/* Full leaderboard list */}
              <div className="space-y-2">
                {currentData.slice(3).map((entry, index) => (
                  <motion.button
                    key={entry.player.id}
                    onClick={() => handlePlayerClick(entry)}
                    className="w-full card flex items-center gap-3 hover:bg-white/10 transition-colors"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
                      {entry.rank}
                    </div>
                    <img
                      src={entry.player.pfpUrl}
                      alt={entry.player.displayName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-sm">{entry.player.displayName}</p>
                      <p className="text-xs text-gray-400">
                        {entry.stats.wins} wins • {entry.stats.gamesPlayed} games
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-game-primary">
                        {activeTab === 'weekly'
                          ? entry.stats.weeklySlices
                          : entry.stats.slicesCaptured}
                      </p>
                      <p className="text-xs text-gray-400">slices</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Your rank (if not in top 20) */}
              {context && (
                <motion.div
                  className="card mt-4 border border-game-primary/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-game-primary/20 flex items-center justify-center font-bold text-sm text-game-primary">
                      42
                    </div>
                    <img
                      src={context.pfpUrl}
                      alt={context.displayName}
                      className="w-10 h-10 rounded-full ring-2 ring-game-primary"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {context.displayName}
                        <span className="text-game-primary ml-1">(You)</span>
                      </p>
                      <p className="text-xs text-gray-400">156 slices captured</p>
                    </div>
                    <motion.button
                      onClick={() => handleShareRank(42)}
                      className="px-3 py-1 bg-game-primary/20 rounded-lg text-sm text-game-primary"
                      whileTap={{ scale: 0.95 }}
                    >
                      Share
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Refresh button */}
        <motion.button
          onClick={refreshLeaderboard}
          className="w-full mt-6 py-3 bg-white/5 rounded-xl text-gray-400 text-sm"
          whileTap={{ scale: 0.98 }}
        >
          ↻ Refresh
        </motion.button>
      </div>
    </main>
  );
}
