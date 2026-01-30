'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface CapturedPizzaSliceProps {
  playerColor: string;
  onAnimationComplete?: () => void;
}

// Pizza topping particles
const toppings = ['🍄', '🫒', '🌶️', '🧀', '🥓', '🍅'];

export function CapturedPizzaSlice({ playerColor, onAnimationComplete }: CapturedPizzaSliceProps) {
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; x: number; y: number }>>([]);

  useEffect(() => {
    // Generate random topping particles
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      emoji: toppings[Math.floor(Math.random() * toppings.length)],
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
    }));
    setParticles(newParticles);

    // Call completion callback
    const timer = setTimeout(() => {
      onAnimationComplete?.();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  return (
    <motion.div
      className="relative flex items-center justify-center"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.5 }}
    >
      {/* Main pizza slice */}
      <motion.div
        className="text-6xl"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 0.5,
          repeat: 2,
        }}
      >
        🍕
      </motion.div>

      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full blur-xl"
        style={{ backgroundColor: playerColor }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 0.6, 0], scale: [0, 2, 2] }}
        transition={{ duration: 1 }}
      />

      {/* Topping particles */}
      <AnimatePresence>
        {particles.map(particle => (
          <motion.span
            key={particle.id}
            className="absolute text-2xl pointer-events-none"
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0,
              x: particle.x,
              y: particle.y,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            {particle.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Capture notification popup
export function CaptureNotification({
  playerName,
  playerColor,
  sliceCount,
  onClose,
}: {
  playerName: string;
  playerColor: string;
  sliceCount: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
      initial={{ opacity: 0, y: -50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.8 }}
    >
      <div
        className="px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
        style={{ backgroundColor: playerColor }}
      >
        <CapturedPizzaSlice playerColor={playerColor} />
        <div className="text-white">
          <p className="font-bold">{playerName}</p>
          <p className="text-sm opacity-90">
            Captured {sliceCount} slice{sliceCount > 1 ? 's' : ''}!
          </p>
        </div>
      </div>
    </motion.div>
  );
}
