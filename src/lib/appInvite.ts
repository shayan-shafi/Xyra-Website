// Reads a friend's invite code from the XYRA APP's database (a different
// Supabase project from this site's): whose code it is, first name only, and
// whether it still has room. Calls the app's public invite_lookup() RPC with
// the app's anon key, which is public by design (it ships in the app too).

const APP_URL = process.env.APP_SUPABASE_URL || "https://naklqxesofjyhnehgizl.supabase.co";
const APP_ANON_KEY = process.env.APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ha2xxeGVzb2ZqeWhuZWhnaXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDc5MDEsImV4cCI6MjA4MjEyMzkwMX0.RIiWqE4H3e7zNgdpMSjZi--CoFgjai9yccrHI-rPAOA";

export const APP_ORIGIN = "https://app.xyra.dev";

export interface InviteInfo {
  firstName: string;
  open: boolean;
}

export function cleanInviteCode(raw: string): string | null {
  const c = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{4,16}$/.test(c) ? c : null;
}

/** null when no such code (or the app database can't be reached). */
export async function lookupInvite(code: string): Promise<InviteInfo | null> {
  try {
    const res = await fetch(`${APP_URL}/rest/v1/rpc/invite_lookup`, {
      method: "POST",
      headers: { apikey: APP_ANON_KEY, Authorization: `Bearer ${APP_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: code }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const v = (await res.json()) as { first_name?: string; open?: boolean } | null;
    if (!v || typeof v !== "object") return null;
    return { firstName: String(v.first_name ?? "").trim().toLowerCase(), open: v.open !== false };
  } catch {
    return null;
  }
}
