import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { MAX_MEMBERS, MAX_NAME, MAX_DESC, isMissingTable, collectMembers } from "./helpers";
import type { GroupSummary } from "./types";

// Saved recipient groups — list + create.
// Admin-only (isAdminRequest), all DB access via service-role supabaseAdmin.
// Tables live behind RLS with no anon policies (setup.sql §12).

export async function GET(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  const includeArchived = new URL(request.url).searchParams.get("archived") === "true";

  let q = supabaseAdmin
    .from("growth_recipient_groups")
    .select("id,name,description,created_at,updated_at,archived_at,last_used_at")
    .order("updated_at", { ascending: false });
  if (!includeArchived) q = q.is("archived_at", null);

  const { data: groups, error } = await q;
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ groups: [], setupNeeded: true });
    return NextResponse.json({ error: "Failed to load groups.", detail: error.message }, { status: 500 });
  }

  // Member counts per group (one query, tallied in JS — robust vs. PostgREST
  // embedded-count FK detection).
  const ids = (groups ?? []).map(g => g.id);
  const counts: Record<number, number> = {};
  if (ids.length > 0) {
    const { data: members, error: mErr } = await supabaseAdmin
      .from("growth_recipient_group_members")
      .select("group_id")
      .in("group_id", ids);
    if (mErr && !isMissingTable(mErr)) {
      return NextResponse.json({ error: "Failed to count members.", detail: mErr.message }, { status: 500 });
    }
    for (const m of members ?? []) counts[m.group_id as number] = (counts[m.group_id as number] ?? 0) + 1;
  }

  const out: GroupSummary[] = (groups ?? []).map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    archivedAt: g.archived_at,
    lastUsedAt: g.last_used_at,
    memberCount: counts[g.id] ?? 0,
  }));
  return NextResponse.json({ groups: out });
}

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  let body: { name?: unknown; description?: unknown; emailsText?: unknown; members?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  if (!name) return NextResponse.json({ error: "Group name is required." }, { status: 400 });
  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim().slice(0, MAX_DESC) : null;

  const members = collectMembers(body.emailsText, body.members);
  if (members.length > MAX_MEMBERS) {
    return NextResponse.json({ error: `Too many recipients (${members.length}). Max is ${MAX_MEMBERS}.` }, { status: 400 });
  }

  const { data: groupRow, error: gErr } = await supabaseAdmin
    .from("growth_recipient_groups")
    .insert({ name, description })
    .select("id")
    .single();
  if (gErr) {
    if (isMissingTable(gErr)) return NextResponse.json({ error: "Recipient groups need a one-time setup — apply supabase/setup.sql §12.", setupNeeded: true }, { status: 503 });
    return NextResponse.json({ error: "Failed to create group.", detail: gErr.message }, { status: 500 });
  }
  const groupId = groupRow.id as number;

  if (members.length > 0) {
    const rows = members.map(m => ({ group_id: groupId, email: m.email, name: m.name, source: "manual" as const }));
    const { error: mErr } = await supabaseAdmin.from("growth_recipient_group_members").insert(rows);
    if (mErr) {
      // Roll back the (now empty/partial) group so a failed member insert doesn't
      // leave an orphan group behind.
      await supabaseAdmin.from("growth_recipient_groups").delete().eq("id", groupId);
      return NextResponse.json({ error: "Failed to save recipients.", detail: mErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: groupId, name, memberCount: members.length }, { status: 201 });
}
