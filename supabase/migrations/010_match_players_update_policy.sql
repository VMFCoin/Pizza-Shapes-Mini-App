-- Migration: Add UPDATE policy on match_players
-- Client needs to update is_connected and disconnected_at when players leave/disconnect.
-- Without this, RLS silently blocks all client-side writes to match_players.

CREATE POLICY "Players can update connection status" ON match_players
  FOR UPDATE USING (true)
  WITH CHECK (true);
