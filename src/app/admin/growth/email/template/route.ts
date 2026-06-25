import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { getGrowthTemplate } from "@/lib/growthEmailTemplates";

// ── Template draft persistence ──────────────────────────────────────────────
// GET    → all saved overrides: { persistence: boolean, overrides: { [id]: {subject, values} } }
// POST   → upsert one override: { templateId, subject, values }
// DELETE → reset (remove) one override: { templateId }
//
// Defaults always live in code. A row in growth_email_templates overrides the
// code default for that template. If the table doesn't exist yet (setup.sql §9
// not applied), GET returns persistence:false and an empty map; POST/DELETE
// return 409 so the client can fall back to browser localStorage.

// The table hasn't been created yet (setup.sql §9 not applied). Covers both the
// Postgres error (42P01) and PostgREST's "not in schema cache" error (PGRST205),
// which is what Supabase returns when the table is absent.
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message || "").toLowerCase();
  return m.includes("could not find the table") || m.includes("schema cache") || m.includes("does not exist");
}

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ persistence: false, overrides: {} });

  const { data, error } = await supabaseAdmin
    .from("growth_email_templates")
    .select("template_id,subject,values_json,sections_json");

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ persistence: false, overrides: {} });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overrides: Record<string, { subject: string; values: Record<string, string>; sections: Record<string, boolean> }> = {};
  for (const row of data ?? []) {
    overrides[row.template_id as string] = {
      subject: (row.subject as string) ?? "",
      values: (row.values_json as Record<string, string>) ?? {},
      sections: (row.sections_json as Record<string, boolean>) ?? {},
    };
  }
  return NextResponse.json({ persistence: true, overrides });
}

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  let body: { templateId?: unknown; subject?: unknown; values?: unknown; sections?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!getGrowthTemplate(templateId)) return NextResponse.json({ error: "Unknown templateId" }, { status: 400 });

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!subject) return NextResponse.json({ error: "Subject is required." }, { status: 400 });

  const values: Record<string, string> = {};
  if (body.values && typeof body.values === "object") {
    for (const [k, v] of Object.entries(body.values as Record<string, unknown>)) {
      if (typeof v === "string") values[k] = v;
    }
  }

  const sections: Record<string, boolean> = {};
  if (body.sections && typeof body.sections === "object") {
    for (const [k, v] of Object.entries(body.sections as Record<string, unknown>)) {
      if (typeof v === "boolean") sections[k] = v;
    }
  }

  const { error } = await supabaseAdmin
    .from("growth_email_templates")
    .upsert({ template_id: templateId, subject, values_json: values, sections_json: sections, updated_at: new Date().toISOString() }, { onConflict: "template_id" });

  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: "Template table not applied yet. Run supabase/setup.sql §9. Saved to your browser locally for now.", persistence: false },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true, persistence: true, templateId });
}

export async function DELETE(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  let body: { templateId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("growth_email_templates").delete().eq("template_id", templateId);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ reset: true, persistence: false });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reset: true, persistence: true, templateId });
}
