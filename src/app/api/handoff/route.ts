import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidEmail } from "@/lib/emailValidation";
import { clipStr, pickFirstTouch, safeVisitorId } from "@/lib/waitlistShared";
import { sendXConversion } from "@/lib/xConversions";
import { newToken, rememberEmailId, sendHandoffEmail } from "@/lib/handoff";

// POST /api/handoff — "send it to my laptop" (see src/lib/handoff.ts).
// Body: { email, visitor_id?, first_touch?, x? }
//
// New email → row + email #1 + X "Sign up" conversion (consent-gated).
// Same email again → the same link re-sent as email #1, and the reminder
// clock restarts; at most once every 2 minutes (a double tap sends one email).

const RESEND_GAP_MS = 2 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const db = supabaseAdmin;
    if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const raw = clipStr(body.email, 254);
    if (!raw || !isValidEmail(raw)) return NextResponse.json({ error: "that email doesn't look right" }, { status: 400 });
    const email = raw.toLowerCase();

    const { data: existing, error: lookupErr } = await db
      .from("handoff_requests")
      .select("id, token, last_email_at")
      .eq("email", email)
      .maybeSingle();
    if (lookupErr) {
      console.error("handoff lookup error:", lookupErr);
      return NextResponse.json({ error: "something went wrong" }, { status: 500 });
    }

    const now = new Date();

    if (existing) {
      const last = existing.last_email_at ? Date.parse(existing.last_email_at) : 0;
      if (now.getTime() - last < RESEND_GAP_MS) return NextResponse.json({ ok: true, resent: false });
      const sent = await sendHandoffEmail(1, email, existing.token);
      if (!sent) return NextResponse.json({ error: "couldn't send the email, try again" }, { status: 502 });
      await db
        .from("handoff_requests")
        .update({ emails_sent: 1, first_sent_at: now.toISOString(), last_email_at: now.toISOString(), unsubscribed_at: null })
        .eq("id", existing.id);
      await rememberEmailId(db, existing.id, sent);
      return NextResponse.json({ ok: true, resent: true });
    }

    const x = body.x && typeof body.x === "object" ? (body.x as { allowed?: unknown; twclid?: unknown }) : {};
    const token = newToken();
    const firstTouch = pickFirstTouch(body.first_touch);
    const { data: row, error: insertErr } = await db
      .from("handoff_requests")
      .insert({
        email,
        token,
        visitor_id: safeVisitorId(body.visitor_id),
        ...(firstTouch ?? {}),
        twclid: x.allowed === true ? clipStr(x.twclid, 512) : null,
      })
      .select("id")
      .single();
    if (insertErr || !row) {
      console.error("handoff insert error:", insertErr);
      return NextResponse.json({ error: "something went wrong" }, { status: 500 });
    }

    const sent = await sendHandoffEmail(1, email, token);
    if (!sent) {
      // No email went, so no row: they can simply try again.
      await db.from("handoff_requests").delete().eq("id", row.id);
      return NextResponse.json({ error: "couldn't send the email, try again" }, { status: 502 });
    }
    await db
      .from("handoff_requests")
      .update({ emails_sent: 1, first_sent_at: now.toISOString(), last_email_at: now.toISOString() })
      .eq("id", row.id);
    await rememberEmailId(db, row.id, sent);

    await sendXConversion({ kind: "signup", request, email, x: body.x });

    return NextResponse.json({ ok: true, resent: false }, { status: 201 });
  } catch (err) {
    console.error("handoff error:", err);
    return NextResponse.json({ error: "something went wrong" }, { status: 500 });
  }
}
