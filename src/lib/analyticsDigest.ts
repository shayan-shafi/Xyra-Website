import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Supabase/PostgREST caps every single response at the project's max-rows
// setting (commonly 1000) no matter what .limit() requests — once a table
// crosses that many rows, a plain .limit(100000) silently truncates instead
// of erroring. Paginate via .range() so growing tables don't quietly drop
// data (this bit us once analytics_events passed 1000 rows: queries kept
// "succeeding" but silently returned only the oldest page).
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

// ── Row types ────────────────────────────────────────────────────────────────

type EventRow = {
  visitor_id: string;
  session_id: string;
  event_name: string;
  created_at: string;
  path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  metadata: Record<string, unknown> | null;
};

type WaitlistRow = {
  visitor_id: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  first_referrer: string | null;
  first_ref_code: string | null;
  survey_must_have: string | null;
  created_at: string;
};

// ── Public types ──────────────────────────────────────────────────────────────

export type DigestSummary = {
  uniqueVisitors: number;
  totalSessions: number;
  ctaClickers: number;
  waitlistViewers: number;
  emailSubmitters: number;
  // Tracked signups: visitor_id present + after ANALYTICS_TRACKING_START_DATE.
  // Used for all conversion rates.
  successfulSignups: number;
  // All waitlist entries in the window (includes pre-tracking rows).
  totalSignups: number;
  // Signups excluded from conversion calculations (no visitor_id or pre-tracking).
  legacySignups: number;
  surveySubmitters: number;
  surveySkippers: number;
  conversionRate: number;
  surveyCompletionRate: number;
};

export type DigestFunnelStep = {
  step: string;
  count: number;
  pctOfPrev: number;
};

export type DigestSource = {
  source: string;
  medium: string | null;
  campaign: string | null;
  rawSources: string[];
  visitors: number;
  signups: number;
  conversionRate: number;
};

export type DigestCta = {
  location: string;
  label: string;
  clicks: number;
  uniqueClickers: number;
};

export type DigestSection = {
  section: string;
  sessions: number;
  pctOfSessions: number;
};

export type DigestScroll = {
  threshold: number;
  sessions: number;
  pctOfSessions: number;
};

export type DigestCard = {
  card: string;
  clicks: number;
  uniqueClickers: number;
};

export type DigestAction = {
  tag: "Fix" | "Watch" | "Double down" | "Promising";
  message: string;
};

// One row per marketing identity (normalized source + medium + campaign +
// content + ref code) — "which post/ad/link drove this", same clean grouping
// as the dashboard's Marketing Performance table. Limited to the top rows by
// signups so the email stays a summary, not a data dump.
export type DigestMarketingRow = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  refCode: string | null;
  visitors: number;
  signups: number;
  conversionRate: number;
};

// Rollup of DigestMarketingRow by normalized source (e.g. "instagram"),
// deduped so a visitor with two campaign touches under one source only
// counts once. Shown above the campaign breakdown so "Instagram overall"
// is visible without manually summing fragmented campaign rows.
export type DigestSourceTotal = {
  source: string;
  visitors: number;
  signups: number;
  conversionRate: number;
};

// One row per referral code — a MARKETING-attribution view, attributed the
// same way as topCampaigns (the converting session's ref code, falling back
// to first-touch only when no conversion event was tracked), so a code
// never shows signups here that don't also show up in topCampaigns, or vice
// versa. This is NOT the app's actual referral reward/leaderboard logic —
// real referral_count credit (src/app/api/waitlist/route.ts) is keyed
// primarily off the visitor's first-ever-touch ref code, so the two can
// disagree for a visitor who clicks a different referral link on a later
// visit before signing up.
export type DigestReferralRow = {
  refCode: string;
  visitors: number;
  sessions: number;
  attributedSignups: number;
  matchedSignups: number;
  // Null when not meaningful (no tracked visitors, or attributedSignups >
  // visitors) — see conversionLabel for what to show instead.
  conversionRate: number | null;
  conversionLabel: string;
};

export type DigestData = {
  period: { start: Date; end: Date; days: number };
  // ISO string from ANALYTICS_TRACKING_START_DATE, or null.
  trackingStartDate: string | null;
  summary: DigestSummary;
  funnel: DigestFunnelStep[];
  sources: DigestSource[];
  topSources: DigestSourceTotal[];
  topCampaigns: DigestMarketingRow[];
  referrals: DigestReferralRow[];
  ctas: DigestCta[];
  sections: DigestSection[];
  scrollDepth: DigestScroll[];
  featureCards: DigestCard[];
  survey: {
    signups: number;
    submits: number;
    skips: number;
    completionRate: number;
    skipRate: number;
  };
  actions: DigestAction[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

function str(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "";
}

function getTrackingStartDate(): string | null {
  const val = process.env.ANALYTICS_TRACKING_START_DATE;
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Known variants that should roll up under one display source. The raw value
// is preserved separately (DigestSource.rawSources) for debugging. These
// double as referrer-hostname aliases (see normalizeSource's fallback below).
const SOURCE_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "l.instagram.com": "instagram",
  "com.instagram.android": "instagram",
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  "www.linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "com.linkedin.android": "linkedin",
  youtube: "youtube",
  "youtu.be": "youtube",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "com.google.android.youtube": "youtube",
  "chatgpt.com": "chatgpt",
  chatgpt: "chatgpt",
};

// Resolves a display source from utm_source, falling back to the referrer's
// hostname when there's no UTM tag at all. "localhost" (dev-only artifact)
// is never treated as a real source.
function normalizeSource(utmSource: string | null, referrerHost: string | null = null): string {
  const raw = utmSource?.toLowerCase().trim();
  if (raw) return SOURCE_ALIASES[raw] ?? raw;

  const host = referrerHost?.toLowerCase().trim();
  if (!host || host === "localhost") return "direct";
  const stripped = host.replace(/^(l|m|www)\./, "");
  return SOURCE_ALIASES[host] ?? SOURCE_ALIASES[stripped] ?? "direct";
}

// Internal dev/QA artifacts (manual curl tests, local validation runs) that
// sometimes land in production analytics_events/waitlist rows. Real rows —
// never deleted/mutated — but noise in a decision-facing digest, so they're
// filtered out of topCampaigns here only.
const TEST_ARTIFACT_SOURCES = new Set(["test", "test_source", "localhost"]);
const TEST_ARTIFACT_TEXT = /local_analytics_test|analytics_validation|analytics_test|local_test/i;

function isTestArtifact(
  source: string,
  medium: string | null,
  campaign: string | null,
  content: string | null
): boolean {
  if (TEST_ARTIFACT_SOURCES.has(source)) return true;
  return TEST_ARTIFACT_TEXT.test(medium ?? "") || TEST_ARTIFACT_TEXT.test(campaign ?? "") || TEST_ARTIFACT_TEXT.test(content ?? "");
}

// Extracts just the hostname from a referrer URL. Returns null for
// empty/invalid referrers (including same-origin/relative values).
function referrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchDigestData(daysBack = 3): Promise<DigestData | null> {
  if (!supabaseAdmin) return null;

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const rangeStartIso = start.toISOString();

  const trackingStart = getTrackingStartDate();

  // Events are fetched from the tracking start, NOT the digest window start.
  // Source attribution below needs each visitor's true first-ever touch — if we
  // only fetched events inside the digest window, a returning visitor's
  // earliest event inside that window would be mistaken for their first touch
  // (e.g. a visitor who first came via instagram weeks ago, then loaded the
  // page directly within the digest window, would wrongly show as "direct").
  // Waitlist uses only the range start so we can show the legacy count too.
  const [events, waitlist] = await Promise.all([
    fetchAllRows<EventRow>(
      (from, to) =>
        supabaseAdmin!
          .from("analytics_events")
          .select("visitor_id,session_id,event_name,created_at,path,referrer,utm_source,utm_medium,utm_campaign,utm_content,metadata")
          .gte("created_at", trackingStart ?? rangeStartIso)
          .order("created_at", { ascending: true })
          .range(from, to),
      "digest events"
    ),
    fetchAllRows<WaitlistRow>(
      (from, to) =>
        supabaseAdmin!
          .from("waitlist")
          .select("visitor_id,first_utm_source,first_utm_medium,first_utm_campaign,first_utm_content,first_referrer,first_ref_code,survey_must_have,created_at")
          .gte("created_at", rangeStartIso)
          .order("created_at", { ascending: true })
          .range(from, to),
      "digest waitlist"
    ),
  ]);

  // Events that actually fall inside the digest window. Used for everything
  // EXCEPT source attribution (which needs the full `events` history above).
  const windowedEvents = events.filter(e => e.created_at >= rangeStartIso);

  // ── Split waitlist: tracked vs legacy ────────────────────────
  // Tracked: has visitor_id AND after tracking start (if set).
  // Legacy: no visitor_id, or created before tracking was deployed.
  const trackedWaitlist = waitlist.filter(
    w => w.visitor_id !== null && (!trackingStart || w.created_at >= trackingStart)
  );
  const totalSignups = waitlist.length;
  const trackedSignups = trackedWaitlist.length;
  const legacySignups = totalSignups - trackedSignups;

  // ── Event sets ────────────────────────────────────────────────
  const allVisitors = new Set(windowedEvents.map(e => e.visitor_id));
  const allSessions = new Set(windowedEvents.map(e => e.session_id));

  const evVisitors: Record<string, Set<string>> = {};
  const evSessions: Record<string, Set<string>> = {};
  for (const e of windowedEvents) {
    (evVisitors[e.event_name] ??= new Set()).add(e.visitor_id);
    (evSessions[e.event_name] ??= new Set()).add(e.session_id);
  }
  const vBy = (n: string) => evVisitors[n]?.size ?? 0;
  const sBy = (n: string) => evSessions[n]?.size ?? 0;

  const uniqueVisitors = allVisitors.size;
  const totalSessions = allSessions.size;
  const ctaClickers = vBy("cta_click");
  const waitlistViewers = vBy("waitlist_view");
  const emailSubmitters = vBy("waitlist_email_submit");
  // successfulSignups = tracked only; used for all ratios.
  const successfulSignups = trackedSignups;
  const surveySubmitters = sBy("waitlist_survey_submit");
  const surveySkippers = sBy("waitlist_survey_skip");

  const summary: DigestSummary = {
    uniqueVisitors,
    totalSessions,
    ctaClickers,
    waitlistViewers,
    emailSubmitters,
    successfulSignups,
    totalSignups,
    legacySignups,
    surveySubmitters,
    surveySkippers,
    conversionRate: pct(successfulSignups, uniqueVisitors),
    surveyCompletionRate: pct(surveySubmitters, successfulSignups),
  };

  // ── Funnel (tracked signups) ──────────────────────────────────
  const funnelRaw = [uniqueVisitors, ctaClickers, waitlistViewers, emailSubmitters, successfulSignups, surveySubmitters];
  const funnelLabels = ["Visitors", "CTA Clickers", "Waitlist Views", "Email Submits", "Signups (tracked)", "Survey Submits"];
  const funnel: DigestFunnelStep[] = funnelRaw.map((count, i) => ({
    step: funnelLabels[i],
    count,
    pctOfPrev: i === 0 ? 100 : pct(count, funnelRaw[i - 1]),
  }));

  // ── Traffic Sources ────────────────────────────────────────────
  // Attribution uses each visitor's true first-ever touch (from the full,
  // unwindowed `events` history) so a visitor's source doesn't flip depending
  // on which events happen to fall inside this digest's window.
  const visitorFirstUtm: Record<string, { utm_source: string; utm_medium: string | null; utm_campaign: string | null }> = {};
  for (const e of events) {
    if (!visitorFirstUtm[e.visitor_id]) {
      visitorFirstUtm[e.visitor_id] = {
        utm_source: normalizeSource(e.utm_source, referrerDomain(e.referrer)),
        utm_medium: e.utm_medium,
        utm_campaign: e.utm_campaign,
      };
    }
  }

  type SourceBucket = { visitors: Set<string>; medium: string | null; campaign: string | null; signups: number };
  const sourceMap: Record<string, SourceBucket> = {};
  for (const vid of allVisitors) {
    const utm = visitorFirstUtm[vid];
    const key = utm?.utm_source ?? "direct";
    if (!sourceMap[key]) sourceMap[key] = { visitors: new Set(), medium: utm?.utm_medium ?? null, campaign: utm?.utm_campaign ?? null, signups: 0 };
    sourceMap[key].visitors.add(vid);
  }
  // Only counted tracked waitlist entries in source conversion.
  for (const w of trackedWaitlist) {
    const src = normalizeSource(w.first_utm_source, referrerDomain(w.first_referrer));
    if (!sourceMap[src]) sourceMap[src] = { visitors: new Set(), medium: w.first_utm_medium, campaign: w.first_utm_campaign, signups: 0 };
    sourceMap[src].signups += 1;
  }

  // Raw label tracking lives in a side-table so it can't introduce phantom
  // zero-visitor/zero-signup rows for sources only seen outside this window.
  const sourceRaw: Record<string, Set<string>> = {};
  for (const e of events) {
    const key = normalizeSource(e.utm_source, referrerDomain(e.referrer));
    const rawLabel = e.utm_source?.toLowerCase().trim() || (referrerDomain(e.referrer) ? `referrer:${referrerDomain(e.referrer)}` : "direct");
    (sourceRaw[key] ??= new Set()).add(rawLabel);
  }
  for (const w of trackedWaitlist) {
    const key = normalizeSource(w.first_utm_source, referrerDomain(w.first_referrer));
    const rawLabel = w.first_utm_source?.toLowerCase().trim() || (referrerDomain(w.first_referrer) ? `referrer:${referrerDomain(w.first_referrer)}` : "direct");
    (sourceRaw[key] ??= new Set()).add(rawLabel);
  }

  const sources: DigestSource[] = Object.entries(sourceMap)
    .map(([source, b]) => ({
      source,
      medium: b.medium,
      campaign: b.campaign,
      rawSources: Array.from(sourceRaw[source] ?? []).sort(),
      visitors: b.visitors.size,
      signups: b.signups,
      conversionRate: pct(b.signups, b.visitors.size),
    }))
    .sort((a, b) => b.signups - a.signups || b.conversionRate - a.conversionRate)
    .slice(0, 8);

  // ── Top Campaigns / Marketing Performance ──────────────────────
  // Same clean grouping as the dashboard's Marketing Performance table:
  // one row per marketing identity (normalized source + medium + campaign +
  // content + ref code), not split by referrer domain or landing path, and
  // pure direct/unknown traffic collapsed into a single row. This answers
  // "which post/ad/link drove signups", which the broad Sources table above
  // can't — it only shows one representative medium/campaign per source.
  type MarketingTouch = { source: string; medium: string | null; campaign: string | null; content: string | null; refCode: string | null };
  type MarketingBucket = MarketingTouch & { visitors: Set<string>; signups: number };

  function marketingKey(m: MarketingTouch): string {
    const isPureDirect = m.source === "direct" && !m.medium && !m.campaign && !m.content && !m.refCode;
    if (isPureDirect) return "direct";
    return [m.source, m.medium, m.campaign, m.content, m.refCode].map(v => v ?? "").join("");
  }

  // Entry touch per session = the session's earliest windowed event.
  type SessionTouch = {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    referrer_domain: string | null;
    ref_code: string | null;
    visitor_id: string;
  };
  const sessionEntry: Record<string, SessionTouch> = {};
  for (const e of windowedEvents) {
    if (!sessionEntry[e.session_id]) {
      sessionEntry[e.session_id] = {
        utm_source: e.utm_source,
        utm_medium: e.utm_medium,
        utm_campaign: e.utm_campaign,
        utm_content: e.utm_content,
        referrer_domain: referrerDomain(e.referrer),
        ref_code: null,
        visitor_id: e.visitor_id,
      };
    }
  }
  for (const e of windowedEvents) {
    if (e.event_name === "ref_link_visit") {
      const code = str(e.metadata?.ref_code) || null;
      if (code && sessionEntry[e.session_id]) sessionEntry[e.session_id].ref_code = code;
    }
  }

  function toMarketingTouch(t: { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_content: string | null; referrer_domain: string | null; ref_code: string | null }): MarketingTouch {
    return {
      source: normalizeSource(t.utm_source, t.referrer_domain),
      medium: t.utm_medium,
      campaign: t.utm_campaign,
      content: t.utm_content,
      refCode: t.ref_code,
    };
  }

  const marketingMap: Record<string, MarketingBucket> = {};
  for (const t of Object.values(sessionEntry)) {
    const m = toMarketingTouch(t);
    const key = marketingKey(m);
    (marketingMap[key] ??= { ...m, visitors: new Set(), signups: 0 }).visitors.add(t.visitor_id);
  }

  // Referral codes: visit tracking (credited signups come from the
  // conversion-event loop below — see refCreditMap).
  const refVisitors: Record<string, Set<string>> = {};
  const refSessions: Record<string, Set<string>> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "ref_link_visit")) {
    const code = str(e.metadata?.ref_code) || "unknown";
    (refVisitors[code] ??= new Set()).add(e.visitor_id);
    (refSessions[code] ??= new Set()).add(e.session_id);
  }
  const refCreditMap: Record<string, { signups: number; matchedSignups: number }> = {};

  // Signups matched to the session/touch that actually converted, same as
  // the dashboard: prefer waitlist_email_success, fall back to
  // waitlist_email_submit, then to the visitor's persisted first-touch.
  const successEventByVisitor: Record<string, EventRow> = {};
  const submitEventByVisitor: Record<string, EventRow> = {};
  for (const e of windowedEvents) {
    if (e.event_name === "waitlist_email_success") successEventByVisitor[e.visitor_id] = e;
    else if (e.event_name === "waitlist_email_submit") submitEventByVisitor[e.visitor_id] = e;
  }
  for (const w of trackedWaitlist) {
    if (!w.visitor_id) continue;
    const convEvent = successEventByVisitor[w.visitor_id] ?? submitEventByVisitor[w.visitor_id];
    const isApprox = !convEvent;
    const t = convEvent
      ? {
          utm_source: convEvent.utm_source,
          utm_medium: convEvent.utm_medium,
          utm_campaign: convEvent.utm_campaign,
          utm_content: convEvent.utm_content,
          referrer_domain: referrerDomain(convEvent.referrer),
          ref_code: str(convEvent.metadata?.ref_code) || sessionEntry[convEvent.session_id]?.ref_code || null,
        }
      : {
          utm_source: w.first_utm_source,
          utm_medium: w.first_utm_medium,
          utm_campaign: w.first_utm_campaign,
          utm_content: w.first_utm_content,
          referrer_domain: referrerDomain(w.first_referrer),
          ref_code: w.first_ref_code,
        };
    const m = toMarketingTouch(t);
    const key = marketingKey(m);
    (marketingMap[key] ??= { ...m, visitors: new Set(), signups: 0 }).signups += 1;

    if (t.ref_code) {
      const rc = (refCreditMap[t.ref_code] ??= { signups: 0, matchedSignups: 0 });
      rc.signups += 1;
      if (!isApprox) rc.matchedSignups += 1;
    }
  }

  function refConversion(visitors: number, attributed: number): { rate: number | null; label: string } {
    if (visitors === 0) return { rate: null, label: attributed > 0 ? "N/A*" : "—" };
    if (attributed > visitors) return { rate: null, label: ">100%*" };
    const rate = pct(attributed, visitors);
    return { rate, label: `${rate}%` };
  }

  const allRefCodes = new Set([...Object.keys(refVisitors), ...Object.keys(refCreditMap)]);
  const referrals: DigestReferralRow[] = Array.from(allRefCodes)
    .map(code => {
      const visitors = refVisitors[code]?.size ?? 0;
      const sessions = refSessions[code]?.size ?? 0;
      const credit = refCreditMap[code];
      const attributedSignups = credit?.signups ?? 0;
      const matchedSignups = credit?.matchedSignups ?? 0;
      const { rate, label } = refConversion(visitors, attributedSignups);
      return { refCode: code, visitors, sessions, attributedSignups, matchedSignups, conversionRate: rate, conversionLabel: label };
    })
    .sort((a, b) => b.attributedSignups - a.attributedSignups || b.visitors - a.visitors);

  const cleanMarketingBuckets = Object.values(marketingMap).filter(
    b => !isTestArtifact(b.source, b.medium, b.campaign, b.content)
  );

  // Roll campaign-tuple buckets up to their normalized source, deduping
  // visitors across tuples — same approach as the dashboard's source totals,
  // so "Instagram overall" reads the same in the email as on the dashboard.
  const sourceTotalMap: Record<string, { visitors: Set<string>; signups: number }> = {};
  for (const b of cleanMarketingBuckets) {
    const t = (sourceTotalMap[b.source] ??= { visitors: new Set(), signups: 0 });
    for (const v of b.visitors) t.visitors.add(v);
    t.signups += b.signups;
  }
  const topSources: DigestSourceTotal[] = Object.entries(sourceTotalMap)
    .map(([source, t]) => ({ source, visitors: t.visitors.size, signups: t.signups, conversionRate: pct(t.signups, t.visitors.size) }))
    .sort((a, b) => b.signups - a.signups || b.visitors - a.visitors);

  const sourceRank: Record<string, number> = {};
  topSources.forEach((s, i) => (sourceRank[s.source] = i));

  // Rows with 0 visitors are signups whose converting session never matched
  // a tracked visit (already counted in topSources above) — excluded from
  // the breakdown so it never implies a campaign converted with 0 visitors.
  const topCampaigns: DigestMarketingRow[] = cleanMarketingBuckets
    .filter(b => b.visitors.size > 0)
    .map(b => ({
      source: b.source,
      medium: b.medium,
      campaign: b.campaign,
      content: b.content,
      refCode: b.refCode,
      visitors: b.visitors.size,
      signups: b.signups,
      conversionRate: pct(b.signups, b.visitors.size),
    }))
    .sort((a, b) => sourceRank[a.source] - sourceRank[b.source] || b.signups - a.signups || b.visitors - a.visitors)
    .slice(0, 8);

  // ── CTAs ──────────────────────────────────────────────────────
  const ctaMap: Record<string, { clicks: number; clickers: Set<string> }> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "cta_click")) {
    const key = `${str(e.metadata?.cta_location) || "unknown"}__${str(e.metadata?.button_label) || "unknown"}`;
    const entry = (ctaMap[key] ??= { clicks: 0, clickers: new Set() });
    entry.clicks++;
    entry.clickers.add(e.visitor_id);
  }
  const ctas: DigestCta[] = Object.entries(ctaMap)
    .map(([key, v]) => {
      const [location, label] = key.split("__");
      return { location, label, clicks: v.clicks, uniqueClickers: v.clickers.size };
    })
    .sort((a, b) => b.clicks - a.clicks);

  // ── Section Engagement ────────────────────────────────────────
  const sectionMap: Record<string, Set<string>> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "section_view")) {
    (sectionMap[str(e.metadata?.section_name) || "unknown"] ??= new Set()).add(e.session_id);
  }
  const sections: DigestSection[] = ["hero", "explainer", "world", "waitlist", "footer"].map(s => ({
    section: s,
    sessions: sectionMap[s]?.size ?? 0,
    pctOfSessions: pct(sectionMap[s]?.size ?? 0, totalSessions),
  }));

  // ── Scroll Depth ──────────────────────────────────────────────
  const scrollMap: Record<number, Set<string>> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "scroll_depth")) {
    const t = typeof e.metadata?.threshold === "number" ? e.metadata.threshold : 0;
    (scrollMap[t] ??= new Set()).add(e.session_id);
  }
  const scrollDepth: DigestScroll[] = [25, 50, 75, 90].map(t => ({
    threshold: t,
    sessions: scrollMap[t]?.size ?? 0,
    pctOfSessions: pct(scrollMap[t]?.size ?? 0, totalSessions),
  }));

  // ── Feature Cards ─────────────────────────────────────────────
  const cardMap: Record<string, { clicks: number; clickers: Set<string> }> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "feature_card_click")) {
    const name = str(e.metadata?.card_name) || "unknown";
    const entry = (cardMap[name] ??= { clicks: 0, clickers: new Set() });
    entry.clicks++;
    entry.clickers.add(e.visitor_id);
  }
  const featureCards: DigestCard[] = Object.entries(cardMap)
    .map(([card, v]) => ({ card, clicks: v.clicks, uniqueClickers: v.clickers.size }))
    .sort((a, b) => b.clicks - a.clicks);

  // ── Survey (tracked signups as denominator) ───────────────────
  const survey = {
    signups: successfulSignups,
    submits: surveySubmitters,
    skips: surveySkippers,
    completionRate: pct(surveySubmitters, successfulSignups),
    skipRate: pct(surveySkippers, successfulSignups),
  };

  // ── Rule-based actions ────────────────────────────────────────
  const actions: DigestAction[] = [];

  const ctaRate = pct(ctaClickers, uniqueVisitors);
  if (uniqueVisitors >= 10 && ctaRate < 5) {
    actions.push({ tag: "Fix", message: `CTA click rate is ${ctaRate}%. Test stronger hero copy or a more prominent CTA button.` });
  } else if (uniqueVisitors >= 10 && ctaRate > 15) {
    actions.push({ tag: "Promising", message: `Strong CTA click rate of ${ctaRate}% — the hero is resonating. Consider increasing traffic.` });
  }

  if (ctaClickers >= 5 && pct(emailSubmitters, waitlistViewers) < 30) {
    actions.push({ tag: "Fix", message: `Only ${pct(emailSubmitters, waitlistViewers)}% of waitlist viewers submit. Reduce form friction or simplify to email-only first.` });
  }

  if (successfulSignups >= 5 && survey.skipRate > 50) {
    actions.push({ tag: "Watch", message: `${survey.skipRate}% of signups skip the survey. Shorten it to one question or move it to a follow-up email.` });
  }

  const scrollAt50 = scrollDepth.find(s => s.threshold === 50)?.pctOfSessions ?? 0;
  if (totalSessions >= 10 && scrollAt50 < 40) {
    actions.push({ tag: "Fix", message: `Only ${scrollAt50}% of sessions reach the halfway point. Move key product proof higher on the page.` });
  }

  if (featureCards.length >= 2) {
    const top = featureCards[0];
    const avg = featureCards.reduce((s, c) => s + c.clicks, 0) / featureCards.length;
    if (top.clicks > avg * 2) {
      actions.push({ tag: "Double down", message: `'${top.card}' gets significantly more feature card clicks. Lead with this theme in your headline or ads.` });
    }
  }

  for (const src of sources) {
    if (src.source !== "direct" && src.visitors > 10 && src.conversionRate < 3) {
      actions.push({ tag: "Watch", message: `'${src.source}' has ${src.visitors} visitors but only ${src.conversionRate}% convert. Audit the audience-to-message fit.` });
      break;
    }
  }

  for (const src of sources) {
    if (src.source !== "direct" && src.visitors >= 3 && src.visitors <= 20 && src.conversionRate > 30) {
      actions.push({ tag: "Double down", message: `'${src.source}' converts at ${src.conversionRate}% on low volume — strong signal. Invest more here.` });
      break;
    }
  }

  if (actions.length === 0 && uniqueVisitors > 0) {
    actions.push({ tag: "Watch", message: "Keep monitoring — not enough data yet to surface clear recommendations." });
  }

  return {
    period: { start, end, days: daysBack },
    trackingStartDate: trackingStart,
    summary,
    funnel,
    sources,
    topSources,
    topCampaigns,
    referrals,
    ctas,
    sections,
    scrollDepth,
    featureCards,
    survey,
    actions,
  };
}
