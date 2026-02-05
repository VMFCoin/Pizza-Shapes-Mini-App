'use client';

import { motion } from 'framer-motion';
import { Player } from '@/types';

interface PlayerCardProps {
  player: Player;
  score: number;
  isActive: boolean;
  isCurrentUser?: boolean;
  isReady?: boolean;
  showReadyStatus?: boolean;
  onClick?: () => void;
}

export function PlayerCard({
  player,
  score,
  isActive,
  isCurrentUser = false,
  isReady,
  showReadyStatus = false,
  onClick,
}: PlayerCardProps) {
  return (
    <motion.div
      onClick={onClick}
      className={`
        relative p-3 rounded-xl cursor-pointer transition-all duration-200
        ${isActive
          ? 'bg-gradient-to-br from-game-primary/20 to-game-secondary/20 ring-2 ring-game-primary'
          : 'bg-white/10 hover:bg-white/20'
        }
        ${isCurrentUser ? 'border-2 border-game-secondary' : ''}
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-8 rounded-r-full bg-game-primary"
          layoutId="activeIndicator"
        />
      )}

      <div className="flex items-center gap-3">
        {/* Profile picture */}
        <div
          className="relative w-10 h-10 rounded-full overflow-hidden ring-2"
          style={{ borderColor: player.color }}
        >
          <img
            src={player.pfpUrl}
            alt={player.displayName}
            className="w-full h-full object-cover"
          />
          {isActive && (
            <motion.div
              className="absolute inset-0 bg-game-primary/30"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate text-sm">
            {player.displayName}
            {isCurrentUser && (
              <span className="ml-1 text-xs text-game-secondary">(You)</span>
            )}
          </p>
          {showReadyStatus ? (
            isReady ? (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span>✓</span> Ready
              </p>
            ) : (
              <p className="text-xs text-gray-400">Waiting...</p>
            )
          ) : (
            <p className="text-xs text-gray-400">FID: {player.fid}</p>
          )}
        </div>

        {/* Score */}
        <div className="flex flex-col items-center">
          <motion.div
            key={score}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1"
          >
            <span className="text-2xl">🍕</span>
            <span
              className="text-xl font-bold"
              style={{ color: player.color }}
            >
              {score}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Color indicator bar */}
      <div
        className="absolute bottom-0 left-4 right-4 h-1 rounded-full"
        style={{ backgroundColor: player.color }}
      />
    </motion.div>
  );
}

// Compact version for smaller displays
export function PlayerCardCompact({
  player,
  score,
  isActive,
}: Omit<PlayerCardProps, 'onClick' | 'isCurrentUser'>) {
  return (
    <motion.div
      className={`
        flex items-center gap-2 px-2 py-1 rounded-lg
        ${isActive ? 'bg-game-primary/20 ring-1 ring-game-primary' : 'bg-white/5'}
      `}
      layout
    >
      <div
        className="w-6 h-6 rounded-full overflow-hidden ring-1"
        style={{ borderColor: player.color }}
      >
        <img
          src={player.pfpUrl}
          alt={player.displayName}
          className="w-full h-full object-cover"
        />
      </div>
      <span className="text-xs font-medium text-white truncate max-w-[60px]">
        {player.displayName}
      </span>
      <span
        className="text-sm font-bold ml-auto"
        style={{ color: player.color }}
      >
        {score}
      </span>
    </motion.div>
  );
}
