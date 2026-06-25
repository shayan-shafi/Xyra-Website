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
  first_landing_page: string | null;
  first_ref_code: string | null;
  survey_must_have: string | null;
  created_at: string;
};

// ── Public types ─────────────────────────────────────────────────────────────

export type DateRange = "7d" | "30d" | "all";

export type Summary = {
  uniqueVisitors: number;
  totalSessions: number;
  ctaClickers: number;
  waitlistViewers: number;
  emailSubmitters: number;
  // Tracked signups: visitor_id present + after ANALYTICS_TRACKING_START_DATE.
  // Used for all conversion rates.
  successfulSignups: number;
  // Total waitlist entries in the date range (includes pre-tracking rows).
  totalSignups: number;
  // Signups that pre-date analytics tracking or have no visitor_id.
  legacySignups: number;
  surveySubmitters: number;
  surveySkippers: number;
  conversionRate: number;
  surveyCompletionRate: number;
};

export type FunnelStep = {
  step: string;
  count: number;
  pctOfVisitors: number;
  pctOfPrev: number;
  dropoff: number;
};

export type TrafficSource = {
  source: string;
  // Distinct raw utm_source/first_utm_source values rolled into this row,
  // kept for debugging since normalization is lossy by design.
  rawSources: string[];
  visitors: number;
  signups: number;
  conversionRate: number;
};

export type CtaRow = {
  location: string;
  label: string;
  clicks: number;
  uniqueClickers: number;
};

export type SectionRow = {
  section: string;
  uniqueSessions: number;
  pctOfSessions: number;
};

export type ScrollRow = {
  threshold: number;
  sessions: number;
  pctOfSessions: number;
};

export type CardRow = {
  card: string;
  clicks: number;
  uniqueClickers: number;
};

// IMPORTANT: this is a marketing-attribution view, NOT the app's actual
// referral reward/leaderboard logic. The real reward credit (referral_count
// increments in src/app/api/waitlist/route.ts) is first-touch-priority:
// `firstTouch.first_ref_code || referredBy-param || null`, where the
// referredBy param is only ever sent by the /ref/[code] page (never the
// homepage form) and only used when first_ref_code is absent. So a visitor
// whose first-ever touch had no ref code, who later clicked a *different*
// referral link before signing up on the homepage, gets ZERO real referral
// credit — but attributedSignups below (session/conversion-event based,
// matching Campaign/Content Breakdown) would still attribute that signup to
// the later code. Don't treat this table as a leaderboard of record.
export type ReferralRow = {
  refCode: string;
  visitors: number;
  sessions: number;
  // Signups whose MARKETING attribution credits this code, using the SAME
  // logic as Campaign/Content Breakdown: the converting session's ref code
  // at signup time, falling back to the visitor's persisted first-touch ref
  // code only when no conversion event was tracked at all. This intentionally
  // matches Campaign Breakdown (not the real reward logic above) so a code
  // never shows signups here that don't also show up there, or vice versa.
  attributedSignups: number;
  // Subset of attributedSignups backed by an actual tracked conversion event
  // (waitlist_email_success/submit), not the first-touch fallback.
  matchedSignups: number;
  firstVisit: string | null;
  lastVisit: string | null;
  firstSignupAt: string | null;
  lastSignupAt: string | null;
  // Null when not meaningful (no tracked visitors, or attributedSignups >
  // visitors — see conversionLabel for what to show instead).
  conversionRate: number | null;
  conversionLabel: string;
};

// One row per distinct utm_source + utm_medium + utm_campaign + utm_content +
// ref_code + referrer domain + landing path combination — i.e. one row per
// specific link/post/story/DM/QR, not per rolled-up channel.
export type CampaignRow = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  refCode: string | null;
  landingPath: string | null;
  referrerDomain: string | null;
  visitors: number;
  sessions: number;
  // Signups attributed to this exact row via the visitor's actual conversion
  // event (waitlist_email_success/submit), i.e. the session that converted —
  // not first-touch. `approxSignups` of these (a subset of `signups`) had no
  // matching conversion event and fell back to the visitor's first-touch
  // tuple instead, so they're approximate.
  signups: number;
  approxSignups: number;
  conversionRate: number;
};

// One row per distinct marketing identity (normalized source + medium +
// campaign + content + ref code) — the "which post/ad/link drove this"
// question, without splitting rows over debug-only signals like referrer
// domain or landing path. This is the primary, decision-friendly table;
// CampaignRow (above) remains available as the raw/debug breakdown.
export type MarketingRow = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  refCode: string | null;
  visitors: number;
  sessions: number;
  signups: number;
  approxSignups: number;
  conversionRate: number;
};

// One row per normalized source (e.g. "instagram") — the rollup of every
// MarketingRow that shares that source, deduped so a visitor/session with
// two campaign touches under the same source isn't double-counted. This is
// what answers "how much overall came from Instagram", with MarketingRow
// providing the campaign/content breakdown underneath it.
export type MarketingSourceTotal = {
  source: string;
  visitors: number;
  sessions: number;
  signups: number;
  approxSignups: number;
  conversionRate: number;
};

// A signup attributed to a source/campaign tuple with zero tracked
// visitors/sessions in this window — the visitor's converting session (or
// their persisted first-touch tuple, used as a fallback) never matched any
// tracked analytics_events session. Usually means their actual visit wasn't
// tracked at all (ad blocker, private browsing, or a first touch outside the
// selected date range), not a campaign that converted at 0 visitors. Kept
// separate from MarketingRow so the main table never implies that.
export type UnmatchedSignupRow = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  refCode: string | null;
  signups: number;
};

// Full debug context for one MarketingRow — for diagnosing confusing rows
// (e.g. why two Instagram link-in-bio variants exist) without cluttering the
// main breakdown table. Internal/admin-only; never shown by default.
export type MarketingRowDebug = {
  source: string;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  refCode: string | null;
  visitors: number;
  sessions: number;
  signups: number;
  approxSignups: number;
  // Date range of tracked traffic (session entry touches) for this exact tuple.
  firstSeen: string | null;
  lastSeen: string | null;
  // Date range of signups attributed to this tuple — answers "when did these
  // signups happen" directly, e.g. for a specific source/campaign.
  firstSignupAt: string | null;
  lastSignupAt: string | null;
  // Distinct raw utm_source values that normalized into this row's source
  // (e.g. both "ig" and "instagram"), so historical naming drift is visible.
  rawSources: string[];
  sampleLandingPath: string | null;
  sampleReferrerDomain: string | null;
};

export type Insight = {
  type: "warning" | "info" | "success";
  message: string;
};

export type ActionCard = {
  tag: "Fix" | "Watch" | "Double down" | "Promising";
  message: string;
};

export type DashboardData = {
  summary: Summary;
  funnel: FunnelStep[];
  trafficSources: TrafficSource[];
  ctaPerformance: CtaRow[];
  sectionEngagement: SectionRow[];
  scrollDepth: ScrollRow[];
  featureCards: CardRow[];
  survey: {
    signups: number;
    submits: number;
    skips: number;
    completionRate: number;
    skipRate: number;
  };
  referrals: ReferralRow[];
  marketingSourceTotals: MarketingSourceTotal[];
  marketing: MarketingRow[];
  unmatchedSignups: UnmatchedSignupRow[];
  marketingDebug: MarketingRowDebug[];
  campaigns: CampaignRow[];
  insights: Insight[];
  actions: ActionCard[];
  // ISO string if ANALYTICS_TRACKING_START_DATE is set, otherwise null.
  trackingStartDate: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStartDate(range: DateRange): string | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "7d" ? 7 : 30));
  return d.toISOString();
}

// Returns the ISO string from ANALYTICS_TRACKING_START_DATE, or null.
function getTrackingStartDate(): string | null {
  const val = process.env.ANALYTICS_TRACKING_START_DATE;
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function pct(num: number, denom: number): number {
  if (denom === 0) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

function str(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return "";
}

// Known variants that should roll up under one display source. The raw value
// is preserved separately (TrafficSource.rawSources) for debugging. These
// double as referrer-hostname aliases (see normalizeSource's fallback below),
// which is why hostname-shaped keys like "l.instagram.com" are already here.
const SOURCE_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "l.instagram.com": "instagram",
  // Android in-app browsers report document.referrer as the app's package
  // name (e.g. "android-app://com.instagram.android/"), not a normal URL.
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
// hostname when there's no UTM tag at all (e.g. an untagged click from
// l.instagram.com should still show up as "instagram", not "direct"). Strips
// common subdomain prefixes (l., m., www.) so hostname variants still match
// the same alias. "localhost" (dev-only artifact) is never a real source.
function normalizeSource(utmSource: string | null, referrerHost: string | null = null): string {
  const raw = utmSource?.toLowerCase().trim();
  if (raw) return SOURCE_ALIASES[raw] ?? raw;

  const host = referrerHost?.toLowerCase().trim();
  if (!host || host === "localhost") return "direct";
  const stripped = host.replace(/^(l|m|www)\./, "");
  return SOURCE_ALIASES[host] ?? SOURCE_ALIASES[stripped] ?? "direct";
}

// Internal dev/QA artifacts (manual curl tests, local validation runs) that
// sometimes land in production analytics_events/waitlist rows. They're real
// rows — never deleted/mutated — but they're noise in decision-facing views,
// so marketing-facing tables/digests filter them out while the raw/debug
// views (which read campaignMap directly, not this filter) still show them.
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

// Extracts just the hostname from a referrer URL, e.g.
// "https://l.instagram.com/?u=..." -> "l.instagram.com". Returns null for
// empty/invalid referrers (including same-origin/relative values).
function referrerDomain(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

// ── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchDashboardData(range: DateRange): Promise<DashboardData | null> {
  if (!supabaseAdmin) return null;

  const rangeStart = getStartDate(range);
  const trackingStart = getTrackingStartDate();

  // Events are fetched from the tracking start, NOT the selected range start.
  // Source attribution below needs each visitor's true first-ever touch — if we
  // only fetched events inside the selected window, a returning visitor's
  // earliest event inside that window would be mistaken for their first touch,
  // and the same visitor could be attributed to a different source depending on
  // which date range was picked (e.g. "direct" in 7d but "instagram" in 30d).
  // Everything else is windowed in JS via `windowedEvents` below.
  const eventsPromise = fetchAllRows<EventRow>((from, to) => {
    let q = supabaseAdmin!
      .from("analytics_events")
      .select("visitor_id,session_id,event_name,created_at,path,referrer,utm_source,utm_medium,utm_campaign,utm_content,metadata")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (trackingStart) q = q.gte("created_at", trackingStart);
    return q;
  }, "analytics_events");

  // Waitlist uses only the range filter. We fetch all rows (including pre-tracking
  // legacy entries) and split them in JS so we can show both counts.
  const wlStart = rangeStart;

  const waitlistPromise = fetchAllRows<WaitlistRow>((from, to) => {
    let q = supabaseAdmin!
      .from("waitlist")
      .select("visitor_id,first_utm_source,first_utm_medium,first_utm_campaign,first_utm_content,first_referrer,first_landing_page,first_ref_code,survey_must_have,created_at")
      .order("created_at", { ascending: true })
      .range(from, to);
    if (wlStart) q = q.gte("created_at", wlStart);
    return q;
  }, "waitlist");

  const [events, waitlist] = await Promise.all([eventsPromise, waitlistPromise]);

  // Events that actually fall inside the selected window. Used for everything
  // EXCEPT source attribution (which needs the full `events` history above).
  const windowedEvents = rangeStart ? events.filter(e => e.created_at >= rangeStart) : events;

  // ── Split waitlist: tracked vs legacy ────────────────────────
  // A signup is "tracked" when it has a visitor_id AND was created after the
  // analytics tracking start date (if that date is configured).
  // Legacy signups are excluded from all conversion rate calculations.
  const trackedWaitlist = waitlist.filter(
    w => w.visitor_id !== null && (!trackingStart || w.created_at >= trackingStart)
  );
  const totalSignups = waitlist.length;
  const trackedSignups = trackedWaitlist.length;
  const legacySignups = totalSignups - trackedSignups;

  // ── Per-event sets ───────────────────────────────────────────
  const allVisitors = new Set(windowedEvents.map(e => e.visitor_id));
  const allSessions = new Set(windowedEvents.map(e => e.session_id));

  const evVisitors: Record<string, Set<string>> = {};
  const evSessions: Record<string, Set<string>> = {};
  for (const e of windowedEvents) {
    (evVisitors[e.event_name] ??= new Set()).add(e.visitor_id);
    (evSessions[e.event_name] ??= new Set()).add(e.session_id);
  }
  const vBy = (name: string) => evVisitors[name]?.size ?? 0;
  const sBy = (name: string) => evSessions[name]?.size ?? 0;

  const uniqueVisitors = allVisitors.size;
  const totalSessions = allSessions.size;
  const ctaClickers = vBy("cta_click");
  const waitlistViewers = vBy("waitlist_view");
  const emailSubmitters = vBy("waitlist_email_submit");
  // successfulSignups = tracked only. Used in every conversion ratio.
  const successfulSignups = trackedSignups;
  const surveySubmitters = sBy("waitlist_survey_submit");
  const surveySkippers = sBy("waitlist_survey_skip");
  const conversionRate = pct(successfulSignups, uniqueVisitors);
  const surveyCompletionRate = pct(surveySubmitters, successfulSignups);

  // ── Summary ──────────────────────────────────────────────────
  const summary: Summary = {
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
    conversionRate,
    surveyCompletionRate,
  };

  // ── Funnel (uses tracked signups) ─────────────────────────────
  const funnelCounts = [uniqueVisitors, ctaClickers, waitlistViewers, emailSubmitters, successfulSignups, surveySubmitters];
  const funnelLabels = ["Visitors", "CTA Clickers", "Waitlist Views", "Email Submits", "Signups (tracked)", "Survey Submits"];
  const funnel: FunnelStep[] = funnelCounts.map((count, i) => ({
    step: funnelLabels[i],
    count,
    pctOfVisitors: pct(count, uniqueVisitors),
    pctOfPrev: i === 0 ? 100 : pct(count, funnelCounts[i - 1]),
    dropoff: i === 0 ? 0 : funnelCounts[i - 1] - count,
  }));

  // ── Traffic Sources ───────────────────────────────────────────
  // Attribution uses each visitor's true first-ever touch (from the full,
  // unwindowed `events` history) so a visitor's source never changes depending
  // on which date range is selected. We then only count visitors/signups that
  // fall inside the selected window (allVisitors / trackedWaitlist already do).
  const visitorFirstSource: Record<string, string> = {};
  for (const e of events) {
    if (!visitorFirstSource[e.visitor_id]) {
      visitorFirstSource[e.visitor_id] = normalizeSource(e.utm_source, referrerDomain(e.referrer));
    }
  }
  const sourceVisitors: Record<string, Set<string>> = {};
  const sourceRaw: Record<string, Set<string>> = {};
  for (const vid of allVisitors) {
    const src = visitorFirstSource[vid] ?? "direct";
    (sourceVisitors[src] ??= new Set()).add(vid);
  }
  for (const e of events) {
    const src = normalizeSource(e.utm_source, referrerDomain(e.referrer));
    const rawLabel = e.utm_source?.toLowerCase().trim() || (referrerDomain(e.referrer) ? `referrer:${referrerDomain(e.referrer)}` : "direct");
    (sourceRaw[src] ??= new Set()).add(rawLabel);
  }
  const sourceSignups: Record<string, number> = {};
  for (const w of trackedWaitlist) {
    const src = normalizeSource(w.first_utm_source, referrerDomain(w.first_referrer));
    sourceSignups[src] = (sourceSignups[src] ?? 0) + 1;
    const rawLabel = w.first_utm_source?.toLowerCase().trim() || (referrerDomain(w.first_referrer) ? `referrer:${referrerDomain(w.first_referrer)}` : "direct");
    (sourceRaw[src] ??= new Set()).add(rawLabel);
  }
  const allSrcs = new Set([...Object.keys(sourceVisitors), ...Object.keys(sourceSignups)]);
  const trafficSources: TrafficSource[] = Array.from(allSrcs)
    .map(src => {
      const visitors = sourceVisitors[src]?.size ?? 0;
      const signups = sourceSignups[src] ?? 0;
      const rawSources = Array.from(sourceRaw[src] ?? []).sort();
      return { source: src, rawSources, visitors, signups, conversionRate: pct(signups, visitors) };
    })
    .sort((a, b) => b.signups - a.signups || b.conversionRate - a.conversionRate);

  // ── CTA Performance ──────────────────────────────────────────
  const ctaMap: Record<string, { clicks: number; clickers: Set<string> }> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "cta_click")) {
    const key = `${str(e.metadata?.cta_location) || "unknown"}__${str(e.metadata?.button_label) || "unknown"}`;
    const entry = (ctaMap[key] ??= { clicks: 0, clickers: new Set() });
    entry.clicks++;
    entry.clickers.add(e.visitor_id);
  }
  const ctaPerformance: CtaRow[] = Object.entries(ctaMap)
    .map(([key, v]) => {
      const [location, label] = key.split("__");
      return { location, label, clicks: v.clicks, uniqueClickers: v.clickers.size };
    })
    .sort((a, b) => b.clicks - a.clicks);

  // ── Section Engagement ───────────────────────────────────────
  const sectionMap: Record<string, Set<string>> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "section_view")) {
    const name = str(e.metadata?.section_name) || "unknown";
    (sectionMap[name] ??= new Set()).add(e.session_id);
  }
  const sectionEngagement: SectionRow[] = ["hero", "explainer", "world", "waitlist", "footer"].map(s => ({
    section: s,
    uniqueSessions: sectionMap[s]?.size ?? 0,
    pctOfSessions: pct(sectionMap[s]?.size ?? 0, totalSessions),
  }));

  // ── Scroll Depth ─────────────────────────────────────────────
  const scrollMap: Record<number, Set<string>> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "scroll_depth")) {
    const threshold = typeof e.metadata?.threshold === "number" ? e.metadata.threshold : 0;
    (scrollMap[threshold] ??= new Set()).add(e.session_id);
  }
  const scrollDepth: ScrollRow[] = [25, 50, 75, 90].map(t => ({
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
  const featureCards: CardRow[] = Object.entries(cardMap)
    .map(([card, v]) => ({ card, clicks: v.clicks, uniqueClickers: v.clickers.size }))
    .sort((a, b) => b.clicks - a.clicks);

  // ── Survey (uses tracked signups as denominator) ──────────────
  const survey = {
    signups: successfulSignups,
    submits: surveySubmitters,
    skips: surveySkippers,
    completionRate: pct(surveySubmitters, successfulSignups),
    skipRate: pct(surveySkippers, successfulSignups),
  };

  // ── Referrals: visit tracking (credited signups are computed later, once
  // the conversion-event attribution loop below has run — see refCreditMap).
  const refVisitors: Record<string, Set<string>> = {};
  const refSessions: Record<string, Set<string>> = {};
  const refFirstSeen: Record<string, string> = {};
  const refLastSeen: Record<string, string> = {};
  for (const e of windowedEvents.filter(e => e.event_name === "ref_link_visit")) {
    const code = str(e.metadata?.ref_code) || "unknown";
    (refVisitors[code] ??= new Set()).add(e.visitor_id);
    (refSessions[code] ??= new Set()).add(e.session_id);
    refFirstSeen[code] = minStr(refFirstSeen[code] ?? null, e.created_at);
    refLastSeen[code] = maxStr(refLastSeen[code] ?? null, e.created_at);
  }
  const refCreditMap: Record<string, { signups: number; matchedSignups: number; firstSignupAt: string | null; lastSignupAt: string | null }> = {};

  // ── Campaign / Session Attribution ────────────────────────────
  // Unlike Traffic Sources (deduped to one row per visitor's true first-ever
  // touch), this table is session-level and intentionally granular: the same
  // visitor can land in multiple rows if they arrived through multiple
  // distinct links/sessions in this window. That's expected — this table
  // answers "which specific link/post/DM/QR drove this visit", not "what
  // channel originally acquired this visitor".
  type CampaignTouch = {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    ref_code: string | null;
    referrer_domain: string | null;
    landing_path: string | null;
  };
  type CampaignBucket = CampaignTouch & { visitors: Set<string>; sessions: Set<string>; signups: number; approxSignups: number };

  function campaignKey(t: CampaignTouch): string {
    return [t.utm_source, t.utm_medium, t.utm_campaign, t.utm_content, t.ref_code, t.referrer_domain, t.landing_path]
      .map(v => v ?? "")
      .join("");
  }

  // The clean marketing identity for a touch — normalized source, raw
  // medium/campaign/content/ref_code, deliberately excluding referrer domain
  // and landing path (those are debug-only signals, not campaign identity).
  type MarketingTouch = { source: string; medium: string | null; campaign: string | null; content: string | null; refCode: string | null };
  // Debug-only context carried alongside each bucket so confusing rows (e.g.
  // multiple Instagram link-in-bio variants) can be traced back to their raw
  // origin without cluttering the main table. Never shown as a clean signal.
  type MarketingDebug = {
    firstSeen: string | null;
    lastSeen: string | null;
    firstSignupAt: string | null;
    lastSignupAt: string | null;
    rawSources: Set<string>;
    sampleLandingPath: string | null;
    sampleReferrerDomain: string | null;
  };
  type MarketingBucket = MarketingTouch & MarketingDebug & { visitors: Set<string>; sessions: Set<string>; signups: number; approxSignups: number };

  function newMarketingBucket(m: MarketingTouch): MarketingBucket {
    return {
      ...m,
      visitors: new Set(),
      sessions: new Set(),
      signups: 0,
      approxSignups: 0,
      firstSeen: null,
      lastSeen: null,
      firstSignupAt: null,
      lastSignupAt: null,
      rawSources: new Set(),
      sampleLandingPath: null,
      sampleReferrerDomain: null,
    };
  }

  function minStr(a: string | null, b: string): string {
    return a === null || b < a ? b : a;
  }
  function maxStr(a: string | null, b: string): string {
    return a === null || b > a ? b : a;
  }

  function toMarketingTouch(t: CampaignTouch): MarketingTouch {
    return {
      source: normalizeSource(t.utm_source, t.referrer_domain),
      medium: t.utm_medium,
      campaign: t.utm_campaign,
      content: t.utm_content,
      refCode: t.ref_code,
    };
  }

  // Pure direct/unknown traffic (no medium/campaign/content/ref code at all)
  // collapses into one canonical "direct" row rather than many near-empty
  // ones. Anything with even one piece of marketing identity — including a
  // referral code on otherwise-direct traffic — keeps its own row.
  function marketingKey(m: MarketingTouch): string {
    const isPureDirect = m.source === "direct" && !m.medium && !m.campaign && !m.content && !m.refCode;
    if (isPureDirect) return "direct";
    return [m.source, m.medium, m.campaign, m.content, m.refCode].map(v => v ?? "").join("");
  }

  // Entry touch per session = the session's earliest event (windowedEvents is
  // already ordered ascending by created_at, so "first seen" = earliest).
  const sessionEntry: Record<string, CampaignTouch & { visitor_id: string; created_at: string }> = {};
  for (const e of windowedEvents) {
    if (!sessionEntry[e.session_id]) {
      sessionEntry[e.session_id] = {
        utm_source: e.utm_source,
        utm_medium: e.utm_medium,
        utm_campaign: e.utm_campaign,
        utm_content: e.utm_content,
        ref_code: null,
        referrer_domain: referrerDomain(e.referrer),
        landing_path: e.path,
        visitor_id: e.visitor_id,
        created_at: e.created_at,
      };
    }
  }
  // A ref_link_visit anywhere in the session attaches that ref code to it.
  for (const e of windowedEvents) {
    if (e.event_name === "ref_link_visit") {
      const code = str(e.metadata?.ref_code) || null;
      if (code && sessionEntry[e.session_id]) {
        sessionEntry[e.session_id].ref_code = code;
      }
    }
  }

  const campaignMap: Record<string, CampaignBucket> = {};
  const marketingMap: Record<string, MarketingBucket> = {};
  for (const t of Object.values(sessionEntry)) {
    const key = campaignKey(t);
    (campaignMap[key] ??= { ...t, visitors: new Set(), sessions: new Set(), signups: 0, approxSignups: 0 }).visitors.add(t.visitor_id);

    const m = toMarketingTouch(t);
    const mKey = marketingKey(m);
    const mBucket = (marketingMap[mKey] ??= newMarketingBucket(m));
    mBucket.visitors.add(t.visitor_id);
    mBucket.firstSeen = minStr(mBucket.firstSeen, t.created_at);
    mBucket.lastSeen = maxStr(mBucket.lastSeen, t.created_at);
    mBucket.rawSources.add(t.utm_source ?? "(none)");
    if (!mBucket.sampleLandingPath && t.landing_path) mBucket.sampleLandingPath = t.landing_path;
    if (!mBucket.sampleReferrerDomain && t.referrer_domain) mBucket.sampleReferrerDomain = t.referrer_domain;
  }
  for (const [sid, t] of Object.entries(sessionEntry)) {
    campaignMap[campaignKey(t)].sessions.add(sid);
    marketingMap[marketingKey(toMarketingTouch(t))].sessions.add(sid);
  }

  // Signups are matched to the session/touch that actually produced them,
  // using the visitor's "waitlist_email_success" event (falling back to
  // "waitlist_email_submit" if success wasn't captured) — these events carry
  // the CURRENT session_id/utm/path/referrer at signup time, not first-touch.
  // Only when neither event exists for a visitor do we fall back to their
  // persisted first-touch tuple, and that fallback is tracked separately
  // (approxSignups) so the UI can flag it as approximate.
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
    const t: CampaignTouch = convEvent
      ? {
          utm_source: convEvent.utm_source,
          utm_medium: convEvent.utm_medium,
          utm_campaign: convEvent.utm_campaign,
          utm_content: convEvent.utm_content,
          ref_code: str(convEvent.metadata?.ref_code) || sessionEntry[convEvent.session_id]?.ref_code || null,
          referrer_domain: referrerDomain(convEvent.referrer),
          landing_path: convEvent.path,
        }
      : {
          utm_source: w.first_utm_source,
          utm_medium: w.first_utm_medium,
          utm_campaign: w.first_utm_campaign,
          utm_content: w.first_utm_content,
          ref_code: w.first_ref_code,
          referrer_domain: referrerDomain(w.first_referrer),
          landing_path: w.first_landing_page,
        };
    const key = campaignKey(t);
    const bucket = (campaignMap[key] ??= { ...t, visitors: new Set(), sessions: new Set(), signups: 0, approxSignups: 0 });
    bucket.signups += 1;
    if (isApprox) bucket.approxSignups += 1;

    if (t.ref_code) {
      const rc = (refCreditMap[t.ref_code] ??= { signups: 0, matchedSignups: 0, firstSignupAt: null, lastSignupAt: null });
      rc.signups += 1;
      if (!isApprox) rc.matchedSignups += 1;
      rc.firstSignupAt = minStr(rc.firstSignupAt, w.created_at);
      rc.lastSignupAt = maxStr(rc.lastSignupAt, w.created_at);
    }

    const m = toMarketingTouch(t);
    const mKey = marketingKey(m);
    const mBucket = (marketingMap[mKey] ??= newMarketingBucket(m));
    mBucket.signups += 1;
    if (isApprox) mBucket.approxSignups += 1;
    mBucket.firstSignupAt = minStr(mBucket.firstSignupAt, w.created_at);
    mBucket.lastSignupAt = maxStr(mBucket.lastSignupAt, w.created_at);
    mBucket.rawSources.add(t.utm_source ?? "(none)");
    if (!mBucket.sampleLandingPath && t.landing_path) mBucket.sampleLandingPath = t.landing_path;
    if (!mBucket.sampleReferrerDomain && t.referrer_domain) mBucket.sampleReferrerDomain = t.referrer_domain;
  }

  // A code can have attributed signups with zero tracked visitors (visit
  // never tracked) or visitors with zero attributed signups (no one
  // converted yet) — both are valid, so the rate is only meaningful when
  // there's a real denominator and the numerator doesn't exceed it.
  function refConversion(visitors: number, attributed: number): { rate: number | null; label: string } {
    if (visitors === 0) return { rate: null, label: attributed > 0 ? "N/A*" : "—" };
    if (attributed > visitors) return { rate: null, label: ">100%*" };
    const rate = pct(attributed, visitors);
    return { rate, label: `${rate}%` };
  }

  const allRefCodes = new Set([...Object.keys(refVisitors), ...Object.keys(refCreditMap)]);
  const referrals: ReferralRow[] = Array.from(allRefCodes)
    .map(code => {
      const visitors = refVisitors[code]?.size ?? 0;
      const sessions = refSessions[code]?.size ?? 0;
      const credit = refCreditMap[code];
      const attributedSignups = credit?.signups ?? 0;
      const matchedSignups = credit?.matchedSignups ?? 0;
      const { rate, label } = refConversion(visitors, attributedSignups);
      return {
        refCode: code,
        visitors,
        sessions,
        attributedSignups,
        matchedSignups,
        firstVisit: refFirstSeen[code] ?? null,
        lastVisit: refLastSeen[code] ?? null,
        firstSignupAt: credit?.firstSignupAt ?? null,
        lastSignupAt: credit?.lastSignupAt ?? null,
        conversionRate: rate,
        conversionLabel: label,
      };
    })
    .sort((a, b) => b.attributedSignups - a.attributedSignups || b.visitors - a.visitors);

  const cleanMarketingBuckets = Object.values(marketingMap).filter(
    b => !isTestArtifact(b.source, b.medium, b.campaign, b.content)
  );

  // Roll every campaign-tuple bucket up to its normalized source, deduping
  // visitors/sessions across tuples (e.g. a visitor with both a link_in_bio
  // and a paid_social touch under "instagram" should only count once).
  const sourceTotalMap: Record<string, { visitors: Set<string>; sessions: Set<string>; signups: number; approxSignups: number }> = {};
  for (const b of cleanMarketingBuckets) {
    const t = (sourceTotalMap[b.source] ??= { visitors: new Set(), sessions: new Set(), signups: 0, approxSignups: 0 });
    for (const v of b.visitors) t.visitors.add(v);
    for (const s of b.sessions) t.sessions.add(s);
    t.signups += b.signups;
    t.approxSignups += b.approxSignups;
  }
  const marketingSourceTotals: MarketingSourceTotal[] = Object.entries(sourceTotalMap)
    .map(([source, t]) => ({
      source,
      visitors: t.visitors.size,
      sessions: t.sessions.size,
      signups: t.signups,
      approxSignups: t.approxSignups,
      conversionRate: pct(t.signups, t.visitors.size),
    }))
    .sort((a, b) => b.signups - a.signups || b.visitors - a.visitors);

  // Cluster the campaign-tuple breakdown by source (in source-total order),
  // so the table reads as "source, then its campaigns" without needing
  // nested/indented rows.
  const sourceRank: Record<string, number> = {};
  marketingSourceTotals.forEach((s, i) => (sourceRank[s.source] = i));

  const allMarketingRows: MarketingRow[] = cleanMarketingBuckets.map(b => ({
    source: b.source,
    medium: b.medium,
    campaign: b.campaign,
    content: b.content,
    refCode: b.refCode,
    visitors: b.visitors.size,
    sessions: b.sessions.size,
    signups: b.signups,
    approxSignups: b.approxSignups,
    conversionRate: pct(b.signups, b.visitors.size),
  }));

  // Rows with zero tracked visitors/sessions are signups whose converting
  // session (or fallback first-touch tuple) never matched a tracked
  // analytics_events session — almost always missing tracking data, not a
  // campaign that converted at 0 visitors. Surfaced separately so the main
  // table never implies that.
  const marketing: MarketingRow[] = allMarketingRows
    .filter(r => r.visitors > 0 || r.sessions > 0)
    .sort((a, b) => sourceRank[a.source] - sourceRank[b.source] || b.signups - a.signups || b.visitors - a.visitors);

  const unmatchedSignups: UnmatchedSignupRow[] = allMarketingRows
    .filter(r => r.visitors === 0 && r.sessions === 0 && r.signups > 0)
    .map(r => ({ source: r.source, medium: r.medium, campaign: r.campaign, content: r.content, refCode: r.refCode, signups: r.signups }))
    .sort((a, b) => b.signups - a.signups);

  // Full debug context per marketing row — traffic date range, signup date
  // range, and sample raw values — so a confusing row (e.g. two different
  // Instagram link-in-bio variants) can be traced back to its origin without
  // cluttering the main breakdown table above. Includes 0-visitor rows too.
  const marketingDebug: MarketingRowDebug[] = cleanMarketingBuckets
    .map(b => ({
      source: b.source,
      medium: b.medium,
      campaign: b.campaign,
      content: b.content,
      refCode: b.refCode,
      visitors: b.visitors.size,
      sessions: b.sessions.size,
      signups: b.signups,
      approxSignups: b.approxSignups,
      firstSeen: b.firstSeen,
      lastSeen: b.lastSeen,
      firstSignupAt: b.firstSignupAt,
      lastSignupAt: b.lastSignupAt,
      rawSources: Array.from(b.rawSources).sort(),
      sampleLandingPath: b.sampleLandingPath,
      sampleReferrerDomain: b.sampleReferrerDomain,
    }))
    .sort((a, b) => sourceRank[a.source] - sourceRank[b.source] || b.signups - a.signups || b.visitors - a.visitors);

  const campaigns: CampaignRow[] = Object.values(campaignMap)
    .map(b => ({
      utmSource: b.utm_source,
      utmMedium: b.utm_medium,
      utmCampaign: b.utm_campaign,
      utmContent: b.utm_content,
      refCode: b.ref_code,
      landingPath: b.landing_path,
      referrerDomain: b.referrer_domain,
      visitors: b.visitors.size,
      sessions: b.sessions.size,
      signups: b.signups,
      approxSignups: b.approxSignups,
      conversionRate: pct(b.signups, b.visitors.size),
    }))
    .sort((a, b) => b.sessions - a.sessions || b.signups - a.signups);

  // ── Rule-based insights ───────────────────────────────────────
  const insights: Insight[] = [];
  const actions: ActionCard[] = [];

  const ctaClickRate = pct(ctaClickers, uniqueVisitors);
  if (uniqueVisitors >= 20) {
    if (ctaClickRate < 5) {
      insights.push({ type: "warning", message: `Only ${ctaClickRate}% of visitors click a CTA. Hero copy or CTA visibility may need work.` });
      actions.push({ tag: "Fix", message: "Revisit hero headline or increase CTA button size and contrast." });
    } else if (ctaClickRate > 15) {
      insights.push({ type: "success", message: `Strong CTA click rate at ${ctaClickRate}% — the hero is resonating.` });
    }
  }

  if (ctaClickers >= 10) {
    const waitlistViewRate = pct(waitlistViewers, ctaClickers);
    if (waitlistViewRate < 50) {
      insights.push({ type: "warning", message: `${waitlistViewRate}% of CTA clickers reach the waitlist. Visitors may be getting lost before the form.` });
      actions.push({ tag: "Fix", message: "Check that the CTA button scrolls directly to the waitlist section." });
    }
  }

  if (waitlistViewers >= 10) {
    const emailSubmitRate = pct(emailSubmitters, waitlistViewers);
    if (emailSubmitRate < 30) {
      insights.push({ type: "warning", message: `Only ${emailSubmitRate}% of waitlist viewers submit their email — the form may have friction.` });
      actions.push({ tag: "Fix", message: "Simplify the form or reduce required fields before email submission." });
    } else if (emailSubmitRate > 60) {
      insights.push({ type: "success", message: `Strong form conversion at ${emailSubmitRate}% — visitors who reach the form are highly motivated.` });
    }
  }

  if (successfulSignups >= 10) {
    if (survey.skipRate > 50) {
      insights.push({ type: "warning", message: `${survey.skipRate}% of signups skip the survey. It may be too long or appear at the wrong moment.` });
      actions.push({ tag: "Watch", message: "Consider reducing the survey to one question or showing it after a short delay." });
    } else if (survey.completionRate > 70) {
      insights.push({ type: "success", message: `${survey.completionRate}% survey completion — signups are highly engaged post-signup.` });
    }
  }

  const scrollHalfPct = scrollDepth.find(s => s.threshold === 50)?.pctOfSessions ?? 0;
  if (totalSessions >= 20 && scrollHalfPct < 40) {
    insights.push({ type: "warning", message: `Only ${scrollHalfPct}% of sessions reach the halfway mark — key content may need to move higher.` });
    actions.push({ tag: "Fix", message: "Move the product explainer or social proof above the fold or earlier in the scroll." });
  }

  if (featureCards.length >= 2) {
    const top = featureCards[0];
    const avg = featureCards.reduce((s, c) => s + c.clicks, 0) / featureCards.length;
    if (top.clicks > avg * 2) {
      insights.push({ type: "info", message: `'${top.card}' gets significantly more feature card clicks — this may be your strongest positioning hook.` });
      actions.push({ tag: "Double down", message: `Lead with the '${top.card}' theme in your headline or paid ads.` });
    }
  }

  for (const src of trafficSources) {
    if (src.source !== "direct" && src.visitors > 15 && src.conversionRate < 3) {
      insights.push({ type: "warning", message: `'${src.source}' brings ${src.visitors} visitors but only ${src.conversionRate}% convert — possible audience or messaging mismatch.` });
      actions.push({ tag: "Watch", message: `Audit the ${src.source} audience and whether the landing page matches their intent.` });
      break;
    }
  }

  for (const src of trafficSources) {
    if (src.source !== "direct" && src.visitors >= 3 && src.visitors <= 25 && src.conversionRate > 30) {
      insights.push({ type: "success", message: `'${src.source}' converts at ${src.conversionRate}% with low volume — strong early signal.` });
      actions.push({ tag: "Double down", message: `Invest more in ${src.source} — early data suggests it sends highly qualified visitors.` });
      break;
    }
  }

  if (uniqueVisitors >= 30 && conversionRate > 15) {
    insights.push({ type: "success", message: `${conversionRate}% visitor-to-signup conversion is well above the typical waitlist page benchmark.` });
    actions.push({ tag: "Promising", message: "Consider increasing traffic spend — conversion is strong enough to justify it." });
  }

  return {
    summary,
    funnel,
    trafficSources,
    ctaPerformance,
    sectionEngagement,
    scrollDepth,
    featureCards,
    survey,
    referrals,
    marketingSourceTotals,
    marketing,
    unmatchedSignups,
    marketingDebug,
    campaigns,
    insights,
    actions,
    trackingStartDate: trackingStart,
  };
}
