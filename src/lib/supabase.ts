'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to ensure environment variables are available
let supabaseClient: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> | null {
  if (supabaseClient) return supabaseClient;

  if (typeof window === 'undefined') return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

  // Check if URL is valid (starts with http:// or https://)
  const isValidUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

  if (!isValidUrl || !supabaseAnonKey) {
    console.warn('Supabase configuration missing or invalid:', {
      hasUrl: !!supabaseUrl,
      urlValid: isValidUrl,
      hasKey: !!supabaseAnonKey
    });
    return null;
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return supabaseClient;
}

// Export getter function and a proxy that lazily initializes
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    const client = getSupabaseClient();
    if (!client) {
      // Return a function that logs warning for method calls
      if (typeof prop === 'string') {
        return () => {
          console.warn(`Supabase client not initialized. Cannot call ${prop}`);
          return Promise.resolve({ data: null, error: new Error('Supabase not initialized') });
        };
      }
      return undefined;
    }
    return (client as any)[prop];
  }
});

// Also export a function to check if supabase is available
export function isSupabaseAvailable(): boolean {
  return getSupabaseClient() !== null;
}

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
          version: number;
          turn_started_at: string;
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
          version?: number;
          turn_started_at?: string;
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
          version?: number;
          turn_started_at?: string;
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
          move_type: 'roll_dice' | 'draw_edge' | 'end_turn' | 'bot_takeover' | 'turn_timeout';
          move_data: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          player_fid: number;
          turn_number: number;
          move_type: 'roll_dice' | 'draw_edge' | 'end_turn' | 'bot_takeover' | 'turn_timeout';
          move_data: unknown;
          created_at?: string;
        };
        Update: {
          turn_number?: number;
          move_type?: 'roll_dice' | 'draw_edge' | 'end_turn' | 'bot_takeover' | 'turn_timeout';
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
