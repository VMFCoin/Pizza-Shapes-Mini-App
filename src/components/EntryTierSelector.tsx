'use client';

import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { ENTRY_TIERS, EntryTier } from '@/types';
import { tierToAmount } from '@/lib/contracts';

// Tier colors for keycap styling
const TIER_COLORS = {
  1: { bg: '#4ECDC4', shadow: '#3EA89D', text: '#1C1917' }, // Teal - Starter
  2: { bg: '#FFB347', shadow: '#CC8F39', text: '#1C1917' }, // Orange - Standard  
  3: { bg: '#FF6B6B', shadow: '#CC5555', text: '#FFFFFF' }, // Red - Pro
};

interface EntryTierSelectorProps {
  selectedTier: number;
  onSelectTier: (tierId: number) => void;
  disabled?: boolean;
  priceUsd?: number | null;
}

export function EntryTierSelector({
  selectedTier,
  onSelectTier,
  disabled = false,
  priceUsd,
}: EntryTierSelectorProps) {
  return (
    <div className="card w-full max-w-md">
      <h3 className="text-base font-bold text-game-light mb-4 text-center">
        Select Entry Tier
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {ENTRY_TIERS.map((tier) => {
          const pizzaAmount = priceUsd ? tierToAmount(tier.id, priceUsd) : null;
          const pizzaDisplay = pizzaAmount && pizzaAmount > BigInt(0)
            ? `~${Number(formatUnits(pizzaAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} PIZZA`
            : null;
          return (
            <TierCard
              key={tier.id}
              tier={tier}
              isSelected={selectedTier === tier.id}
              onSelect={() => !disabled && onSelectTier(tier.id)}
              disabled={disabled}
              pizzaDisplay={pizzaDisplay}
            />
          );
        })}
      </div>
      <p className="text-xs text-stone-400 text-center mt-3">
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
  pizzaDisplay,
}: {
  tier: EntryTier;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  pizzaDisplay?: string | null;
}) {
  const colors = TIER_COLORS[tier.id as keyof typeof TIER_COLORS] || TIER_COLORS[1];
  
  return (
    <motion.button
      onClick={onSelect}
      disabled={disabled}
      className="relative p-4 rounded-xl text-center"
      style={isSelected ? {
        background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bg}DD 100%)`,
        color: colors.text,
        boxShadow: `0 4px 0 0 ${colors.shadow}, 0 6px 16px ${colors.bg}40`,
        transform: 'translateY(0)',
      } : {
        background: 'linear-gradient(180deg, #44403C 0%, #292524 100%)',
        color: '#A8A29E',
        boxShadow: '0 3px 0 0 #1C1917, inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      whileHover={!disabled ? { 
        scale: 1.05,
        boxShadow: isSelected 
          ? `0 4px 0 0 ${colors.shadow}, 0 8px 24px ${colors.bg}60`
          : `0 4px 0 0 #1C1917, 0 6px 16px rgba(0,0,0,0.3)`,
      } : {}}
      whileTap={!disabled ? { 
        scale: 0.98,
        boxShadow: isSelected
          ? `0 1px 0 0 ${colors.shadow}`
          : '0 1px 0 0 #1C1917',
      } : {}}
    >
      {/* Tier amount */}
      <p 
        className="text-2xl font-bold"
        style={{ fontFamily: 'var(--font-lilita), cursive' }}
      >
        {tier.label}
      </p>

      {/* Board size */}
      <p className={`text-xs mt-1 font-medium ${isSelected ? 'opacity-90' : 'text-stone-500'}`}>
        {tier.gridSize}x{tier.gridSize} Board
      </p>

      {/* Player count */}
      <p className={`text-xs ${isSelected ? 'opacity-70' : 'text-stone-600'}`}>
        {tier.minPlayers === tier.maxPlayers
          ? `${tier.maxPlayers} players`
          : `${tier.minPlayers}-${tier.maxPlayers} players`}
      </p>

      {/* PIZZA equivalent */}
      {pizzaDisplay && (
        <p className={`text-[10px] mt-1 ${isSelected ? 'opacity-60' : 'text-stone-600'}`}>
          {pizzaDisplay}
        </p>
      )}

      {/* Selected indicator - keycap badge */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          className="absolute -top-2 -right-2 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, #58D68D 0%, #46AB71 100%)',
            boxShadow: '0 2px 0 0 #2D7A4E',
          }}
        >
          <span className="text-white text-sm font-bold">{"✓"}</span>
        </motion.div>
      )}
    </motion.button>
  );
}

// Prize breakdown component - Updated with keycap styling
export function PrizeBreakdown({ entryAmount }: { entryAmount: number }) {
  const calculatePrize = (percentage: number) => {
    return (entryAmount * percentage / 100).toFixed(4);
  };

  return (
    <div className="card mt-4">
      <h4 className="text-sm font-bold text-game-light mb-3">Prize Distribution</h4>
      <div className="space-y-2 text-xs">
        {[
          { emoji: '🏆', label: 'Winner (77%)', value: calculatePrize(77), highlight: true },
          { emoji: '🎖️', label: 'Weekly Top 3 (10%)', value: calculatePrize(10) },
          { emoji: '🎲', label: 'Daily Free Roll (3%)', value: calculatePrize(3) },
          { emoji: '🔥', label: 'Burned (7%)', value: calculatePrize(7) },
          { emoji: '🎗️', label: 'Charities (3%)', value: calculatePrize(3) },
        ].map((item, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-stone-400">{item.emoji} {item.label}</span>
            <span className={item.highlight ? 'text-game-secondary font-bold' : 'text-stone-300'}>
              ${item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
