import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";
import { fetchAll } from "@/lib/fetchAll";
import type { ResolvedWindow } from "../analytics/data";

// Data layer for /admin/funnel (Brain/01-xyra/funnel-optimization-plan.md, stage 2).
//
// One path, two databases:
//   site (xyra.dev Supabase)  analytics_events → handoff_requests
//   app  (app.xyra.dev)       auth.users (signup_attribution, firstrun_*) →
//                             agent_tokens → user_integrations → product_events
//                             (paywall_view, checkout_started, subscription_started)
//                             → subscriptions
// Nothing new is stored for this page: every step is a row that already exists.
//
// Cohort rule: site steps count events inside the window; app steps follow the
// ACCOUNTS CREATED inside the window, to wherever they have got by now.

const INTERNAL_DOMAINS = ["xyraconsult.com"];
const INTERNAL_EMAILS = new Set(
  (process.env.RETENTION_INTERNAL_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);
const isInternal = (email: string) => INTERNAL_EMAILS.has(email) || INTERNAL_DOMAINS.some((d) => email.endsWith(`@${d}`));

// Agent tokens that aren't an AI (the phone widget uses the same table).
const NOT_AN_AI = new Set(["iphone widget"]);

export type Path = "phone" | "laptop" | "unknown";
export type Source = "handoff" | "site" | "invite" | "direct";

/** One funnel row. `ofFirst` rows sit beside the path (shown as a share of the first step, not of the row above). */
export type Step = { label: string; n: number; note?: string; ofFirst?: boolean };

export type CreativeRow = {
  key: string; // utm_content, or "(no ad tags)"
  source: string | null;
  campaign: string | null;
  visitors: number;
  ctaClicks: number;
  emails: number;
  accounts: number;
  activated: number;
  paid: number;
};

export type RecentAccount = {
  email: string;
  createdAt: string;
  source: Source;
  creative: string | null;
  reached: string; // furthest step
  internal: boolean;
};

export type FunnelData = {
  window: ResolvedWindow;
  includeInternal: boolean;
  appConnected: boolean;
  deviceTaggedSince: string | null; // first event carrying metadata.device
  site: {
    visitors: { total: number; phone: number; desktop: number; untagged: number };
    phone: Step[];
    laptop: Step[];
    ctaUntyped: number;
  };
  app: Step[];
  totals: { accounts: number; activated: number; paying: number };
  bySource: Record<Source, number>;
  unattributed: { siteAccounts: number; withoutAdTags: number };
  creatives: CreativeRow[];
  recent: RecentAccount[];
};

type EventRow = {
  visitor_id: string;
  event_name: string;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type HandoffRow = {
  created_at: string;
  opened_at: string | null;
  laptop_opened_at: string | null;
  claimed_at: string | null;
  first_utm_source: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
};

type AuthUser = { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown> };
type Attribution = { src?: string; h?: string; utm_source?: string; utm_campaign?: string; utm_content?: string };

const inWindow = (iso: string, w: ResolvedWindow) =>
  (!w.startIso || iso >= w.startIso) && (!w.endIso || iso < w.endIso);

const NO_TAGS = "(no ad tags)";

// An untagged visit still says where it came from: X's link wrapper, another site, or nothing.
function untaggedKey(referrer: string | null): string {
  if (!referrer) return `${NO_TAGS} · direct`;
  let host = "";
  try { host = new URL(referrer).hostname.replace(/^www\./, ""); } catch { return `${NO_TAGS} · direct`; }
  if (!host || host.endsWith("xyra.dev") || host === "localhost") return `${NO_TAGS} · direct`;
  // X's in-app browser often sends no referrer at all, so some "direct" is X too.
  if (host === "com.twitter.android" || host === "t.co" || host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com")) return `${NO_TAGS} · X`;
  return `${NO_TAGS} · ${host}`;
}

function siteEvents(w: ResolvedWindow) {
  const db = supabaseAdmin!;
  return fetchAll<EventRow>((from, to) => {
    let q = db
      .from("analytics_events")
      .select("visitor_id, event_name, utm_source, utm_campaign, utm_content, referrer, metadata, created_at")
      .in("event_name", ["pageview", "cta_click", "handoff_open", "handoff_success"]);
    if (w.startIso) q = q.gte("created_at", w.startIso);
    if (w.endIso) q = q.lt("created_at", w.endIso);
    return q.order("id", { ascending: true }).range(from, to);
  }, "funnel/analytics_events");
}

function handoffRows(w: ResolvedWindow) {
  const db = supabaseAdmin!;
  return fetchAll<HandoffRow>((from, to) => {
    let q = db
      .from("handoff_requests")
      .select("created_at, opened_at, laptop_opened_at, claimed_at, first_utm_source, first_utm_campaign, first_utm_content");
    if (w.startIso) q = q.gte("created_at", w.startIso);
    if (w.endIso) q = q.lt("created_at", w.endIso);
    return q.order("id", { ascending: true }).range(from, to);
  }, "funnel/handoff_requests");
}

async function authUsers(): Promise<AuthUser[]> {
  const app = supabaseAppAdmin!;
  const all: AuthUser[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await app.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("admin/funnel/listUsers:", error.message);
      break;
    }
    all.push(...(data.users as AuthUser[]));
    if (data.users.length < 1000) break;
  }
  return all;
}

const firstBy = <T extends { user_id: string; created_at: string }>(rows: T[], keep: (r: T) => boolean = () => true) => {
  const m = new Map<string, string>();
  for (const r of rows) {
    if (!keep(r)) continue;
    const prev = m.get(r.user_id);
    if (!prev || r.created_at < prev) m.set(r.user_id, r.created_at);
  }
  return m;
};

function sourceOf(meta: Record<string, unknown>): { source: Source; attr: Attribution } {
  const attr = (meta.signup_attribution && typeof meta.signup_attribution === "object" ? meta.signup_attribution : {}) as Attribution;
  const src = String(meta.signup_src ?? attr.src ?? "");
  if (attr.h) return { source: "handoff", attr };
  if (src.startsWith("site_") || attr.utm_source) return { source: "site", attr };
  if (meta.invite_code) return { source: "invite", attr };
  return { source: "direct", attr };
}

export async function fetchFunnelData(w: ResolvedWindow, includeInternal: boolean): Promise<FunnelData | null> {
  if (!supabaseAdmin) return null;

  const [events, handoffs] = await Promise.all([siteEvents(w), handoffRows(w)]);

  // ── site ───────────────────────────────────────────────────────────────
  const visitorDevice = new Map<string, string>();
  const visitorCreative = new Map<string, { content: string; source: string | null; campaign: string | null }>();
  const visitorUntagged = new Map<string, string>(); // first referrer bucket, for visitors with no ad tags
  const ctaUntyped = new Set<string>(); // presses from before the phone/laptop split (2026-11-15)
  const pageviewVisitors = new Set<string>();
  const ctaPhone = new Set<string>();
  const ctaLaptop = new Set<string>();
  const sheetOpened = new Set<string>();
  const emailSent = new Set<string>();
  let deviceTaggedSince: string | null = null;

  for (const e of events) {
    const device = typeof e.metadata?.device === "string" ? e.metadata.device : null;
    if (device) {
      if (!visitorDevice.has(e.visitor_id)) visitorDevice.set(e.visitor_id, device);
      if (!deviceTaggedSince) deviceTaggedSince = e.created_at;
    }
    if (e.utm_content && !visitorCreative.has(e.visitor_id)) {
      visitorCreative.set(e.visitor_id, { content: e.utm_content, source: e.utm_source, campaign: e.utm_campaign });
    }
    if (!visitorUntagged.has(e.visitor_id)) visitorUntagged.set(e.visitor_id, untaggedKey(e.referrer));
    if (e.event_name === "pageview") pageviewVisitors.add(e.visitor_id);
    else if (e.event_name === "cta_click") {
      const dest = e.metadata?.destination;
      if (dest === "handoff") ctaPhone.add(e.visitor_id);
      else if (dest === "app_signup") ctaLaptop.add(e.visitor_id);
      else ctaUntyped.add(e.visitor_id);
    } else if (e.event_name === "handoff_open") sheetOpened.add(e.visitor_id);
    else if (e.event_name === "handoff_success") emailSent.add(e.visitor_id);
  }

  let phoneV = 0, desktopV = 0, untagged = 0;
  pageviewVisitors.forEach((v) => {
    const d = visitorDevice.get(v);
    if (d === "phone") phoneV++;
    else if (d === "desktop") desktopV++;
    else untagged++;
  });

  // ── app ────────────────────────────────────────────────────────────────
  const appConnected = !!supabaseAppAdmin;
  let accounts: (AuthUser & { source: Source; attr: Attribution; internal: boolean })[] = [];
  let tokenAt = new Map<string, string>();
  let integrationAt = new Map<string, string>();
  const eventAt: Record<string, Map<string, string>> = {};
  const subStatus = new Map<string, { status: string | null; customer: string | null }>();

  if (supabaseAppAdmin) {
    const app = supabaseAppAdmin;
    const [users, tokens, integrations, pevents, subs] = await Promise.all([
      authUsers(),
      fetchAll<{ user_id: string; name: string | null; created_at: string }>(
        (from, to) => app.from("agent_tokens").select("user_id, name, created_at").range(from, to),
        "funnel/agent_tokens",
      ),
      fetchAll<{ user_id: string; created_at: string }>(
        (from, to) => app.from("user_integrations").select("user_id, created_at").range(from, to),
        "funnel/user_integrations",
      ),
      fetchAll<{ user_id: string; event_name: string; created_at: string }>(
        (from, to) =>
          app
            .from("product_events")
            .select("user_id, event_name, created_at")
            .in("event_name", ["paywall_view", "checkout_started", "subscription_started"])
            .range(from, to),
        "funnel/product_events",
      ),
      fetchAll<{ user_id: string; status: string | null; stripe_customer_id: string | null }>(
        (from, to) => app.from("subscriptions").select("user_id, status, stripe_customer_id").range(from, to),
        "funnel/subscriptions",
      ),
    ]);

    accounts = users
      .filter((u) => inWindow(u.created_at, w))
      .map((u) => {
        const email = (u.email ?? "").toLowerCase();
        return { ...u, ...sourceOf(u.user_metadata ?? {}), internal: isInternal(email) };
      })
      .filter((u) => includeInternal || !u.internal)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    tokenAt = firstBy(tokens, (t) => !NOT_AN_AI.has((t.name ?? "").trim().toLowerCase()));
    integrationAt = firstBy(integrations);
    for (const name of ["paywall_view", "checkout_started", "subscription_started"]) {
      eventAt[name] = firstBy(pevents, (e) => e.event_name === name);
    }
    for (const s of subs) subStatus.set(s.user_id, { status: s.status, customer: s.stripe_customer_id });
  }

  const reachedOf = (u: (typeof accounts)[number]) => {
    const meta = u.user_metadata ?? {};
    const sub = subStatus.get(u.id);
    return {
      tourStarted: !!meta.firstrun_at,
      tourDone: meta.firstrun_done === true,
      ai: tokenAt.has(u.id),
      tool: integrationAt.has(u.id),
      connected: tokenAt.has(u.id) || integrationAt.has(u.id),
      paywall: eventAt.paywall_view?.has(u.id) ?? false,
      checkout: (eventAt.checkout_started?.has(u.id) ?? false) || !!sub?.customer,
      trial: sub?.status === "trialing",
      paid: sub?.status === "active",
    };
  };

  const count = (pred: (r: ReturnType<typeof reachedOf>) => boolean) => accounts.filter((u) => pred(reachedOf(u))).length;

  const app: Step[] = appConnected
    ? [
        { label: "Account created", n: accounts.length },
        { label: "Tour started", n: count((r) => r.tourStarted), note: "accounts made since the paywall launch" },
        { label: "Tour finished", n: count((r) => r.tourDone) },
        { label: "Saw the paywall", n: count((r) => r.paywall), note: "web, recorded from 2026-11-15" },
        { label: "Started checkout", n: count((r) => r.checkout) },
        { label: "Trial or paying", n: count((r) => r.trial || r.paid), note: `${count((r) => r.paid)} paying · ${count((r) => r.trial)} on a code trial` },
        { label: "AI connected (activated)", n: count((r) => r.ai), note: "Claude, ChatGPT… via MCP; share of accounts", ofFirst: true },
        { label: "Any connection", n: count((r) => r.connected), note: "an AI or a tool; share of accounts", ofFirst: true },
      ]
    : [];
  const activated = count((r) => r.ai);
  const paying = count((r) => r.paid);

  const bySource: Record<Source, number> = { handoff: 0, site: 0, invite: 0, direct: 0 };
  for (const u of accounts) bySource[u.source]++;

  const siteAccounts = accounts.filter((u) => u.source === "site" || u.source === "handoff");
  const unattributed = { siteAccounts: siteAccounts.length, withoutAdTags: siteAccounts.filter((u) => !u.attr.utm_source).length };

  const handoffAccounts = accounts.filter((u) => u.source === "handoff");
  const laptopAccounts = accounts.filter((u) => u.source === "site");

  const phone: Step[] = [
    { label: "Pressed start on a phone", n: ctaPhone.size },
    { label: "Sheet opened", n: sheetOpened.size },
    { label: "Email sent", n: emailSent.size, note: `${handoffs.length} rows in handoff_requests` },
    { label: "Link opened (any device)", n: handoffs.filter((h) => h.opened_at).length },
    { label: "Link opened on a laptop", n: handoffs.filter((h) => h.laptop_opened_at).length },
    { label: "Account created", n: handoffs.filter((h) => h.claimed_at).length, note: `${handoffAccounts.length} accounts carry a link token` },
  ];
  const laptop: Step[] = [
    { label: "Pressed start on a laptop", n: ctaLaptop.size },
    { label: "Account created", n: laptopAccounts.length, note: "site button or ad tags, no link token" },
  ];

  // ── per creative ───────────────────────────────────────────────────────
  const rows = new Map<string, CreativeRow>();
  const row = (key: string | null | undefined, source?: string | null, campaign?: string | null) => {
    // X's ad link field has slipped spaces into pasted links ("first-dat   e-h1"),
    // so a key is the tag with all whitespace removed: one row per ad either way.
    const k = (key ?? "").replace(/\s+/g, "") || NO_TAGS;
    let r = rows.get(k);
    if (!r) {
      r = { key: k, source: source ?? null, campaign: campaign ?? null, visitors: 0, ctaClicks: 0, emails: 0, accounts: 0, activated: 0, paid: 0 };
      rows.set(k, r);
    }
    if (!r.source && source) r.source = source;
    if (!r.campaign && campaign) r.campaign = campaign;
    return r;
  };
  const rowFor = (v: string) => {
    const c = visitorCreative.get(v);
    return c ? row(c.content, c.source, c.campaign) : row(visitorUntagged.get(v) ?? `${NO_TAGS} · direct`);
  };
  pageviewVisitors.forEach((v) => { rowFor(v).visitors++; });
  // The X landing (/x) has its email form inline, with no start button before it,
  // so anyone who sent an email counts as having pressed start.
  new Set([...Array.from(ctaPhone), ...Array.from(ctaLaptop), ...Array.from(ctaUntyped), ...Array.from(emailSent)]).forEach((v) => { rowFor(v).ctaClicks++; });
  for (const h of handoffs) row(h.first_utm_content, h.first_utm_source, h.first_utm_campaign).emails++;
  for (const u of siteAccounts) {
    const r = row(u.attr.utm_content, u.attr.utm_source, u.attr.utm_campaign);
    const reached = reachedOf(u);
    r.accounts++;
    if (reached.ai) r.activated++;
    if (reached.paid) r.paid++;
  }
  const isUntagged = (k: string) => (k.startsWith(NO_TAGS) ? 1 : 0);
  const creatives = Array.from(rows.values()).sort(
    (a, b) => isUntagged(a.key) - isUntagged(b.key) || b.accounts - a.accounts || b.visitors - a.visitors,
  );

  // ── recent accounts (for a hand count) ─────────────────────────────────
  const recent: RecentAccount[] = accounts.slice(0, 25).map((u) => {
    const r = reachedOf(u);
    const reached = r.paid ? "paying" : r.trial ? "trial" : r.checkout ? "checkout" : r.paywall ? "paywall" : r.ai ? "AI connected" : r.tool ? "tool connected" : r.tourDone ? "tour done" : r.tourStarted ? "tour started" : "account";
    return { email: u.email ?? "", createdAt: u.created_at, source: u.source, creative: u.attr.utm_content ?? null, reached, internal: u.internal };
  });

  return {
    window: w,
    includeInternal,
    appConnected,
    deviceTaggedSince,
    site: { visitors: { total: pageviewVisitors.size, phone: phoneV, desktop: desktopV, untagged }, phone, laptop, ctaUntyped: ctaUntyped.size },
    app,
    totals: { accounts: accounts.length, activated, paying },
    bySource,
    unattributed,
    creatives,
    recent,
  };
}
