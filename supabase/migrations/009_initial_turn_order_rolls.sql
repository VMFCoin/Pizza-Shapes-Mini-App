-- Migration: Add initial_roll column to match_players for turn order determination
--
-- When a match is created, each player rolls a die (1-6) to determine turn order.
-- The highest roller goes first. This column stores that initial roll so clients
-- can display the roll-off animation before the game starts.

ALTER TABLE match_players ADD COLUMN IF NOT EXISTS initial_roll INT;

COMMENT ON COLUMN match_players.initial_roll IS 'Initial dice roll (1-6) used to determine turn order. Highest roll goes first.';
