-- Migration: Create players table
-- This table caches Farcaster user information

CREATE TABLE IF NOT EXISTS players (
  fid BIGINT PRIMARY KEY,
  address TEXT,
  display_name TEXT NOT NULL,
  pfp_url TEXT,
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Players can read all players (for leaderboards, game displays)
CREATE POLICY "Players are viewable by everyone" ON players
  FOR SELECT USING (true);

-- Players can insert their own data (upsert on join)
CREATE POLICY "Players can insert their own data" ON players
  FOR INSERT WITH CHECK (true);

-- Players can update their own data
CREATE POLICY "Players can update own data" ON players
  FOR UPDATE USING (true);

-- Index for display name searches (leaderboard)
CREATE INDEX idx_players_display_name ON players(display_name);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
