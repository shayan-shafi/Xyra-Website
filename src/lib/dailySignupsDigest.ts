import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ── Row types ────────────────────────────────────────────────────────────────

type WaitlistDailyRow = {
  email: string;
  visitor_id: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_ref_code: string | null;
  created_at: string;
};

type EventRow = {
  visitor_id: string;
  session_id: string;
  event_name: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  metadata: Record<string, unknown> | null;
};

// ── Public types ──────────────────────────────────────────────────────────────

export type SignupAttribution = {
  email: string;
  // Normalized first-touch channel ("instagram", "direct", "unknown", ...).
  // "unknown" specifically means no visitor_id at all (no tracking possible),
  // distinct from "direct" (tracked, but no referrer/UTM).
  source: string;
  // "utm_source / utm_medium / utm_campaign / utm_content", or null if the
  // signup has no campaign data at all (pure direct/organic).
  campaignLabel: string | null;
  refCode: string | null;
  isUnknown: boolean;
};

export type DailySignupsData = {
  windowLabel: string; // e.g. "June 24, 2026"
  windowStart: string; // ISO, Chicago-midnight start of the summarized day
  windowEnd: string; // ISO, Chicago-midnight end of the summarized day
  newSignups: number;
  totalWaitlist: number;
  bySource: { source: string; count: number }[];
  byCampaign: { label: string; count: number }[];
  byRefCode: { code: string; count: number }[];
  signups: SignupAttribution[];
  unknownCount: number;
};

// ── Source normalization (duplicated from data.ts/analyticsDigest.ts — this
// codebase doesn't share a util module between these three call sites, and
// duplicating a 20-line alias map is lower risk than refactoring already
// verified/shipped files for this addition). ──────────────────────────────
const SOURCE_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  "l.instagram.com": "instagram",
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  youtube: "youtube",
  "youtu.be": "youtube",
  "youtube.com": "youtube",
  "chatgpt.com": "chatgpt",
  chatgpt: "chatgpt",
};

function normalizeSource(raw: string | null): string {
  if (!raw) return "direct";
  const v = raw.toLowerCase().trim();
  if (!v) return "direct";
  return SOURCE_ALIASES[v] ?? v;
}

function str(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "";
}

function campaignLabel(t: {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}): string | null {
  if (!t.utm_source && !t.utm_medium && !t.utm_campaign && !t.utm_content) return null;
  return [t.utm_source, t.utm_medium, t.utm_campaign, t.utm_content].map(v => v ?? "—").join(" / ");
}

// ── Chicago "yesterday" window (dependency-free IANA timezone handling) ──────

// Returns the offset, in minutes, such that `chicagoWallClock = utc + offsetMinutes`.
// Computed by re-reading the UTC instant's wall-clock time in America/Chicago,
// which correctly accounts for DST without needing a timezone library.
function chicagoOffsetMinutes(utc: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(utc)) parts[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - utc.getTime()) / 60_000;
}

// Returns the actual UTC instant corresponding to 00:00:00 in America/Chicago
// on the given calendar date.
function chicagoMidnightUtc(y: number, m: number, d: number): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetMinutes = chicagoOffsetMinutes(guess);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

function chicagoDateParts(utc: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(utc)) parts[p.type] = p.value;
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

// Returns [start, end) in UTC for "yesterday" in America/Chicago, relative to `now`.
export function chicagoYesterdayWindow(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const today = chicagoDateParts(now);
  // UTC-anchored date used purely for calendar-day arithmetic (subtracting a day).
  const todayAnchor = new Date(Date.UTC(today.y, today.m - 1, today.d));
  const yesterdayAnchor = new Date(todayAnchor.getTime() - 86_400_000);
  const yest = {
    y: yesterdayAnchor.getUTCFullYear(),
    m: yesterdayAnchor.getUTCMonth() + 1,
    d: yesterdayAnchor.getUTCDate(),
  };

  const start = chicagoMidnightUtc(yest.y, yest.m, yest.d);
  const end = chicagoMidnightUtc(today.y, today.m, today.d);
  const label = new Date(Date.UTC(yest.y, yest.m - 1, yest.d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return { start, end, label };
}

// ── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchDailySignupsData(now: Date = new Date()): Promise<DailySignupsData | null> {
  if (!supabaseAdmin) return null;

  const { start, end, label } = chicagoYesterdayWindow(now);

  const [{ data: wlRaw, error: wlErr }, { count: totalWaitlist, error: countErr }] = await Promise.all([
    supabaseAdmin
      .from("waitlist")
      .select("email,visitor_id,first_utm_source,first_utm_medium,first_utm_campaign,first_utm_content,first_ref_code,created_at")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true })
      .limit(5000),
    supabaseAdmin.from("waitlist").select("*", { count: "exact", head: true }),
  ]);

  if (wlErr) console.error("daily signups waitlist fetch:", wlErr.message);
  if (countErr) console.error("daily signups count fetch:", countErr.message);

  const rows = (wlRaw ?? []) as WaitlistDailyRow[];

  // Look up each signup's actual converting touch (the session/current UTM at
  // signup time) via their waitlist_email_success event, falling back to
  // waitlist_email_submit, then to their persisted first-touch tuple — same
  // approach as the dashboard's Campaign/Session Attribution table. Scoped to
  // only the visitors who signed up in this window, so it's a small query.
  const visitorIds = Array.from(new Set(rows.map(r => r.visitor_id).filter((v): v is string => Boolean(v))));

  let convEvents: EventRow[] = [];
  if (visitorIds.length > 0) {
    const { data: evRaw, error: evErr } = await supabaseAdmin
      .from("analytics_events")
      .select("visitor_id,session_id,event_name,utm_source,utm_medium,utm_campaign,utm_content,metadata")
      .in("visitor_id", visitorIds)
      .in("event_name", ["waitlist_email_success", "waitlist_email_submit", "ref_link_visit"])
      .order("created_at", { ascending: true })
      .limit(5000);
    if (evErr) console.error("daily signups events fetch:", evErr.message);
    convEvents = (evRaw ?? []) as EventRow[];
  }

  const successByVisitor: Record<string, EventRow> = {};
  const submitByVisitor: Record<string, EventRow> = {};
  const refCodeBySession: Record<string, string> = {};
  for (const e of convEvents) {
    if (e.event_name === "waitlist_email_success") successByVisitor[e.visitor_id] = e;
    else if (e.event_name === "waitlist_email_submit") submitByVisitor[e.visitor_id] = e;
    else if (e.event_name === "ref_link_visit") {
      const code = str(e.metadata?.ref_code);
      if (code) refCodeBySession[e.session_id] = code;
    }
  }

  const signups: SignupAttribution[] = rows.map(w => {
    if (!w.visitor_id) {
      return { email: w.email, source: "unknown", campaignLabel: null, refCode: null, isUnknown: true };
    }
    const convEvent = successByVisitor[w.visitor_id] ?? submitByVisitor[w.visitor_id];
    const tuple = convEvent
      ? {
          utm_source: convEvent.utm_source,
          utm_medium: convEvent.utm_medium,
          utm_campaign: convEvent.utm_campaign,
          utm_content: convEvent.utm_content,
        }
      : {
          utm_source: w.first_utm_source,
          utm_medium: w.first_utm_medium,
          utm_campaign: w.first_utm_campaign,
          utm_content: w.first_utm_content,
        };
    const refCode =
      (convEvent && (str(convEvent.metadata?.ref_code) || refCodeBySession[convEvent.session_id])) ||
      w.first_ref_code ||
      null;
    return {
      email: w.email,
      source: normalizeSource(tuple.utm_source),
      campaignLabel: campaignLabel(tuple),
      refCode,
      isUnknown: false,
    };
  });

  const bySourceMap: Record<string, number> = {};
  const byCampaignMap: Record<string, number> = {};
  const byRefMap: Record<string, number> = {};
  for (const s of signups) {
    bySourceMap[s.source] = (bySourceMap[s.source] ?? 0) + 1;
    if (s.campaignLabel) byCampaignMap[s.campaignLabel] = (byCampaignMap[s.campaignLabel] ?? 0) + 1;
    const refKey = s.refCode ?? "none";
    byRefMap[refKey] = (byRefMap[refKey] ?? 0) + 1;
  }

  return {
    windowLabel: label,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    newSignups: rows.length,
    totalWaitlist: totalWaitlist ?? 0,
    bySource: Object.entries(bySourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count),
    byCampaign: Object.entries(byCampaignMap)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    byRefCode: Object.entries(byRefMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    signups,
    unknownCount: signups.filter(s => s.isUnknown).length,
  };
}
