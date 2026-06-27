import crypto from "crypto";

// ============================================================================
// Instagram comment → DM automation helpers
//
// Official Meta/Instagram Graph API ONLY. No scraping, no browser automation,
// no unofficial endpoints, no Instagram passwords. Everything here is driven by
// environment variables — no secrets are ever hard-coded.
//
// Pure functions (signature verification, keyword matching, message building)
// live here so they can be reasoned about and tested in isolation. The webhook
// route (src/app/api/instagram/webhook/route.ts) stays thin.
// ============================================================================

// ── Configuration ──────────────────────────────────────────────────────────

export interface InstagramConfig {
  appSecret: string;
  verifyToken: string;
  accessToken: string;
  igUserId: string;
  graphApiBase: string;
  graphApiVersion: string;
  triggerKeyword: string;
  waitlistUrl: string;
  dmMessageTemplate: string | null;
  replyMode: "private_reply" | "public_reply" | "both";
  publicReplyText: string | null;
}

/**
 * Dry-run is ENABLED BY DEFAULT. The only way to actually send real DMs is to
 * explicitly set INSTAGRAM_DRY_RUN to one of the falsey strings below. Anything
 * else — unset, empty, "true", "1", "yes", garbage — keeps us in dry-run.
 *
 * This is intentionally fail-safe: a misconfiguration can never cause a real
 * message to be sent.
 */
export function isDryRun(): boolean {
  const raw = (process.env.INSTAGRAM_DRY_RUN ?? "").trim().toLowerCase();
  const explicitlyLive = raw === "false" || raw === "0" || raw === "no" || raw === "off";
  return !explicitlyLive;
}

export function getInstagramConfig(): InstagramConfig {
  return {
    appSecret: process.env.INSTAGRAM_APP_SECRET ?? "",
    verifyToken: process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "",
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
    igUserId: process.env.INSTAGRAM_IG_USER_ID ?? "",
    graphApiBase: process.env.INSTAGRAM_GRAPH_API_BASE ?? "https://graph.facebook.com",
    graphApiVersion: process.env.INSTAGRAM_GRAPH_API_VERSION ?? "v21.0",
    triggerKeyword: (process.env.INSTAGRAM_TRIGGER_KEYWORD ?? "ALPHA").trim(),
    waitlistUrl: process.env.INSTAGRAM_WAITLIST_URL ?? "https://xyra.dev",
    dmMessageTemplate: process.env.INSTAGRAM_DM_MESSAGE?.trim() || null,
    replyMode:
      (process.env.INSTAGRAM_REPLY_MODE as InstagramConfig["replyMode"]) || "private_reply",
    publicReplyText: process.env.INSTAGRAM_PUBLIC_REPLY_TEXT?.trim() || null,
  };
}

// ── Signature verification (X-Hub-Signature-256) ─────────────────────────────

/**
 * Verify Meta's `X-Hub-Signature-256` header. Meta signs the *raw* request body
 * with HMAC-SHA256 keyed by the app secret. We must compare against the exact
 * bytes we received — re-serializing parsed JSON would change the bytes and
 * break the check.
 *
 * Returns false on any malformed input rather than throwing, so the route can
 * treat "could not verify" and "did not match" identically (→ 401).
 */
export function verifyInstagramSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!appSecret || !signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;

  const expected = signatureHeader.slice("sha256=".length).trim();
  const computed = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  // Timing-safe compare; bail if lengths differ (timingSafeEqual throws on
  // mismatched buffer lengths).
  const expectedBuf = Buffer.from(expected, "hex");
  const computedBuf = Buffer.from(computed, "hex");
  if (expectedBuf.length !== computedBuf.length || expectedBuf.length === 0) return false;

  return crypto.timingSafeEqual(expectedBuf, computedBuf);
}

// ── Keyword matching ─────────────────────────────────────────────────────────

/**
 * Does this comment contain the trigger keyword? Case-insensitive, matched as a
 * whole word so "ALPHA" fires but "alphabet" does not. Punctuation around the
 * word (e.g. "ALPHA!", "@you ALPHA") still matches.
 */
export function matchesTriggerKeyword(text: string | null | undefined, keyword: string): boolean {
  if (!text || !keyword) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  return re.test(text);
}

// ── Message building ─────────────────────────────────────────────────────────

/**
 * Build the waitlist URL for a DM, adding per-post attribution.
 *
 * When the webhook event carries a media_id (the post/Reel/ad the comment was
 * on), we set `utm_content=ig_media_<media_id>` so signups can be attributed to
 * the exact post that drove them. ALL other existing params in
 * INSTAGRAM_WAITLIST_URL (utm_source, utm_medium, utm_campaign, etc.) are
 * preserved. Only media_id is used — never the commenter's id or username, so no
 * personal identifier ever ends up in the URL.
 *
 * `utm_content` is reserved for this per-post value: if the base URL already has
 * a `utm_content`, it is replaced with the media-specific one (that's the whole
 * point of per-post attribution). With no media_id, the base URL is returned
 * unchanged.
 */
export function buildWaitlistUrl(baseUrl: string, mediaId: string | null | undefined): string {
  if (!mediaId) return baseUrl;
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_content", `ig_media_${mediaId}`);
    return url.toString();
  } catch {
    // baseUrl isn't a valid absolute URL — fall back to a manual append that
    // still preserves whatever query string is already there.
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}utm_content=ig_media_${encodeURIComponent(mediaId)}`;
  }
}

/**
 * The DM body sent to a commenter. Supports a {url} placeholder in
 * INSTAGRAM_DM_MESSAGE; if no template is set, falls back to a sensible default
 * that explains the waitlist + referral mechanic.
 *
 * When `mediaId` is provided, the waitlist link carries per-post attribution
 * (see buildWaitlistUrl). Only media_id is used for attribution — never any
 * commenter identifier.
 */
export function buildDmMessage(config: InstagramConfig, mediaId: string | null = null): string {
  const url = buildWaitlistUrl(config.waitlistUrl, mediaId);
  if (config.dmMessageTemplate) {
    return config.dmMessageTemplate.replace(/\{url\}/g, url);
  }
  return [
    "Thanks for commenting! 🎉 Here's your Xyra waitlist link:",
    url,
    "",
    "Join the waitlist and you'll get your own unique referral link. Every friend you refer moves you up the list — so you get alpha access sooner. See you inside ✨",
  ].join("\n");
}

// ── Webhook payload parsing ──────────────────────────────────────────────────

export interface ParsedComment {
  commentId: string;
  mediaId: string | null;
  fromId: string | null;
  fromUsername: string | null;
  text: string | null;
}

interface IgCommentValue {
  id?: unknown;
  text?: unknown;
  from?: { id?: unknown; username?: unknown } | null;
  media?: { id?: unknown } | null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Pull every `comments`-field change out of a webhook payload into a flat list
 * of comments. Defensive against missing/oddly-shaped fields — anything we
 * can't read becomes null, and entries without a comment id are dropped.
 */
export function parseCommentEvents(payload: unknown): ParsedComment[] {
  const out: ParsedComment[] = [];
  if (!payload || typeof payload !== "object") return out;

  const body = payload as { object?: unknown; entry?: unknown };
  if (body.object !== "instagram") return out;
  if (!Array.isArray(body.entry)) return out;

  for (const entry of body.entry) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const c = change as { field?: unknown; value?: unknown };
      if (c.field !== "comments") continue;

      const value = (c.value ?? {}) as IgCommentValue;
      const commentId = asString(value.id);
      if (!commentId) continue;

      out.push({
        commentId,
        mediaId: asString(value.media?.id),
        fromId: asString(value.from?.id),
        fromUsername: asString(value.from?.username),
        text: asString(value.text),
      });
    }
  }

  return out;
}

// ── Graph API calls ──────────────────────────────────────────────────────────

export interface SendResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * Send a PRIVATE REPLY to a comment — the official comment→DM mechanism. This
 * opens a 1:1 DM thread with the commenter seeded by our message. Requires the
 * `instagram_manage_messages` permission and an approved app in Live mode for
 * public (non-tester) commenters.
 *
 * Endpoint: POST /{ig-user-id}/messages
 *   body: { recipient: { comment_id }, message: { text } }
 *
 * Callers must guarantee this is only invoked when NOT in dry-run mode.
 */
export async function sendInstagramPrivateReply(
  config: InstagramConfig,
  commentId: string,
  message: string
): Promise<SendResult> {
  const url = `${config.graphApiBase}/${config.graphApiVersion}/${config.igUserId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: message },
    }),
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Optional PUBLIC reply under the comment (visible to everyone). Off by default;
 * only used when INSTAGRAM_REPLY_MODE includes public replies and
 * INSTAGRAM_PUBLIC_REPLY_TEXT is set. Requires `instagram_manage_comments`.
 *
 * Endpoint: POST /{comment-id}/replies  body: { message }
 */
export async function sendInstagramPublicReply(
  config: InstagramConfig,
  commentId: string,
  message: string
): Promise<SendResult> {
  const url = `${config.graphApiBase}/${config.graphApiVersion}/${commentId}/replies`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({ message }),
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}
