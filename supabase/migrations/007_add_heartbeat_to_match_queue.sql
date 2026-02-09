-- Migration: Add last_heartbeat column to match_queue
-- Tracks when a player last sent a heartbeat, so stale/disconnected players
-- can be filtered out by other clients

ALTER TABLE match_queue ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ DEFAULT NOW();

-- Index for efficiently filtering stale entries
CREATE INDEX IF NOT EXISTS idx_match_queue_heartbeat ON match_queue(last_heartbeat) WHERE status = 'waiting';
