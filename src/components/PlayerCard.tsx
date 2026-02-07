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
      className="relative p-3 rounded-xl cursor-pointer transition-all duration-200"
      style={isActive ? {
        background: `linear-gradient(180deg, ${player.color}20 0%, ${player.color}10 100%)`,
        border: `1px solid ${player.color}40`,
        boxShadow: `0 0 12px ${player.color}20, 0 2px 0 0 ${player.color}30`,
      } : {
        background: 'linear-gradient(180deg, rgba(68, 64, 60, 0.5) 0%, rgba(41, 37, 36, 0.5) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 2px 0 0 rgba(28, 25, 23, 0.5)',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Active indicator dot */}
      {isActive && (
        <motion.div
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
          style={{ 
            backgroundColor: player.color,
            boxShadow: `0 0 8px ${player.color}`,
          }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}

      <div className="flex items-center gap-3">
        {/* Profile picture */}
        <div
          className="relative w-10 h-10 rounded-full overflow-hidden ring-2"
          style={{ 
            borderColor: player.color,
            boxShadow: isActive ? `0 0 10px ${player.color}50` : 'none',
          }}
        >
          {player.isBot ? (
            <div className="w-full h-full flex items-center justify-center bg-stone-700 text-lg">
              {"🤖"}
            </div>
          ) : (
            <img
              src={player.pfpUrl}
              alt={player.displayName}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-game-light truncate text-sm">
            {player.displayName}
            {player.isBot && (
              <span className="ml-1 text-xs text-blue-400">(Bot)</span>
            )}
            {isCurrentUser && !player.isBot && (
              <span className="ml-1 text-xs text-game-secondary">(You)</span>
            )}
          </p>
          {showReadyStatus ? (
            isReady ? (
              <p className="text-xs text-green-400 flex items-center gap-1 font-medium">
                <span>{"✓"}</span> Ready
              </p>
            ) : (
              <p className="text-xs text-stone-400">Waiting...</p>
            )
          ) : (
            <p className="text-xs text-stone-400">FID: {player.fid}</p>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-1.5">
          <motion.div
            key={score}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1"
          >
            <span className="text-xl">{"🍕"}</span>
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
        className="absolute bottom-0 left-3 right-3 h-1 rounded-full"
        style={{ 
          backgroundColor: player.color,
          boxShadow: isActive ? `0 0 6px ${player.color}` : 'none',
        }}
      />
    </motion.div>
  );
}

// Compact version for smaller displays - Keycap style
export function PlayerCardCompact({
  player,
  score,
  isActive,
}: Omit<PlayerCardProps, 'onClick' | 'isCurrentUser'>) {
  return (
    <motion.div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
      style={isActive ? {
        background: `linear-gradient(180deg, ${player.color}30 0%, ${player.color}15 100%)`,
        border: `1px solid ${player.color}40`,
        boxShadow: `0 0 8px ${player.color}20`,
      } : {
        background: 'rgba(41, 37, 36, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
      layout
    >
      <div
        className="w-6 h-6 rounded-full overflow-hidden ring-1"
        style={{ borderColor: player.color }}
      >
        {player.isBot ? (
          <div className="w-full h-full flex items-center justify-center bg-stone-700 text-xs">
            {"🤖"}
          </div>
        ) : (
          <img
            src={player.pfpUrl}
            alt={player.displayName}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <span className="text-xs font-bold text-game-light truncate max-w-[60px]">
        {player.displayName}
        {player.isBot && <span className="text-blue-400 ml-0.5">(Bot)</span>}
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
