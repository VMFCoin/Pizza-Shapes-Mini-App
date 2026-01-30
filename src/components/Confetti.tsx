'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfettiProps {
  isActive: boolean;
  duration?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  emoji?: string;
}

const colors = ['#FF6B35', '#F7C548', '#C41E3A', '#4ECDC4', '#FFE66D', '#AA96DA'];
const emojis = ['🍕', '🎉', '🏆', '⭐', '✨', '🔥'];

export function Confetti({ isActive, duration = 3000 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (isActive) {
      // Generate confetti particles
      const newParticles: Particle[] = [];
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: -10 - Math.random() * 20,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 8 + Math.random() * 8,
          rotation: Math.random() * 360,
          emoji: Math.random() > 0.7 ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
        });
      }
      setParticles(newParticles);

      // Clear particles after duration
      const timer = setTimeout(() => {
        setParticles([]);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isActive, duration]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
              }}
              initial={{
                y: 0,
                x: 0,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: window.innerHeight + 100,
                x: (Math.random() - 0.5) * 200,
                rotate: particle.rotation + Math.random() * 720,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2 + Math.random() * 2,
                ease: "easeIn",
              }}
            >
              {particle.emoji ? (
                <span style={{ fontSize: particle.size }}>{particle.emoji}</span>
              ) : (
                <div
                  style={{
                    width: particle.size,
                    height: particle.size,
                    backgroundColor: particle.color,
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

// Fireworks effect
export function Fireworks({ isActive }: { isActive: boolean }) {
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    if (isActive) {
      const createBurst = () => {
        const newBurst = {
          id: Date.now(),
          x: 20 + Math.random() * 60,
          y: 20 + Math.random() * 40,
        };
        setBursts(prev => [...prev, newBurst]);

        setTimeout(() => {
          setBursts(prev => prev.filter(b => b.id !== newBurst.id));
        }, 1500);
      };

      createBurst();
      const interval = setInterval(createBurst, 600);

      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 3000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isActive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {bursts.map((burst) => (
          <FireworkBurst key={burst.id} x={burst.x} y={burst.y} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function FireworkBurst({ x, y }: { x: number; y: number }) {
  const sparks = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (360 / 12) * i,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <div
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {sparks.map((spark) => (
        <motion.div
          key={spark.id}
          className="absolute w-2 h-2 rounded-full"
          style={{ backgroundColor: spark.color }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: Math.cos((spark.angle * Math.PI) / 180) * 80,
            y: Math.sin((spark.angle * Math.PI) / 180) * 80,
            scale: 0,
            opacity: 0,
          }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// Prize pool coin rain effect
export function CoinRain({ isActive }: { isActive: boolean }) {
  const [coins, setCoins] = useState<Array<{ id: number; x: number; delay: number }>>([]);

  useEffect(() => {
    if (isActive) {
      const newCoins = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
      }));
      setCoins(newCoins);

      const timeout = setTimeout(() => {
        setCoins([]);
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [isActive]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      <AnimatePresence>
        {coins.map((coin) => (
          <motion.div
            key={coin.id}
            className="absolute text-2xl"
            style={{ left: `${coin.x}%`, top: '-30px' }}
            initial={{ y: 0, rotate: 0, opacity: 1 }}
            animate={{
              y: window.innerHeight + 50,
              rotate: 720,
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: 3,
              delay: coin.delay,
              ease: "easeIn",
            }}
          >
            🪙
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
