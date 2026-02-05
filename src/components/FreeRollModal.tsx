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

// Keycap colors for number buttons
const NUMBER_COLORS = [
  { bg: '#FF6B6B', shadow: '#CC5555' }, // 1 - Red
  { bg: '#FFE066', shadow: '#CCB352', text: '#1C1917' }, // 2 - Yellow
  { bg: '#4ECDC4', shadow: '#3EA89D' }, // 3 - Teal
  { bg: '#BB8FCE', shadow: '#9572A5' }, // 4 - Purple
  { bg: '#58D68D', shadow: '#46AB71' }, // 5 - Green
  { bg: '#5DADE2', shadow: '#4A8AB5' }, // 6 - Blue
];

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="card-elevated max-w-sm w-full mx-4 p-6"
            style={{
              background: 'linear-gradient(180deg, #3D3835 0%, #292524 100%)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 4px 0 0 #1C1917',
            }}
            initial={{ scale: 0.8, y: 50, rotate: -5 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.8, y: 50, rotate: 5 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with fun styling */}
            <div className="text-center mb-6">
              <motion.div
                className="text-5xl mb-3"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {"🎲"}
              </motion.div>
              <h2 
                className="text-2xl font-bold text-game-light mb-2"
                style={{ fontFamily: 'var(--font-lilita), cursive' }}
              >
                Daily Free Roll
              </h2>
              <p className="text-stone-400 text-sm mb-3">
                Pick a number and roll to win!
              </p>
              <div 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  background: 'linear-gradient(180deg, #FFC875 0%, #FFB347 100%)',
                  boxShadow: '0 3px 0 0 #CC8F39, 0 4px 12px rgba(255, 179, 71, 0.3)',
                }}
              >
                <span className="text-lg">{"🍕"}</span>
                <span className="font-bold text-game-dark">
                  Prize Pool: {formatPrize(prizePool)} $PIZZA
                </span>
              </div>
            </div>

            {/* Number selection - Keycap style buttons */}
            {result === null && (
              <div className="grid grid-cols-6 gap-2 mb-6">
                {[1, 2, 3, 4, 5, 6].map((num) => {
                  const colors = NUMBER_COLORS[num - 1];
                  const isSelected = selectedNumber === num;
                  
                  return (
                    <motion.button
                      key={num}
                      onClick={() => setSelectedNumber(num)}
                      className="aspect-square rounded-xl text-xl font-bold relative"
                      style={{
                        background: isSelected 
                          ? `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg}DD 100%)`
                          : 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
                        color: isSelected ? (colors.text || '#FFF') : '#A8A29E',
                        boxShadow: isSelected
                          ? `0 4px 0 0 ${colors.shadow}, 0 6px 16px ${colors.bg}40, inset 0 1px 0 rgba(255,255,255,0.3)`
                          : '0 3px 0 0 #1C1917, inset 0 1px 0 rgba(255,255,255,0.05)',
                        transform: isSelected ? 'translateY(0)' : 'translateY(0)',
                      }}
                      whileHover={{ 
                        scale: 1.1,
                        boxShadow: `0 4px 0 0 ${colors.shadow}, 0 6px 16px ${colors.bg}60`,
                      }}
                      whileTap={{ 
                        scale: 0.95,
                        boxShadow: `0 1px 0 0 ${colors.shadow}`,
                      }}
                      disabled={isRolling}
                    >
                      {num}
                    </motion.button>
                  );
                })}
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
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="text-center mb-4"
              >
                {hasWon ? (
                  <div>
                    <motion.div
                      className="text-4xl mb-2"
                      animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, repeat: 3 }}
                    >
                      {"🎉"}
                    </motion.div>
                    <p 
                      className="text-2xl font-bold text-game-secondary mb-2"
                      style={{ fontFamily: 'var(--font-lilita), cursive' }}
                    >
                      YOU WON!
                    </p>
                    <p className="text-stone-300">
                      You won a share of the prize pool!
                    </p>
                  </div>
                ) : (
                  <div>
                    <motion.div
                      className="text-4xl mb-2"
                      initial={{ rotate: 0 }}
                      animate={{ rotate: [0, -15, 15, 0] }}
                    >
                      {"😅"}
                    </motion.div>
                    <p className="text-lg text-stone-400 mb-1">
                      You rolled <span className="font-bold text-game-light">{result}</span>, needed <span className="font-bold text-game-primary">{selectedNumber}</span>
                    </p>
                    <p className="text-stone-300">
                      Better luck tomorrow! {"🍕"}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Instructions */}
            {result === null && selectedNumber !== null && !isRolling && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-stone-400 text-sm mb-4"
              >
                {"👆"} Tap the dice to roll!
              </motion.p>
            )}

            {/* Close button - Keycap style */}
            <motion.button
              onClick={handleClose}
              className="w-full py-3 rounded-xl font-bold"
              style={{
                background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
                color: '#FAFAF9',
                boxShadow: '0 3px 0 0 #1C1917, inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98, boxShadow: '0 1px 0 0 #1C1917' }}
            >
              {result !== null ? 'Close' : 'Maybe Later...'}
            </motion.button>
          </motion.div>

          {/* Confetti on win */}
          <Confetti isActive={hasWon} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
