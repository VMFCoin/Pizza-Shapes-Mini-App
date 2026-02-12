-- Migration: Add optimistic concurrency control and server-side turn timeout
--
-- 1. Version column on matches for optimistic concurrency (TOCTOU prevention)
-- 2. turn_started_at for server-side turn timeout detection
-- 3. auto_advance_stale_turns() function for pg_cron
-- 4. Index for efficient stale turn queries
--
-- PREREQUISITE: Enable pg_cron extension in Supabase Dashboard → Database → Extensions

-- ============================================
-- 1. ADD VERSION AND TURN TIMESTAMP COLUMNS
-- ============================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 2. UPDATE MOVE_HISTORY CHECK CONSTRAINT
-- ============================================

-- Drop and recreate to add 'turn_timeout' move type
ALTER TABLE move_history DROP CONSTRAINT IF EXISTS move_history_move_type_check;
ALTER TABLE move_history ADD CONSTRAINT move_history_move_type_check
  CHECK (move_type IN ('roll_dice', 'draw_edge', 'end_turn', 'bot_takeover', 'turn_timeout'));

-- ============================================
-- 3. INDEX FOR STALE TURN QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_matches_stale_turn
  ON matches(turn_started_at)
  WHERE status = 'active';

-- ============================================
-- 4. SERVER-SIDE TURN TIMEOUT FUNCTION
-- ============================================

-- This function is called by pg_cron every minute.
-- It finds active matches where the current turn has been idle for 70+ seconds
-- and auto-advances to the next player.

CREATE OR REPLACE FUNCTION auto_advance_stale_turns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stale_match RECORD;
  player_count INT;
  next_index INT;
  current_player_fid BIGINT;
BEGIN
  -- Find all active matches with stale turns (70+ seconds idle)
  -- FOR UPDATE SKIP LOCKED prevents concurrent cron runs from conflicting
  FOR stale_match IN
    SELECT m.id, m.current_player_index, m.turn_number, m.version
    FROM matches m
    WHERE m.status = 'active'
      AND m.turn_started_at < NOW() - INTERVAL '70 seconds'
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Get player count for this match
    SELECT COUNT(*) INTO player_count
    FROM match_players
    WHERE match_id = stale_match.id;

    -- Skip if somehow no players
    IF player_count = 0 THEN
      CONTINUE;
    END IF;

    -- Get current player FID for move_history logging
    SELECT player_fid INTO current_player_fid
    FROM match_players
    WHERE match_id = stale_match.id
      AND player_index = stale_match.current_player_index;

    -- Calculate next player index (round-robin)
    next_index := (stale_match.current_player_index + 1) % player_count;

    -- Advance the turn with version check (safety against concurrent validate-move)
    UPDATE matches
    SET current_player_index = next_index,
        turn_number = stale_match.turn_number + 1,
        version = stale_match.version + 1,
        turn_started_at = NOW()
    WHERE id = stale_match.id
      AND version = stale_match.version;

    -- Reset game state for next player's fresh turn
    UPDATE game_states
    SET dice_roll = NULL,
        moves_remaining = 0,
        updated_at = NOW()
    WHERE match_id = stale_match.id;

    -- Log the timeout to move history
    INSERT INTO move_history (match_id, player_fid, turn_number, move_type, move_data)
    VALUES (
      stale_match.id,
      current_player_fid,
      stale_match.turn_number,
      'turn_timeout',
      jsonb_build_object('reason', 'server_timeout', 'timeout_seconds', 70)
    );

    RAISE NOTICE 'Auto-advanced turn for match %, player % (fid %) timed out',
      stale_match.id, stale_match.current_player_index, current_player_fid;
  END LOOP;
END;
$$;

-- ============================================
-- 5. SCHEDULE PG_CRON JOB (run every minute)
-- ============================================
-- NOTE: pg_cron must be enabled in Supabase Dashboard first.
-- Run this manually in the SQL Editor after enabling pg_cron:
--
-- SELECT cron.schedule(
--   'auto-advance-stale-turns',
--   '* * * * *',
--   $$SELECT auto_advance_stale_turns();$$
-- );
--
-- To verify it's running:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
