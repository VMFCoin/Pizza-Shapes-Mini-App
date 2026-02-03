'use client';

import { motion } from 'framer-motion';

// SVG paths for dot-connected letters (dots at vertices, lines connecting them)
const LETTER_PATHS: Record<string, { dots: [number, number][]; lines: [number, number, number, number][] }> = {
  P: {
    dots: [[0, 0], [0, 12], [0, 24], [8, 0], [8, 12]],
    lines: [[0, 0, 0, 24], [0, 0, 8, 0], [8, 0, 8, 12], [8, 12, 0, 12]],
  },
  I: {
    dots: [[0, 0], [4, 0], [8, 0], [4, 12], [4, 24], [0, 24], [8, 24]],
    lines: [[0, 0, 8, 0], [4, 0, 4, 24], [0, 24, 8, 24]],
  },
  Z: {
    dots: [[0, 0], [8, 0], [0, 24], [8, 24]],
    lines: [[0, 0, 8, 0], [8, 0, 0, 24], [0, 24, 8, 24]],
  },
  A: {
    dots: [[4, 0], [0, 24], [8, 24], [2, 16], [6, 16]],
    lines: [[4, 0, 0, 24], [4, 0, 8, 24], [2, 16, 6, 16]],
  },
  S: {
    dots: [[8, 0], [0, 0], [0, 12], [8, 12], [8, 24], [0, 24]],
    lines: [[8, 0, 0, 0], [0, 0, 0, 12], [0, 12, 8, 12], [8, 12, 8, 24], [8, 24, 0, 24]],
  },
  H: {
    dots: [[0, 0], [0, 12], [0, 24], [8, 0], [8, 12], [8, 24]],
    lines: [[0, 0, 0, 24], [8, 0, 8, 24], [0, 12, 8, 12]],
  },
  E: {
    dots: [[8, 0], [0, 0], [0, 12], [6, 12], [0, 24], [8, 24]],
    lines: [[8, 0, 0, 0], [0, 0, 0, 24], [0, 24, 8, 24], [0, 12, 6, 12]],
  },
  O: {
    dots: [[0, 4], [4, 0], [8, 4], [8, 20], [4, 24], [0, 20]],
    lines: [[0, 4, 4, 0], [4, 0, 8, 4], [8, 4, 8, 20], [8, 20, 4, 24], [4, 24, 0, 20], [0, 20, 0, 4]],
  },
  C: {
    dots: [[8, 4], [4, 0], [0, 4], [0, 20], [4, 24], [8, 20]],
    lines: [[8, 4, 4, 0], [4, 0, 0, 4], [0, 4, 0, 20], [0, 20, 4, 24], [4, 24, 8, 20]],
  },
  N: {
    dots: [[0, 24], [0, 0], [8, 24], [8, 0]],
    lines: [[0, 24, 0, 0], [0, 0, 8, 24], [8, 24, 8, 0]],
  },
  T: {
    dots: [[0, 0], [4, 0], [8, 0], [4, 24]],
    lines: [[0, 0, 8, 0], [4, 0, 4, 24]],
  },
  D: {
    dots: [[0, 0], [0, 24], [6, 0], [8, 6], [8, 18], [6, 24]],
    lines: [[0, 0, 0, 24], [0, 0, 6, 0], [6, 0, 8, 6], [8, 6, 8, 18], [8, 18, 6, 24], [6, 24, 0, 24]],
  },
  W: {
    dots: [[0, 0], [2, 24], [5, 12], [8, 24], [10, 0]],
    lines: [[0, 0, 2, 24], [2, 24, 5, 12], [5, 12, 8, 24], [8, 24, 10, 0]],
  },
  R: {
    dots: [[0, 0], [0, 12], [0, 24], [8, 0], [8, 12], [8, 24]],
    lines: [[0, 0, 0, 24], [0, 0, 8, 0], [8, 0, 8, 12], [8, 12, 0, 12], [0, 12, 8, 24]],
  },
  L: {
    dots: [[0, 0], [0, 24], [8, 24]],
    lines: [[0, 0, 0, 24], [0, 24, 8, 24]],
  },
  ' ': {
    dots: [],
    lines: [],
  },
  '&': {
    dots: [[6, 8], [4, 4], [2, 8], [4, 12], [8, 18], [0, 24], [6, 24]],
    lines: [[6, 8, 4, 4], [4, 4, 2, 8], [2, 8, 4, 12], [4, 12, 0, 24], [4, 12, 8, 18], [8, 18, 6, 24]],
  },
};

interface DotLetterProps {
  letter: string;
  color?: string;
  dotColor?: string;
  size?: number;
  delay?: number;
}

function DotLetter({ letter, color = '#FFFFFF', dotColor, size = 1, delay = 0 }: DotLetterProps) {
  const upperLetter = letter.toUpperCase();
  const path = LETTER_PATHS[upperLetter];

  if (!path) {
    return <span style={{ width: size * 12 }} />;
  }

  if (path.dots.length === 0) {
    return <span style={{ width: size * 6 }} />;
  }

  const actualDotColor = dotColor || color;

  return (
    <svg
      width={size * 14}
      height={size * 28}
      viewBox="-2 -2 14 28"
      style={{ overflow: 'visible' }}
    >
      {/* Lines */}
      {path.lines.map(([x1, y1, x2, y2], i) => (
        <motion.line
          key={`line-${i}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: delay + i * 0.05 }}
        />
      ))}
      {/* Dots */}
      {path.dots.map(([x, y], i) => (
        <motion.circle
          key={`dot-${i}`}
          cx={x}
          cy={y}
          r={2.5}
          fill={actualDotColor}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: delay + 0.2 + i * 0.05 }}
        />
      ))}
    </svg>
  );
}

interface DotTextProps {
  text: string;
  color?: string;
  dotColor?: string;
  size?: number;
  className?: string;
  stagger?: boolean;
}

export function DotText({
  text,
  color = '#FFFFFF',
  dotColor,
  size = 1,
  className = '',
  stagger = true,
}: DotTextProps) {
  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      {text.split('').map((letter, i) => (
        <DotLetter
          key={i}
          letter={letter}
          color={color}
          dotColor={dotColor}
          size={size}
          delay={stagger ? i * 0.1 : 0}
        />
      ))}
    </div>
  );
}

// Simpler glowing text component for better readability
interface GlowTextProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  glowColor?: string;
}

export function GlowText({ children, className = '', color = '#FFFFFF', glowColor }: GlowTextProps) {
  const glow = glowColor || color;
  return (
    <span
      className={className}
      style={{
        color,
        textShadow: `
          0 0 10px ${glow},
          0 0 20px ${glow},
          0 0 30px ${glow}50,
          0 0 40px ${glow}30
        `,
      }}
    >
      {children}
    </span>
  );
}
