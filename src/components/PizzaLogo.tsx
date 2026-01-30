'use client';

import { motion } from 'framer-motion';

interface PizzaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
}

const sizes = {
  sm: 'w-12 h-12 text-3xl',
  md: 'w-20 h-20 text-5xl',
  lg: 'w-32 h-32 text-7xl',
  xl: 'w-48 h-48 text-9xl',
};

export function PizzaLogo({ size = 'md', animated = true }: PizzaLogoProps) {
  return (
    <div className="relative">
      {/* Main pizza */}
      <motion.div
        className={`${sizes[size]} flex items-center justify-center`}
        animate={animated ? {
          rotate: [0, 5, -5, 0],
        } : {}}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        🍕
      </motion.div>

      {/* Orbiting slices */}
      {animated && (
        <>
          <motion.div
            className="absolute top-0 left-0 text-2xl"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{ originX: '150%', originY: '150%' }}
          >
            🍕
          </motion.div>
          <motion.div
            className="absolute bottom-0 right-0 text-xl"
            animate={{
              rotate: -360,
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{ originX: '-100%', originY: '-100%' }}
          >
            🍕
          </motion.div>
        </>
      )}

      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full bg-game-secondary/20 blur-2xl -z-10"
        animate={animated ? {
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        } : {}}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
}

// Text logo component
export function PizzaShapesLogo({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <PizzaLogo size="sm" animated={false} />
      <div>
        <h1 className="text-2xl font-bold text-white leading-none">
          Pizza
          <span className="text-game-secondary"> Shapes</span>
        </h1>
        <p className="text-xs text-gray-400">Dots & Boxes, but tastier</p>
      </div>
    </motion.div>
  );
}
