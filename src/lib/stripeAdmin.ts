// Server-only, read-only Stripe client for the admin Revenue tab.
//
// Plain fetch against the REST API (no SDK dependency). Uses its OWN restricted
// key, never the app's edge-function key:
//
//   STRIPE_ADMIN_KEY – rk_live_… restricted key, READ on Charges, Balance
//                      transactions, Customers, Subscriptions, Coupons, Invoices
//
// The API version is pinned to the account's basil generation so response
// shapes don't drift if the account default is upgraded (basil keeps
// current_period_end on subscription ITEMS and discounts as an array).
//
// Never import this in a client component.

const STRIPE_API = process.env.STRIPE_API_BASE || "https://api.stripe.com/v1"; // override only for local mocks
const STRIPE_VERSION = "2025-07-30.basil";
const key = process.env.STRIPE_ADMIN_KEY || "";

export const isStripeConfigured = key.length > 0;

/** Live keys link to the live dashboard, test keys to /test. */
export const stripeDashboardBase = key.includes("_test_")
  ? "https://dashboard.stripe.com/test"
  : "https://dashboard.stripe.com";

export class StripeAdminError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Params = Record<string, string | number | string[] | undefined>;

function toQuery(params: Params): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(`${k}[]`, x));
    else q.append(k, String(v));
  }
  return q.toString();
}

async function stripeGet<T>(path: string, params: Params): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}?${toQuery(params)}`, {
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message ?? `Stripe ${res.status}`;
    throw new StripeAdminError(`${path}: ${msg}`, res.status);
  }
  return body as T;
}

/**
 * Pages a Stripe list endpoint to the end (or maxPages × 100 rows). Xyra's
 * volume is tiny; the cap only exists so a runaway account can't hang the page.
 */
export async function stripeListAll<T extends { id: string }>(
  path: string,
  params: Params = {},
  maxPages = 30,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await stripeGet<{ data: T[]; has_more: boolean }>(path, {
      ...params,
      limit: 100,
      starting_after: startingAfter,
    });
    rows.push(...res.data);
    if (!res.has_more || res.data.length === 0) return { rows, truncated: false };
    startingAfter = res.data[res.data.length - 1].id;
  }
  return { rows, truncated: true };
}
