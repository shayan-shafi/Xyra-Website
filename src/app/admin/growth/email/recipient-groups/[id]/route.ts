import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { MAX_MEMBERS, MAX_NAME, MAX_DESC, isMissingTable, collectMembers, loadGroupDetail } from "../helpers";

// Recipient group detail — GET (with members), PATCH (rename/description/
// archive/add/remove members), DELETE (hard delete; cascade removes members).
// The UI prefers PATCH { archived: true } (soft archive) over DELETE.

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });

  try {
    const detail = await loadGroupDetail(supabaseAdmin, id);
    if (detail && "missing" in detail) return NextResponse.json({ setupNeeded: true, error: "Recipient groups need a one-time setup — apply supabase/setup.sql §12." }, { status: 503 });
    if (!detail) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json({ group: detail });
  } catch (e) {
    return NextResponse.json({ error: "Failed to load group.", detail: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });

  let body: { name?: unknown; description?: unknown; archived?: unknown; addEmailsText?: unknown; addMembers?: unknown; removeEmails?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  // ── Field updates (name / description / archive) ──────────────────────────
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, MAX_NAME);
    if (!name) return NextResponse.json({ error: "Group name cannot be empty." }, { status: 400 });
    patch.name = name;
  }
  if (body.description !== undefined) {
    patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, MAX_DESC) : null;
  }
  if (typeof body.archived === "boolean") {
    patch.archived_at = body.archived ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("growth_recipient_groups").update(patch).eq("id", id);
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ setupNeeded: true, error: "Apply supabase/setup.sql §12." }, { status: 503 });
      return NextResponse.json({ error: "Failed to update group.", detail: error.message }, { status: 500 });
    }
  }

  // ── Remove members ────────────────────────────────────────────────────────
  if (Array.isArray(body.removeEmails) && body.removeEmails.length > 0) {
    const emails = (body.removeEmails as unknown[])
      .filter((e): e is string => typeof e === "string")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length > 0) {
      const { error } = await supabaseAdmin.from("growth_recipient_group_members").delete().eq("group_id", id).in("email", emails);
      if (error) return NextResponse.json({ error: "Failed to remove recipients.", detail: error.message }, { status: 500 });
    }
  }

  // ── Add members (deduped against what's already in the group) ─────────────
  const toAdd = collectMembers(body.addEmailsText, body.addMembers);
  if (toAdd.length > 0) {
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("growth_recipient_group_members").select("email").eq("group_id", id);
    if (exErr && !isMissingTable(exErr)) return NextResponse.json({ error: "Failed to read existing members.", detail: exErr.message }, { status: 500 });
    const have = new Set((existing ?? []).map(r => (r.email as string).toLowerCase()));
    const fresh = toAdd.filter(m => !have.has(m.email));
    if (have.size + fresh.length > MAX_MEMBERS) {
      return NextResponse.json({ error: `Group would exceed the ${MAX_MEMBERS}-recipient limit.` }, { status: 400 });
    }
    if (fresh.length > 0) {
      const rows = fresh.map(m => ({ group_id: id, email: m.email, name: m.name, source: "manual" as const }));
      const { error } = await supabaseAdmin.from("growth_recipient_group_members").insert(rows);
      if (error) return NextResponse.json({ error: "Failed to add recipients.", detail: error.message }, { status: 500 });
    }
    await supabaseAdmin.from("growth_recipient_groups").update({ updated_at: new Date().toISOString() }).eq("id", id);
  }

  try {
    const detail = await loadGroupDetail(supabaseAdmin, id);
    if (!detail || "missing" in detail) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    return NextResponse.json({ group: detail });
  } catch (e) {
    return NextResponse.json({ error: "Updated, but failed to reload.", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Invalid group id" }, { status: 400 });

  // Members are removed by the ON DELETE CASCADE foreign key.
  const { error } = await supabaseAdmin.from("growth_recipient_groups").delete().eq("id", id);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ setupNeeded: true, error: "Apply supabase/setup.sql §12." }, { status: 503 });
    return NextResponse.json({ error: "Failed to delete group.", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
