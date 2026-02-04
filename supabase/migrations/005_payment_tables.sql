-- Migration: Create payment and distribution tracking tables

-- Free roll records
CREATE TABLE IF NOT EXISTS free_rolls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fid BIGINT NOT NULL,
  wallet_address TEXT NOT NULL,
  selection SMALLINT NOT NULL CHECK (selection >= 1 AND selection <= 6),
  result SMALLINT NOT NULL CHECK (result >= 1 AND result <= 6),
  won BOOLEAN NOT NULL DEFAULT FALSE,
  prize TEXT NOT NULL DEFAULT '0',
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for checking daily rolls
CREATE INDEX IF NOT EXISTS idx_free_rolls_fid_date ON free_rolls (fid, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_free_rolls_wallet ON free_rolls (wallet_address);

-- Weekly distribution records
CREATE TABLE IF NOT EXISTS weekly_distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL UNIQUE,
  total_distributed TEXT NOT NULL,
  winners JSONB NOT NULL DEFAULT '[]',
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Match settlements table (links to matches)
CREATE TABLE IF NOT EXISTS match_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  winner_address TEXT NOT NULL,
  total_pool TEXT NOT NULL,
  winner_prize TEXT NOT NULL,
  weekly_amount TEXT NOT NULL,
  burned_amount TEXT NOT NULL,
  free_roll_amount TEXT NOT NULL,
  charity_amount TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_settlements_match ON match_settlements (match_id);
CREATE INDEX IF NOT EXISTS idx_match_settlements_winner ON match_settlements (winner_address);

-- Charity distribution tracking
CREATE TABLE IF NOT EXISTS charity_distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_settlement_id UUID REFERENCES match_settlements(id) ON DELETE CASCADE,
  charity_name TEXT NOT NULL,
  charity_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charity_distributions_settlement ON charity_distributions (match_settlement_id);
CREATE INDEX IF NOT EXISTS idx_charity_distributions_address ON charity_distributions (charity_address);

-- Add settlement columns to matches table
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS winner_address TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS settlement_tx TEXT;

-- Function to update player stats after settlement
CREATE OR REPLACE FUNCTION update_player_stats(
  p_address TEXT,
  p_is_winner BOOLEAN,
  p_slices INTEGER,
  p_earnings TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO players (address, games_played, wins, slices_captured, lifetime_earnings, weekly_slices)
  VALUES (
    p_address,
    1,
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    p_slices,
    p_earnings::NUMERIC,
    p_slices
  )
  ON CONFLICT (address) DO UPDATE SET
    games_played = players.games_played + 1,
    wins = players.wins + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    slices_captured = players.slices_captured + p_slices,
    lifetime_earnings = players.lifetime_earnings + p_earnings::NUMERIC,
    weekly_slices = players.weekly_slices + p_slices,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to reset weekly slices (called by cron)
CREATE OR REPLACE FUNCTION reset_weekly_slices() RETURNS VOID AS $$
BEGIN
  UPDATE players SET weekly_slices = 0, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable RLS for new tables
ALTER TABLE free_rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE charity_distributions ENABLE ROW LEVEL SECURITY;

-- Public read access for transparency
CREATE POLICY "Free rolls are publicly readable" ON free_rolls
  FOR SELECT USING (true);

CREATE POLICY "Weekly distributions are publicly readable" ON weekly_distributions
  FOR SELECT USING (true);

CREATE POLICY "Match settlements are publicly readable" ON match_settlements
  FOR SELECT USING (true);

CREATE POLICY "Charity distributions are publicly readable" ON charity_distributions
  FOR SELECT USING (true);

-- Only service role can insert (via Edge Functions)
CREATE POLICY "Only service role can insert free rolls" ON free_rolls
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can insert weekly distributions" ON weekly_distributions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can insert match settlements" ON match_settlements
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can insert charity distributions" ON charity_distributions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
