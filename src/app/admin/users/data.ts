import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Data layer for the admin Users tab — the alpha roster.
//
// Joins two databases by email:
//   • the XYRA APP project (service role): auth users + activity signals
//     (dashboards, items, chat, brain dumps, feedback, push tokens, billing)
//   • the marketing site's own project: the waitlist (alpha_status, invite
//     date, acquisition source)
//
// Everything is read-only. Activity is derived from row timestamps — no
// tracking pixels, no new writes in the app.

const PAGE = 1000;

// PostgREST caps each response at the project max-rows (commonly 1000), so
// page through with .range() instead of a bare .limit().
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) {
      console.error(`users/${label}:`, error.message);
      break;
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Lifecycle bucket, computed from the most recent activity row:
 *   active   – used the app in the last 7 days
 *   cooling  – 8–30 days since last activity
 *   dormant  – >30 days since last activity
 *   idle     – has an account but never created anything (no dashboards,
 *              chat, or brain dumps) — signed up and bounced
 *   invited  – on the waitlist with alpha_status invited/selected, no account yet
 *   waitlist – on the waitlist, not invited, no account
 */
export type UserStatus = "active" | "cooling" | "dormant" | "idle" | "invited" | "waitlist";

export type AlphaUser = {
  key: string; // auth user id, or `wl:<waitlist id>` for waitlist-only rows
  email: string;
  name: string | null;
  status: UserStatus;
  hasAccount: boolean;
  activated: boolean; // has at least one activity row
  signedUpAt: string | null; // auth.users.created_at
  lastSignInAt: string | null;
  lastActiveAt: string | null; // max(created_at) across activity tables
  daysSinceActive: number | null;
  activeDays30: number; // distinct days with activity in the last 30 days
  dashboards: number;
  items: number;
  chats: number; // user-authored chat messages
  dumps: number; // ingestion_events (brain dumps / voice)
  feedback: number;
  pushEnabled: boolean;
  subscription: string | null;
  provider: string | null; // email / apple / google …
  // Waitlist side
  onWaitlist: boolean;
  waitlistedAt: string | null;
  alphaStatus: string | null;
  alphaInvitedAt: string | null;
  source: string | null;
  adminNotes: string | null;
};

export type UsersData = {
  users: AlphaUser[];
  funnel: {
    waitlist: number;
    invited: number;
    accounts: number;
    activated: number;
    active7: number;
    active30: number;
  };
  byStatus: Record<UserStatus, number>;
  generatedAt: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type Stamp = { user_id: string; created_at: string };

const DAY = 86_400_000;

function daysAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

// Per-user rollup of one activity table: count, latest timestamp, and the set
// of active days in the last 30 (for the "days used" signal).
class Rollup {
  count = new Map<string, number>();
  latest = new Map<string, string>();
  days = new Map<string, Set<string>>();
  constructor(private cutoff30: number) {}
  add(row: Stamp) {
    const u = row.user_id;
    this.count.set(u, (this.count.get(u) ?? 0) + 1);
    const prev = this.latest.get(u);
    if (!prev || row.created_at > prev) this.latest.set(u, row.created_at);
    if (new Date(row.created_at).getTime() >= this.cutoff30) {
      let s = this.days.get(u);
      if (!s) this.days.set(u, (s = new Set()));
      s.add(row.created_at.slice(0, 10));
    }
  }
}

function maxIso(...vals: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  for (const v of vals) if (v && (!best || v > best)) best = v;
  return best;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchUsersData(): Promise<UsersData | null> {
  if (!supabaseAppAdmin) return null;
  const app = supabaseAppAdmin;
  const now = Date.now();
  const cutoff30 = now - 30 * DAY;

  const stamps = (table: string, extra?: (q: any) => any) =>
    fetchAll<Stamp>((from, to) => {
      let q = app.from(table).select("user_id, created_at");
      if (extra) q = extra(q);
      return q.order("created_at", { ascending: false }).range(from, to);
    }, table);

  const [
    authUsers,
    profileRows,
    dashRows,
    itemRows,
    chatRows,
    dumpRows,
    feedbackRows,
    pushRows,
    subRows,
    waitlistRows,
  ] = await Promise.all([
    // Alpha scale: one page of up to 1000 auth users.
    app.auth.admin
      .listUsers({ page: 1, perPage: 1000 })
      .then((r) => r.data?.users ?? [])
      .catch((e) => {
        console.error("users/auth.listUsers:", e);
        return [];
      }),
    fetchAll<{ auth_id: string | null; name: string | null; email: string; created_at: string | null }>(
      (from, to) => app.from("users").select("auth_id, name, email, created_at").range(from, to),
      "users",
    ),
    stamps("dashboards"),
    stamps("dashboard_items"),
    stamps("chat_messages", (q) => q.eq("role", "user").eq("synthetic", false)),
    stamps("ingestion_events"),
    stamps("feedback"),
    fetchAll<{ user_id: string }>((from, to) => app.from("push_tokens").select("user_id").range(from, to), "push_tokens"),
    fetchAll<{ user_id: string; status: string }>(
      (from, to) => app.from("subscriptions").select("user_id, status").range(from, to),
      "subscriptions",
    ),
    supabaseAdmin
      ? fetchAll<{
          id: number;
          email: string;
          name: string | null;
          created_at: string;
          first_utm_source: string | null;
          referred_by: string | null;
          alpha_status?: string | null;
          alpha_invited_at?: string | null;
          admin_notes?: string | null;
        }>(async (from, to) => {
          // alpha_* columns exist only after setup.sql §7 — fall back gracefully.
          const full = await supabaseAdmin!
            .from("waitlist")
            .select("id, email, name, created_at, first_utm_source, referred_by, alpha_status, alpha_invited_at, admin_notes")
            .range(from, to);
          if (!full.error) return full;
          return supabaseAdmin!
            .from("waitlist")
            .select("id, email, name, created_at, first_utm_source, referred_by")
            .range(from, to);
        }, "waitlist")
      : Promise.resolve([]),
  ]);

  const dash = new Rollup(cutoff30);
  const items = new Rollup(cutoff30);
  const chats = new Rollup(cutoff30);
  const dumps = new Rollup(cutoff30);
  const fb = new Rollup(cutoff30);
  for (const r of dashRows) dash.add(r);
  for (const r of itemRows) items.add(r);
  for (const r of chatRows) chats.add(r);
  for (const r of dumpRows) dumps.add(r);
  for (const r of feedbackRows) fb.add(r);

  const profileByAuth = new Map<string, { name: string | null; created_at: string | null }>();
  for (const p of profileRows) if (p.auth_id) profileByAuth.set(p.auth_id, { name: p.name, created_at: p.created_at });
  const pushUsers = new Set(pushRows.map((r) => r.user_id));
  const subByUser = new Map(subRows.map((r) => [r.user_id, r.status]));
  const waitlistByEmail = new Map(waitlistRows.map((w) => [w.email.trim().toLowerCase(), w]));

  const users: AlphaUser[] = [];
  const seenEmails = new Set<string>();

  for (const u of authUsers) {
    const email = (u.email ?? "").toLowerCase();
    if (!email) continue;
    seenEmails.add(email);
    const id = u.id;
    const wl = waitlistByEmail.get(email);
    const lastActiveAt = maxIso(dash.latest.get(id), items.latest.get(id), chats.latest.get(id), dumps.latest.get(id));
    const nDash = dash.count.get(id) ?? 0;
    const nItems = items.count.get(id) ?? 0;
    const nChats = chats.count.get(id) ?? 0;
    const nDumps = dumps.count.get(id) ?? 0;
    const activated = nDash + nItems + nChats + nDumps > 0;
    const since = daysAgo(lastActiveAt, now);

    const activeDaySet = new Set<string>();
    for (const r of [dash, items, chats, dumps]) for (const d of r.days.get(id) ?? []) activeDaySet.add(d);

    let status: UserStatus;
    if (!activated) status = "idle";
    else if (since !== null && since <= 7) status = "active";
    else if (since !== null && since <= 30) status = "cooling";
    else status = "dormant";

    const provider =
      (u.app_metadata?.provider as string | undefined) ??
      (Array.isArray(u.app_metadata?.providers) ? (u.app_metadata!.providers as string[])[0] : null) ??
      null;

    users.push({
      key: id,
      email,
      name: profileByAuth.get(id)?.name ?? (u.user_metadata?.name as string | undefined) ?? wl?.name ?? null,
      status,
      hasAccount: true,
      activated,
      signedUpAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      lastActiveAt,
      daysSinceActive: since,
      activeDays30: activeDaySet.size,
      dashboards: nDash,
      items: nItems,
      chats: nChats,
      dumps: nDumps,
      feedback: fb.count.get(id) ?? 0,
      pushEnabled: pushUsers.has(id),
      subscription: subByUser.get(id) ?? null,
      provider,
      onWaitlist: !!wl,
      waitlistedAt: wl?.created_at ?? null,
      alphaStatus: wl?.alpha_status ?? null,
      alphaInvitedAt: wl?.alpha_invited_at ?? null,
      source: wl ? wl.first_utm_source ?? (wl.referred_by ? "referral" : "direct") : null,
      adminNotes: wl?.admin_notes ?? null,
    });
  }

  // Waitlist people who never created an account.
  for (const w of waitlistRows) {
    const email = w.email.trim().toLowerCase();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    const invited = w.alpha_status === "invited" || w.alpha_status === "selected";
    users.push({
      key: `wl:${w.id}`,
      email,
      name: w.name,
      status: invited ? "invited" : "waitlist",
      hasAccount: false,
      activated: false,
      signedUpAt: null,
      lastSignInAt: null,
      lastActiveAt: null,
      daysSinceActive: null,
      activeDays30: 0,
      dashboards: 0,
      items: 0,
      chats: 0,
      dumps: 0,
      feedback: 0,
      pushEnabled: false,
      subscription: null,
      provider: null,
      onWaitlist: true,
      waitlistedAt: w.created_at,
      alphaStatus: w.alpha_status ?? null,
      alphaInvitedAt: w.alpha_invited_at ?? null,
      source: w.first_utm_source ?? (w.referred_by ? "referral" : "direct"),
      adminNotes: w.admin_notes ?? null,
    });
  }

  // Most recently active first; accounts before waitlist-only rows.
  users.sort((a, b) => {
    if (a.hasAccount !== b.hasAccount) return a.hasAccount ? -1 : 1;
    const la = a.lastActiveAt ?? a.signedUpAt ?? a.waitlistedAt ?? "";
    const lb = b.lastActiveAt ?? b.signedUpAt ?? b.waitlistedAt ?? "";
    return lb.localeCompare(la);
  });

  const byStatus: Record<UserStatus, number> = { active: 0, cooling: 0, dormant: 0, idle: 0, invited: 0, waitlist: 0 };
  for (const u of users) byStatus[u.status] += 1;

  const accounts = users.filter((u) => u.hasAccount);
  return {
    users,
    funnel: {
      waitlist: waitlistRows.length,
      invited: waitlistRows.filter((w) => w.alpha_status === "invited" || w.alpha_status === "selected").length,
      accounts: accounts.length,
      activated: accounts.filter((u) => u.activated).length,
      active7: accounts.filter((u) => u.daysSinceActive !== null && u.daysSinceActive <= 7).length,
      active30: accounts.filter((u) => u.daysSinceActive !== null && u.daysSinceActive <= 30).length,
    },
    byStatus,
    generatedAt: new Date(now).toISOString(),
  };
}
