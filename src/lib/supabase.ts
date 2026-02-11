import { createClient } from "@supabase/supabase-js";

// ── Types ────────────────────────────────────────────────────────────────

export interface BetaConfig {
  id: number;
  key: string;
  value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: number;
  email: string;
  created_at: string;
}

// ── Client ───────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ── Helpers ──────────────────────────────────────────────────────────────

/** Fetch a config value from the beta_config table by key */
export async function getBetaConfig(key: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("beta_config")
    .select("value")
    .eq("key", key)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data.value;
}

/** Fetch the active beta test link */
export async function getBetaTestLink(): Promise<string | null> {
  return getBetaConfig("beta_test_link");
}
