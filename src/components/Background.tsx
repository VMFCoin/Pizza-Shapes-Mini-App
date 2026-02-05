'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

// Warm pizza-themed dot colors
const DOT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFE066', // Yellow
  '#BB8FCE', // Purple
  '#58D68D', // Green
  '#5DADE2', // Blue
  '#FF8FAB', // Pink
  '#FFA94D', // Orange
  '#FF6B35', // Pizza Orange
  '#FFB347', // Pizza Secondary
];

interface Dot {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
}

// Floating pizza slices
interface PizzaSlice {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  delay: number;
}

export function Background() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate grid of colorful dots with more variety
  const dots = useMemo(() => {
    const gridDots: Dot[] = [];
    const cols = 8;
    const rows = 12;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Add some randomness to position
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetY = (Math.random() - 0.5) * 8;
        
        gridDots.push({
          id: row * cols + col,
          x: (col / (cols - 1)) * 100 + offsetX,
          y: (row / (rows - 1)) * 100 + offsetY,
          color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
          size: 8 + Math.random() * 12,
          delay: Math.random() * 3,
          duration: 3 + Math.random() * 2,
        });
      }
    }
    return gridDots;
  }, []);

  // Generate floating pizza slices
  const pizzaSlices = useMemo(() => {
    const slices: PizzaSlice[] = [];
    const count = 5;
    
    for (let i = 0; i < count; i++) {
      slices.push({
        id: i,
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 80,
        rotation: Math.random() * 360,
        scale: 0.6 + Math.random() * 0.4,
        delay: Math.random() * 5,
      });
    }
    return slices;
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-game-dark">
      {/* Warm gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(255, 107, 53, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(78, 205, 196, 0.06) 0%, transparent 50%)',
        }}
      />

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
            boxShadow: `0 0 ${dot.size}px ${dot.color}40, inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.2)`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: dot.duration,
            delay: dot.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Floating pizza slice emojis */}
      {pizzaSlices.map((slice) => (
        <motion.div
          key={`pizza-${slice.id}`}
          className="absolute text-2xl pointer-events-none select-none"
          style={{
            left: `${slice.x}%`,
            top: `${slice.y}%`,
            transform: `translate(-50%, -50%) rotate(${slice.rotation}deg) scale(${slice.scale})`,
            opacity: 0.15,
            filter: 'blur(1px)',
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [slice.rotation, slice.rotation + 10, slice.rotation],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 6 + Math.random() * 4,
            delay: slice.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {"🍕"}
        </motion.div>
      ))}

      {/* Subtle vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(28, 25, 23, 0.6) 100%)',
        }}
      />

      {/* Top and bottom fade for content readability */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(28, 25, 23, 0.8) 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(28, 25, 23, 0.8) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

// Keep original for backwards compatibility
export function AmusementParkBackground() {
  return <Background />;
}
