import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendHandoffEmail, type EmailNumber } from "@/lib/handoff";

// Daily (vercel.json): the "send it to my laptop" reminders.
//   email 2 — at least 20h after email 1
//   email 3 — at least 68h after email 1 (the last one)
// Never to anyone who made the account (claimed) or tapped "stop".
// Also deletes rows that never became an account, 30 days on.
//
// Same cron-secret pattern as /api/cron/daily-signups.

const H = 60 * 60 * 1000;
const STEPS: { from: number; to: EmailNumber; afterMs: number }[] = [
  { from: 1, to: 2, afterMs: 20 * H },
  { from: 2, to: 3, afterMs: 68 * H },
];
const PURGE_AFTER_MS = 30 * 24 * H;
const BATCH = 200;

function authOk(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if ((request.headers.get("authorization") ?? "") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authOk(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin;
  if (!db) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const now = Date.now();
  const sent: Record<string, number> = { "2": 0, "3": 0 };
  const failed: Record<string, number> = { "2": 0, "3": 0 };

  for (const step of STEPS) {
    const cutoff = new Date(now - step.afterMs).toISOString();
    const { data: rows, error } = await db
      .from("handoff_requests")
      .select("id, email, token")
      .eq("emails_sent", step.from)
      .lte("first_sent_at", cutoff)
      .is("claimed_at", null)
      .is("unsubscribed_at", null)
      .not("email", "is", null)
      .limit(BATCH);
    if (error) {
      console.error(`handoff reminders (${step.to}) query error:`, error);
      continue;
    }
    for (const r of rows ?? []) {
      const ok = await sendHandoffEmail(step.to, r.email as string, r.token as string);
      if (!ok) {
        failed[step.to]++;
        continue;
      }
      sent[step.to]++;
      // Guarded on emails_sent so a re-run or overlap can't double-send.
      await db
        .from("handoff_requests")
        .update({ emails_sent: step.to, last_email_at: new Date().toISOString() })
        .eq("id", r.id)
        .eq("emails_sent", step.from);
    }
  }

  const { count: purged, error: purgeErr } = await db
    .from("handoff_requests")
    .delete({ count: "exact" })
    .is("claimed_at", null)
    .lt("created_at", new Date(now - PURGE_AFTER_MS).toISOString());
  if (purgeErr) console.error("handoff purge error:", purgeErr);

  return NextResponse.json({ sent, failed, purged: purged ?? 0 });
}
