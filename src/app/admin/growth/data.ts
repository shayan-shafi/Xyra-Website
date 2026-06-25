import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Paginate via .range() — same reason as the analytics dashboard: PostgREST
// caps every response at the project's max-rows setting (commonly 1000), so a
// growing waitlist would silently truncate with a bare .limit().
const SUPABASE_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      console.error(`${label} fetch:`, error.message);
      break;
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < SUPABASE_PAGE_SIZE) break;
  }
  return all;
}

// ── Types ────────────────────────────────────────────────────────────────────

type WaitlistRow = {
  id: number;
  name: string | null;
  email: string;
  created_at: string;
  ref_code: string | null;
  referred_by: string | null;
  referral_count: number | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  first_ref_code: string | null;
  // Present only after supabase/setup.sql section 7 is applied.
  alpha_status?: string | null;
  alpha_invited_at?: string | null;
  admin_notes?: string | null;
};

export type GrowthUser = {
  id: number;
  name: string | null;
  email: string;
  createdAt: string;
  refCode: string | null;
  referredBy: string | null;
  // Stored reward tally on this user's row (incremented at signup time).
  referralCount: number;
  // Computed from the data: how many waitlist rows name this user's ref_code in
  // referred_by. This is the same reward model, recomputed — shown alongside
  // referralCount so any drift between the two is visible.
  rewardReferrals: number;
  // First-touch source label (raw utm_source, or "referral"/"direct" fallback).
  source: string;
  campaign: string | null;
  alphaStatus: string | null;
  alphaInvitedAt: string | null;
  adminNotes: string | null;
};

export type LeaderboardRow = {
  name: string | null;
  email: string;
  refCode: string | null;
  referralCount: number;
  rewardReferrals: number;
};

export type GrowthData = {
  users: GrowthUser[];
  leaderboard: LeaderboardRow[];
  total: number;
  // False until the alpha_* / admin_notes columns exist (setup.sql §7).
  alphaFieldsAvailable: boolean;
  sources: string[];
  campaigns: string[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sourceLabel(row: WaitlistRow): string {
  const s = row.first_utm_source?.trim().toLowerCase();
  if (s) return s;
  if (row.first_ref_code) return "referral";
  return "direct";
}

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function fetchGrowthData(): Promise<GrowthData | null> {
  if (!supabaseAdmin) return null;

  // Probe whether the alpha columns exist yet, so the UI can degrade gracefully
  // before supabase/setup.sql §7 is applied. A failed probe is expected and not
  // an error condition.
  const probe = await supabaseAdmin.from("waitlist").select("alpha_status").limit(1);
  const alphaFieldsAvailable = !probe.error;

  const baseCols = "id,name,email,created_at,ref_code,referred_by,referral_count,first_utm_source,first_utm_campaign,first_ref_code";
  const cols = alphaFieldsAvailable ? `${baseCols},alpha_status,alpha_invited_at,admin_notes` : baseCols;

  const rows = await fetchAllRows<WaitlistRow>(
    (from, to) =>
      // `cols` is built at runtime (alpha columns are conditional), so the
      // typed client can't infer the row shape from the select string — cast
      // to the known WaitlistRow result shape.
      supabaseAdmin!
        .from("waitlist")
        .select(cols)
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: WaitlistRow[] | null; error: { message: string } | null }>,
    "growth waitlist"
  );

  // Reward attribution recomputed from the data: count rows per referred_by.
  const rewardByCode: Record<string, number> = {};
  for (const r of rows) {
    if (r.referred_by) rewardByCode[r.referred_by] = (rewardByCode[r.referred_by] ?? 0) + 1;
  }

  const users: GrowthUser[] = rows.map(r => ({
    id: r.id,
    name: r.name,
    email: r.email,
    createdAt: r.created_at,
    refCode: r.ref_code,
    referredBy: r.referred_by,
    referralCount: r.referral_count ?? 0,
    rewardReferrals: r.ref_code ? rewardByCode[r.ref_code] ?? 0 : 0,
    source: sourceLabel(r),
    campaign: r.first_utm_campaign,
    alphaStatus: alphaFieldsAvailable ? r.alpha_status ?? null : null,
    alphaInvitedAt: alphaFieldsAvailable ? r.alpha_invited_at ?? null : null,
    adminNotes: alphaFieldsAvailable ? r.admin_notes ?? null : null,
  }));

  const leaderboard: LeaderboardRow[] = users
    .filter(u => u.referralCount > 0 || u.rewardReferrals > 0)
    .map(u => ({
      name: u.name,
      email: u.email,
      refCode: u.refCode,
      referralCount: u.referralCount,
      rewardReferrals: u.rewardReferrals,
    }))
    .sort((a, b) => b.referralCount - a.referralCount || b.rewardReferrals - a.rewardReferrals)
    .slice(0, 25);

  const sources = Array.from(new Set(users.map(u => u.source))).sort();
  const campaigns = Array.from(
    new Set(users.map(u => u.campaign).filter((c): c is string => Boolean(c)))
  ).sort();

  return {
    users,
    leaderboard,
    total: users.length,
    alphaFieldsAvailable,
    sources,
    campaigns,
  };
}
