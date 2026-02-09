'use client';

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled?: boolean;
}

// --- Pip layout for each face ---

function Pip() {
  return (
    <div
      className="w-3 h-3 rounded-full"
      style={{
        background: 'radial-gradient(circle at 35% 35%, #3a3a5e, #1a1a2e)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 1px rgba(255,255,255,0.15)',
      }}
    />
  );
}

function DiceFace({ value }: { value: number }) {
  const layouts: Record<number, ReactNode> = {
    1: (
      <div className="w-full h-full flex items-center justify-center">
        <Pip />
      </div>
    ),
    2: (
      <div className="w-full h-full flex flex-col justify-between p-2.5">
        <div className="flex justify-end"><Pip /></div>
        <div className="flex justify-start"><Pip /></div>
      </div>
    ),
    3: (
      <div className="w-full h-full flex flex-col justify-between p-2.5">
        <div className="flex justify-end"><Pip /></div>
        <div className="flex justify-center"><Pip /></div>
        <div className="flex justify-start"><Pip /></div>
      </div>
    ),
    4: (
      <div className="w-full h-full grid grid-cols-2 p-2.5 gap-1">
        <div className="flex items-start justify-start"><Pip /></div>
        <div className="flex items-start justify-end"><Pip /></div>
        <div className="flex items-end justify-start"><Pip /></div>
        <div className="flex items-end justify-end"><Pip /></div>
      </div>
    ),
    5: (
      <div className="w-full h-full relative p-2.5">
        <Pip />
        <div className="absolute top-2.5 right-2.5"><Pip /></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Pip /></div>
        <div className="absolute bottom-2.5 left-2.5"><Pip /></div>
        <div className="absolute bottom-2.5 right-2.5"><Pip /></div>
      </div>
    ),
    6: (
      <div className="w-full h-full grid grid-cols-2 p-2.5 gap-y-0.5">
        <div className="flex items-start justify-start"><Pip /></div>
        <div className="flex items-start justify-end"><Pip /></div>
        <div className="flex items-center justify-start"><Pip /></div>
        <div className="flex items-center justify-end"><Pip /></div>
        <div className="flex items-end justify-start"><Pip /></div>
        <div className="flex items-end justify-end"><Pip /></div>
      </div>
    ),
  };

  return <>{layouts[value] || layouts[1]}</>;
}

// --- Standard die opposite faces sum to 7 ---
// Layout: 1=front, 6=back, 2=right, 5=left, 3=top, 4=bottom
// To show face N facing the viewer we rotate:
const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 180, y: 0 },
};

const CUBE_SIZE = 68;
const HALF = CUBE_SIZE / 2;

export function Dice({ value, isRolling, onRoll, disabled = false }: DiceProps) {
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'landing' | 'landed'>('idle');
  const [landValue, setLandValue] = useState<number>(1);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Randomized tumble parameters — new each roll for variety
  const tumble = useMemo(() => {
    if (!isRolling) return null;
    // Random number of full rotations (3-5 per axis) with random directions
    const xSpins = (3 + Math.floor(Math.random() * 3)) * (Math.random() > 0.5 ? 1 : -1);
    const ySpins = (2 + Math.floor(Math.random() * 3)) * (Math.random() > 0.5 ? 1 : -1);
    const zSpins = (1 + Math.floor(Math.random() * 2)) * (Math.random() > 0.5 ? 1 : -1);
    return { x: xSpins * 360, y: ySpins * 360, z: zSpins * 360 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRolling]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (isRolling) {
      setPhase('spinning');
      const t1 = setTimeout(() => setPhase('landing'), 1000);
      const t2 = setTimeout(() => setPhase('landed'), 1400);
      timersRef.current = [t1, t2];
      return clearTimers;
    } else {
      if (value !== null) setLandValue(value);
      const t = setTimeout(() => setPhase('idle'), 400);
      timersRef.current = [t];
      return clearTimers;
    }
  }, [isRolling, value, clearTimers]);

  // Build the 3D rotation transform for the cube
  const getCubeTransform = (): string => {
    const target = FACE_ROTATIONS[landValue] || FACE_ROTATIONS[1];

    if (phase === 'spinning' && tumble) {
      // Wild tumble — multiple full rotations on all axes
      return `rotateX(${tumble.x}deg) rotateY(${tumble.y}deg) rotateZ(${tumble.z}deg)`;
    }
    // Landing & idle — snap to the exact face
    return `rotateX(${target.x}deg) rotateY(${target.y}deg)`;
  };

  const getCubeTransition = (): string => {
    switch (phase) {
      case 'spinning':
        // Fast spin with deceleration curve
        return 'transform 1.0s cubic-bezier(0.15, 0.8, 0.25, 1)';
      case 'landing':
        // Quick settle to final face
        return 'transform 0.4s cubic-bezier(0.0, 0.0, 0.15, 1)';
      default:
        return 'transform 0.2s ease-out';
    }
  };

  // Physics-inspired bounce: 3 bounces with decreasing height (restitution ~0.5)
  const bounceKeyframes = {
    y: [0, -50, 0, -22, 0, -8, 0, -2, 0],
  };
  const bounceTimes = [0, 0.10, 0.25, 0.35, 0.50, 0.58, 0.70, 0.85, 1];

  // Squash on each impact, stretch at apex
  const squashKeyframes = {
    scaleX: [1, 0.90, 1.12, 0.93, 1.08, 0.96, 1.04, 0.98, 1],
    scaleY: [1, 1.10, 0.88, 1.07, 0.92, 1.04, 0.96, 1.02, 1],
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Perspective container — slightly above center for a top-down viewing feel */}
      <div className="relative" style={{ perspective: '600px', perspectiveOrigin: '50% 35%' }}>
        {/* Ground shadow — shrinks when dice is in the air */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            bottom: -10,
            width: 56,
            height: 10,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 70%)',
            filter: 'blur(4px)',
          }}
          animate={
            phase === 'spinning'
              ? {
                  scaleX: [1, 0.4, 0.85, 0.5, 0.9, 0.65, 0.95, 0.85, 1],
                  opacity: [0.5, 0.15, 0.45, 0.2, 0.4, 0.3, 0.45, 0.4, 0.5],
                }
              : { scaleX: 1, opacity: 0.5 }
          }
          transition={
            phase === 'spinning'
              ? { duration: 1.0, times: bounceTimes }
              : { duration: 0.3 }
          }
        />

        {/* Bounce + squash/stretch wrapper */}
        <motion.div
          animate={
            phase === 'spinning'
              ? { ...bounceKeyframes, ...squashKeyframes }
              : phase === 'landing'
              ? { y: [null, 3, 0], scaleX: [null, 1.06, 1], scaleY: [null, 0.94, 1] }
              : phase === 'landed'
              ? { scaleX: [1, 1.05, 1], scaleY: [1, 0.95, 1] }
              : {}
          }
          transition={
            phase === 'spinning'
              ? { duration: 1.0, ease: 'easeOut', times: bounceTimes }
              : phase === 'landing'
              ? { duration: 0.3, ease: 'easeOut' as const }
              : { duration: 0.2 }
          }
          style={{ width: CUBE_SIZE, height: CUBE_SIZE }}
        >
          {/* Clickable button wrapping the 3D cube */}
          <button
            onClick={onRoll}
            disabled={disabled || isRolling}
            className={`block w-full h-full relative ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{ perspective: '600px' }}
          >
            {/* The actual CSS 3D cube — 6 faces positioned in 3D space */}
            <div
              style={{
                width: CUBE_SIZE,
                height: CUBE_SIZE,
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: getCubeTransform(),
                transition: getCubeTransition(),
              }}
            >
              {/* Standard die layout: 1-front, 6-back, 2-right, 5-left, 3-top, 4-bottom */}
              <CubeFace face={1} translate={`translateZ(${HALF}px)`} />
              <CubeFace face={6} translate={`rotateY(180deg) translateZ(${HALF}px)`} />
              <CubeFace face={2} translate={`rotateY(90deg) translateZ(${HALF}px)`} />
              <CubeFace face={5} translate={`rotateY(-90deg) translateZ(${HALF}px)`} />
              <CubeFace face={3} translate={`rotateX(90deg) translateZ(${HALF}px)`} />
              <CubeFace face={4} translate={`rotateX(-90deg) translateZ(${HALF}px)`} />
            </div>

            {/* Idle hover glow — subtle when tappable */}
            {!disabled && !isRolling && phase === 'idle' && (
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  boxShadow: '0 0 20px 4px rgba(255,179,71,0.2)',
                }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </button>
        </motion.div>

        {/* Spark particles during spin */}
        {isRolling && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(10)].map((_, i) => {
              const angle = (i * 36) * Math.PI / 180;
              const dist = 35 + Math.random() * 20;
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3 - (i % 3),
                    height: 3 - (i % 3),
                    background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#FF6B6B' : '#FFB347',
                    left: HALF,
                    top: HALF,
                  }}
                  initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0,
                  }}
                  transition={{
                    duration: 0.45,
                    delay: i * 0.06,
                    repeat: Infinity,
                    repeatDelay: 0.35,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Landing impact ring */}
        <AnimatePresence>
          {phase === 'landed' && (
            <motion.div
              className="absolute pointer-events-none"
              style={{
                left: '50%',
                top: '50%',
                width: CUBE_SIZE,
                height: CUBE_SIZE,
                marginLeft: -HALF,
                marginTop: -HALF,
                borderRadius: '50%',
                border: '2px solid rgba(255,179,71,0.5)',
              }}
              initial={{ opacity: 0.8, scale: 0.5 }}
              animate={{ opacity: 0, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Tap to roll hint */}
      {!disabled && !isRolling && value === null && (
        <motion.p
          className="text-sm text-gray-400"
          animate={{ opacity: [0.4, 1, 0.4] }}
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

// --- Individual cube face with realistic styling ---

function CubeFace({ face, translate }: { face: number; translate: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: CUBE_SIZE,
        height: CUBE_SIZE,
        transform: translate,
        backfaceVisibility: 'hidden',
        borderRadius: 10,
        // Ivory white with subtle warm gradient — like a real casino die
        background: 'linear-gradient(145deg, #FEFEFE 0%, #F8F6F4 35%, #EDEBE8 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), ' +
          'inset 0 -1px 0 rgba(0,0,0,0.06), ' +
          'inset 1px 0 0 rgba(255,255,255,0.4), ' +
          'inset -1px 0 0 rgba(0,0,0,0.04)',
        border: '1px solid rgba(120,113,108,0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Top-left specular highlight like the reference repo's MeshPhongMaterial */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(125deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)',
          borderRadius: 10,
          pointerEvents: 'none',
        }}
      />
      <DiceFace value={face} />
    </div>
  );
}
