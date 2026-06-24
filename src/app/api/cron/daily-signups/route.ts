import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { fetchDailySignupsData } from "@/lib/dailySignupsDigest";
import { buildDailySignupsSubject, buildDailySignupsText } from "@/lib/dailySignupsEmail";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Same cron-secret pattern as /api/cron/analytics-report.
function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
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
  if (Object.keys(result).length === 0) {
    try {
      result.raw = JSON.stringify(err);
    } catch {
      result.raw = String(err);
    }
  }
  return result;
}

export async function GET(request: Request) {
  if (!authOk(request)) return unauthorized();

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";

  const data = await fetchDailySignupsData();
  if (!data) {
    return NextResponse.json(
      { error: "Failed to fetch signup data. Check SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, data });
  }

  // ── Duplicate-send guard: one send per Chicago calendar date, not a rolling
  // hours-since-last-send check, so a cron firing a few minutes early/late
  // never causes a double-send or a skipped day. ──────────────────────────
  const windowDate = data.windowStart.slice(0, 10); // "YYYY-MM-DD" of the Chicago day being summarized
  if (!force && supabaseAdmin) {
    const { data: existing } = await supabaseAdmin
      .from("daily_signup_digest_runs")
      .select("id")
      .eq("window_date", windowDate)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        skipped: true,
        reason: `Daily signups digest for ${windowDate} was already sent.`,
      });
    }
  }

  // ── Send email ────────────────────────────────────────────────
  const recipientsRaw = process.env.DAILY_SIGNUPS_RECIPIENTS || process.env.ANALYTICS_REPORT_RECIPIENTS || "";
  const recipients = recipientsRaw
    .split(",")
    .map(e => e.trim())
    .filter(e => e.includes("@"));

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No recipients configured. Set DAILY_SIGNUPS_RECIPIENTS or ANALYTICS_REPORT_RECIPIENTS." },
      { status: 500 }
    );
  }

  if (!resend) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }

  const fromEmail = process.env.ANALYTICS_REPORT_FROM_EMAIL ?? "shayan@xyra.dev";
  const subject = buildDailySignupsSubject(data);
  const text = buildDailySignupsText(data);

  const { error: sendError } = await resend.emails.send({
    from: `Xyra Daily Signups <${fromEmail}>`,
    to: recipients,
    subject,
    text,
  });

  if (sendError) {
    const detail = serializeError(sendError);
    console.error("Daily signups send error:", JSON.stringify(detail));
    return NextResponse.json({ error: "Email send failed.", detail }, { status: 500 });
  }

  // ── Record the run ────────────────────────────────────────────
  if (supabaseAdmin) {
    const { error: dbErr } = await supabaseAdmin
      .from("daily_signup_digest_runs")
      .insert({ window_date: windowDate, recipients: recipients.join(",") });
    // Unique-violation here just means another concurrent invocation already
    // recorded this date — not a real failure.
    if (dbErr && dbErr.code !== "23505") console.error("Failed to record daily signups run:", dbErr.message);
  }

  return NextResponse.json({
    sent: true,
    recipients,
    subject,
    windowDate,
    newSignups: data.newSignups,
    totalWaitlist: data.totalWaitlist,
  });
}
