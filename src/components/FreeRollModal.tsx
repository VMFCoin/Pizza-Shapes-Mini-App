'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dice } from './Dice';
import { Confetti } from './Confetti';

interface FreeRollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaim: (selection: number, result: number) => void;
  prizePool: bigint;
}

export function FreeRollModal({ isOpen, onClose, onClaim, prizePool }: FreeRollModalProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [hasWon, setHasWon] = useState(false);

  const formatPrize = (amount: bigint) => {
    const value = Number(amount) / 10 ** 18;
    return value.toFixed(2);
  };

  const handleRoll = () => {
    if (selectedNumber === null) return;

    setIsRolling(true);

    // Simulate roll
    setTimeout(() => {
      const rolledNumber = Math.floor(Math.random() * 6) + 1;
      setResult(rolledNumber);
      setIsRolling(false);

      const won = rolledNumber === selectedNumber;
      setHasWon(won);

      // Notify parent
      setTimeout(() => {
        onClaim(selectedNumber, rolledNumber);
      }, won ? 2000 : 1000);
    }, 1500);
  };

  const handleClose = () => {
    setSelectedNumber(null);
    setResult(null);
    setHasWon(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="bg-gradient-to-br from-game-dark to-gray-900 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-white/10"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center mb-6">
              <motion.h2
                className="text-2xl font-bold text-white mb-2"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎲 Daily Free Roll
              </motion.h2>
              <p className="text-gray-400 text-sm">
                Pick a number and roll to win!
              </p>
              <div className="mt-2 px-4 py-2 bg-game-secondary/20 rounded-lg inline-block">
                <span className="text-game-secondary font-bold">
                  Prize Pool: {formatPrize(prizePool)} $PIZZA
                </span>
              </div>
            </div>

            {/* Number selection */}
            {result === null && (
              <div className="grid grid-cols-6 gap-2 mb-6">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <motion.button
                    key={num}
                    onClick={() => setSelectedNumber(num)}
                    className={`
                      aspect-square rounded-xl text-xl font-bold
                      ${selectedNumber === num
                        ? 'bg-game-primary text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
                      }
                    `}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    disabled={isRolling}
                  >
                    {num}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Dice */}
            <div className="flex justify-center mb-6">
              <Dice
                value={result}
                isRolling={isRolling}
                onRoll={handleRoll}
                disabled={selectedNumber === null || result !== null}
              />
            </div>

            {/* Result */}
            {result !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-4"
              >
                {hasWon ? (
                  <div>
                    <motion.p
                      className="text-3xl font-bold text-game-secondary"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: 3 }}
                    >
                      🎉 YOU WON! 🎉
                    </motion.p>
                    <p className="text-white mt-2">
                      You won a share of the prize pool!
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl text-gray-400">
                      You rolled {result}, needed {selectedNumber}
                    </p>
                    <p className="text-white mt-2">
                      Better luck tomorrow! 🍕
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Instructions */}
            {result === null && selectedNumber !== null && !isRolling && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-gray-400 text-sm mb-4"
              >
                Tap the dice to roll!
              </motion.p>
            )}

            {/* Close button */}
            <motion.button
              onClick={handleClose}
              className="w-full py-3 bg-white/10 rounded-xl text-white font-semibold hover:bg-white/20"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {result !== null ? 'Close' : 'Maybe Later'}
            </motion.button>
          </motion.div>

          {/* Confetti on win */}
          <Confetti isActive={hasWon} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
