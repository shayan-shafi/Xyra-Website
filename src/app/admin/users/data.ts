import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAll } from "@/lib/fetchAll";

// Data layer for the admin Users tab — the alpha roster.
//
// Joins two databases by email:
//   • the XYRA APP project (service role): auth users + activity signals
//     (dashboards, items, chat, brain dumps, feedback, push tokens, billing,
//     and app_opened events: opening the web or phone app counts as use;
//     memories + notes, the memory meter (rpc memory_usage_all), and anything an outside AI does through the brain
//     MCP: writes via agent_events, reads via agent_tokens.last_used_at)
//   • the marketing site's own project: the waitlist (alpha_status, invite
//     date, acquisition source)
//
// Everything is read-only. Activity is derived from row timestamps, plus the
// app's first-party app_opened events (product_events, sent by the app since
// 2026-10-27), so a visit that creates nothing still counts.

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Lifecycle bucket, computed from the most recent activity row or app open:
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
  lastActiveAt: string | null; // max(created_at) across activity tables and app opens
  daysSinceActive: number | null;
  activeDays30: number; // distinct days with activity or an app open in the last 30 days
  webOpens30: number; // app_opened from the laptop web app, last 30 days
  phoneOpens30: number; // app_opened from the phone app, last 30 days
  memories: number; // user_facts the user (or their AI) added — background connector syncs excluded
  notes: number; // brain_notes, same rule
  // Memory meter (app db memory_usage_all, 2026-11-19): everything kept in the
  // brain, the unit pricing is built on. 1 per active fact, 1 per row on a
  // live board, 1 per 280 chars of a note. Every source counts, connectors too.
  stored: number;
  storedFacts: number;
  storedRows: number;
  storedNoteMemories: number;
  agentActions30: number; // MCP writes by outside AIs (agent_events), last 30 days
  agentLastUsedAt: string | null; // latest MCP call of any kind, reads included (agent_tokens.last_used_at)
  agentNames: string[]; // connected AIs that used the brain in the last 30 days
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

// Memories/notes written by cron connector syncs (Granola, Wispr, Apple
// Health weekly digests) land without the user doing anything, so they
// don't count as use. Everything else does: chat extraction, quick replies,
// and every `agent:<name>` write from an outside AI.
const isBackgroundSource = (src: string | null) => !!src && src.startsWith("connector");

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
    openRows,
    factRows,
    noteRows,
    agentEventRows,
    agentTokenRows,
    meterRows,
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
    // Opening the app (web or phone), at most one per device kind per 15 min.
    fetchAll<Stamp & { props: { client?: string } | null }>((from, to) =>
      app.from("product_events").select("user_id, created_at, props").eq("event_name", "app_opened")
        .order("created_at", { ascending: false }).range(from, to), "product_events/app_opened"),
    // The brain: memories and notes, minus background connector syncs.
    fetchAll<Stamp & { source: string | null }>((from, to) =>
      app.from("user_facts").select("user_id, created_at, source")
        .order("created_at", { ascending: false }).range(from, to), "user_facts"),
    fetchAll<Stamp & { source: string | null }>((from, to) =>
      app.from("brain_notes").select("user_id, created_at, source")
        .order("created_at", { ascending: false }).range(from, to), "brain_notes"),
    // Outside AIs (Claude, ChatGPT, …) through the brain MCP. Every write is
    // logged in agent_events (edits/moves/forgets included); reads only bump
    // the token's last_used_at (at most once per 5 min), so a read-only AI
    // shows as last-active but adds at most one day to Days/30.
    fetchAll<Stamp & { agent_name: string | null }>((from, to) =>
      app.from("agent_events").select("user_id, created_at, agent_name")
        .order("created_at", { ascending: false }).range(from, to), "agent_events"),
    fetchAll<{ user_id: string; name: string | null; last_used_at: string | null }>((from, to) =>
      app.from("agent_tokens").select("user_id, name, last_used_at").not("last_used_at", "is", null)
        .range(from, to), "agent_tokens"),
    fetchAll<{ user_id: string; facts: number; board_rows: number; note_memories: number; total: number }>((from, to) =>
      app.rpc("memory_usage_all").range(from, to), "memory_usage_all"),
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
  const facts = new Rollup(cutoff30);
  const notes = new Rollup(cutoff30);
  for (const r of factRows) if (!isBackgroundSource(r.source)) facts.add(r);
  for (const r of noteRows) if (!isBackgroundSource(r.source)) notes.add(r);
  const agentWrites = new Rollup(cutoff30);
  const agentUse = new Rollup(cutoff30); // reads + writes, one stamp per token
  const agentWrites30 = new Map<string, number>();
  const agentNames = new Map<string, Set<string>>();
  const nameAgent = (u: string, n: string | null) => {
    if (!n) return;
    let s = agentNames.get(u);
    if (!s) agentNames.set(u, (s = new Set()));
    s.add(n);
  };
  for (const r of agentEventRows) {
    agentWrites.add(r);
    if (new Date(r.created_at).getTime() < cutoff30) continue;
    agentWrites30.set(r.user_id, (agentWrites30.get(r.user_id) ?? 0) + 1);
    nameAgent(r.user_id, r.agent_name);
  }
  for (const t of agentTokenRows) {
    if (!t.last_used_at) continue;
    agentUse.add({ user_id: t.user_id, created_at: t.last_used_at });
    if (new Date(t.last_used_at).getTime() >= cutoff30) nameAgent(t.user_id, t.name);
  }
  const opens = new Rollup(cutoff30);
  const webOpens = new Map<string, number>();
  const phoneOpens = new Map<string, number>();
  for (const r of openRows) {
    opens.add(r);
    if (new Date(r.created_at).getTime() < cutoff30) continue;
    const by = r.props?.client === "web" ? webOpens : r.props?.client === "mobile" ? phoneOpens : null;
    if (by) by.set(r.user_id, (by.get(r.user_id) ?? 0) + 1);
  }

  const meterByUser = new Map(meterRows.map((m) => [m.user_id, m]));

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
    const lastActiveAt = maxIso(
      dash.latest.get(id), items.latest.get(id), chats.latest.get(id), dumps.latest.get(id), opens.latest.get(id),
      facts.latest.get(id), notes.latest.get(id), agentWrites.latest.get(id), agentUse.latest.get(id),
    );
    const nDash = dash.count.get(id) ?? 0;
    const nItems = items.count.get(id) ?? 0;
    const nChats = chats.count.get(id) ?? 0;
    const nDumps = dumps.count.get(id) ?? 0;
    const nFacts = facts.count.get(id) ?? 0;
    const nNotes = notes.count.get(id) ?? 0;
    const nAgentWrites = agentWrites.count.get(id) ?? 0;
    // Putting something in the brain counts, whoever typed it — the app or an outside AI.
    const activated = nDash + nItems + nChats + nDumps + nFacts + nNotes + nAgentWrites > 0;
    const since = daysAgo(lastActiveAt, now);
    const meter = meterByUser.get(id);

    const activeDaySet = new Set<string>();
    for (const r of [dash, items, chats, dumps, opens, facts, notes, agentWrites, agentUse]) for (const d of r.days.get(id) ?? []) activeDaySet.add(d);

    // "Activated" = created something (in the app or through an AI); opening
    // the app or an AI reading the brain keeps an account active (and out of idle).
    let status: UserStatus;
    if (!activated && !opens.latest.has(id) && !agentUse.latest.has(id)) status = "idle";
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
      webOpens30: webOpens.get(id) ?? 0,
      phoneOpens30: phoneOpens.get(id) ?? 0,
      memories: nFacts,
      notes: nNotes,
      stored: Number(meter?.total ?? 0),
      storedFacts: Number(meter?.facts ?? 0),
      storedRows: Number(meter?.board_rows ?? 0),
      storedNoteMemories: Number(meter?.note_memories ?? 0),
      agentActions30: agentWrites30.get(id) ?? 0,
      agentLastUsedAt: maxIso(agentUse.latest.get(id), agentWrites.latest.get(id)),
      agentNames: [...(agentNames.get(id) ?? [])],
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
      webOpens30: 0,
      phoneOpens30: 0,
      memories: 0,
      notes: 0,
      stored: 0,
      storedFacts: 0,
      storedRows: 0,
      storedNoteMemories: 0,
      agentActions30: 0,
      agentLastUsedAt: null,
      agentNames: [],
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
