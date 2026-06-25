import { NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { getGrowthTemplate, buildRecipientValues, missingRequiredGlobals, PER_RECIPIENT_KEYS } from "@/lib/growthEmailTemplates";

// ── Guarded real send to SELECTED waitlist users ────────────────────────────
//
// Safety model (all enforced server-side):
//  1. Admin auth required.
//  2. Hard-disabled unless ENABLE_GROWTH_EMAIL_SENDS === "true".
//  3. Recipients must be an explicit, non-empty list. There is no "send to all"
//     path — the route only ever emails the emails it is handed, after
//     verifying each one exists on the waitlist.
//  4. Capped at GROWTH_MAX_SEND (default 1000) recipients per call.
//  5. A dry run (dryRun:true) is required first and returns exactly who would
//     be emailed / skipped, without sending or writing anything.
//  6. A real send requires the exact typed confirm phrase for the template.
//  7. Per-recipient idempotency: a claim row is inserted in
//     email_campaign_recipients (unique on campaign_key+email) BEFORE sending,
//     so the same campaign can never email the same person twice.
//  8. Per-recipient personalization (first_name, referral_link) is derived from
//     waitlist data here — never trusted from the client.

const MAX_SEND = (() => {
  const n = parseInt(process.env.GROWTH_MAX_SEND ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1000;
})();

function siteBaseUrl(): string {
  return (process.env.GROWTH_SITE_URL || "https://xyra.dev").replace(/\/$/, "");
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

type WaitlistLite = { email: string; name: string | null; ref_code: string | null };

export async function POST(request: Request) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hard kill-switch. Without the flag, real sends are impossible — the UI
  // still offers preview, test-send, and CSV export.
  if (process.env.ENABLE_GROWTH_EMAIL_SENDS !== "true") {
    return NextResponse.json(
      { error: "Real sends are disabled. Set ENABLE_GROWTH_EMAIL_SENDS=true to enable selected-recipient sends." },
      { status: 403 }
    );
  }

  let body: {
    templateId?: unknown;
    values?: unknown;
    subject?: unknown;
    sections?: unknown;
    recipients?: unknown;
    campaignKey?: unknown;
    confirm?: unknown;
    dryRun?: unknown;
    sentBy?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  const tpl = getGrowthTemplate(templateId);
  if (!tpl) return NextResponse.json({ error: "Unknown templateId" }, { status: 400 });

  const campaignKey = typeof body.campaignKey === "string" ? body.campaignKey.trim() : "";
  if (!campaignKey) return NextResponse.json({ error: "campaignKey is required (e.g. 'alpha-2026-06-29')." }, { status: 400 });

  const sections: Record<string, boolean> = {};
  if (body.sections && typeof body.sections === "object") {
    for (const [k, val] of Object.entries(body.sections as Record<string, unknown>)) {
      if (typeof val === "boolean") sections[k] = val;
    }
  }

  const dryRun = body.dryRun === true;

  // Global values from the admin; per-recipient keys are stripped so they can
  // never be injected from the client — they're rebuilt from waitlist data.
  const globalValues: Record<string, string> = {};
  if (body.values && typeof body.values === "object") {
    for (const [k, v] of Object.entries(body.values as Record<string, unknown>)) {
      if (typeof v === "string" && !PER_RECIPIENT_KEYS.includes(k as (typeof PER_RECIPIENT_KEYS)[number])) {
        globalValues[k] = v;
      }
    }
  }

  // Recipients: explicit, non-empty, de-duplicated, capped.
  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  const recipients = Array.from(
    new Set(rawRecipients.filter((e): e is string => typeof e === "string" && e.includes("@")).map(e => e.trim().toLowerCase()))
  );
  if (recipients.length === 0) {
    return NextResponse.json({ error: "recipients must be a non-empty list of emails." }, { status: 400 });
  }
  if (recipients.length > MAX_SEND) {
    return NextResponse.json({ error: `Too many recipients (${recipients.length}). Max is ${MAX_SEND}.` }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  }

  // Authoritative recipient data — only waitlist members can be emailed.
  const { data: wlRows, error: wlErr } = await supabaseAdmin
    .from("waitlist")
    .select("email,name,ref_code")
    .in("email", recipients);
  if (wlErr) {
    return NextResponse.json({ error: "Failed to load waitlist recipients.", detail: wlErr.message }, { status: 500 });
  }
  const byEmail = new Map<string, WaitlistLite>();
  for (const r of (wlRows ?? []) as WaitlistLite[]) byEmail.set(r.email.toLowerCase(), r);

  // Already-sent for this campaign (idempotency).
  const { data: sentRows, error: sentErr } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("email")
    .eq("campaign_key", campaignKey)
    .in("email", recipients);
  if (sentErr) {
    return NextResponse.json({ error: "Failed to check prior sends.", detail: sentErr.message }, { status: 500 });
  }
  const alreadySent = new Set((sentRows ?? []).map(r => (r.email as string).toLowerCase()));

  const skippedUnknown = recipients.filter(e => !byEmail.has(e));
  const skippedDuplicate = recipients.filter(e => byEmail.has(e) && alreadySent.has(e));
  const willSend = recipients.filter(e => byEmail.has(e) && !alreadySent.has(e));

  const subjectOverride = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : null;
  const subject = subjectOverride ?? tpl.buildSubject(globalValues);

  // Required global content must be present — never send a half-filled email.
  // Disabled sections are excluded from the requirement.
  const missingGlobals = missingRequiredGlobals(tpl, globalValues, sections);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      templateId,
      campaignKey,
      subject,
      missingGlobals,
      counts: { requested: recipients.length, willSend: willSend.length, skippedDuplicate: skippedDuplicate.length, skippedUnknown: skippedUnknown.length },
      willSend,
      skippedDuplicate,
      skippedUnknown,
    });
  }

  // ── Real send from here ──────────────────────────────────────────────────
  const expected = tpl.confirmPhrase;
  if (body.confirm !== expected) {
    return NextResponse.json({ error: `Confirmation phrase mismatch. Type "${expected}" to send.` }, { status: 400 });
  }
  if (missingGlobals.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missingGlobals.map(k => `{{${k}}}`).join(", ")}.` }, { status: 400 });
  }
  if (!subjectOverride && !tpl.buildSubject(globalValues).trim()) {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  if (!resend) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }
  if (willSend.length === 0) {
    return NextResponse.json({ error: "Nothing to send — all recipients are unknown or already sent.", skippedDuplicate, skippedUnknown }, { status: 400 });
  }

  // Growth emails send from GROWTH_EMAIL_FROM (separate from the analytics/
  // digest sender), falling back to the analytics sender for local compat.
  // If the configured value already includes a display name ("Name <email>"),
  // use it verbatim; only a bare address gets wrapped with a default display
  // name (re-wrapping a "Name <email>" produces an invalid 422 `from`).
  const fromConfigured = process.env.GROWTH_EMAIL_FROM || process.env.ANALYTICS_REPORT_FROM_EMAIL || "shayan@xyra.dev";
  const fromName = templateId === "alpha-invite" ? "Cole & Shayan from Xyra" : "Xyra";
  const from = fromConfigured.includes("<") ? fromConfigured : `${fromName} <${fromConfigured}>`;
  const sentBy = typeof body.sentBy === "string" ? body.sentBy.slice(0, 200) : null;
  const base = siteBaseUrl();

  // Record the run.
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from("email_campaign_runs")
    .insert({ campaign_key: campaignKey, template_id: templateId, subject, recipient_count: willSend.length, sent_by: sentBy })
    .select("id")
    .single();
  if (runErr) {
    return NextResponse.json({ error: "Failed to record campaign run.", detail: runErr.message }, { status: 500 });
  }
  const runId = runRow?.id ?? null;

  const sent: string[] = [];
  const failed: { email: string; detail: Record<string, unknown> }[] = [];

  for (const email of willSend) {
    const wl = byEmail.get(email)!;

    // Claim the recipient first (unique index on campaign_key+email). A
    // unique-violation here means a concurrent run already claimed it — skip.
    const { error: claimErr } = await supabaseAdmin
      .from("email_campaign_recipients")
      .insert({ campaign_key: campaignKey, template_id: templateId, email, run_id: runId, status: "pending" });
    if (claimErr) {
      if (claimErr.code === "23505") continue; // already sent by a concurrent run
      failed.push({ email, detail: { message: claimErr.message } });
      continue;
    }

    const values = buildRecipientValues(globalValues, { name: wl.name, refCode: wl.ref_code }, base);
    const html = tpl.buildHtml(values, sections);
    const text = tpl.buildText(values, sections);

    const { error: sendErr } = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });

    if (sendErr) {
      // Roll back the claim so this recipient can be retried on a later run.
      await supabaseAdmin.from("email_campaign_recipients").delete().eq("campaign_key", campaignKey).eq("email", email);
      failed.push({ email, detail: serializeError(sendErr) });
      continue;
    }

    await supabaseAdmin
      .from("email_campaign_recipients")
      .update({ status: "sent" })
      .eq("campaign_key", campaignKey)
      .eq("email", email);
    sent.push(email);

    // For alpha invites, persist the invite state on the waitlist row.
    if (templateId === "alpha-invite") {
      await supabaseAdmin
        .from("waitlist")
        .update({ alpha_status: "invited", alpha_invited_at: new Date().toISOString() })
        .eq("email", email);
    }
  }

  return NextResponse.json({
    sent: true,
    mode: "real",
    runId,
    campaignKey,
    subject,
    counts: {
      requested: recipients.length,
      sent: sent.length,
      failed: failed.length,
      skippedDuplicate: skippedDuplicate.length,
      skippedUnknown: skippedUnknown.length,
    },
    failed,
    skippedDuplicate,
    skippedUnknown,
  });
}
