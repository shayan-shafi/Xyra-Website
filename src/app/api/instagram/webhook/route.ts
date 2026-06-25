import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getInstagramConfig,
  isDryRun,
  verifyInstagramSignature,
  matchesTriggerKeyword,
  buildDmMessage,
  parseCommentEvents,
  sendInstagramPrivateReply,
  sendInstagramPublicReply,
  type InstagramConfig,
  type ParsedComment,
} from "@/lib/instagram";

// Needs the Node runtime: uses `crypto` (HMAC signature check) and the Supabase
// service-role client. Never run this on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────────────────────
// GET — Meta webhook verification handshake.
//
// When you subscribe the webhook in the Meta dashboard, Meta calls this URL with
// hub.mode=subscribe, hub.verify_token=<your token>, hub.challenge=<random>.
// We must echo back the challenge verbatim (as plain text) IFF the token matches
// what we configured. Otherwise 403.
// ────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const { verifyToken } = getInstagramConfig();

  if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ────────────────────────────────────────────────────────────────────────────
// POST — incoming webhook events (we subscribe to the `comments` field).
//
// Flow per request:
//   1. Verify X-Hub-Signature-256 against the app secret (reject if bad).
//   2. Parse out every comment in the payload.
//   3. For each comment: skip our own comments, claim+dedupe in Supabase,
//      keyword-match, then (dry-run) log only or (live) send a private reply.
//
// We always return 200 once the signature is valid so Meta doesn't hammer us
// with retries — dedupe protects us from any retries that do happen.
// ────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const config = getInstagramConfig();
  const dryRun = isDryRun();

  // Read the RAW body — signature verification must run against the exact bytes
  // Meta signed, not a re-serialized object.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  // If no app secret is configured we cannot verify anything. Refuse rather than
  // process unauthenticated input. (Local testing without a secret is documented
  // in the testing guide via the dedicated dry-run test endpoint, not here.)
  if (!config.appSecret) {
    console.error("[ig-webhook] INSTAGRAM_APP_SECRET not set — refusing unverified webhook.");
    return new NextResponse("Webhook not configured", { status: 401 });
  }

  if (!verifyInstagramSignature(rawBody, signature, config.appSecret)) {
    console.warn("[ig-webhook] Invalid X-Hub-Signature-256 — rejecting.");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Signature was valid but body isn't JSON — ack so Meta stops retrying.
    console.warn("[ig-webhook] Could not parse JSON body.");
    return NextResponse.json({ ok: true });
  }

  const comments = parseCommentEvents(payload);
  const results: Array<Record<string, unknown>> = [];

  for (const comment of comments) {
    try {
      const result = await processComment(comment, config, dryRun, payload);
      results.push({ commentId: comment.commentId, ...result });
    } catch (err) {
      console.error("[ig-webhook] Error processing comment", comment.commentId, err);
      results.push({ commentId: comment.commentId, status: "error" });
    }
  }

  console.log(
    `[ig-webhook] dryRun=${dryRun} processed=${results.length}`,
    JSON.stringify(results)
  );

  return NextResponse.json({ ok: true, dryRun, processed: results });
}

// ── Per-comment processing ───────────────────────────────────────────────────

type ProcessStatus =
  | "skipped_self"
  | "duplicate"
  | "skipped_no_match"
  | "dry_run"
  | "sent"
  | "failed"
  | "no_dedupe_store";

async function processComment(
  comment: ParsedComment,
  config: InstagramConfig,
  dryRun: boolean,
  rawEvent: unknown
): Promise<{ status: ProcessStatus; matched?: boolean }> {
  // 1. Ignore comments made by our own account (prevents reply loops).
  if (comment.fromId && config.igUserId && comment.fromId === config.igUserId) {
    return { status: "skipped_self" };
  }

  const matched = matchesTriggerKeyword(comment.text, config.triggerKeyword);

  // Without the service-role client we cannot dedupe safely. Fail closed: log
  // and DO NOT send, so we can never double-send without a dedupe store.
  if (!supabaseAdmin) {
    console.warn(
      `[ig-webhook] No SUPABASE_SERVICE_ROLE_KEY — cannot dedupe. comment=${comment.commentId} matched=${matched} (not sending).`
    );
    return { status: "no_dedupe_store", matched };
  }

  // 2. Claim the comment by inserting a row keyed on the UNIQUE comment_id.
  //    A 23505 unique-violation means we've already seen this comment → dedupe.
  const { error: claimError } = await supabaseAdmin
    .from("instagram_comment_events")
    .insert({
      comment_id: comment.commentId,
      media_id: comment.mediaId,
      commenter_id: comment.fromId,
      commenter_username: comment.fromUsername,
      comment_text: comment.text,
      matched_keyword: matched,
      reply_status: matched ? "pending" : "skipped_no_match",
      dry_run: dryRun,
      raw_event: rawEvent as object,
    })
    .select("id")
    .single();

  if (claimError) {
    if (claimError.code === "23505") return { status: "duplicate", matched };
    console.error("[ig-webhook] Failed to claim comment:", claimError.message);
    throw new Error(claimError.message);
  }

  // 3. Not a trigger comment → logged, nothing to send.
  if (!matched) {
    return { status: "skipped_no_match", matched };
  }

  // 4. Dry-run → record what we WOULD send, but send nothing.
  if (dryRun) {
    const message = buildDmMessage(config);
    await finalize(comment.commentId, {
      reply_status: "dry_run",
      reply_kind: config.replyMode,
      reply_error: null,
    });
    console.log(
      `[ig-webhook][DRY-RUN] Would DM comment=${comment.commentId} user=@${comment.fromUsername ?? "?"} text="${truncate(message, 120)}"`
    );
    return { status: "dry_run", matched };
  }

  // 5. Live mode → actually send.
  return sendReplies(comment, config, matched);
}

async function sendReplies(
  comment: ParsedComment,
  config: InstagramConfig,
  matched: boolean
): Promise<{ status: ProcessStatus; matched: boolean }> {
  const message = buildDmMessage(config);
  const wantPrivate = config.replyMode === "private_reply" || config.replyMode === "both";
  const wantPublic =
    (config.replyMode === "public_reply" || config.replyMode === "both") &&
    !!config.publicReplyText;

  const errors: string[] = [];

  if (wantPrivate) {
    const res = await sendInstagramPrivateReply(config, comment.commentId, message);
    if (!res.ok) errors.push(`private:${res.status}:${JSON.stringify(res.body)}`);
  }

  if (wantPublic && config.publicReplyText) {
    const res = await sendInstagramPublicReply(config, comment.commentId, config.publicReplyText);
    if (!res.ok) errors.push(`public:${res.status}:${JSON.stringify(res.body)}`);
  }

  if (errors.length > 0) {
    const joined = errors.join(" | ");
    console.error(`[ig-webhook] Send failed comment=${comment.commentId}: ${joined}`);
    await finalize(comment.commentId, {
      reply_status: "failed",
      reply_kind: config.replyMode,
      reply_error: truncate(joined, 2000),
    });
    return { status: "failed", matched };
  }

  await finalize(comment.commentId, {
    reply_status: "sent",
    reply_kind: config.replyMode,
    reply_error: null,
  });
  console.log(`[ig-webhook] Sent reply for comment=${comment.commentId}`);
  return { status: "sent", matched };
}

async function finalize(
  commentId: string,
  fields: { reply_status: string; reply_kind: string; reply_error: string | null }
): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from("instagram_comment_events")
    .update({ ...fields, replied_at: new Date().toISOString() })
    .eq("comment_id", commentId);
  if (error) console.error("[ig-webhook] Failed to finalize row:", error.message);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
