// Shared between /api/waitlist and /api/alpha-apply — both create waitlist
// rows, so the ref-code, first-touch, and referral-credit logic lives once.

import type { SupabaseClient } from "@supabase/supabase-js";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function clipStr(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

type IncomingFirstTouch = {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  referrer?: unknown;
  landing_page?: unknown;
  ref_code?: unknown;
};

export function pickFirstTouch(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const ft = raw as IncomingFirstTouch;
  return {
    first_utm_source: clipStr(ft.utm_source, 128),
    first_utm_medium: clipStr(ft.utm_medium, 128),
    first_utm_campaign: clipStr(ft.utm_campaign, 128),
    first_utm_content: clipStr(ft.utm_content, 128),
    first_referrer: clipStr(ft.referrer, 512),
    first_landing_page: clipStr(ft.landing_page, 512),
    first_ref_code: clipStr(ft.ref_code, 64),
  };
}

export function generateRefCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** A visitor_id is only kept when it's a well-formed UUID. */
export function safeVisitorId(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

/** Bump the referrer's referral_count when a new signup names their ref_code. */
export async function creditReferrer(client: SupabaseClient, refCode: string | null) {
  if (!refCode) return;
  const { data: referrer } = await client
    .from("waitlist")
    .select("referral_count")
    .eq("ref_code", refCode)
    .maybeSingle();
  if (referrer) {
    await client
      .from("waitlist")
      .update({ referral_count: (referrer.referral_count || 0) + 1 })
      .eq("ref_code", refCode);
  }
}
