import { isStripeConfigured, stripeDashboardBase, stripeListAll } from "@/lib/stripeAdmin";

// Data layer for the admin Revenue tab. Reads Stripe directly (read-only key).
//
// Definitions (the same ones Stripe's own billing dashboard uses):
//   MRR        – every active or past_due subscription, item prices normalised
//                to one month (yearly ÷ 12, weekly × 52/12 …), minus its
//                coupons. Trials don't count until they convert; XYRAFRIEND
//                (100% off forever) subscriptions count as $0.
//   Revenue    – succeeded charges. Refunds and Stripe fees are subtracted for
//                net. Charges are the money that actually moved.
//   Churn      – subscriptions that ENDED inside the window, valued at what
//                they were paying.
//
// The MRR trend is reconstructed from each subscription's start / trial end /
// end dates at its CURRENT price and coupons. Stripe keeps no history of past
// MRR, so a plan or coupon change shows up as if it had always applied.

const DAY = 86_400_000;
const TZ = "America/Chicago";

export const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"];

export type TxnStatus = "paid" | "refunded" | "partial" | "failed" | "disputed" | "pending";

export type RevenueTxn = {
  id: string;
  created: number; // epoch ms
  email: string | null;
  description: string | null;
  amount: number; // cents
  refunded: number;
  fee: number;
  net: number; // amount − refunded − fee (0 for failed)
  currency: string;
  status: TxnStatus;
  failure: string | null;
  url: string;
};

export type RevenueSub = {
  id: string;
  email: string | null;
  status: string;
  listMonthly: number; // cents, before coupons
  monthly: number; // cents, what counts toward MRR
  coupon: string | null;
  started: number;
  trialEnd: number | null;
  endedAt: number | null;
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  url: string;
};

export type Totals = { gross: number; refunds: number; fees: number; net: number; paidCount: number; failedCount: number };

export type RevenueData = {
  generatedAt: number;
  range: RangeKey;
  windowStart: number;
  currency: string;
  mrr: number;
  arr: number;
  arpu: number;
  counts: { paying: number; free: number; trialing: number; pastDue: number; canceling: number };
  window: Totals & { newSubs: number; newMrr: number; churned: number; churnedMrr: number };
  allTime: Totals;
  mrrSeries: { date: string; mrr: number }[];
  monthly: { month: string; gross: number; refunds: number; net: number }[];
  txns: RevenueTxn[];
  subs: RevenueSub[];
  warnings: string[];
};

// ── helpers ────────────────────────────────────────────────────────────────

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
export const dayKey = (ms: number) => dayFmt.format(new Date(ms)); // YYYY-MM-DD
const sec = (v: unknown) => (typeof v === "number" ? v * 1000 : null);

function monthlyFactor(interval: string | undefined, count: number | undefined): number {
  const c = count && count > 0 ? count : 1;
  switch (interval) {
    case "day": return 365 / 12 / c;
    case "week": return 52 / 12 / c;
    case "year": return 1 / (12 * c);
    default: return 1 / c; // month
  }
}

// basil inlines the coupon on the discount; clover moved it to source.coupon.
function couponOf(d: any): any | null {
  if (!d || typeof d !== "object") return null;
  const c = d.coupon ?? d.source?.coupon;
  return c && typeof c === "object" ? c : null;
}

function emailOf(customer: any, fallback?: string | null): string | null {
  if (customer && typeof customer === "object" && !customer.deleted) return customer.email ?? customer.name ?? fallback ?? null;
  return fallback ?? null;
}

const emptyTotals = (): Totals => ({ gross: 0, refunds: 0, fees: 0, net: 0, paidCount: 0, failedCount: 0 });

function addTxn(t: Totals, x: RevenueTxn) {
  if (x.status === "failed") { t.failedCount++; return; }
  if (x.status === "pending") return;
  t.gross += x.amount;
  t.refunds += x.refunded;
  t.fees += x.fee;
  t.net += x.net;
  t.paidCount++;
}

// ── fetch + reduce ─────────────────────────────────────────────────────────

export async function fetchRevenueData(range: RangeKey): Promise<RevenueData | null> {
  if (!isStripeConfigured) return null;
  const now = Date.now();
  const warnings: string[] = [];

  const [charges, subscriptions] = await Promise.all([
    stripeListAll<any>("/charges", { expand: ["data.balance_transaction", "data.customer"] }),
    stripeListAll<any>("/subscriptions", { status: "all", expand: ["data.customer", "data.discounts"] }),
  ]);
  if (charges.truncated) warnings.push("More than 3,000 charges: only the newest 3,000 are counted.");
  if (subscriptions.truncated) warnings.push("More than 3,000 subscriptions: only the newest 3,000 are counted.");

  // Dominant currency; anything else is listed but kept out of the totals.
  const currencyCount = new Map<string, number>();
  for (const c of charges.rows) currencyCount.set(c.currency, (currencyCount.get(c.currency) ?? 0) + 1);
  const currency = Array.from(currencyCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "usd";
  if (currencyCount.size > 1) warnings.push(`Charges in ${currencyCount.size} currencies; totals only count ${currency.toUpperCase()}.`);

  // ── transactions
  const txns: RevenueTxn[] = charges.rows.map((c) => {
    const bt = c.balance_transaction && typeof c.balance_transaction === "object" ? c.balance_transaction : null;
    const refunded = c.amount_refunded ?? 0;
    let status: TxnStatus;
    if (c.status === "failed") status = "failed";
    else if (c.status === "pending") status = "pending";
    else if (c.disputed) status = "disputed";
    else if (c.refunded || (refunded > 0 && refunded >= c.amount)) status = "refunded";
    else if (refunded > 0) status = "partial";
    else status = "paid";
    const fee = status === "failed" ? 0 : bt?.fee ?? 0;
    const amount: number = c.amount;
    return {
      id: c.id,
      created: c.created * 1000,
      email: emailOf(c.customer, c.billing_details?.email ?? c.receipt_email ?? null),
      description: c.description ?? null,
      amount,
      refunded,
      fee,
      net: status === "failed" || status === "pending" ? 0 : amount - refunded - fee,
      currency: c.currency,
      status,
      failure: c.failure_message ?? c.outcome?.seller_message ?? null,
      url: `${stripeDashboardBase}/payments/${c.payment_intent ?? c.id}`,
    };
  });

  const windowDays = RANGES.find((r) => r.key === range)?.days ?? null;
  const earliest = Math.min(
    now,
    ...txns.map((t) => t.created),
    ...subscriptions.rows.map((s) => s.start_date * 1000),
  );
  const windowStart = windowDays ? now - windowDays * DAY : earliest;

  const allTime = emptyTotals();
  const win = { ...emptyTotals(), newSubs: 0, newMrr: 0, churned: 0, churnedMrr: 0 };
  for (const t of txns) {
    if (t.currency !== currency) continue;
    addTxn(allTime, t);
    if (t.created >= windowStart) addTxn(win, t);
  }

  // ── subscriptions
  const subs: RevenueSub[] = subscriptions.rows
    .filter((s) => s.status !== "incomplete" && s.status !== "incomplete_expired")
    .map((s) => {
      const items: any[] = s.items?.data ?? [];
      let listMonthly = 0;
      for (const it of items) {
        const p = it.price ?? it.plan;
        const unit = typeof p?.unit_amount === "number" ? p.unit_amount : Number(p?.unit_amount_decimal ?? NaN);
        if (!Number.isFinite(unit)) { warnings.push(`${s.id}: tiered/metered price, left out of MRR.`); continue; }
        listMonthly += unit * (it.quantity ?? 1) * monthlyFactor(p?.recurring?.interval ?? p?.interval, p?.recurring?.interval_count ?? p?.interval_count);
      }
      const first = items[0]?.price ?? items[0]?.plan;
      const interval = first?.recurring?.interval ?? first?.interval;
      const intervalCount = first?.recurring?.interval_count ?? first?.interval_count;

      const discounts = [s.discount, ...(Array.isArray(s.discounts) ? s.discounts : [])].filter(
        (d) => d && typeof d === "object" && !(typeof d.end === "number" && d.end * 1000 < now),
      );
      let monthly = listMonthly;
      const labels: string[] = [];
      const seen = new Set<string>();
      for (const d of discounts) {
        const c = couponOf(d);
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        if (typeof c.percent_off === "number") {
          monthly *= 1 - c.percent_off / 100;
          labels.push(`${c.name ?? c.id} · ${c.percent_off}% off`);
        } else if (typeof c.amount_off === "number") {
          monthly -= c.amount_off * monthlyFactor(interval, intervalCount);
          labels.push(`${c.name ?? c.id} · ${(c.amount_off / 100).toFixed(2)} off`);
        }
      }
      if (discounts.length > 0 && seen.size === 0) warnings.push(`${s.id}: coupon not readable (add Coupons: Read to the key).`);
      monthly = Math.max(0, Math.round(monthly));

      const periodEnd = sec(s.current_period_end) ?? sec(items[0]?.current_period_end);
      return {
        id: s.id,
        email: emailOf(s.customer),
        status: s.status,
        listMonthly: Math.round(listMonthly),
        monthly,
        coupon: labels.length ? labels.join(", ") : null,
        started: s.start_date * 1000,
        trialEnd: sec(s.trial_end),
        endedAt: sec(s.ended_at) ?? (s.status === "canceled" ? sec(s.canceled_at) : null),
        renewsAt: s.status === "canceled" ? null : periodEnd,
        cancelAtPeriodEnd: !!s.cancel_at_period_end || typeof s.cancel_at === "number",
        url: `${stripeDashboardBase}/subscriptions/${s.id}`,
      };
    })
    .sort((a, b) => b.started - a.started);

  const counting = (s: RevenueSub) => s.status === "active" || s.status === "past_due";
  const live = subs.filter(counting);
  const mrr = live.reduce((n, s) => n + s.monthly, 0);
  const paying = live.filter((s) => s.monthly > 0).length;
  const counts = {
    paying,
    free: live.filter((s) => s.monthly === 0).length,
    trialing: subs.filter((s) => s.status === "trialing").length,
    pastDue: subs.filter((s) => s.status === "past_due").length,
    canceling: live.filter((s) => s.cancelAtPeriodEnd).length,
  };

  // When did a sub start paying? After its trial, if it had one.
  const payingFrom = (s: RevenueSub) => Math.max(s.started, s.trialEnd ?? 0);
  for (const s of subs) {
    if (s.monthly === 0) continue;
    const from = payingFrom(s);
    const converted = s.endedAt === null || s.endedAt > from;
    if (converted && from >= windowStart && from <= now) { win.newSubs++; win.newMrr += s.monthly; }
    if (s.endedAt !== null && s.endedAt >= windowStart && converted) { win.churned++; win.churnedMrr += s.monthly; }
  }

  // ── MRR trend (daily, reconstructed)
  const mrrSeries: { date: string; mrr: number }[] = [];
  const step = (now - windowStart) / DAY > 400 ? 7 * DAY : DAY; // weekly points past ~13 months
  for (let t = windowStart; t <= now + 1; t += step) {
    const end = Math.min(t + step - 1, now);
    let v = 0;
    for (const s of subs) {
      if (s.monthly === 0) continue;
      if (payingFrom(s) <= end && (s.endedAt === null || s.endedAt > end)) v += s.monthly;
    }
    mrrSeries.push({ date: dayKey(end), mrr: v });
  }

  // ── revenue by month (always the last 12 months, independent of the range)
  const months: string[] = [];
  const cursor = new Date(dayKey(now).slice(0, 7) + "-15T12:00:00Z");
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 15));
    months.push(d.toISOString().slice(0, 7));
  }
  const monthMap = new Map(months.map((m) => [m, { month: m, gross: 0, refunds: 0, net: 0 }]));
  for (const t of txns) {
    if (t.currency !== currency || t.status === "failed" || t.status === "pending") continue;
    const m = monthMap.get(dayKey(t.created).slice(0, 7));
    if (!m) continue;
    m.gross += t.amount;
    m.refunds += t.refunded;
    m.net += t.net;
  }

  return {
    generatedAt: now,
    range,
    windowStart,
    currency,
    mrr,
    arr: mrr * 12,
    arpu: paying ? Math.round(mrr / paying) : 0,
    counts,
    window: win,
    allTime,
    mrrSeries,
    monthly: Array.from(monthMap.values()),
    txns: txns.filter((t) => t.created >= windowStart).sort((a, b) => b.created - a.created),
    subs,
    warnings: Array.from(new Set(warnings)),
  };
}
