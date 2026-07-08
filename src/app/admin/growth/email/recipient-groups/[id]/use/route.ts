import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { isMissingTable, loadGroupDetail } from "../../helpers";

// Marks a group as "used" (stamps last_used_at) and returns its members so the
// composer can load them. This ONLY reads recipients into the composer — it
// never sends. The guarded send path (/admin/growth/email/send) is untouched.

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });

  try {
    const detail = await loadGroupDetail(supabaseAdmin, id);
    if (detail && "missing" in detail) return NextResponse.json({ setupNeeded: true, error: "Apply supabase/setup.sql §12." }, { status: 503 });
    if (!detail) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("growth_recipient_groups")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", id);
    if (error && !isMissingTable(error)) {
      // Non-fatal: still return members so the load succeeds.
      console.error("group use last_used_at:", error.message);
    }
    return NextResponse.json({ group: { ...detail, lastUsedAt: new Date().toISOString() } });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load group.", detail: String(e) }, { status: 500 });
  }
}
