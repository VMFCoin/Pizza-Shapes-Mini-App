-- Migration: Enable Realtime subscriptions for required tables
-- These tables need to broadcast changes to connected clients

-- Enable realtime for matches (status changes, turn updates)
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

-- Enable realtime for match_players (connection status, scores)
ALTER PUBLICATION supabase_realtime ADD TABLE match_players;

-- Enable realtime for game_states (board updates)
ALTER PUBLICATION supabase_realtime ADD TABLE game_states;

-- Enable realtime for match_queue (matchmaking)
ALTER PUBLICATION supabase_realtime ADD TABLE match_queue;

-- Note: players and move_history don't need realtime
-- - players: only updated on join, read-only for most operations
-- - move_history: append-only log, not needed in real-time
