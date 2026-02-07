'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PizzaShapesLogo,
  PlayerCard,
  Background,
  WalletDisplayCompact,
} from '@/components';
import { useWallet, useFarcaster, usePayment } from '@/hooks';
import { usePizzaPrice } from '@/hooks/usePizzaPrice';
import { useRealtimeMatchmaking } from '@/hooks/useRealtimeMatchmaking';
import { getPaymentStepMessage, isPaymentLoading } from '@/hooks/usePayment';
import { ENTRY_TIERS, Player } from '@/types';
import { type Address, formatUnits } from 'viem';
import { tierToAmount } from '@/lib/contracts';
import { supabase } from '@/lib/supabase';

function WaitingRoomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get('tier');
  const tier = tierParam ? parseInt(tierParam) : 1;

  const { address, balance, isConnected } = useWallet();
  const { context, viewToken, viewProfile } = useFarcaster();
  const { paymentState, enterMatchWithPayment, formatPizzaAmount, resetPayment } = usePayment();
  const { priceUsd, isLoading: isPriceLoading, error: priceError, usdToPizza } = usePizzaPrice();

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isAddingBot, setIsAddingBot] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const addBotCalledRef = useRef(false);

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

  // Calculate PIZZA equivalent for current tier
  const pizzaEquivalent = priceUsd
    ? tierToAmount(tier, priceUsd)
    : null;
  const pizzaEquivalentDisplay = pizzaEquivalent && pizzaEquivalent > BigInt(0)
    ? Number(formatUnits(pizzaEquivalent, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : null;

  // Auto-join queue when page loads
  useEffect(() => {
    if (currentPlayer && !isInQueue && isConnected) {
      joinQueue(tier, currentPlayer);
    }
  }, [currentPlayer, isInQueue, isConnected, tier, joinQueue]);

  // Add bot and start match when only 1 player is ready
  const addBotAndStartMatch = useCallback(async () => {
    if (addBotCalledRef.current || !currentPlayer) return;
    addBotCalledRef.current = true;
    setIsAddingBot(true);
    setBotError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('add-bot-player', {
        body: { tier, humanFid: currentPlayer.fid },
      });
      if (invokeError) throw invokeError;
      if (data?.matchId) {
        router.push(`/game?matchId=${data.matchId}&tier=${tier}`);
      }
    } catch (err) {
      console.error('Failed to add bot:', err);
      setBotError('Failed to add bot opponent. Please try again.');
      // Do NOT reset addBotCalledRef — prevents infinite retry loop
    } finally {
      setIsAddingBot(false);
    }
  }, [currentPlayer, tier, router]);

  // Navigate to game when countdown reaches 0 and player is ready
  useEffect(() => {
    if (countdown === 0 && isCurrentPlayerReady) {
      if (readyPlayerCount >= 2) {
        // Enough human players — create normal match
        const newMatchId = `match_${Date.now()}_${tier}`;
        router.push(`/game?matchId=${newMatchId}&tier=${tier}`);
      } else if (readyPlayerCount === 1) {
        // Only 1 ready player — add bot opponent
        addBotAndStartMatch();
      }
    }
  }, [countdown, isCurrentPlayerReady, readyPlayerCount, tier, router, addBotAndStartMatch]);

  // Handle Enter Game payment
  const handleEnterGame = async () => {
    if (!address || !currentPlayer || isProcessingPayment) return;

    if (!priceUsd) {
      return; // Price not loaded yet — button should be disabled
    }

    setIsProcessingPayment(true);
    resetPayment();

    try {
      // Generate a match ID for payment tracking
      const paymentMatchId = `match_${Date.now()}_${tier}`;

      const success = await enterMatchWithPayment(paymentMatchId, tier, address as Address, priceUsd);

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
    <main className="fixed inset-0 flex flex-col">
      <Background />

      {/* Header - Keycap style */}
      <header className="shrink-0 w-full max-w-md mx-auto z-40 px-3 pt-4 safe-area-top bg-gradient-to-b from-game-dark via-game-dark/80 to-transparent">
        <div className="flex items-center justify-between">
          <PizzaShapesLogo />
          <WalletDisplayCompact balance={balance} onViewToken={() => viewToken()} />
        </div>
      </header>

      {/* Main content - scrollable area between header and footer */}
      <div className="flex-1 overflow-y-auto px-3 pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Error display - Keycap style */}
          {error && (
            <motion.div
              className="rounded-xl p-3"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 107, 107, 0.2) 0%, rgba(255, 107, 107, 0.1) 100%)',
                border: '1px solid rgba(255, 107, 107, 0.4)',
                boxShadow: '0 2px 0 0 rgba(204, 85, 85, 0.3)',
              }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-red-400 text-sm font-medium">{error}</p>
            </motion.div>
          )}

          {/* Connection status - Keycap banner */}
          {connectionStatus !== 'connected' && (
            <motion.div
              className="rounded-xl p-3 text-center"
              style={{
                background: 'linear-gradient(180deg, #FFE066 0%, #FFD426 100%)',
                boxShadow: '0 2px 0 0 #CCB352',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-game-dark text-sm font-bold">
                {connectionStatus === 'connecting' ? 'Connecting to server...' : 'Reconnecting...'}
              </p>
            </motion.div>
          )}

          {/* Status card - Main keycap card */}
          <motion.div
            className="card text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              className="text-6xl mb-4"
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {"🍕"}
            </motion.div>
            <h2 
              className="text-xl font-bold mb-2 text-game-light"
              style={{ fontFamily: 'var(--font-lilita), cursive' }}
            >
              {countdown !== null && countdown > 0
                ? `Game starts in ${countdown}s`
                : countdown === 0
                  ? (botError
                    ? 'Bot setup failed'
                    : isAddingBot
                      ? 'Adding bot opponent...'
                      : isCurrentPlayerReady ? 'Starting...' : "Time's up!")
                  : 'Finding Players...'}
            </h2>
            <p className="text-stone-400 text-sm">
              {currentTier?.label} tier - {currentTier?.description}
            </p>
            {readyPlayerCount > 0 && (
              <div 
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: 'linear-gradient(180deg, #58D68D 0%, #46AB71 100%)',
                  boxShadow: '0 2px 0 0 #2D7A4E',
                  color: '#FFF',
                }}
              >
                <span>{"✓"}</span>
                {readyPlayerCount} player{readyPlayerCount !== 1 ? 's' : ''} ready
              </div>
            )}
            {botError && (
              <div className="mt-3 space-y-2">
                <p className="text-red-400 text-xs">{botError}</p>
                <button
                  onClick={() => {
                    addBotCalledRef.current = false;
                    setBotError(null);
                    addBotAndStartMatch();
                  }}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{
                    background: 'linear-gradient(180deg, #FF6B6B 0%, #E05555 100%)',
                    boxShadow: '0 2px 0 0 #B34444',
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {countdown !== null && countdown > 0 && (
              <motion.div
                className="mt-4 inline-flex items-center justify-center w-16 h-16 rounded-xl text-3xl font-bold"
                style={{
                  background: 'linear-gradient(180deg, #FFC875 0%, #FFB347 100%)',
                  boxShadow: '0 4px 0 0 #CC8F39, 0 6px 16px rgba(255, 179, 71, 0.3)',
                  color: '#1C1917',
                  fontFamily: 'var(--font-lilita), cursive',
                }}
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
              <h3 className="font-bold text-game-light">Players ({queuePlayers.length}/{currentTier?.maxPlayers || 2})</h3>
              <span className="text-xs text-stone-400">Min {currentTier?.minPlayers || 2} to start</span>
            </div>

            <div className="space-y-4">
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

              {/* Empty slots - Dashed keycap style */}
              {Array.from({ length: Math.max(0, (currentTier?.maxPlayers || 2) - queuePlayers.length) }).map((_, i) => (
                <motion.div
                  key={`empty-${i}`}
                  className="p-3 rounded-xl border-2 border-dashed border-stone-700 text-center"
                  style={{ background: 'rgba(41, 37, 36, 0.3)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <p className="text-stone-500 text-sm">Waiting for player...</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Tips - Keycap card */}
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h4 className="font-bold mb-3 text-sm text-game-light flex items-center gap-2">
              <span>{"💡"}</span> Pro Tips
            </h4>
            <ul className="text-xs text-stone-400 space-y-4">
              {[
                { color: '#FF6B6B', text: 'Complete triangles to capture pizza slices' },
                { color: '#4ECDC4', text: 'Capturing gives you an extra turn!' },
                { color: '#FFE066', text: 'Diagonal lines open up more possibilities' },
                { color: '#BB8FCE', text: 'Watch out for setups from other players' },
              ].map((tip, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tip.color }}
                  />
                  {tip.text}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>

      {/* Bottom action bar - Keycap buttons */}
      <div className="shrink-0 w-full max-w-md mx-auto px-3 pb-4 safe-area-bottom">
        <div className="card p-4 space-y-4">
          {/* Payment status message */}
          {isPaymentLoading(paymentState.step) && (
            <motion.div
              className="rounded-xl p-3 text-center"
              style={{
                background: 'linear-gradient(180deg, rgba(255, 107, 53, 0.2) 0%, rgba(255, 107, 53, 0.1) 100%)',
                border: '1px solid rgba(255, 107, 53, 0.3)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm text-game-light font-medium">{getPaymentStepMessage(paymentState.step)}</p>
            </motion.div>
          )}

          {paymentState.step === 'error' && (
            <motion.div
              className="rounded-xl p-3 text-center"
              style={{
                background: 'rgba(255, 107, 107, 0.15)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm text-red-400 font-medium">{paymentState.error}</p>
            </motion.div>
          )}

          {/* Price error */}
          {priceError && (
            <motion.div
              className="rounded-xl p-3 text-center"
              style={{
                background: 'rgba(255, 107, 107, 0.15)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-sm text-red-400 font-medium">Unable to fetch PIZZA price. Cannot enter game.</p>
            </motion.div>
          )}

          {/* Enter Game / Ready button - Keycap style */}
          {isCurrentPlayerReady ? (
            <motion.div
              className="w-full py-4 rounded-xl font-bold text-lg text-center"
              style={{
                background: 'linear-gradient(180deg, #58D68D 0%, #46AB71 100%)',
                boxShadow: '0 3px 0 0 #2D7A4E, 0 4px 12px rgba(88, 214, 141, 0.3)',
                color: '#FFF',
              }}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
            >
              <span className="flex items-center justify-center gap-2">
                <span>{"✓"}</span> Ready!
              </span>
            </motion.div>
          ) : (
            <div>
              <motion.button
                onClick={handleEnterGame}
                className="w-full btn-primary py-4 text-base"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isProcessingPayment || countdown === 0 || !priceUsd || isPriceLoading}
              >
                {isProcessingPayment
                  ? 'Processing...'
                  : isPriceLoading
                    ? 'Loading price...'
                    : `Enter Game - $${currentTier?.amount.toFixed(2) || '0.50'}`}
              </motion.button>
              {pizzaEquivalentDisplay && (
                <p className="text-xs text-stone-500 text-center mt-1">
                  ~{pizzaEquivalentDisplay} PIZZA at current price
                </p>
              )}
            </div>
          )}

          {/* Leave Queue button - only show if not ready */}
          {!isCurrentPlayerReady && (
            <motion.button
              onClick={handleLeave}
              className="w-full btn-secondary py-3"
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
            {"🍕"}
          </motion.div>
        </div>
      }
    >
      <WaitingRoomContent />
    </Suspense>
  );
}
