import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { summarizeAndStore, type ShipEvent } from "@/lib/changelog";

// Admin-only: (re)write the AI summary for one release, or for every release
// that has commits but no summary yet ({ missing: true }, at most 10 per call).
// A hand-edited summary is never overwritten.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Website database not connected" }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Summaries need ANTHROPIC_API_KEY on the server." }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: unknown; missing?: unknown };
  let q = supabaseAdmin.from("ship_events").select("*").eq("summary_edited", false);
  if (typeof body.id === "number") q = q.eq("id", body.id);
  else if (body.missing === true) q = q.is("summary", null).order("shipped_at", { ascending: false }).limit(10);
  else return NextResponse.json({ error: "Pass id or missing" }, { status: 400 });

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = ((data ?? []) as ShipEvent[]).filter((r) => r.commits.length > 0);
  const results = await Promise.all(rows.map(async (r) => ({ id: r.id, summary: await summarizeAndStore({ ...r, summary: null }) })));
  return NextResponse.json({ written: results.filter((r) => r.summary).length, results });
}
