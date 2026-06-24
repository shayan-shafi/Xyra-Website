import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ── Row types ────────────────────────────────────────────────────────────────

type EventRow = {
  visitor_id: string;
  session_id: string;
  event_name: string;
  created_at: string;
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

export type DigestData = {
  period: { start: Date; end: Date; days: number };
  // ISO string from ANALYTICS_TRACKING_START_DATE, or null.
  trackingStartDate: string | null;
  summary: DigestSummary;
  funnel: DigestFunnelStep[];
  sources: DigestSource[];
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
// is preserved separately (DigestSource.rawSources) for debugging.
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
  const [{ data: evRaw, error: evErr }, { data: wlRaw, error: wlErr }] = await Promise.all([
    supabaseAdmin
      .from("analytics_events")
      .select("visitor_id,session_id,event_name,created_at,utm_source,utm_medium,utm_campaign,utm_content,metadata")
      .gte("created_at", trackingStart ?? rangeStartIso)
      .order("created_at", { ascending: true })
      .limit(100000),
    supabaseAdmin
      .from("waitlist")
      .select("visitor_id,first_utm_source,first_utm_medium,first_utm_campaign,first_utm_content,first_ref_code,survey_must_have,created_at")
      .gte("created_at", rangeStartIso)
      .order("created_at", { ascending: true })
      .limit(10000),
  ]);

  if (evErr) console.error("digest events fetch:", evErr.message);
  if (wlErr) console.error("digest waitlist fetch:", wlErr.message);

  const events = (evRaw ?? []) as EventRow[];
  const waitlist = (wlRaw ?? []) as WaitlistRow[];

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
        utm_source: normalizeSource(e.utm_source),
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
    const src = normalizeSource(w.first_utm_source);
    if (!sourceMap[src]) sourceMap[src] = { visitors: new Set(), medium: w.first_utm_medium, campaign: w.first_utm_campaign, signups: 0 };
    sourceMap[src].signups += 1;
  }

  // Raw label tracking lives in a side-table so it can't introduce phantom
  // zero-visitor/zero-signup rows for sources only seen outside this window.
  const sourceRaw: Record<string, Set<string>> = {};
  for (const e of events) {
    const key = normalizeSource(e.utm_source);
    (sourceRaw[key] ??= new Set()).add(e.utm_source?.toLowerCase().trim() || "direct");
  }
  for (const w of trackedWaitlist) {
    const key = normalizeSource(w.first_utm_source);
    (sourceRaw[key] ??= new Set()).add(w.first_utm_source?.toLowerCase().trim() || "direct");
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
    ctas,
    sections,
    scrollDepth,
    featureCards,
    survey,
    actions,
  };
}
