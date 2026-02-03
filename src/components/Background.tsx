'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

// Vibrant dot colors inspired by the colorful dot theme
const DOT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96E6A1', // Green
  '#DDA0DD', // Plum
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
  '#F8B500', // Orange
  '#58D68D', // Lime
  '#EC7063', // Coral
  '#5DADE2', // Sky Blue
  '#F39C12', // Amber
  '#9B59B6', // Violet
  '#1ABC9C', // Turquoise
  '#E74C3C', // Bright Red
  '#3498DB', // Blue
  '#2ECC71', // Emerald
  '#E91E63', // Pink
  '#00BCD4', // Cyan
];

interface Dot {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
}

export function Background() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate grid of colorful dots
  const dots = useMemo(() => {
    const gridDots: Dot[] = [];
    const cols = 10;
    const rows = 14;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gridDots.push({
          id: row * cols + col,
          x: (col / (cols - 1)) * 100,
          y: (row / (rows - 1)) * 100,
          color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
          size: 12 + Math.random() * 16,
          delay: Math.random() * 2,
        });
      }
    }
    return gridDots;
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#0D0D0D]">
      {/* Animated colorful dots grid */}
      {dots.map((dot) => (
        <motion.div
          key={dot.id}
          className="absolute rounded-full"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            delay: dot.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Subtle vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }}
      />
    </div>
  );
}

// Keep original for backwards compatibility
export function AmusementParkBackground() {
  return <Background />;
}
