import { NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { getGrowthTemplate } from "@/lib/growthEmailTemplates";
import { isValidEmail } from "@/lib/emailValidation";

// ── Test send ────────────────────────────────────────────────────────────────
// Renders a template and sends it ONLY to internal/admin recipients (from env),
// with a [TEST] subject prefix. It deliberately ignores any recipient list in
// the request body — there is no code path here that can email a waitlist user.
// It never writes the email_campaign_* logs, so test sends can't interfere with
// real-send duplicate protection.

function internalRecipients(): string[] {
  const raw =
    process.env.GROWTH_EMAIL_TEST_RECIPIENTS ||
    process.env.ANALYTICS_REPORT_RECIPIENTS ||
    process.env.DAILY_SIGNUPS_RECIPIENTS ||
    "";
  // Exclude malformed addresses before any send (same rule as the real-send route).
  return raw.split(",").map(e => e.trim()).filter(e => isValidEmail(e));
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err == null) return { raw: String(err) };
  if (typeof err === "string") return { message: err };
  if (typeof err !== "object") return { raw: String(err) };
  const e = err as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof e.name === "string") out.name = e.name;
  if (typeof e.message === "string") out.message = e.message;
  if (typeof e.statusCode === "number") out.statusCode = e.statusCode;
  if (Object.keys(out).length === 0) {
    try { out.raw = JSON.stringify(err); } catch { out.raw = String(err); }
  }
  return out;
}

export async function POST(request: Request) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { templateId?: unknown; values?: unknown; subject?: unknown; sections?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  const tpl = getGrowthTemplate(templateId);
  if (!tpl) return NextResponse.json({ error: "Unknown templateId" }, { status: 400 });

  const values: Record<string, string> = {};
  if (body.values && typeof body.values === "object") {
    for (const [k, v] of Object.entries(body.values as Record<string, unknown>)) {
      if (typeof v === "string") values[k] = v;
    }
  }

  // Subject is editable in the Email Ops editor; fall back to the template default.
  const subjectOverride = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;

  const sections: Record<string, boolean> = {};
  if (body.sections && typeof body.sections === "object") {
    for (const [k, val] of Object.entries(body.sections as Record<string, unknown>)) {
      if (typeof val === "boolean") sections[k] = val;
    }
  }

  const recipients = internalRecipients();
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No internal recipients configured. Set GROWTH_EMAIL_TEST_RECIPIENTS (or ANALYTICS_REPORT_RECIPIENTS)." },
      { status: 500 }
    );
  }
  if (!resend) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }

  // Growth emails send from GROWTH_EMAIL_FROM so they're separate from the
  // analytics/digest sender. Fall back to the analytics sender for local
  // compatibility if it isn't configured. If the configured value already
  // includes a display name ("Name <email>"), use it verbatim — only a bare
  // address gets wrapped with a default display name (otherwise we'd produce
  // an invalid nested "Xyra <Name <email>>" that Resend rejects with a 422).
  const fromConfigured = process.env.GROWTH_EMAIL_FROM || process.env.ANALYTICS_REPORT_FROM_EMAIL || "shayan@xyra.dev";
  const from = fromConfigured.includes("<") ? fromConfigured : `Xyra <${fromConfigured}>`;
  const subject = `[TEST] ${subjectOverride ?? tpl.buildSubject(values)}`;
  const html = tpl.buildHtml(values, sections);
  const text = tpl.buildText(values, sections);

  const { error } = await resend.emails.send({
    from,
    to: recipients,
    subject,
    html,
    text,
  });

  if (error) {
    const detail = serializeError(error);
    console.error("Growth test-send error:", JSON.stringify(detail));
    const reason = typeof detail.message === "string" ? detail.message : "unknown error";
    return NextResponse.json({ error: `Test email send failed: ${reason}`, detail }, { status: 500 });
  }

  return NextResponse.json({ sent: true, mode: "test", recipients, subject });
}
