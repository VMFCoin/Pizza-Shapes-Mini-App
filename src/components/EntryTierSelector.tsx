'use client';

import { motion } from 'framer-motion';
import { ENTRY_TIERS, EntryTier } from '@/types';

interface EntryTierSelectorProps {
  selectedTier: number;
  onSelectTier: (tierId: number) => void;
  disabled?: boolean;
}

export function EntryTierSelector({
  selectedTier,
  onSelectTier,
  disabled = false,
}: EntryTierSelectorProps) {
  return (
    <div className="w-full max-w-md">
      <h3 className="text-lg font-semibold text-white mb-4 text-center">
        Select Entry Tier
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {ENTRY_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isSelected={selectedTier === tier.id}
            onSelect={() => !disabled && onSelectTier(tier.id)}
            disabled={disabled}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center mt-3">
        Higher stakes = bigger prizes!
      </p>
    </div>
  );
}

function TierCard({
  tier,
  isSelected,
  onSelect,
  disabled,
}: {
  tier: EntryTier;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <motion.button
      onClick={onSelect}
      disabled={disabled}
      className={`
        relative p-4 rounded-xl text-center transition-all duration-200
        ${isSelected
          ? 'bg-gradient-to-br from-game-primary to-game-secondary text-white'
          : 'bg-white/10 text-white hover:bg-white/20'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      {/* Glow effect on hover/selected */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-xl bg-game-primary/30 blur-xl -z-10"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Tier amount */}
      <p className="text-2xl font-bold">{tier.label}</p>

      {/* Board size */}
      <p className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
        {tier.gridSize}x{tier.gridSize} Board
      </p>

      {/* Player count */}
      <p className={`text-xs ${isSelected ? 'text-white/60' : 'text-gray-500'}`}>
        {tier.minPlayers === tier.maxPlayers
          ? `${tier.maxPlayers} players`
          : `${tier.minPlayers}-${tier.maxPlayers} players`}
      </p>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
        >
          <span className="text-white text-xs">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
}

// Prize breakdown component
export function PrizeBreakdown({ entryAmount }: { entryAmount: number }) {
  const calculatePrize = (percentage: number) => {
    return (entryAmount * percentage / 100).toFixed(4);
  };

  return (
    <div className="bg-white/5 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-white mb-3">Prize Distribution</h4>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-gray-300">
          <span>🏆 Winner (77%)</span>
          <span className="text-game-secondary">${calculatePrize(77)}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>🎖️ Weekly Top 3 (10%)</span>
          <span>${calculatePrize(10)}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>🎲 Daily Free Roll (3%)</span>
          <span>${calculatePrize(3)}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>🔥 Burned (7%)</span>
          <span>${calculatePrize(7)}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>🎗️ Charities (3%)</span>
          <span>${calculatePrize(3)}</span>
        </div>
      </div>
    </div>
  );
}
