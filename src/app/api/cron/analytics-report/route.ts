import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { fetchDigestData } from "@/lib/analyticsDigest";
import { buildDigestHtml, buildDigestSubject } from "@/lib/digestEmail";

// How many hours must pass between digests (default: 72 = every 3 days).
const DIGEST_INTERVAL_HOURS = 72;

// Default report window in days.
const DEFAULT_WINDOW_DAYS = 3;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Resend returns ErrorResponse objects (name, message, statusCode) rather than
// throwing. String() on those produces "[object Object]", so we extract fields
// explicitly and fall back to JSON.stringify for anything unexpected.
function serializeError(err: unknown): Record<string, unknown> {
  if (err == null) return { raw: String(err) };
  if (typeof err === "string") return { message: err };
  if (typeof err !== "object") return { raw: String(err) };
  const e = err as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (typeof e.name === "string") result.name = e.name;
  if (typeof e.message === "string") result.message = e.message;
  if (typeof e.statusCode === "number") result.statusCode = e.statusCode;
  // Include the full stringified value if none of the expected fields are present
  // so we never silently swallow an unexpected error shape.
  if (Object.keys(result).length === 0) {
    try { result.raw = JSON.stringify(err); } catch { result.raw = String(err); }
  }
  return result;
}

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${secret}`) return true;

  // Allow query-param for local curl tests: ?secret=<CRON_SECRET>
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function GET(request: Request) {
  if (!authOk(request)) return unauthorized();

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";
  const daysParam = parseInt(url.searchParams.get("days") ?? "", 10);
  const windowDays = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : DEFAULT_WINDOW_DAYS;

  // ── Check when we last sent ───────────────────────────────────
  if (!dryRun && !force && supabaseAdmin) {
    const { data: lastRun } = await supabaseAdmin
      .from("analytics_digest_runs")
      .select("sent_at")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun?.sent_at) {
      const hoursSince = (Date.now() - new Date(lastRun.sent_at).getTime()) / 3_600_000;
      if (hoursSince < DIGEST_INTERVAL_HOURS) {
        return NextResponse.json({
          skipped: true,
          reason: `Last digest sent ${Math.round(hoursSince)}h ago. Next window opens in ${Math.round(DIGEST_INTERVAL_HOURS - hoursSince)}h.`,
        });
      }
    }
  }

  // ── Fetch data ────────────────────────────────────────────────
  const data = await fetchDigestData(windowDays);

  if (!data) {
    return NextResponse.json(
      { error: "Failed to fetch analytics data. Check SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  // Dry-run: return metrics without sending or recording.
  if (dryRun) {
    return NextResponse.json({ dryRun: true, data });
  }

  // ── Send email ────────────────────────────────────────────────
  const recipientsRaw = process.env.ANALYTICS_REPORT_RECIPIENTS ?? "";
  const recipients = recipientsRaw
    .split(",")
    .map(e => e.trim())
    .filter(e => e.includes("@"));

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "ANALYTICS_REPORT_RECIPIENTS is not set or contains no valid emails." },
      { status: 500 }
    );
  }

  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const fromEmail =
    process.env.ANALYTICS_REPORT_FROM_EMAIL ?? "shayan@xyra.dev";
  const subject = buildDigestSubject(data);
  const html = buildDigestHtml(data);

  const { error: sendError } = await resend.emails.send({
    from: `Xyra Analytics <${fromEmail}>`,
    to: recipients,
    subject,
    html,
  });

  if (sendError) {
    const detail = serializeError(sendError);
    console.error("Digest send error:", JSON.stringify(detail));
    return NextResponse.json(
      { error: "Email send failed.", detail },
      { status: 500 }
    );
  }

  // ── Record the run ────────────────────────────────────────────
  if (supabaseAdmin) {
    const { error: dbErr } = await supabaseAdmin
      .from("analytics_digest_runs")
      .insert({
        recipients: recipients.join(","),
        window_days: windowDays,
      });
    if (dbErr) console.error("Failed to record digest run:", dbErr.message);
  }

  return NextResponse.json({
    sent: true,
    recipients,
    subject,
    windowDays,
    summary: data.summary,
  });
}
