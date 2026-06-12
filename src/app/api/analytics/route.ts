import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Always return 204 on success/expected failure so sendBeacon doesn't retry
// and the browser never sees a noisy response. Only real server errors return 5xx.

const ALLOWED_EVENTS = new Set([
  "pageview",
  "cta_click",
  "section_view",
  "feature_card_click",
  "scroll_depth",
  "waitlist_view",
  "waitlist_email_submit",
  "waitlist_email_success",
  "waitlist_email_duplicate",
  "waitlist_survey_submit",
  "waitlist_survey_skip",
  "waitlist_done_view",
  "ref_link_visit",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_PATH = 512;
const MAX_REFERRER = 512;
const MAX_UTM = 128;
const MAX_EVENT = 64;
const MAX_METADATA_KEYS = 16;
const MAX_METADATA_VALUE = 256;
const MAX_BODY_BYTES = 4 * 1024;

function clipString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function sanitizeMetadata(raw: unknown): Record<string, string | number | boolean | null> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (typeof k !== "string" || k.length === 0 || k.length > 64) continue;
    if (v === null) {
      out[k] = null;
    } else if (typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = v.slice(0, MAX_METADATA_VALUE);
    } else {
      continue;
    }
    count += 1;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function POST(request: Request) {
  try {
    if (!supabase) {
      // Service not configured — silently accept so the client doesn't spam logs.
      return new NextResponse(null, { status: 204 });
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return new NextResponse(null, { status: 204 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new NextResponse(null, { status: 204 });
    }

    if (!body || typeof body !== "object") {
      return new NextResponse(null, { status: 204 });
    }

    const b = body as Record<string, unknown>;

    const visitor_id = typeof b.visitor_id === "string" ? b.visitor_id : "";
    const session_id = typeof b.session_id === "string" ? b.session_id : "";
    const event_name = clipString(b.event_name, MAX_EVENT);

    if (!UUID_RE.test(visitor_id)) {
      return new NextResponse(null, { status: 204 });
    }
    if (!UUID_RE.test(session_id)) {
      return new NextResponse(null, { status: 204 });
    }
    if (!event_name || !ALLOWED_EVENTS.has(event_name)) {
      return new NextResponse(null, { status: 204 });
    }

    const row = {
      visitor_id,
      session_id,
      event_name,
      path: clipString(b.path, MAX_PATH),
      referrer: clipString(b.referrer, MAX_REFERRER),
      utm_source: clipString(b.utm_source, MAX_UTM),
      utm_medium: clipString(b.utm_medium, MAX_UTM),
      utm_campaign: clipString(b.utm_campaign, MAX_UTM),
      utm_content: clipString(b.utm_content, MAX_UTM),
      metadata: sanitizeMetadata(b.metadata),
    };

    const { error } = await supabase.from("analytics_events").insert(row);

    if (error) {
      // Log but don't surface to the client — keeps sendBeacon clean.
      console.error("analytics insert error:", error.message);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("analytics route error:", err);
    return new NextResponse(null, { status: 204 });
  }
}
