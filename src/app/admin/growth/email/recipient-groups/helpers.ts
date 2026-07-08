import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRecipientText, type ParsedRecipient } from "@/lib/recipientParsing";
import type { GroupDetail } from "./types";

// Shared server-side helpers for the recipient-groups routes. Not a route file
// (no HTTP handlers exported), so Next treats it as a plain module.

export const MAX_MEMBERS = 10000;
export const MAX_NAME = 200;
export const MAX_DESC = 2000;

// Postgres "undefined_table" — the migration (setup.sql §12) isn't applied yet.
export function isMissingTable(err: { code?: string } | null | undefined): boolean {
  return err?.code === "42P01";
}

type MemberInput = { email?: unknown; name?: unknown; notes?: unknown; source?: unknown };

// Merge pasted text + an explicit members array into one deduped, lowercased list.
export function collectMembers(emailsText: unknown, members: unknown): ParsedRecipient[] {
  const seen = new Set<string>();
  const out: ParsedRecipient[] = [];
  const push = (email: string, name: string | null) => {
    const e = email.trim().toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push({ email: e, name: name && name.trim() ? name.trim().slice(0, MAX_NAME) : null });
  };
  if (typeof emailsText === "string" && emailsText.trim()) {
    for (const r of parseRecipientText(emailsText).valid) push(r.email, r.name);
  }
  if (Array.isArray(members)) {
    for (const m of members as MemberInput[]) {
      if (m && typeof m.email === "string") push(m.email, typeof m.name === "string" ? m.name : null);
    }
  }
  return out;
}

// Loads one group with its members. Returns null when the group id doesn't
// exist, or { missing: true } when the tables themselves aren't set up yet.
export async function loadGroupDetail(
  db: SupabaseClient,
  id: number,
): Promise<GroupDetail | null | { missing: true }> {
  const { data: g, error } = await db
    .from("growth_recipient_groups")
    .select("id,name,description,created_at,updated_at,archived_at,last_used_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { missing: true };
    throw error;
  }
  if (!g) return null;

  const { data: members, error: mErr } = await db
    .from("growth_recipient_group_members")
    .select("email,name,notes,source")
    .eq("group_id", id)
    .order("created_at", { ascending: true });
  if (mErr && !isMissingTable(mErr)) throw mErr;

  return {
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
    archivedAt: g.archived_at,
    lastUsedAt: g.last_used_at,
    memberCount: (members ?? []).length,
    members: (members ?? []).map(m => ({ email: m.email, name: m.name, notes: m.notes, source: m.source })),
  };
}
