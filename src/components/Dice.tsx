'use client';

import { useState, useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled?: boolean;
}

const diceFaces: Record<number, ReactElement> = {
  1: (
    <div className="grid place-items-center h-full">
      <div className="w-4 h-4 bg-game-dark rounded-full" />
    </div>
  ),
  2: (
    <div className="grid grid-cols-2 h-full p-2">
      <div className="flex items-start justify-start">
        <div className="w-3 h-3 bg-game-dark rounded-full" />
      </div>
      <div className="flex items-end justify-end">
        <div className="w-3 h-3 bg-game-dark rounded-full" />
      </div>
    </div>
  ),
  3: (
    <div className="grid grid-cols-3 h-full p-2">
      <div className="flex items-start justify-start">
        <div className="w-3 h-3 bg-game-dark rounded-full" />
      </div>
      <div className="flex items-center justify-center">
        <div className="w-3 h-3 bg-game-dark rounded-full" />
      </div>
      <div className="flex items-end justify-end">
        <div className="w-3 h-3 bg-game-dark rounded-full" />
      </div>
    </div>
  ),
  4: (
    <div className="grid grid-cols-2 gap-2 h-full p-2">
      <div className="w-3 h-3 bg-game-dark rounded-full" />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end" />
      <div className="w-3 h-3 bg-game-dark rounded-full self-end" />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end self-end" />
    </div>
  ),
  5: (
    <div className="grid grid-cols-3 gap-1 h-full p-2">
      <div className="w-3 h-3 bg-game-dark rounded-full" />
      <div />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end" />
      <div />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-center self-center" />
      <div />
      <div className="w-3 h-3 bg-game-dark rounded-full self-end" />
      <div />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end self-end" />
    </div>
  ),
  6: (
    <div className="grid grid-cols-2 gap-y-1 h-full p-2">
      <div className="w-3 h-3 bg-game-dark rounded-full" />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end" />
      <div className="w-3 h-3 bg-game-dark rounded-full" />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end" />
      <div className="w-3 h-3 bg-game-dark rounded-full" />
      <div className="w-3 h-3 bg-game-dark rounded-full justify-self-end" />
    </div>
  ),
};

export function Dice({ value, isRolling, onRoll, disabled = false }: DiceProps) {
  const [displayValue, setDisplayValue] = useState<number>(1);

  useEffect(() => {
    if (isRolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 100);

      return () => clearInterval(interval);
    } else if (value !== null) {
      setDisplayValue(value);
    }
  }, [isRolling, value]);

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.button
        onClick={onRoll}
        disabled={disabled || isRolling}
        className={`
          relative w-20 h-20 rounded-xl bg-white shadow-lg
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-xl'}
          transition-shadow duration-200
        `}
        animate={isRolling ? {
          rotate: [0, 360],
          scale: [1, 1.1, 1],
        } : {}}
        transition={{
          duration: 0.3,
          repeat: isRolling ? Infinity : 0,
          ease: "easeInOut"
        }}
        whileHover={!disabled ? { scale: 1.05 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={displayValue}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
            className="w-full h-full"
          >
            {diceFaces[displayValue]}
          </motion.div>
        </AnimatePresence>

        {/* Glow effect when rolling */}
        {isRolling && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-game-primary/30"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </motion.button>

      {!disabled && !isRolling && value === null && (
        <motion.p
          className="text-sm text-gray-400"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Tap to roll
        </motion.p>
      )}

      {value !== null && !isRolling && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-bold text-game-primary"
        >
          {value} {value === 1 ? 'move' : 'moves'}!
        </motion.p>
      )}
    </div>
  );
}
