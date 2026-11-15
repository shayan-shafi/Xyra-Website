import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { SummaryItem } from "@/lib/changelog";

// Admin-only: save a hand-edited summary and/or note for one release. Once a
// summary is edited by hand the AI never rewrites it ({ resetSummary: true }
// hands it back to the AI).

export const dynamic = "force-dynamic";

const TYPES = new Set(["new", "fixed", "under_the_hood"]);

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Website database not connected" }, { status: 500 });

  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; headline?: unknown; items?: unknown; note?: unknown; resetSummary?: unknown }
    | null;
  if (!body || typeof body.id !== "number") return NextResponse.json({ error: "Need id" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.resetSummary === true) {
    patch.summary = null;
    patch.summary_edited = false;
  } else if (typeof body.headline === "string" && Array.isArray(body.items)) {
    const items: SummaryItem[] = body.items
      .filter((i): i is SummaryItem => !!i && typeof i === "object" && TYPES.has((i as SummaryItem).type) && typeof (i as SummaryItem).text === "string")
      .map((i) => ({ type: i.type, text: i.text.trim().slice(0, 400) }))
      .filter((i) => i.text)
      .slice(0, 20);
    patch.summary = { headline: body.headline.trim().slice(0, 200), items };
    patch.summary_edited = true;
  }
  if (typeof body.note === "string") patch.note = body.note.trim().slice(0, 1000) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });

  const { error } = await supabaseAdmin.from("ship_events").update(patch).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
