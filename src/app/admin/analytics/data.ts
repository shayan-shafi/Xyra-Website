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

export type ReferralRow = {
  refCode: string;
  visitors: number;
  signups: number;
  conversionRate: number;
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

// Returns the later of two nullable ISO date strings.
function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
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

// ── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchDashboardData(range: DateRange): Promise<DashboardData | null> {
  if (!supabaseAdmin) return null;

  const rangeStart = getStartDate(range);
  const trackingStart = getTrackingStartDate();

  // Events are gated by both the range AND the tracking start date. In practice
  // analytics_events has no rows before tracking was deployed, but being explicit
  // keeps the two datasets aligned.
  const eventsStart = laterOf(rangeStart, trackingStart);

  // Waitlist uses only the range filter. We fetch all rows (including pre-tracking
  // legacy entries) and split them in JS so we can show both counts.
  const wlStart = rangeStart;

  let evQ = supabaseAdmin
    .from("analytics_events")
    .select("visitor_id,session_id,event_name,created_at,utm_source,utm_medium,utm_campaign,utm_content,metadata")
    .order("created_at", { ascending: true })
    .limit(100000);
  if (eventsStart) evQ = evQ.gte("created_at", eventsStart);

  let wlQ = supabaseAdmin
    .from("waitlist")
    .select("visitor_id,first_utm_source,first_utm_medium,first_utm_campaign,first_utm_content,first_referrer,first_landing_page,first_ref_code,survey_must_have,created_at")
    .order("created_at", { ascending: true })
    .limit(10000);
  if (wlStart) wlQ = wlQ.gte("created_at", wlStart);

  const [{ data: evRaw, error: evErr }, { data: wlRaw, error: wlErr }] = await Promise.all([evQ, wlQ]);

  if (evErr) console.error("analytics_events fetch:", evErr.message);
  if (wlErr) console.error("waitlist fetch:", wlErr.message);

  const events = (evRaw || []) as EventRow[];
  const waitlist = (wlRaw || []) as WaitlistRow[];

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
  const allVisitors = new Set(events.map(e => e.visitor_id));
  const allSessions = new Set(events.map(e => e.session_id));

  const evVisitors: Record<string, Set<string>> = {};
  const evSessions: Record<string, Set<string>> = {};
  for (const e of events) {
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

  // ── Traffic Sources (tracked waitlist only) ──────────────────
  const visitorSource: Record<string, string> = {};
  for (const e of events) {
    if (!visitorSource[e.visitor_id]) {
      visitorSource[e.visitor_id] = e.utm_source || "direct";
    }
  }
  const sourceVisitors: Record<string, Set<string>> = {};
  for (const [vid, src] of Object.entries(visitorSource)) {
    (sourceVisitors[src] ??= new Set()).add(vid);
  }
  const sourceSignups: Record<string, number> = {};
  for (const w of trackedWaitlist) {
    const src = w.first_utm_source || "direct";
    sourceSignups[src] = (sourceSignups[src] ?? 0) + 1;
  }
  const allSrcs = new Set([...Object.keys(sourceVisitors), ...Object.keys(sourceSignups)]);
  const trafficSources: TrafficSource[] = Array.from(allSrcs)
    .map(src => {
      const visitors = sourceVisitors[src]?.size ?? 0;
      const signups = sourceSignups[src] ?? 0;
      return { source: src, visitors, signups, conversionRate: pct(signups, visitors) };
    })
    .sort((a, b) => b.signups - a.signups || b.conversionRate - a.conversionRate);

  // ── CTA Performance ──────────────────────────────────────────
  const ctaMap: Record<string, { clicks: number; clickers: Set<string> }> = {};
  for (const e of events.filter(e => e.event_name === "cta_click")) {
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
  for (const e of events.filter(e => e.event_name === "section_view")) {
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
  for (const e of events.filter(e => e.event_name === "scroll_depth")) {
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
  for (const e of events.filter(e => e.event_name === "feature_card_click")) {
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

  // ── Referrals (tracked waitlist only) ─────────────────────────
  const refVisitors: Record<string, Set<string>> = {};
  for (const e of events.filter(e => e.event_name === "ref_link_visit")) {
    const code = str(e.metadata?.ref_code) || "unknown";
    (refVisitors[code] ??= new Set()).add(e.visitor_id);
  }
  const refSignups: Record<string, number> = {};
  for (const w of trackedWaitlist) {
    if (w.first_ref_code) {
      refSignups[w.first_ref_code] = (refSignups[w.first_ref_code] ?? 0) + 1;
    }
  }
  const allRefCodes = new Set([...Object.keys(refVisitors), ...Object.keys(refSignups)]);
  const referrals: ReferralRow[] = Array.from(allRefCodes)
    .map(code => {
      const visitors = refVisitors[code]?.size ?? 0;
      const signups = refSignups[code] ?? 0;
      return { refCode: code, visitors, signups, conversionRate: pct(signups, visitors) };
    })
    .sort((a, b) => b.signups - a.signups || b.visitors - a.visitors);

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
    insights,
    actions,
    trackingStartDate: trackingStart,
  };
}
