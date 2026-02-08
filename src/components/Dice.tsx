'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled?: boolean;
}

// Pip component for cleaner dice faces
function Pip({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`w-2.5 h-2.5 rounded-full bg-[#1a1a2e] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] ${className}`}
    />
  );
}

// Dice face component with proper pip layouts
function DiceFace({ value }: { value: number }) {
  const layouts: Record<number, ReactNode> = {
    1: (
      <div className="w-full h-full flex items-center justify-center">
        <Pip />
      </div>
    ),
    2: (
      <div className="w-full h-full grid grid-cols-2 p-2">
        <div className="flex items-start justify-start"><Pip /></div>
        <div className="flex items-end justify-end"><Pip /></div>
      </div>
    ),
    3: (
      <div className="w-full h-full relative p-2">
        <Pip className="absolute top-2 left-2" />
        <Pip className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <Pip className="absolute bottom-2 right-2" />
      </div>
    ),
    4: (
      <div className="w-full h-full grid grid-cols-2 gap-1 p-2">
        <div className="flex items-start justify-start"><Pip /></div>
        <div className="flex items-start justify-end"><Pip /></div>
        <div className="flex items-end justify-start"><Pip /></div>
        <div className="flex items-end justify-end"><Pip /></div>
      </div>
    ),
    5: (
      <div className="w-full h-full relative p-2">
        <Pip className="absolute top-2 left-2" />
        <Pip className="absolute top-2 right-2" />
        <Pip className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        <Pip className="absolute bottom-2 left-2" />
        <Pip className="absolute bottom-2 right-2" />
      </div>
    ),
    6: (
      <div className="w-full h-full grid grid-cols-2 p-2 gap-y-1">
        <div className="flex items-start justify-start"><Pip /></div>
        <div className="flex items-start justify-end"><Pip /></div>
        <div className="flex items-center justify-start"><Pip /></div>
        <div className="flex items-center justify-end"><Pip /></div>
        <div className="flex items-end justify-start"><Pip /></div>
        <div className="flex items-end justify-end"><Pip /></div>
      </div>
    ),
  };

  return layouts[value] || layouts[1];
}

export function Dice({ value, isRolling, onRoll, disabled = false }: DiceProps) {
  const [displayValue, setDisplayValue] = useState<number>(1);
  const [rollPhase, setRollPhase] = useState<'idle' | 'bouncing' | 'settling' | 'landed'>('idle');
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRolling) {
      setRollPhase('bouncing');

      // Fast random face changes during roll
      let changeSpeed = 50;
      const changeFace = () => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
        changeSpeed = Math.min(changeSpeed + 10, 200); // Gradually slow down
        rollIntervalRef.current = setTimeout(changeFace, changeSpeed);
      };

      rollIntervalRef.current = setTimeout(changeFace, changeSpeed);

      // Transition to settling phase
      rollTimeoutRef.current = setTimeout(() => {
        setRollPhase('settling');
      }, 800);

      // Land on final value
      const landTimeout = setTimeout(() => {
        if (rollIntervalRef.current) clearTimeout(rollIntervalRef.current);
        setRollPhase('landed');
      }, 1200);

      return () => {
        if (rollIntervalRef.current) clearTimeout(rollIntervalRef.current);
        if (rollTimeoutRef.current) clearTimeout(rollTimeoutRef.current);
        clearTimeout(landTimeout);
      };
    } else {
      // Rolling stopped — show the final value if available and transition to idle
      if (value !== null) {
        setDisplayValue(value);
      }
      // Always transition to idle so the dice doesn't get stuck in landed/settling
      const idleTimer = setTimeout(() => setRollPhase('idle'), 300);
      return () => clearTimeout(idleTimer);
    }
  }, [isRolling, value]);

  // Get animation variants based on phase
  const getAnimationProps = () => {
    switch (rollPhase) {
      case 'bouncing':
        return {
          animate: {
            rotateX: [0, 360, 720, 1080],
            rotateY: [0, 180, 360, 540],
            rotateZ: [0, 90, 180, 270],
            y: [0, -30, 0, -20, 0, -10, 0],
            scale: [1, 1.15, 1, 1.1, 1, 1.05, 1],
          },
          transition: {
            duration: 1.2,
            ease: [0.25, 0.46, 0.45, 0.94] as const,
            times: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1],
          },
        };
      case 'settling':
        return {
          animate: {
            rotateX: [null, 0],
            rotateY: [null, 0],
            rotateZ: [null, 0],
            y: [null, -5, 0],
            scale: [null, 1.02, 1],
          },
          transition: {
            duration: 0.4,
            ease: 'easeOut' as const,
          },
        };
      case 'landed':
        return {
          animate: {
            scale: [1, 1.08, 1],
            boxShadow: [
              '0 4px 20px rgba(0,0,0,0.3)',
              '0 8px 40px rgba(255,165,0,0.4)',
              '0 4px 20px rgba(0,0,0,0.3)',
            ],
          },
          transition: {
            duration: 0.3,
            ease: 'easeOut' as const,
          },
        };
      default:
        return {
          animate: {},
          transition: {},
        };
    }
  };

  const animProps = getAnimationProps();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Dice container with 3D perspective */}
      <div className="relative" style={{ perspective: '600px' }}>
        {/* Shadow element */}
        <motion.div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-black/30 rounded-full blur-md"
          animate={{
            scale: rollPhase === 'bouncing' ? [1, 0.6, 1, 0.7, 1, 0.85, 1] : 1,
            opacity: rollPhase === 'bouncing' ? [0.3, 0.15, 0.3, 0.2, 0.3, 0.25, 0.3] : 0.3,
          }}
          transition={{
            duration: 1.2,
            times: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1],
          }}
        />

        <motion.button
          onClick={onRoll}
          disabled={disabled || isRolling}
          className={`
            relative w-16 h-16 rounded-xl
            bg-gradient-to-br from-white via-gray-50 to-gray-100
            border border-gray-200/50
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            overflow-hidden
          `}
          style={{
            transformStyle: 'preserve-3d',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.8), inset 0 -2px 0 rgba(0,0,0,0.1)',
          }}
          {...animProps}
          whileHover={!disabled && !isRolling ? { 
            scale: 1.08,
            y: -2,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3), inset 0 2px 0 rgba(255,255,255,0.8), inset 0 -2px 0 rgba(0,0,0,0.1)',
          } : {}}
          whileTap={!disabled && !isRolling ? { 
            scale: 0.95,
            y: 0,
          } : {}}
        >
          {/* Inner shine effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent rounded-xl pointer-events-none" />
          
          {/* Dice face with pips */}
          <AnimatePresence mode="wait">
            <motion.div
              key={displayValue}
              initial={{ opacity: 0, scale: 0.9, rotateY: -90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateY: 90 }}
              transition={{ duration: rollPhase === 'bouncing' ? 0.05 : 0.15 }}
              className="w-full h-full"
            >
              <DiceFace value={displayValue} />
            </motion.div>
          </AnimatePresence>

          {/* Rolling glow effect */}
          {isRolling && (
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(255,165,0,0.3) 0%, transparent 70%)',
              }}
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          )}

          {/* Edge highlight */}
          <div className="absolute inset-0 rounded-xl border border-white/30 pointer-events-none" />
        </motion.button>

        {/* Particle effects during roll */}
        {isRolling && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-400 rounded-full"
                initial={{ 
                  x: 32, 
                  y: 32, 
                  opacity: 1,
                  scale: 1,
                }}
                animate={{ 
                  x: 32 + Math.cos((i * 60) * Math.PI / 180) * 40,
                  y: 32 + Math.sin((i * 60) * Math.PI / 180) * 40,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 0.3,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tap to roll hint */}
      {!disabled && !isRolling && value === null && (
        <motion.p
          className="text-sm text-gray-400 flex items-center gap-2"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.span
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          >
            Tap to roll
          </motion.span>
        </motion.p>
      )}

      {/* Result display */}
      {value !== null && !isRolling && (
        <motion.p
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="text-lg font-bold text-game-primary"
        >
          {value} {value === 1 ? 'move' : 'moves'}!
        </motion.p>
      )}
    </div>
  );
}
