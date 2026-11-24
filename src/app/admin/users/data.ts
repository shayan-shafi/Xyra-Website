import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAll } from "@/lib/fetchAll";
import { isInternal } from "../retention/data";

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

/**
 * How someone used Xyra in the last 30 days:
 *   app  – only inside the Xyra app (chat, dumps, boards, opens)
 *   ai   – only through an outside AI over the brain MCP (Claude, ChatGPT…)
 *   both – both
 *   none – neither in the last 30 days
 */
export type UseMode = "app" | "ai" | "both" | "none";

/** Billing bucket from subscriptions.status. */
export type Plan = "paying" | "trial" | "comped" | "lapsed" | "free";

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
  plan: Plan;
  internal: boolean; // team / test account (same rule as the Retention tab)
  mode30: UseMode;
  appDays30: number; // distinct days used inside the app, last 30
  aiDays30: number; // distinct days an outside AI used the brain, last 30
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
  overview: Overview;
  generatedAt: string;
};

/** The "where are we" numbers. Team/test accounts are excluded throughout. */
export type Overview = {
  accounts: number;
  paying: number;
  trial: number;
  comped: number;
  lapsed: number; // canceled / past_due: had a subscription, not paying now
  checkoutUnfinished: number; // started Stripe checkout, never paid (status incomplete)
  payingActive7: number;
  payingQuiet: number; // paying, nothing in 8+ days
  activated: number;
  active7: number;
  active7Prev: number; // active in the 7 days before that
  active30: number;
  newThisWeek: number; // accounts created in the last 7 days
  newStuck: number; // created in the last 14 days, nothing in the brain yet
  modes: Record<UseMode, number>; // accounts by 30-day use mode
  payingModes: Record<UseMode, number>; // same, paying only
  agents: { name: string; users: number }[]; // outside AIs used in the last 30 days
  weekly: { label: string; app: number; ai: number; both: number; signups: number }[]; // 8 rolling weeks, oldest first
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type Stamp = { user_id: string; created_at: string };

// Memories/notes written by cron connector syncs (Granola, Wispr, Apple
// Health weekly digests) land without the user doing anything, so they
// don't count as use. Everything else does: chat extraction, quick replies,
// and every `agent:<name>` write from an outside AI.
const isBackgroundSource = (src: string | null) => !!src && src.startsWith("connector");
// Written by an outside AI over MCP ("agent:claude", "agent:chatgpt" …).
const isAgentSource = (src: string | null) => !!src && src.startsWith("agent");

function planOf(status: string | null | undefined): Plan {
  switch (status) {
    case "active":
      return "paying";
    case "trialing":
      return "trial";
    case "comped":
      return "comped";
    case null:
    case undefined:
      return "free";
    default:
      return "lapsed"; // past_due, canceled, incomplete, unpaid …
  }
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Test sign-ups (QA runs, smoke tests, demo seeds) inflate every count. Same
// "team" bucket as internal accounts; anything this misses goes in
// RETENTION_INTERNAL_EMAILS.
const TEST_EMAIL = /test|@example\.com$|@xyra\.dev$|@xyraapp\.test$|^shayan\+/i;
const isTeamOrTest = (email: string) => isInternal(email) || TEST_EMAIL.test(email);

const DAY = 86_400_000;

function daysAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return Math.floor((now - new Date(iso).getTime()) / DAY);
}

// Per-user rollup of one activity table: count, latest timestamp, and the set
// of active days in the trend window (56 days; "days used" counts the last 30).
class Rollup {
  count = new Map<string, number>();
  latest = new Map<string, string>();
  days = new Map<string, Set<string>>();
  constructor(private cutoff: number) {}
  add(row: Stamp) {
    const u = row.user_id;
    this.count.set(u, (this.count.get(u) ?? 0) + 1);
    const prev = this.latest.get(u);
    if (!prev || row.created_at > prev) this.latest.set(u, row.created_at);
    if (new Date(row.created_at).getTime() >= this.cutoff) {
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
  const day30 = isoDay(cutoff30);
  const cutoffTrend = now - 56 * DAY; // 8 weeks for the trend

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

  const dash = new Rollup(cutoffTrend);
  const items = new Rollup(cutoffTrend);
  const chats = new Rollup(cutoffTrend);
  const dumps = new Rollup(cutoffTrend);
  const fb = new Rollup(cutoffTrend);
  for (const r of dashRows) dash.add(r);
  for (const r of itemRows) items.add(r);
  for (const r of chatRows) chats.add(r);
  for (const r of dumpRows) dumps.add(r);
  for (const r of feedbackRows) fb.add(r);
  // Facts/notes count as activity whoever wrote them; for the app-vs-AI split
  // the ones an outside AI wrote also land in agentBrain.
  const facts = new Rollup(cutoffTrend);
  const notes = new Rollup(cutoffTrend);
  const agentBrain = new Rollup(cutoffTrend);
  const appBrain = new Rollup(cutoffTrend);
  for (const r of [...factRows, ...noteRows]) {
    if (isBackgroundSource(r.source)) continue;
    (isAgentSource(r.source) ? agentBrain : appBrain).add(r);
  }
  for (const r of factRows) if (!isBackgroundSource(r.source)) facts.add(r);
  for (const r of noteRows) if (!isBackgroundSource(r.source)) notes.add(r);
  const agentWrites = new Rollup(cutoffTrend);
  const agentUse = new Rollup(cutoffTrend); // reads + writes, one stamp per token
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
  const opens = new Rollup(cutoffTrend);
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
  const appDaysById = new Map<string, Set<string>>();
  const aiDaysById = new Map<string, Set<string>>();

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

    // Days in the app vs days an outside AI used the brain (56-day window).
    const appDaySet = new Set<string>();
    for (const r of [dash, items, chats, dumps, opens, appBrain]) for (const d of r.days.get(id) ?? []) appDaySet.add(d);
    const aiDaySet = new Set<string>();
    for (const r of [agentWrites, agentUse, agentBrain]) for (const d of r.days.get(id) ?? []) aiDaySet.add(d);
    appDaysById.set(id, appDaySet);
    aiDaysById.set(id, aiDaySet);
    const in30 = (set: Set<string>) => [...set].filter((d) => d >= day30).length;
    const activeDaySet = new Set([...appDaySet, ...aiDaySet].filter((d) => d >= day30));
    const appDays30 = in30(appDaySet);
    const aiDays30 = in30(aiDaySet);
    const mode30: UseMode = appDays30 && aiDays30 ? "both" : appDays30 ? "app" : aiDays30 ? "ai" : "none";

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
      plan: planOf(subByUser.get(id)),
      internal: isTeamOrTest(email),
      mode30,
      appDays30,
      aiDays30,
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
      plan: "free",
      internal: isTeamOrTest(email),
      mode30: "none",
      appDays30: 0,
      aiDays30: 0,
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
  const real = accounts.filter((u) => !u.internal);
  const paying = real.filter((u) => u.plan === "paying");
  const countModes = (list: AlphaUser[]) => {
    const m: Record<UseMode, number> = { app: 0, ai: 0, both: 0, none: 0 };
    for (const u of list) m[u.mode30] += 1;
    return m;
  };
  const agentUsers = new Map<string, number>();
  for (const u of real) {
    for (const n of new Set(u.agentNames.map((a) => a.trim().toLowerCase()))) agentUsers.set(n, (agentUsers.get(n) ?? 0) + 1);
  }

  // Did this user do anything (app or AI) on a day in (from, to]?
  const usedBetween = (id: string, from: string, to: string) => {
    const hit = (set?: Set<string>) => !!set && [...set].some((d) => d > from && d <= to);
    return { app: hit(appDaysById.get(id)), ai: hit(aiDaysById.get(id)) };
  };
  // Rolling weeks, oldest first; the last bar is the 7 days ending today. A
  // user counts once per week, in the bucket for how they used Xyra that week.
  const weekly: Overview["weekly"] = [];
  for (let w = 7; w >= 0; w--) {
    const from = isoDay(now - (w + 1) * 7 * DAY);
    const to = isoDay(now - w * 7 * DAY);
    let app = 0, ai = 0, both = 0, signups = 0;
    for (const u of real) {
      const su = u.signedUpAt?.slice(0, 10);
      if (su && su > from && su <= to) signups++;
      const x = usedBetween(u.key, from, to);
      if (x.app && x.ai) both++;
      else if (x.app) app++;
      else if (x.ai) ai++;
    }
    const start = new Date(now - (w + 1) * 7 * DAY + DAY);
    weekly.push({ label: w === 0 ? "This wk" : start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), app, ai, both, signups });
  }
  const prevFrom = isoDay(now - 14 * DAY), prevTo = isoDay(now - 7 * DAY);

  const overview: Overview = {
    accounts: real.length,
    paying: paying.length,
    trial: real.filter((u) => u.plan === "trial").length,
    comped: real.filter((u) => u.plan === "comped").length,
    lapsed: real.filter((u) => u.plan === "lapsed" && u.subscription !== "incomplete").length,
    checkoutUnfinished: real.filter((u) => u.subscription === "incomplete").length,
    payingActive7: paying.filter((u) => u.daysSinceActive !== null && u.daysSinceActive <= 7).length,
    payingQuiet: paying.filter((u) => u.daysSinceActive === null || u.daysSinceActive > 7).length,
    activated: real.filter((u) => u.activated).length,
    active7: real.filter((u) => u.daysSinceActive !== null && u.daysSinceActive <= 7).length,
    active7Prev: real.filter((u) => { const x = usedBetween(u.key, prevFrom, prevTo); return x.app || x.ai; }).length,
    active30: real.filter((u) => u.daysSinceActive !== null && u.daysSinceActive <= 30).length,
    newThisWeek: real.filter((u) => { const d = daysAgo(u.signedUpAt, now); return d !== null && d < 7; }).length,
    newStuck: real.filter((u) => { const d = daysAgo(u.signedUpAt, now); return d !== null && d < 14 && !u.activated; }).length,
    modes: countModes(real),
    payingModes: countModes(paying),
    agents: [...agentUsers.entries()].map(([name, users]) => ({ name, users })).sort((a, b) => b.users - a.users),
    weekly,
  };

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
    overview,
    generatedAt: new Date(now).toISOString(),
  };
}
