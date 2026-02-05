-- Migration: Add is_ready column to match_queue
-- This tracks whether a player has paid and is ready to start the game

ALTER TABLE match_queue ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT FALSE;

-- Index for efficiently finding ready players
CREATE INDEX IF NOT EXISTS idx_match_queue_tier_ready ON match_queue(tier, is_ready) WHERE status = 'waiting';
