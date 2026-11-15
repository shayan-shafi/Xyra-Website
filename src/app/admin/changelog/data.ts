import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";
import { fetchAll } from "@/lib/fetchAll";
import type { ShipEvent, ShipKind } from "@/lib/changelog";

// Data layer for the admin Changelog tab.
//
// Releases come from ship_events (WEBSITE project, written by
// /api/changelog/ingest). The daily numbers they're laid against come from the
// APP project, same sources as the Users + Retention tabs:
//   active   = distinct people who opened the app (product_events app_opened)
//              or sent a message (chat_messages, role=user, not synthetic)
//   signups  = auth users created that day
//   messages = user chat messages
// Team accounts (@xyraconsult.com + RETENTION_INTERNAL_EMAILS) are left out.

const DAY = 86_400_000;
export const WINDOW_DAYS = 60;
export const COMPARE_DAYS = 7;
const TZ = "America/Chicago";

const INTERNAL_DOMAINS = ["xyraconsult.com"];
const INTERNAL_EMAILS = new Set(
  (process.env.RETENTION_INTERNAL_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);
const isInternal = (email: string) => INTERNAL_EMAILS.has(email) || INTERNAL_DOMAINS.some((d) => email.endsWith(`@${d}`));

const dayKey = (t: number | string) =>
  new Date(t).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD

export type DayPoint = { day: string; active: number; signups: number; messages: number };

export type Compare = {
  days: number; // days of "after" that have happened (≤ COMPARE_DAYS)
  activeBefore: number; activeAfter: number;
  signupsBefore: number; signupsAfter: number;
  messagesBefore: number; messagesAfter: number;
};

export type PendingPhone = { sha: string; subject: string; at: string; via: ShipKind; shippedAt: string };

export type ChangelogData = {
  events: ShipEvent[];
  series: DayPoint[] | null; // null = app database not connected
  compareByDay: Record<string, Compare>;
  pendingPhone: PendingPhone[];
  lastPhone: ShipEvent | null;
  tableMissing: boolean;
};

async function fetchEvents(): Promise<{ events: ShipEvent[]; tableMissing: boolean }> {
  if (!supabaseAdmin) return { events: [], tableMissing: true };
  const since = new Date(Date.now() - 365 * DAY).toISOString();
  let missing = false;
  const rows = await fetchAll<ShipEvent>(async (from, to) => {
    const r = await supabaseAdmin!.from("ship_events").select("*").gte("shipped_at", since)
      .order("shipped_at", { ascending: false }).range(from, to);
    if (r.error && /ship_events/.test(r.error.message)) missing = true;
    return r;
  }, "ship_events");
  return { events: rows, tableMissing: missing };
}

async function fetchSeries(): Promise<DayPoint[] | null> {
  if (!supabaseAppAdmin) return null;
  const app = supabaseAppAdmin;
  const since = new Date(Date.now() - (WINDOW_DAYS + 1) * DAY).toISOString();
  type Stamp = { user_id: string; created_at: string };

  const [users, opens, chats] = await Promise.all([
    app.auth.admin.listUsers({ page: 1, perPage: 1000 }).then((r) => r.data?.users ?? []).catch(() => []),
    fetchAll<Stamp>((f, t) => app.from("product_events").select("user_id, created_at").eq("event_name", "app_opened")
      .gte("created_at", since).range(f, t), "changelog/app_opened"),
    fetchAll<Stamp>((f, t) => app.from("chat_messages").select("user_id, created_at").eq("role", "user").eq("synthetic", false)
      .gte("created_at", since).range(f, t), "changelog/chat_messages"),
  ]);

  const team = new Set(users.filter((u) => isInternal((u.email ?? "").toLowerCase())).map((u) => u.id));

  const days: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) days.push(dayKey(Date.now() - i * DAY));
  const idx = new Map(days.map((d, i) => [d, i]));
  const active = days.map(() => new Set<string>());
  const signups = days.map(() => 0);
  const messages = days.map(() => 0);

  for (const u of users) {
    if (team.has(u.id)) continue;
    const i = idx.get(dayKey(u.created_at));
    if (i !== undefined) signups[i]++;
  }
  for (const r of opens) {
    if (team.has(r.user_id)) continue;
    const i = idx.get(dayKey(r.created_at));
    if (i !== undefined) active[i].add(r.user_id);
  }
  for (const r of chats) {
    if (team.has(r.user_id)) continue;
    const i = idx.get(dayKey(r.created_at));
    if (i !== undefined) { active[i].add(r.user_id); messages[i]++; }
  }
  return days.map((day, i) => ({ day, active: active[i].size, signups: signups[i], messages: messages[i] }));
}

// Average per day over the COMPARE_DAYS before the release day vs the days
// from the release day on. Keyed by release DAY: several releases on one day
// share one comparison (they can't be told apart at daily grain anyway).
function compareFor(series: DayPoint[], day: string): Compare | null {
  const i = series.findIndex((p) => p.day === day);
  if (i < COMPARE_DAYS) return null; // not enough "before" in the window
  const before = series.slice(i - COMPARE_DAYS, i);
  const after = series.slice(i, i + COMPARE_DAYS);
  const avg = (xs: DayPoint[], k: keyof Omit<DayPoint, "day">) => (xs.length ? xs.reduce((s, p) => s + p[k], 0) / xs.length : 0);
  return {
    days: after.length,
    activeBefore: avg(before, "active"), activeAfter: avg(after, "active"),
    signupsBefore: avg(before, "signups"), signupsAfter: avg(after, "signups"),
    messagesBefore: avg(before, "messages"), messagesAfter: avg(after, "messages"),
  };
}

// Phone-side work that went live on web/functions but isn't in any phone
// build yet: commits touching mobile/ or packages/shared/ that appear in a
// non-phone release and in no phone release.
function pendingPhoneWork(events: ShipEvent[]): PendingPhone[] {
  const inPhone = new Set<string>();
  for (const e of events) if (e.kind === "phone" && e.status !== "failed") for (const c of e.commits) inPhone.add(c.sha);
  const seen = new Set<string>();
  const out: PendingPhone[] = [];
  for (const e of events) {
    if (e.kind === "phone" || e.kind === "website" || e.status !== "live") continue;
    for (const c of e.commits) {
      if (seen.has(c.sha) || inPhone.has(c.sha)) continue;
      if (!c.areas.includes("phone") && !c.areas.includes("shared")) continue;
      seen.add(c.sha);
      out.push({ sha: c.sha, subject: c.subject, at: c.at, via: e.kind, shippedAt: e.shipped_at });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export async function fetchChangelogData(): Promise<ChangelogData> {
  const [{ events, tableMissing }, series] = await Promise.all([fetchEvents(), fetchSeries()]);
  const compareByDay: Record<string, Compare> = {};
  if (series) {
    for (const e of events) {
      const d = dayKey(e.shipped_at);
      if (compareByDay[d]) continue;
      const c = compareFor(series, d);
      if (c) compareByDay[d] = c;
    }
  }
  return {
    events,
    series,
    compareByDay,
    pendingPhone: pendingPhoneWork(events),
    lastPhone: events.find((e) => e.kind === "phone" && e.status !== "failed") ?? null,
    tableMissing,
  };
}

export { dayKey };
