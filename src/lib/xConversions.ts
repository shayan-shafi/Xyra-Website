// Server-side X (Twitter) Conversion API. Called from /api/waitlist and
// /api/alpha-apply once the signup row is written. Never call this from the
// browser: it carries X_PIXEL_TOKEN.
//
// Only sends when the browser said ad measurement is allowed (body.x.allowed,
// see getXAttribution in src/lib/analytics.ts), the token is set, and the
// event ID for that kind is configured. It never throws and gives up after
// 3s, so a slow or broken X API can't fail a signup.

import { createHash, randomUUID } from "crypto";
import { UUID_RE, clipStr } from "@/lib/waitlistShared";
import { X_EVENT_IDS, X_PIXEL_ID, type XConversionKind } from "@/lib/analytics";

const ENDPOINT = `https://ads-api.x.com/12/measurement/conversions/${X_PIXEL_ID}`;
const TIMEOUT_MS = 3000;

type IncomingX = { allowed?: unknown; conversion_id?: unknown; twclid?: unknown };

type Identifier = {
  twclid?: string;
  hashed_email?: string;
  ip_address?: string;
  user_agent?: string;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** X wants trimmed, lowercased email, SHA-256 as hex. */
export function hashEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase());
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || null;
}

export async function sendXConversion(opts: {
  kind: XConversionKind;
  request: Request;
  email: string;
  x: unknown;
}): Promise<void> {
  try {
    const token = process.env.X_PIXEL_TOKEN;
    const eventId = X_EVENT_IDS[opts.kind];
    const x = (opts.x && typeof opts.x === "object" ? opts.x : {}) as IncomingX;
    if (!token || !eventId || x.allowed !== true) return;

    // Same id the browser pixel fired with, so X dedupes the pair.
    const conversionId =
      typeof x.conversion_id === "string" && UUID_RE.test(x.conversion_id)
        ? x.conversion_id
        : randomUUID();

    const identifier: Identifier = { hashed_email: hashEmail(opts.email) };
    const twclid = clipStr(x.twclid, 512);
    if (twclid) identifier.twclid = twclid;
    const ip = clientIp(opts.request);
    const ua = clipStr(opts.request.headers.get("user-agent"), 512);
    if (ip && ua) {
      identifier.ip_address = ip;
      identifier.user_agent = ua;
    }

    const conversion: Record<string, unknown> = {
      conversion_time: new Date().toISOString(),
      event_id: eventId,
      conversion_id: conversionId,
      identifiers: [identifier],
    };
    const sourceUrl = clipStr(opts.request.headers.get("referer"), 2048);
    if (sourceUrl) conversion.event_source_url = sourceUrl;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "X-Pixel-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ conversions: [conversion] }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`X conversion (${opts.kind}) failed: ${res.status} ${text.slice(0, 500)}`);
    }
  } catch (err) {
    console.error(`X conversion (${opts.kind}) error:`, err);
  }
}
