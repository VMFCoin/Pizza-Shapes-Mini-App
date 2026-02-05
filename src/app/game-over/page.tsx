'use client';

import { useEffect, useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Confetti,
  Fireworks,
  CoinRain,
  Background,
  ShareInviteModal,
} from '@/components';
import { useFarcaster } from '@/hooks';
import { Player, PLAYER_COLORS } from '@/types';

// Demo match results
const demoResults: {
  players: Player[];
  scores: Record<string, number>;
  prize: bigint;
} = {
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

function GameOverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId');
  const winnerId = searchParams.get('winner');

  const { context, shareMatchWin, composeCast, shareInvite } = useFarcaster();

  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isWinner = winnerId === `player_${context?.fid}`;
  const winner = demoResults.players.find(p => p.id === winnerId) || demoResults.players[0];

  // Trigger celebration animations and show invite modal after delay
  useEffect(() => {
    if (isWinner) {
      setShowCelebration(true);
    }
    // Show invite modal after 3 seconds
    const timer = setTimeout(() => {
      setShowInviteModal(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isWinner]);

  const formatPrize = (amount: bigint) => {
    const value = Number(amount) / 10 ** 18;
    return value.toFixed(4);
  };

  const handleShare = () => {
    if (isWinner) {
      shareMatchWin(matchId || '', demoResults.scores[winnerId || ''] || 0, demoResults.prize);
    } else {
      composeCast(`Just played Pizza Dots and captured ${demoResults.scores[`player_${context?.fid}`] || 0} slices! Can you beat my score?`);
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
      <div className="relative z-10 px-3 pt-12 pb-32 min-h-[100svh] flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto space-y-4">
        {/* Result header - Fun keycap style */}
        <motion.div
          className="text-center mb-6"
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
                {"🏆"}
              </motion.div>
              <h1 
                className="text-4xl font-bold gradient-text mb-2"
                style={{ fontFamily: 'var(--font-lilita), cursive' }}
              >
                Victory!
              </h1>
              <p className="text-stone-400">You captured the most slices!</p>
            </>
          ) : (
            <>
              <motion.div
                className="text-6xl mb-4"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                {"🍕"}
              </motion.div>
              <h1 
                className="text-3xl font-bold text-game-light mb-2"
                style={{ fontFamily: 'var(--font-lilita), cursive' }}
              >
                Game Over
              </h1>
              <p className="text-stone-400">Better luck next time!</p>
            </>
          )}
        </motion.div>

        {/* Winner showcase - Keycap card */}
        <motion.div
          className="card"
          style={isWinner ? {
            background: 'linear-gradient(180deg, rgba(255, 179, 71, 0.15) 0%, rgba(255, 107, 53, 0.08) 100%)',
            border: '1px solid rgba(255, 179, 71, 0.3)',
            boxShadow: '0 0 20px rgba(255, 179, 71, 0.15)',
          } : {}}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-center mb-4">
            <p className="text-sm text-stone-400 mb-3">{"🎉"} Winner</p>
            <div className="flex items-center justify-center gap-2">
              <img
                src={winner.pfpUrl}
                alt={winner.displayName}
                className="w-16 h-16 rounded-full ring-4 ring-game-secondary"
                style={{ boxShadow: '0 0 20px rgba(255, 179, 71, 0.3)' }}
              />
              <div className="text-left">
                <p className="text-xl font-bold text-game-light">{winner.displayName}</p>
                <p className="text-sm text-stone-400">FID: {winner.fid}</p>
              </div>
            </div>
          </div>

          {/* Prize info - Fun keycap badge */}
          {isWinner && (
            <motion.div
              className="rounded-xl p-4 text-center"
              style={{
                background: 'linear-gradient(180deg, #FFC875 0%, #FFB347 100%)',
                boxShadow: '0 4px 0 0 #CC8F39, 0 6px 16px rgba(255, 179, 71, 0.3)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-sm text-game-dark/70 mb-1">You Won</p>
              <p 
                className="text-3xl font-bold text-game-dark"
                style={{ fontFamily: 'var(--font-lilita), cursive' }}
              >
                {formatPrize(demoResults.prize)} $PIZZA
              </p>
              <p className="text-xs text-game-dark/60 mt-1">
                Prize sent to your wallet {"💰"}
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Final standings - Keycap list style */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-bold mb-4 text-game-light">{"🏅"} Final Standings</h3>
          <div className="space-y-4">
            {rankedPlayers.map((player, index) => (
              <motion.div
                key={player.id}
                className="flex items-center gap-2 p-2 rounded-xl"
                style={{
                  background: index === 0 ? 'rgba(255, 179, 71, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: index === 0 ? '1px solid rgba(255, 179, 71, 0.2)' : 'none',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div 
                  className="number-badge"
                  style={index === 0 ? {
                    background: 'linear-gradient(180deg, #FFC875 0%, #FFB347 100%)',
                    color: '#1C1917',
                    boxShadow: '0 2px 0 0 #CC8F39',
                  } : {
                    background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
                    color: '#A8A29E',
                    boxShadow: '0 2px 0 0 #1C1917',
                  }}
                >
                  {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`}
                </div>
                <img
                  src={player.pfpUrl}
                  alt={player.displayName}
                  className="w-10 h-10 rounded-full ring-1 ring-stone-600"
                />
                <div className="flex-1">
                  <p className="font-bold text-game-light">{player.displayName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span>{"🍕"}</span>
                  <span className="font-bold text-lg" style={{ color: player.color }}>
                    {demoResults.scores[player.id] || 0}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Match stats - Keycap stat cards */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="font-bold mb-4 text-game-light">{"📊"} Match Stats</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { value: Object.values(demoResults.scores).reduce((a, b) => a + b, 0), label: 'Total Slices', color: '#FF6B35' },
              { value: demoResults.players.length, label: 'Players', color: '#4ECDC4' },
              { value: formatPrize(demoResults.prize), label: '$PIZZA Pool', color: '#FFB347' },
            ].map((stat, i) => (
              <div 
                key={i}
                className="p-3 rounded-xl"
                style={{
                  background: `${stat.color}15`,
                  border: `1px solid ${stat.color}30`,
                }}
              >
                <p className="text-2xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-xs text-stone-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Prize distribution - Clean list */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="font-bold mb-3 text-game-light">{"💰"} Prize Distribution</h3>
          <div className="space-y-4 text-sm">
            {[
              { emoji: '🏆', label: 'Match Winner (77%)', value: formatPrize((demoResults.prize * BigInt(77)) / BigInt(100)), highlight: true },
              { emoji: '🎖️', label: 'Weekly Pool (10%)', value: formatPrize((demoResults.prize * BigInt(10)) / BigInt(100)) },
              { emoji: '🔥', label: 'Burned (7%)', value: formatPrize((demoResults.prize * BigInt(7)) / BigInt(100)) },
              { emoji: '🎲', label: 'Daily Free Roll (3%)', value: formatPrize((demoResults.prize * BigInt(3)) / BigInt(100)) },
              { emoji: '🎗️', label: 'Charities (3%)', value: formatPrize((demoResults.prize * BigInt(3)) / BigInt(100)) },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-stone-400">{item.emoji} {item.label}</span>
                <span className={item.highlight ? 'text-game-secondary font-bold' : 'text-stone-300'}>
                  {item.value} $PIZZA
                </span>
              </div>
            ))}
          </div>
        </motion.div>
        </div>
      </div>

      {/* Bottom actions - Keycap buttons */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-3 pb-4 bg-gradient-to-t from-game-dark via-game-dark to-transparent safe-area-bottom">
        <div className="card p-4 space-y-4">
          <motion.button
            onClick={handleShare}
            className={`w-full btn-primary py-4 text-base ${hasShared ? 'opacity-50' : ''}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={hasShared}
          >
            {hasShared ? '✓ Shared!' : '📣 Share Result'}
          </motion.button>

          <div className="flex gap-2">
            <motion.button
              onClick={handlePlayAgain}
              className="flex-1 keycap-teal py-3 text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {"🎮"} Play Again
            </motion.button>
            <motion.button
              onClick={handleViewLeaderboard}
              className="flex-1 keycap-secondary py-3 text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {"🏆"} Leaderboard
            </motion.button>
          </div>
        </div>
      </div>

      {/* Invite friends modal */}
      <ShareInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onShare={shareInvite}
        onSkip={() => setShowInviteModal(false)}
      />
    </main>
  );
}

export default function GameOverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-game-dark">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="text-6xl"
          >
            {"🍕"}
          </motion.div>
        </div>
      }
    >
      <GameOverContent />
    </Suspense>
  );
}
