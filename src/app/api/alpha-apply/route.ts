import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { isValidEmail } from "@/lib/emailValidation";
import { SITE_URL } from "@/lib/site";
import { clipStr, creditReferrer, generateRefCode, pickFirstTouch, safeVisitorId } from "@/lib/waitlistShared";

// ─── POST /api/alpha-apply ───────────────────────────────────────────────────
// The alpha application (the /apply conversation — same five questions as the
// Google Form it replaced, 2026-09-27). Answers land on the applicant's
// waitlist row: created if they weren't on the list yet (with a ref code and
// first-touch attribution, exactly like /api/waitlist), otherwise enriched in
// place. alpha_status becomes "applied" unless it's already further along
// (an "invited" person who applies stays invited).
//
// Needs supabase/setup.sql §14 (the alpha_* answer columns). Until it's
// applied the insert/update fails on the unknown column and this returns 503
// with setupNeeded — nothing half-written.

const SETUP_MSG = "Alpha applications need a one-time setup — apply supabase/setup.sql §14.";

type PgError = { code?: string; message?: string } | null;

function isMissingColumn(err: PgError): boolean {
  if (!err) return false;
  // 42703 = undefined_column (Postgres); PGRST204 = column not in PostgREST's schema cache.
  return err.code === "42703" || err.code === "PGRST204" || /column .* does not exist|schema cache/i.test(err.message ?? "");
}

function parseRecipients(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(isValidEmail);
}

type Application = {
  name: string;
  email: string;
  whatsUp: string;
  why: string;
  payOk: boolean;
};

// Best-effort heads-up to the inbox that already gets the daily signups
// digest (or ALPHA_APPLY_NOTIFY_TO to route it elsewhere). Never fails the
// request — the row is what matters; this is the "new response" ping the
// Google Form used to give.
async function notify(app: Application, returning: boolean) {
  if (!resend) return;
  const to = parseRecipients(
    process.env.ALPHA_APPLY_NOTIFY_TO || process.env.DAILY_SIGNUPS_RECIPIENTS || process.env.ANALYTICS_REPORT_RECIPIENTS
  );
  if (to.length === 0) return;
  const fromEmail = process.env.ANALYTICS_REPORT_FROM_EMAIL ?? "shayan@xyra.dev";
  const lines = [
    `name: ${app.name}`,
    `what they're up to: ${app.whatsUp}`,
    `email: ${app.email}`,
    ``,
    `why they want in:`,
    app.why,
    ``,
    `$10 to test: ${app.payOk ? "yes" : "no :(((((("}`,
    returning ? `already on the waitlist, row updated.` : `new to the waitlist, row created.`,
    ``,
    `${SITE_URL}/admin/growth`,
  ];
  try {
    await resend.emails.send({
      from: `Xyra Alpha Applications <${fromEmail}>`,
      to,
      subject: `new alpha application: ${app.name}${app.payOk ? "" : " (no to the $10)"}`,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("alpha-apply notify failed:", err);
  }
}

export async function POST(request: Request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json({ error: "Applications are not configured yet" }, { status: 503 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const name = clipStr(body.name, 120);
    const whatsUp = clipStr(body.whatsUp, 600);
    const why = clipStr(body.why, 2000);
    const rawEmail = clipStr(body.email, 254);
    const payOk = body.payOk;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!whatsUp) return NextResponse.json({ error: "Tell us what you're up to" }, { status: 400 });
    if (!rawEmail || !isValidEmail(rawEmail)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    if (!why) return NextResponse.json({ error: "Tell us why you want in" }, { status: 400 });
    if (typeof payOk !== "boolean") return NextResponse.json({ error: "Answer the $10 question" }, { status: 400 });

    const email = rawEmail.toLowerCase();
    const application = {
      alpha_applied_at: new Date().toISOString(),
      alpha_whats_up: whatsUp,
      alpha_why: why,
      alpha_pay_ok: payOk,
    };

    const { data: existing, error: lookupErr } = await db
      .from("waitlist")
      .select("id, alpha_status")
      .eq("email", email)
      .maybeSingle();

    if (lookupErr) {
      console.error("alpha-apply lookup error:", lookupErr);
      if (isMissingColumn(lookupErr)) return NextResponse.json({ error: SETUP_MSG, setupNeeded: true }, { status: 503 });
      return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }

    let error: PgError = null;
    let status: 200 | 201;

    if (existing) {
      // Already on the list: keep whatever alpha_status they've earned, fill in
      // the application, and take the name they just gave us.
      const res = await db
        .from("waitlist")
        .update({ name, ...application, alpha_status: existing.alpha_status ?? "applied" })
        .eq("id", existing.id);
      error = res.error;
      status = 200;
    } else {
      const firstTouch = pickFirstTouch(body.first_touch);
      const referredBy = firstTouch?.first_ref_code || null;
      const res = await db.from("waitlist").insert({
        name,
        email,
        ref_code: generateRefCode(),
        referred_by: referredBy,
        visitor_id: safeVisitorId(body.visitor_id),
        ...(firstTouch ?? {}),
        ...application,
        alpha_status: "applied",
      });
      error = res.error;
      status = 201;
      if (!error) await creditReferrer(db, referredBy);
    }

    if (error) {
      console.error("alpha-apply write error:", error);
      if (isMissingColumn(error)) return NextResponse.json({ error: SETUP_MSG, setupNeeded: true }, { status: 503 });
      if (error.code === "42501") {
        return NextResponse.json({ error: "Database permissions not configured. Run setup.sql in Supabase SQL Editor." }, { status: 503 });
      }
      return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
    }

    await notify({ name, email, whatsUp, why, payOk }, status === 200);

    return NextResponse.json({ message: "you're in the pile." }, { status });
  } catch (err) {
    console.error("alpha-apply error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
