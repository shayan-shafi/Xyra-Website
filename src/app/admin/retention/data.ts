import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";
import { fetchAll } from "@/lib/fetchAll";
import type { RetentionData, RetentionUser } from "./metrics";

// Data layer for the admin Retention tab.
//
// Reads the XYRA APP project (service role) and reduces every account to one
// compact RetentionUser: when in their life they were active, and when they
// first hit each value-ladder milestone. All aggregation happens client-side
// in metrics.ts so filters re-cut every number.
//
// "Activity" = a row the USER created: a dashboard, an item, a chat message, a
// brain dump, a reminder. The app emits no app-open event, so a visit where the
// user only reads is invisible here — retention is a floor, not a ceiling.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SESSION_GAP = 30 * 60_000; // 30 min of silence ends a session
const NUDGE_REPLY_WINDOW = 3 * HOUR;

// Team / test accounts are flagged (not dropped) so the dashboard can toggle
// them. Extra addresses: RETENTION_INTERNAL_EMAILS="a@x.com,b@y.com".
const INTERNAL_DOMAINS = ["xyraconsult.com"];
const INTERNAL_EMAILS = new Set(
  (process.env.RETENTION_INTERNAL_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);
const isInternal = (email: string) => INTERNAL_EMAILS.has(email) || INTERNAL_DOMAINS.some((d) => email.endsWith(`@${d}`));

type Stamp = { user_id: string; created_at: string };

// user_id → ascending epoch-ms timestamps
function byUser(rows: Stamp[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const list = m.get(r.user_id);
    if (list) list.push(t); else m.set(r.user_id, [t]);
  }
  m.forEach((list) => list.sort((a, b) => a - b));
  return m;
}

const uniqSorted = (vals: number[]) => Array.from(new Set(vals)).sort((a, b) => a - b);

export async function fetchRetentionData(): Promise<RetentionData | null> {
  if (!supabaseAppAdmin) return null;
  const app = supabaseAppAdmin;
  const now = Date.now();

  const stamps = (table: string, extra?: (q: any) => any) =>
    fetchAll<Stamp>((from, to) => {
      let q = app.from(table).select("user_id, created_at");
      if (extra) q = extra(q);
      return q.order("created_at", { ascending: true }).range(from, to);
    }, `retention/${table}`);

  const listAuthUsers = async () => {
    const all: { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown> }[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await app.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) {
        console.error("admin/retention/auth.listUsers:", error.message);
        break;
      }
      all.push(...data.users);
      if (data.users.length < 1000) break;
    }
    return all;
  };

  const [authUsers, profileRows, dashRows, itemRows, chatRows, dumpRows, reminderRows, triggerRows, nudgeRows, factRows, summaryRows, pushRows] =
    await Promise.all([
      listAuthUsers(),
      fetchAll<{ auth_id: string | null; name: string | null }>(
        (from, to) => app.from("users").select("auth_id, name").range(from, to),
        "retention/users",
      ),
      stamps("dashboards"),
      stamps("dashboard_items"),
      stamps("chat_messages", (q) => q.eq("role", "user").eq("synthetic", false)),
      stamps("ingestion_events"),
      stamps("reminders"),
      stamps("triggers"),
      // Xyra-initiated texts. quick-reply answers ride kind='proactive' for
      // delivery but are replies, not nudges — same exclusion the initiative fn uses.
      stamps("chat_messages", (q) => q.eq("role", "assistant").eq("kind", "proactive").not("client_id", "like", "qr-%")),
      stamps("user_facts", (q) => q.eq("status", "active")),
      fetchAll<{ user_id: string; message_count: number }>(
        (from, to) => app.from("chat_summaries").select("user_id, message_count").range(from, to),
        "retention/chat_summaries",
      ),
      fetchAll<{ user_id: string }>((from, to) => app.from("push_tokens").select("user_id").range(from, to), "retention/push_tokens"),
    ]);

  const dash = byUser(dashRows);
  const items = byUser(itemRows);
  const chats = byUser(chatRows);
  const dumps = byUser(dumpRows);
  const reminders = byUser([...reminderRows, ...triggerRows]);
  const nudges = byUser(nudgeRows);
  const facts = byUser(factRows);
  const nameByAuth = new Map(profileRows.filter((p) => p.auth_id).map((p) => [p.auth_id!, p.name]));
  const memoryByUser = new Map(summaryRows.map((r) => [r.user_id, r.message_count]));
  const pushUsers = new Set(pushRows.map((r) => r.user_id));

  const users: RetentionUser[] = [];

  for (const au of authUsers) {
    const email = (au.email ?? "").toLowerCase();
    if (!email) continue;
    const id = au.id;
    const t0 = new Date(au.created_at).getTime();
    const hourOf = (t: number) => Math.max(0, Math.floor((t - t0) / HOUR));

    const uDash = dash.get(id) ?? [];
    const uItems = items.get(id) ?? [];
    const uChats = chats.get(id) ?? [];
    const uDumps = dumps.get(id) ?? [];
    const uRem = reminders.get(id) ?? [];
    const uNudges = nudges.get(id) ?? [];
    const uFacts = facts.get(id) ?? [];

    const activity = [...uDash, ...uItems, ...uChats, ...uDumps, ...uRem].sort((a, b) => a - b);
    const voice = [...uChats, ...uDumps].sort((a, b) => a - b); // things the user SAID to Xyra

    // Second session = first activity after a 30-min+ silence.
    let secondSessionAt: number | null = null;
    for (let i = 1; i < activity.length; i++) {
      if (activity[i] - activity[i - 1] > SESSION_GAP) { secondSessionAt = activity[i]; break; }
    }

    // A nudge counts as answered when the user says something within 3h of it.
    let nudgesAnswered = 0;
    let firstNudgeReplyAt: number | null = null;
    let v = 0;
    for (const n of uNudges) {
      while (v < voice.length && voice[v] <= n) v++;
      if (v < voice.length && voice[v] - n <= NUDGE_REPLY_WINDOW) {
        nudgesAnswered++;
        if (firstNudgeReplyAt === null) firstNudgeReplyAt = voice[v];
      }
    }

    const at = (t: number | null | undefined) => (t == null ? null : hourOf(t));

    users.push({
      id,
      email,
      name: nameByAuth.get(id) ?? (au.user_metadata?.name as string | undefined) ?? null,
      internal: isInternal(email),
      signedUpAt: au.created_at,
      ageHours: (now - t0) / HOUR,
      hours72: uniqSorted(activity.map(hourOf).filter((h) => h < 72)),
      activeDays: uniqSorted(activity.map((t) => Math.max(0, Math.floor((t - t0) / DAY)))),
      lastActiveAt: activity.length ? new Date(activity[activity.length - 1]).toISOString() : null,
      firstDumpMin: voice.length ? Math.max(0, (voice[0] - t0) / 60_000) : null,
      ms: {
        dump: at(voice[0]),
        secondSession: at(secondSessionAt),
        secondBoard: at(uDash[1]),
        reminder: at(uRem[0]),
        reminder2: at(uRem[1]),
        nudgeReply: at(firstNudgeReplyAt),
        facts3: at(uFacts[2]),
      },
      counts: {
        dashboards: uDash.length,
        items: uItems.length,
        messages: uChats.length + uDumps.length,
        reminders: uRem.length,
        nudgesSent: uNudges.length,
        nudgesAnswered,
        facts: uFacts.length,
        memoryMessages: memoryByUser.get(id) ?? 0,
      },
      factDays: uFacts.map((t) => Math.max(0, Math.floor((t - t0) / DAY))),
      pushEnabled: pushUsers.has(id),
    });
  }

  users.sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt));
  return { users, generatedAt: new Date(now).toISOString() };
}
