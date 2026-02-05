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
    <main className="min-h-[100svh] relative">
      <Background />

      {/* Header - Keycap style */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-3 pt-4 safe-area-top bg-gradient-to-b from-game-dark via-game-dark/90 to-transparent">
        <div className="flex items-center justify-between">
          <motion.button
            onClick={() => router.push('/')}
            className="px-3 py-2 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
              boxShadow: '0 2px 0 0 #1C1917, inset 0 1px 0 rgba(255,255,255,0.05)',
              color: '#FAFAF9',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98, boxShadow: '0 0 0 0 #1C1917' }}
          >
            {"← Back"}
          </motion.button>
          <h1 
            className="text-lg font-bold text-game-light flex items-center gap-2"
            style={{ fontFamily: 'var(--font-lilita), cursive' }}
          >
            <span>{"🏆"}</span> Leaderboard
          </h1>
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Main content */}
      <div className="pt-24 pb-8 px-3 min-h-[100svh] flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Tabs - Keycap style */}
          <div className="flex gap-2">
            {(['weekly', 'lifetime'] as TabType[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <motion.button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm"
                  style={isActive ? {
                    background: 'linear-gradient(180deg, #FF8C5A 0%, #FF6B35 100%)',
                    color: '#FFF',
                    boxShadow: '0 3px 0 0 #CC5429, 0 4px 12px rgba(255, 107, 53, 0.3)',
                  } : {
                    background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
                    color: '#A8A29E',
                    boxShadow: '0 2px 0 0 #1C1917',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {tab === 'weekly' ? '📅 Weekly' : '🌟 All Time'}
                </motion.button>
              );
            })}
          </div>

          {/* Prize info - Fun keycap card */}
          {activeTab === 'weekly' && (
            <motion.div
              className="card text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm text-stone-400 mb-2">Weekly Prize Pool</p>
              <div 
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl mb-2"
                style={{
                  background: 'linear-gradient(180deg, #FFC875 0%, #FFB347 100%)',
                  boxShadow: '0 3px 0 0 #CC8F39, 0 4px 12px rgba(255, 179, 71, 0.3)',
                }}
              >
                <span className="text-2xl">{"🍕"}</span>
                <span 
                  className="text-2xl font-bold text-game-dark"
                  style={{ fontFamily: 'var(--font-lilita), cursive' }}
                >
                  10,000 $PIZZA
                </span>
              </div>
              <p className="text-xs text-stone-400">Top 3 players share the prize!</p>
            </motion.div>
          )}

          {/* Loading state */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <motion.div
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="text-4xl"
              >
                {"🍕"}
              </motion.div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
              {/* Top 3 podium - Keycap style */}
              {currentData.length >= 3 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {/* 2nd place */}
                  <motion.div
                    className="card text-center pt-6"
                    style={{
                      background: 'linear-gradient(180deg, rgba(168, 162, 158, 0.15) 0%, rgba(168, 162, 158, 0.05) 100%)',
                      border: '1px solid rgba(168, 162, 158, 0.3)',
                    }}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="text-3xl mb-2">{"🥈"}</div>
                    <img
                      src={currentData[1].player.pfpUrl}
                      alt={currentData[1].player.displayName}
                      className="w-11 h-11 rounded-full mx-auto mb-2 ring-2 ring-stone-400"
                    />
                    <p className="text-xs font-bold text-game-light truncate px-1">
                      {currentData[1].player.displayName}
                    </p>
                    <p className="text-lg font-bold text-stone-400">
                      {activeTab === 'weekly'
                        ? currentData[1].stats.weeklySlices
                        : currentData[1].stats.slicesCaptured}
                    </p>
                    <p className="text-xs text-stone-500">slices</p>
                  </motion.div>

                  {/* 1st place */}
                  <motion.div
                    className="card text-center -mt-2"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255, 179, 71, 0.2) 0%, rgba(255, 107, 53, 0.1) 100%)',
                      border: '1px solid rgba(255, 179, 71, 0.4)',
                      boxShadow: '0 0 20px rgba(255, 179, 71, 0.2)',
                    }}
                    initial={{ y: 20, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                  >
                    <motion.div 
                      className="text-4xl mb-2"
                      animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      {"🥇"}
                    </motion.div>
                    <img
                      src={currentData[0].player.pfpUrl}
                      alt={currentData[0].player.displayName}
                      className="w-14 h-14 rounded-full mx-auto mb-2 ring-2 ring-game-secondary"
                    />
                    <p className="text-sm font-bold text-game-light truncate px-1">
                      {currentData[0].player.displayName}
                    </p>
                    <p 
                      className="text-xl font-bold text-game-secondary"
                      style={{ fontFamily: 'var(--font-lilita), cursive' }}
                    >
                      {activeTab === 'weekly'
                        ? currentData[0].stats.weeklySlices
                        : currentData[0].stats.slicesCaptured}
                    </p>
                    <p className="text-xs text-stone-400">slices</p>
                  </motion.div>

                  {/* 3rd place */}
                  <motion.div
                    className="card text-center pt-6"
                    style={{
                      background: 'linear-gradient(180deg, rgba(205, 127, 50, 0.15) 0%, rgba(205, 127, 50, 0.05) 100%)',
                      border: '1px solid rgba(205, 127, 50, 0.3)',
                    }}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="text-3xl mb-2">{"🥉"}</div>
                    <img
                      src={currentData[2].player.pfpUrl}
                      alt={currentData[2].player.displayName}
                      className="w-11 h-11 rounded-full mx-auto mb-2 ring-2 ring-amber-700"
                    />
                    <p className="text-xs font-bold text-game-light truncate px-1">
                      {currentData[2].player.displayName}
                    </p>
                    <p className="text-lg font-bold text-amber-600">
                      {activeTab === 'weekly'
                        ? currentData[2].stats.weeklySlices
                        : currentData[2].stats.slicesCaptured}
                    </p>
                    <p className="text-xs text-stone-500">slices</p>
                  </motion.div>
                </div>
              )}

              {/* Full leaderboard list - Keycap style rows */}
              <div className="space-y-4">
                {currentData.slice(3).map((entry, index) => (
                  <motion.button
                    key={entry.player.id}
                    onClick={() => handlePlayerClick(entry)}
                    className="w-full card flex items-center gap-2 hover:scale-[1.01] transition-transform"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <div 
                      className="number-badge"
                      style={{
                        background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
                        color: '#A8A29E',
                        boxShadow: '0 2px 0 0 #1C1917',
                      }}
                    >
                      {entry.rank}
                    </div>
                    <img
                      src={entry.player.pfpUrl}
                      alt={entry.player.displayName}
                      className="w-10 h-10 rounded-full ring-1 ring-stone-600"
                    />
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm text-game-light">{entry.player.displayName}</p>
                      <p className="text-xs text-stone-400">
                        {entry.stats.wins} wins {"•"} {entry.stats.gamesPlayed} games
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-game-primary">
                        {activeTab === 'weekly'
                          ? entry.stats.weeklySlices
                          : entry.stats.slicesCaptured}
                      </p>
                      <p className="text-xs text-stone-400">slices</p>
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Your rank (if not in top 20) - Keycap highlighted */}
              {context && (
                <motion.div
                  className="card mt-4"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255, 107, 53, 0.15) 0%, rgba(255, 107, 53, 0.05) 100%)',
                    border: '1px solid rgba(255, 107, 53, 0.3)',
                    boxShadow: '0 0 12px rgba(255, 107, 53, 0.15)',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="number-badge"
                      style={{
                        background: 'linear-gradient(180deg, #FF8C5A 0%, #FF6B35 100%)',
                        color: '#FFF',
                        boxShadow: '0 2px 0 0 #CC5429',
                      }}
                    >
                      42
                    </div>
                    <img
                      src={context.pfpUrl}
                      alt={context.displayName}
                      className="w-10 h-10 rounded-full ring-2 ring-game-primary"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-game-light">
                        {context.displayName}
                        <span className="text-game-primary ml-1">(You)</span>
                      </p>
                      <p className="text-xs text-stone-400">156 slices captured</p>
                    </div>
                    <motion.button
                      onClick={() => handleShareRank(42)}
                      className="keycap-primary px-4 py-2 text-sm"
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

          {/* Refresh button - Keycap style */}
          <motion.button
            onClick={refreshLeaderboard}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
              color: '#A8A29E',
              boxShadow: '0 2px 0 0 #1C1917',
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {"↻"} Refresh
          </motion.button>
        </div>
      </div>
    </main>
  );
}
