'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if URL is valid (starts with http:// or https://)
const isValidUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

// Create a mock client or real client based on environment
let supabaseClient: SupabaseClient<Database> | null = null;

if (typeof window !== 'undefined' && isValidUrl && supabaseAnonKey) {
  // Only create client on client-side with valid URL
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

// Export the client (may be null during static build or SSR)
export const supabase = supabaseClient as SupabaseClient<Database>;

// Database type definitions
export type Database = {
  public: {
    Tables: {
      players: {
        Row: {
          fid: number;
          address: string | null;
          display_name: string;
          pfp_url: string | null;
          username: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          fid: number;
          address?: string | null;
          display_name: string;
          pfp_url?: string | null;
          username?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          fid?: number;
          address?: string | null;
          display_name?: string;
          pfp_url?: string | null;
          username?: string | null;
          updated_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          tier: number;
          grid_size: number;
          status: 'waiting' | 'countdown' | 'active' | 'completed' | 'abandoned';
          current_player_index: number;
          turn_number: number;
          winner_fid: number | null;
          created_at: string;
          started_at: string | null;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          tier: number;
          grid_size: number;
          status?: 'waiting' | 'countdown' | 'active' | 'completed' | 'abandoned';
          current_player_index?: number;
          turn_number?: number;
          winner_fid?: number | null;
          created_at?: string;
          started_at?: string | null;
          ended_at?: string | null;
        };
        Update: {
          tier?: number;
          grid_size?: number;
          status?: 'waiting' | 'countdown' | 'active' | 'completed' | 'abandoned';
          current_player_index?: number;
          turn_number?: number;
          winner_fid?: number | null;
          started_at?: string | null;
          ended_at?: string | null;
        };
      };
      match_players: {
        Row: {
          match_id: string;
          player_fid: number;
          color: string;
          player_index: number;
          is_bot: boolean;
          is_connected: boolean;
          disconnected_at: string | null;
          score: number;
        };
        Insert: {
          match_id: string;
          player_fid: number;
          color: string;
          player_index: number;
          is_bot?: boolean;
          is_connected?: boolean;
          disconnected_at?: string | null;
          score?: number;
        };
        Update: {
          color?: string;
          player_index?: number;
          is_bot?: boolean;
          is_connected?: boolean;
          disconnected_at?: string | null;
          score?: number;
        };
      };
      game_states: {
        Row: {
          match_id: string;
          nodes: unknown;
          edges: unknown;
          possible_slices: unknown;
          captured_slices: unknown;
          dice_roll: number | null;
          moves_remaining: number;
          updated_at: string;
        };
        Insert: {
          match_id: string;
          nodes: unknown;
          edges?: unknown;
          possible_slices?: unknown;
          captured_slices?: unknown;
          dice_roll?: number | null;
          moves_remaining?: number;
          updated_at?: string;
        };
        Update: {
          nodes?: unknown;
          edges?: unknown;
          possible_slices?: unknown;
          captured_slices?: unknown;
          dice_roll?: number | null;
          moves_remaining?: number;
          updated_at?: string;
        };
      };
      match_queue: {
        Row: {
          id: string;
          player_fid: number;
          tier: number;
          joined_at: string;
          status: 'waiting' | 'matched' | 'cancelled';
          match_id: string | null;
        };
        Insert: {
          id?: string;
          player_fid: number;
          tier: number;
          joined_at?: string;
          status?: 'waiting' | 'matched' | 'cancelled';
          match_id?: string | null;
        };
        Update: {
          tier?: number;
          status?: 'waiting' | 'matched' | 'cancelled';
          match_id?: string | null;
        };
      };
      move_history: {
        Row: {
          id: string;
          match_id: string;
          player_fid: number;
          turn_number: number;
          move_type: 'roll_dice' | 'draw_edge' | 'end_turn' | 'bot_takeover';
          move_data: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          player_fid: number;
          turn_number: number;
          move_type: 'roll_dice' | 'draw_edge' | 'end_turn' | 'bot_takeover';
          move_data: unknown;
          created_at?: string;
        };
        Update: {
          turn_number?: number;
          move_type?: 'roll_dice' | 'draw_edge' | 'end_turn' | 'bot_takeover';
          move_data?: unknown;
        };
      };
    };
  };
};

// Helper types for realtime subscriptions
export type MatchRow = Database['public']['Tables']['matches']['Row'];
export type MatchPlayerRow = Database['public']['Tables']['match_players']['Row'];
export type GameStateRow = Database['public']['Tables']['game_states']['Row'];
export type MatchQueueRow = Database['public']['Tables']['match_queue']['Row'];
export type PlayerRow = Database['public']['Tables']['players']['Row'];
