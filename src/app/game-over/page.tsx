'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PizzaLogo,
  PlayerCard,
  Confetti,
  Fireworks,
  CoinRain,
  Background,
} from '@/components';
import { useFarcaster, useWallet } from '@/hooks';
import { Player, PLAYER_COLORS } from '@/types';

// Demo match results
const demoResults = {
  players: [
    {
      id: 'player_12345',
      fid: 12345,
      displayName: 'Pizza Fan',
      pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=pizzafan',
      address: '',
      color: PLAYER_COLORS[0],
    },
    {
      id: 'bot_1',
      fid: 100001,
      displayName: 'PizzaBot',
      pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=bot1',
      address: '',
      color: PLAYER_COLORS[1],
    },
  ],
  scores: {
    'player_12345': 8,
    'bot_1': 5,
  },
  prize: BigInt(670) * BigInt(10 ** 15), // 0.67 ETH worth of PIZZA
};

export default function GameOverPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId');
  const winnerId = searchParams.get('winner');

  const { context, shareMatchWin, composeCast } = useFarcaster();
  const { balance } = useWallet();

  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShared, setHasShared] = useState(false);

  const isWinner = winnerId === `player_${context?.fid}`;
  const winner = demoResults.players.find(p => p.id === winnerId) || demoResults.players[0];

  // Trigger celebration animations
  useEffect(() => {
    if (isWinner) {
      setShowCelebration(true);
    }
  }, [isWinner]);

  const formatPrize = (amount: bigint) => {
    const value = Number(amount) / 10 ** 18;
    return value.toFixed(4);
  };

  const handleShare = () => {
    if (isWinner) {
      shareMatchWin(matchId || '', demoResults.scores[winnerId || ''] || 0, demoResults.prize);
    } else {
      composeCast(`Just played Pizza Dots and captured ${demoResults.scores[`player_${context?.fid}`] || 0} slices! 🍕 Can you beat my score?`);
    }
    setHasShared(true);
  };

  const handlePlayAgain = () => {
    router.push('/');
  };

  const handleViewLeaderboard = () => {
    router.push('/leaderboard');
  };

  // Sort players by score
  const rankedPlayers = [...demoResults.players].sort(
    (a, b) => (demoResults.scores[b.id] || 0) - (demoResults.scores[a.id] || 0)
  );

  return (
    <main className="min-h-[100svh] relative overflow-hidden">
      <Background />

      {/* Celebration effects */}
      {showCelebration && (
        <>
          <Confetti isActive={true} duration={5000} />
          <Fireworks isActive={true} />
          <CoinRain isActive={true} />
        </>
      )}

      {/* Main content */}
      <div className="relative z-10 px-4 pt-12 pb-32 min-h-[100svh] flex flex-col justify-center">
        <div className="w-full max-w-lg mx-auto space-y-2">
        {/* Result header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {isWinner ? (
            <>
              <motion.div
                className="text-7xl mb-4"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                🏆
              </motion.div>
              <h1 className="text-3xl font-bold gradient-text mb-2">
                Victory!
              </h1>
              <p className="text-gray-400">You captured the most slices!</p>
            </>
          ) : (
            <>
              <motion.div
                className="text-6xl mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                🍕
              </motion.div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Game Over
              </h1>
              <p className="text-gray-400">Better luck next time!</p>
            </>
          )}
        </motion.div>

        {/* Winner showcase */}
        <motion.div
          className="card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-center mb-4">
            <p className="text-sm text-gray-400 mb-2">Winner</p>
            <div className="flex items-center justify-center gap-3">
              <img
                src={winner.pfpUrl}
                alt={winner.displayName}
                className="w-16 h-16 rounded-full ring-4 ring-game-secondary"
              />
              <div className="text-left">
                <p className="text-xl font-bold text-white">{winner.displayName}</p>
                <p className="text-sm text-gray-400">FID: {winner.fid}</p>
              </div>
            </div>
          </div>

          {/* Prize info */}
          {isWinner && (
            <motion.div
              className="bg-gradient-to-r from-game-primary/20 to-game-secondary/20 rounded-xl p-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-sm text-gray-400 mb-1">You Won</p>
              <p className="text-3xl font-bold text-game-secondary">
                {formatPrize(demoResults.prize)} $PIZZA
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Prize sent to your wallet
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Final standings */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-semibold mb-4">Final Standings</h3>
          <div className="space-y-3">
            {rankedPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </div>
                <img
                  src={player.pfpUrl}
                  alt={player.displayName}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <p className="font-semibold text-white">{player.displayName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: player.color }}>
                    {demoResults.scores[player.id] || 0}
                  </p>
                  <p className="text-xs text-gray-400">slices</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Match stats */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-semibold mb-4">Match Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-game-primary">
                {Object.values(demoResults.scores).reduce((a, b) => a + b, 0)}
              </p>
              <p className="text-xs text-gray-400">Total Slices</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-game-secondary">
                {demoResults.players.length}
              </p>
              <p className="text-xs text-gray-400">Players</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {formatPrize(demoResults.prize)}
              </p>
              <p className="text-xs text-gray-400">$PIZZA Pool</p>
            </div>
          </div>
        </motion.div>

        {/* Prize distribution */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="font-semibold mb-3">Prize Distribution</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">🏆 Match Winner (77%)</span>
              <span className="text-game-secondary font-bold">
                {formatPrize((demoResults.prize * BigInt(77)) / BigInt(100))} $PIZZA
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🎖️ Weekly Pool (10%)</span>
              <span>{formatPrize((demoResults.prize * BigInt(10)) / BigInt(100))} $PIZZA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🔥 Burned (7%)</span>
              <span>{formatPrize((demoResults.prize * BigInt(7)) / BigInt(100))} $PIZZA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🎲 Daily Free Roll (3%)</span>
              <span>{formatPrize((demoResults.prize * BigInt(3)) / BigInt(100))} $PIZZA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">🎗️ Charities (3%)</span>
              <span>{formatPrize((demoResults.prize * BigInt(3)) / BigInt(100))} $PIZZA</span>
            </div>
          </div>
        </motion.div>
        </div>
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg p-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div className="space-y-3">
          <motion.button
            onClick={handleShare}
            className={`w-full btn-primary ${hasShared ? 'opacity-50' : ''}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={hasShared}
          >
            {hasShared ? '✓ Shared!' : '📣 Share Result'}
          </motion.button>

          <div className="flex gap-3">
            <motion.button
              onClick={handlePlayAgain}
              className="flex-1 btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🎮 Play Again
            </motion.button>
            <motion.button
              onClick={handleViewLeaderboard}
              className="flex-1 btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🏆 Leaderboard
            </motion.button>
          </div>
        </div>
      </div>
    </main>
  );
}
