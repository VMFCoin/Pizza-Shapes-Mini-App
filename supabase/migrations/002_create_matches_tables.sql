-- Migration: Create matches and related tables
-- Core game tables for multiplayer functionality

-- Matches table - stores match metadata
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier INT NOT NULL CHECK (tier IN (1, 2, 3)),
  grid_size INT NOT NULL CHECK (grid_size IN (4, 6, 8)),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'countdown', 'active', 'completed', 'abandoned')),
  current_player_index INT DEFAULT 0,
  turn_number INT DEFAULT 1,
  winner_fid BIGINT REFERENCES players(fid),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Match players - join table linking players to matches
CREATE TABLE IF NOT EXISTS match_players (
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_fid BIGINT REFERENCES players(fid),
  color TEXT NOT NULL,
  player_index INT NOT NULL,
  is_bot BOOLEAN DEFAULT FALSE,
  is_connected BOOLEAN DEFAULT TRUE,
  disconnected_at TIMESTAMPTZ,
  score INT DEFAULT 0,
  PRIMARY KEY (match_id, player_fid)
);

-- Game states - stores the current board state
CREATE TABLE IF NOT EXISTS game_states (
  match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  nodes JSONB NOT NULL,
  edges JSONB NOT NULL DEFAULT '[]',
  possible_slices JSONB NOT NULL DEFAULT '[]',
  captured_slices JSONB NOT NULL DEFAULT '[]',
  dice_roll INT,
  moves_remaining INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Move history - audit log for all game actions
CREATE TABLE IF NOT EXISTS move_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_fid BIGINT REFERENCES players(fid),
  turn_number INT NOT NULL,
  move_type TEXT NOT NULL CHECK (move_type IN ('roll_dice', 'draw_edge', 'end_turn', 'bot_takeover')),
  move_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match queue - for real-time matchmaking
CREATE TABLE IF NOT EXISTS match_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_fid BIGINT REFERENCES players(fid),
  tier INT NOT NULL CHECK (tier IN (1, 2, 3)),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
  match_id UUID REFERENCES matches(id)
);

-- Indexes for performance
CREATE INDEX idx_match_queue_tier_status ON match_queue(tier, status) WHERE status = 'waiting';
CREATE INDEX idx_matches_status ON matches(status) WHERE status IN ('waiting', 'countdown', 'active');
CREATE INDEX idx_match_players_fid ON match_players(player_fid);
CREATE INDEX idx_match_players_connected ON match_players(match_id, is_connected) WHERE is_connected = FALSE;
CREATE INDEX idx_move_history_match ON move_history(match_id, created_at);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);

-- Trigger to auto-update game_states.updated_at
CREATE TRIGGER update_game_states_updated_at
  BEFORE UPDATE ON game_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
