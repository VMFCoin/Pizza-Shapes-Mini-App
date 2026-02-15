'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@/types';
import { useState, useEffect } from 'react';

interface InitialRollDisplayProps {
  players: Player[];
  onComplete: () => void;
}

export function InitialRollDisplay({ players, onComplete }: InitialRollDisplayProps) {
  const [showRolls, setShowRolls] = useState(false);
  const [highlightWinner, setHighlightWinner] = useState(false);

  // Find highest roll
  const sortedPlayers = [...players].sort((a, b) => (b.initialRoll || 0) - (a.initialRoll || 0));
  const highestRoll = sortedPlayers[0]?.initialRoll || 0;
  const winner = sortedPlayers[0];

  useEffect(() => {
    // Sequence: wait 500ms → show rolls → wait 2s → highlight winner → wait 1.5s → complete
    const showTimer = setTimeout(() => setShowRolls(true), 500);
    const highlightTimer = setTimeout(() => setHighlightWinner(true), 2500);
    const completeTimer = setTimeout(() => onComplete(), 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(highlightTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-game-dark/95 backdrop-blur-sm">
      <div className="w-full max-w-md px-4">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2
            className="text-3xl font-bold text-game-secondary mb-2"
            style={{ fontFamily: 'var(--font-lilita), cursive' }}
          >
            Roll for Turn Order!
          </h2>
          <p className="text-stone-400 text-sm">Highest roll goes first</p>
        </motion.div>

        {/* Player rolls */}
        <div className="space-y-3">
          {players.map((player, index) => {
            const isWinner = highlightWinner && player.initialRoll === highestRoll;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -50 }}
                animate={{
                  opacity: 1,
                  x: 0,
                  scale: isWinner ? 1.05 : 1,
                }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: isWinner
                    ? `linear-gradient(135deg, ${player.color}40 0%, ${player.color}20 100%)`
                    : 'linear-gradient(180deg, rgba(30, 30, 50, 0.8), rgba(20, 20, 35, 0.9))',
                  border: isWinner ? `2px solid ${player.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: isWinner ? `0 0 20px ${player.color}80` : 'none',
                }}
              >
                {/* Player info */}
                <div className="flex items-center gap-3">
                  {player.pfpUrl && (
                    <img
                      src={player.pfpUrl}
                      alt={player.displayName}
                      className="w-10 h-10 rounded-full border-2"
                      style={{ borderColor: player.color }}
                    />
                  )}
                  <div>
                    <p
                      className="font-bold"
                      style={{ color: player.color }}
                    >
                      {player.displayName}
                    </p>
                    {isWinner && highlightWinner && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-game-secondary"
                      >
                        Goes first! 👑
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Dice roll */}
                <AnimatePresence>
                  {showRolls && player.initialRoll && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{
                        scale: isWinner ? 1.2 : 1,
                        rotate: 0,
                      }}
                      className="w-16 h-16 flex items-center justify-center rounded-xl"
                      style={{
                        background: isWinner
                          ? `linear-gradient(135deg, ${player.color} 0%, ${player.color}CC 100%)`
                          : 'linear-gradient(135deg, #4ECDC4 0%, #3EA89D 100%)',
                        boxShadow: isWinner
                          ? `0 4px 12px ${player.color}60, 0 0 20px ${player.color}40`
                          : '0 4px 12px rgba(78, 205, 196, 0.4)',
                      }}
                    >
                      <span className="text-2xl font-bold text-white">
                        {player.initialRoll}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Winner announcement */}
        <AnimatePresence>
          {highlightWinner && winner && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 text-center"
            >
              <motion.p
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-lg font-bold"
                style={{ color: winner.color }}
              >
                {winner.displayName} starts the game!
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
