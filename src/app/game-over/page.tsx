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
import { supabase } from '@/lib/supabase';
import { Player, PLAYER_COLORS } from '@/types';

interface MatchData {
  players: Player[];
  scores: Record<string, number>;
  totalPool: string | null;
  winnerPrize: string | null;
  winnerId: string | null;
}

function GameOverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('matchId');
  const winnerIdParam = searchParams.get('winner');

  const { context, shareMatchWin, composeCast, shareInvite } = useFarcaster();

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasShared, setHasShared] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch real match data from Supabase
  useEffect(() => {
    if (!matchId) {
      setIsLoadingMatch(false);
      return;
    }

    const fetchMatchData = async () => {
      try {
        const { data: match, error: matchErr } = await supabase
          .from('matches')
          .select(`
            *,
            match_players (
              player_fid,
              color,
              player_index,
              is_bot,
              score,
              players (
                fid,
                display_name,
                pfp_url,
                address
              )
            )
          `)
          .eq('id', matchId)
          .single();

        if (matchErr || !match) {
          console.error('Failed to fetch match:', matchErr);
          setIsLoadingMatch(false);
          return;
        }

        const matchAny = match as any;

        // Build players array from match_players
        const players: Player[] = (matchAny.match_players || [])
          .sort((a: any, b: any) => a.player_index - b.player_index)
          .map((mp: any) => ({
            id: `player_${mp.player_fid}`,
            fid: mp.player_fid,
            displayName: mp.players?.display_name || `Player ${mp.player_fid}`,
            pfpUrl: mp.players?.pfp_url || '',
            address: mp.players?.address || '',
            color: mp.color || PLAYER_COLORS[mp.player_index % PLAYER_COLORS.length],
            isBot: mp.is_bot,
          }));

        // Build scores from match_players.score
        const scores: Record<string, number> = {};
        for (const mp of matchAny.match_players || []) {
          scores[`player_${mp.player_fid}`] = mp.score || 0;
        }

        // Try to fetch settlement data for prize amounts
        const { data: settlement } = await supabase
          .from('match_settlements' as any)
          .select('winner_prize, total_pool')
          .eq('match_id', matchId)
          .single();

        const settlementAny = settlement as any;

        setMatchData({
          players,
          scores,
          totalPool: settlementAny?.total_pool || null,
          winnerPrize: settlementAny?.winner_prize || null,
          winnerId: matchAny.winner_fid ? `player_${matchAny.winner_fid}` : winnerIdParam,
        });
      } catch (err) {
        console.error('Failed to fetch match data:', err);
      } finally {
        setIsLoadingMatch(false);
      }
    };

    fetchMatchData();
  }, [matchId, winnerIdParam]);

  const players = matchData?.players || [];
  const scores = matchData?.scores || {};

  // Detect tie: if no single winnerId, find all players with max score
  const maxScore = Object.values(scores).length > 0 ? Math.max(...Object.values(scores)) : 0;
  const tiedWinnerIds = Object.entries(scores)
    .filter(([, s]) => s === maxScore && maxScore > 0)
    .map(([id]) => id);
  const isTie = !matchData?.winnerId && tiedWinnerIds.length > 1;

  const winnerId = matchData?.winnerId || winnerIdParam;
  const isWinner = isTie
    ? tiedWinnerIds.includes(`player_${context?.fid}`)
    : winnerId === `player_${context?.fid}`;
  const winnerPlayer = isTie
    ? players.find(p => tiedWinnerIds.includes(p.id)) || players[0]
    : players.find(p => p.id === winnerId) || players[0];
  const tiedPlayers = isTie ? players.filter(p => tiedWinnerIds.includes(p.id)) : [];

  // Trigger celebration animations and show invite modal after delay
  useEffect(() => {
    if (isLoadingMatch) return;
    if (isWinner) {
      setShowCelebration(true);
    }
    const timer = setTimeout(() => {
      setShowInviteModal(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [isWinner, isLoadingMatch]);

  const formatPool = (weiStr: string) => {
    const value = Number(weiStr) / 10 ** 18;
    return value.toFixed(4);
  };

  const handleShare = () => {
    const myPlayerId = `player_${context?.fid}`;
    const myScore = scores[myPlayerId] || 0;
    if (isTie && isWinner) {
      composeCast(`Tied for first in Pizza Dots with ${myScore} slices! We split the winnings 🤝🍕`);
    } else if (isWinner && matchData?.winnerPrize) {
      shareMatchWin(matchId || '', myScore, BigInt(matchData.winnerPrize));
    } else {
      composeCast(`Just played Pizza Dots and captured ${myScore} slices! Can you beat my score?`);
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
  const rankedPlayers = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  const totalSlices = Object.values(scores).reduce((a, b) => a + b, 0);
  const hasSettlement = !!matchData?.totalPool;

  // Loading state
  if (isLoadingMatch) {
    return (
      <main className="min-h-[100svh] relative overflow-hidden flex items-center justify-center">
        <Background />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          {"🍕"}
        </motion.div>
      </main>
    );
  }

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
          {isTie && isWinner ? (
            <>
              <motion.div
                className="text-7xl mb-4"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                {"🤝"}
              </motion.div>
              <h1
                className="text-4xl font-bold gradient-text mb-2"
                style={{ fontFamily: 'var(--font-lilita), cursive' }}
              >
                It&apos;s a Tie!
              </h1>
              <p className="text-stone-400">You split the winnings with {tiedPlayers.length - 1} other player{tiedPlayers.length > 2 ? 's' : ''}!</p>
            </>
          ) : isWinner ? (
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
        {(winnerPlayer || isTie) && (
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
            <p className="text-sm text-stone-400 mb-3">{isTie ? '🤝 Tied Winners' : '🎉 Winner'}</p>
            {isTie ? (
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {tiedPlayers.map(tp => (
                  <div key={tp.id} className="flex flex-col items-center gap-1">
                    {tp.pfpUrl ? (
                      <img
                        src={tp.pfpUrl}
                        alt={tp.displayName}
                        className="w-14 h-14 rounded-full ring-4 ring-game-secondary"
                        style={{ boxShadow: '0 0 20px rgba(255, 179, 71, 0.3)' }}
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full ring-4 ring-game-secondary flex items-center justify-center text-xl"
                        style={{ background: tp.color, boxShadow: '0 0 20px rgba(255, 179, 71, 0.3)' }}
                      >
                        {"🍕"}
                      </div>
                    )}
                    <p className="text-sm font-bold text-game-light">{tp.displayName}</p>
                    <p className="text-xs text-stone-400">{scores[tp.id] || 0} slices</p>
                  </div>
                ))}
              </div>
            ) : winnerPlayer && (
              <div className="flex items-center justify-center gap-2">
                {winnerPlayer.pfpUrl ? (
                  <img
                    src={winnerPlayer.pfpUrl}
                    alt={winnerPlayer.displayName}
                    className="w-16 h-16 rounded-full ring-4 ring-game-secondary"
                    style={{ boxShadow: '0 0 20px rgba(255, 179, 71, 0.3)' }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full ring-4 ring-game-secondary flex items-center justify-center text-2xl"
                    style={{ background: winnerPlayer.color, boxShadow: '0 0 20px rgba(255, 179, 71, 0.3)' }}
                  >
                    {"🍕"}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xl font-bold text-game-light">{winnerPlayer.displayName}</p>
                  <p className="text-sm text-stone-400">
                    {scores[winnerPlayer.id] || 0} slices captured
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Prize info */}
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
              {hasSettlement ? (
                <>
                  <p className="text-sm text-game-dark/70 mb-1">
                    {isTie ? `Split ${tiedPlayers.length} Ways` : 'You Won'}
                  </p>
                  <p
                    className="text-3xl font-bold text-game-dark"
                    style={{ fontFamily: 'var(--font-lilita), cursive' }}
                  >
                    {formatPool(matchData!.winnerPrize!)} $PIZZA
                  </p>
                  <p className="text-xs text-game-dark/60 mt-1">
                    {isTie ? 'Your share sent to your wallet 💰' : 'Prize sent to your wallet 💰'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-game-dark/70 mb-1">
                    {isTie ? `Tied! Split ${tiedPlayers.length} Ways` : 'You Won!'}
                  </p>
                  <p className="text-lg font-bold text-game-dark">
                    Settlement pending...
                  </p>
                  <p className="text-xs text-game-dark/60 mt-1">
                    {isTie ? 'Your share will be sent to your wallet 💰' : 'Prize will be sent to your wallet 💰'}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
        )}

        {/* Final standings - Keycap list style */}
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-bold mb-4 text-game-light">{"🏅"} Final Standings</h3>
          <div className="space-y-4">
            {rankedPlayers.map((player, index) => {
              const isTopPlayer = isTie ? tiedWinnerIds.includes(player.id) : index === 0;
              // Calculate rank position: tied players share same rank
              const playerScore = scores[player.id] || 0;
              const rank = Object.values(scores).filter(s => s > playerScore).length + 1;
              const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
              return (
              <motion.div
                key={player.id}
                className="flex items-center gap-2 p-2 rounded-xl"
                style={{
                  background: isTopPlayer ? 'rgba(255, 179, 71, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: isTopPlayer ? '1px solid rgba(255, 179, 71, 0.2)' : 'none',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
              >
                <div
                  className="number-badge"
                  style={isTopPlayer ? {
                    background: 'linear-gradient(180deg, #FFC875 0%, #FFB347 100%)',
                    color: '#1C1917',
                    boxShadow: '0 2px 0 0 #CC8F39',
                  } : {
                    background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
                    color: '#A8A29E',
                    boxShadow: '0 2px 0 0 #1C1917',
                  }}
                >
                  {rankLabel}
                </div>
                {player.pfpUrl ? (
                  <img
                    src={player.pfpUrl}
                    alt={player.displayName}
                    className="w-10 h-10 rounded-full ring-1 ring-stone-600"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full ring-1 ring-stone-600 flex items-center justify-center"
                    style={{ background: player.color }}
                  >
                    {"🍕"}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-game-light">{player.displayName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span>{"🍕"}</span>
                  <span className="font-bold text-lg" style={{ color: player.color }}>
                    {scores[player.id] || 0}
                  </span>
                </div>
              </motion.div>
              );
            })}
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
              { value: totalSlices, label: 'Total Slices', color: '#FF6B35' },
              { value: players.length, label: 'Players', color: '#4ECDC4' },
              { value: hasSettlement ? formatPool(matchData!.totalPool!) : '--', label: '$PIZZA Pool', color: '#FFB347' },
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
          {isTie && (
            <div className="mt-3 text-center">
              <span className="text-xs px-3 py-1 rounded-full bg-game-secondary/20 text-game-secondary">
                Tied! Winnings split between co-winners
              </span>
            </div>
          )}
        </motion.div>

        {/* Prize distribution - Clean list */}
        {hasSettlement && (
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="font-bold mb-3 text-game-light">{"💰"} Prize Distribution</h3>
          <div className="space-y-4 text-sm">
            {(() => {
              const pool = BigInt(matchData!.totalPool!);
              return [
                { emoji: '🏆', label: isTie ? `Split ${tiedPlayers.length} Ways (77%)` : 'Match Winner (77%)', value: formatPool(((pool * BigInt(77)) / BigInt(100)).toString()), highlight: true },
                { emoji: '🎖️', label: 'Weekly Pool (10%)', value: formatPool(((pool * BigInt(10)) / BigInt(100)).toString()) },
                { emoji: '🔥', label: 'Burned (7%)', value: formatPool(((pool * BigInt(7)) / BigInt(100)).toString()) },
                { emoji: '🎲', label: 'Daily Free Roll (3%)', value: formatPool(((pool * BigInt(3)) / BigInt(100)).toString()) },
                { emoji: '🎗️', label: 'Charities (3%)', value: formatPool(((pool * BigInt(3)) / BigInt(100)).toString()) },
              ];
            })().map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-stone-400">{item.emoji} {item.label}</span>
                <span className={item.highlight ? 'text-game-secondary font-bold' : 'text-stone-300'}>
                  {item.value} $PIZZA
                </span>
              </div>
            ))}
          </div>
        </motion.div>
        )}
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
