import { NextResponse } from "next/server";
import {
  getInstagramConfig,
  isDryRun,
  matchesTriggerKeyword,
  buildDmMessage,
} from "@/lib/instagram";

// Node runtime to match the webhook route; not strictly required here but keeps
// behavior identical.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// Dry-run-only preview endpoint. This NEVER calls the Graph API and NEVER sends
// a message — no matter what INSTAGRAM_DRY_RUN is set to. It exists so you can
// sanity-check the keyword matching + DM copy without a signed Meta payload.
//
// Protected by the same CRON_SECRET pattern used elsewhere in this repo so it
// isn't a public endpoint.
//
// Usage:
//   GET  /api/instagram/test?secret=...&text=I%20want%20ALPHA&media=17900000000000000
//   POST /api/instagram/test   (Authorization: Bearer <CRON_SECRET>)
//        { "text": "ALPHA please", "media": "17900000000000000" }
//
// The optional `media` param previews the per-post attribution: when present,
// the waitlist link gains utm_content=ig_media_<media>.
// ────────────────────────────────────────────────────────────────────────────

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

function preview(text: string | null, mediaId: string | null) {
  const config = getInstagramConfig();
  const matched = matchesTriggerKeyword(text, config.triggerKeyword);
  return {
    note: "This endpoint never sends. It only previews what the webhook WOULD do.",
    globalDryRun: isDryRun(),
    triggerKeyword: config.triggerKeyword,
    replyMode: config.replyMode,
    waitlistUrl: config.waitlistUrl,
    input: { text, mediaId },
    matched,
    wouldSend: matched,
    messageThatWouldBeSent: matched ? buildDmMessage(config, mediaId) : null,
  };
}

export async function GET(request: Request) {
  if (!authOk(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  return NextResponse.json(
    preview(url.searchParams.get("text"), url.searchParams.get("media"))
  );
}

export async function POST(request: Request) {
  if (!authOk(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let text: string | null = null;
  let mediaId: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.text === "string") text = body.text;
    if (typeof body?.media === "string") mediaId = body.media;
  } catch {
    /* empty / non-JSON body → text/media stay null */
  }
  return NextResponse.json(preview(text, mediaId));
}
