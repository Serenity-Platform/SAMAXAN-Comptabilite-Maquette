// Paperasse — Client Supabase singleton côté navigateur
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!config.supabase.anonKey) {
    throw new Error("Supabase anon key manquante (VITE_SUPABASE_ANON_KEY).");
  }
  _client = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "paperasse-auth",
    },
  });
  return _client;
}
