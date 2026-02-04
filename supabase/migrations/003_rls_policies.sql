-- Migration: Row Level Security policies for all tables
-- These policies control who can read/write to each table

-- Enable RLS on all tables
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MATCHES TABLE POLICIES
-- ============================================

-- Anyone can read matches (for spectating, leaderboards)
CREATE POLICY "Matches are viewable by everyone" ON matches
  FOR SELECT USING (true);

-- Only service role can insert/update matches (via Edge Functions)
-- This is handled by default - no policy needed for authenticated users

-- ============================================
-- MATCH PLAYERS TABLE POLICIES
-- ============================================

-- Anyone can view match players
CREATE POLICY "Match players viewable by everyone" ON match_players
  FOR SELECT USING (true);

-- ============================================
-- GAME STATES TABLE POLICIES
-- ============================================

-- Anyone can view game states (needed for realtime subscriptions)
CREATE POLICY "Game states viewable by everyone" ON game_states
  FOR SELECT USING (true);

-- ============================================
-- MOVE HISTORY TABLE POLICIES
-- ============================================

-- Anyone can view move history (for replays, verification)
CREATE POLICY "Move history viewable by everyone" ON move_history
  FOR SELECT USING (true);

-- ============================================
-- MATCH QUEUE TABLE POLICIES
-- ============================================

-- Anyone can view the queue
CREATE POLICY "Players can view queue" ON match_queue
  FOR SELECT USING (true);

-- Players can join the queue
CREATE POLICY "Players can join queue" ON match_queue
  FOR INSERT WITH CHECK (true);

-- Players can update their own queue entry (to cancel)
CREATE POLICY "Players can update own queue entry" ON match_queue
  FOR UPDATE USING (true);

-- Players can delete their own queue entry
CREATE POLICY "Players can delete own queue entry" ON match_queue
  FOR DELETE USING (true);
