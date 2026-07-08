import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { MAX_NAME, MAX_DESC, MAX_MEMBERS, isMissingTable } from "../helpers";
import type { CampaignSummary } from "../types";

// Create a recipient group from a previous send's campaign log.
//   GET  → list past campaigns (campaign_key/template/recipient count only —
//          NEVER returns emails).
//   POST → build a group from one campaign_key: reads the logged recipients
//          (email_campaign_recipients) + waitlist names, server-side only.
//
// The recipient emails ARE stored (email_campaign_recipients from the guarded
// real-send path), which is what makes reconstructing e.g. the first Alpha
// cohort possible without re-pasting.

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  // NOTE: select does NOT include the email column — counts/metadata only.
  const { data, error } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("campaign_key,template_id,created_at");
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ campaigns: [] });
    return NextResponse.json({ error: "Failed to read campaigns.", detail: error.message }, { status: 500 });
  }

  const agg = new Map<string, CampaignSummary>();
  for (const r of data ?? []) {
    const key = r.campaign_key as string;
    const cur = agg.get(key) ?? { campaignKey: key, templateId: r.template_id as string, recipientCount: 0, lastSentAt: null };
    cur.recipientCount += 1;
    const at = r.created_at as string | null;
    if (at && (!cur.lastSentAt || at > cur.lastSentAt)) cur.lastSentAt = at;
    agg.set(key, cur);
  }
  const campaigns = Array.from(agg.values()).sort((a, b) => (b.lastSentAt ?? "").localeCompare(a.lastSentAt ?? ""));
  return NextResponse.json({ campaigns });
}

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });

  let body: { campaignKey?: unknown; name?: unknown; description?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const campaignKey = typeof body.campaignKey === "string" ? body.campaignKey.trim() : "";
  if (!campaignKey) return NextResponse.json({ error: "campaignKey is required." }, { status: 400 });

  // Read the campaign's recipients (emails needed only to build the group,
  // server-side; never returned to the client in this response).
  const { data: recRows, error: recErr } = await supabaseAdmin
    .from("email_campaign_recipients")
    .select("email")
    .eq("campaign_key", campaignKey);
  if (recErr) {
    if (isMissingTable(recErr)) return NextResponse.json({ error: "No campaign log found." }, { status: 404 });
    return NextResponse.json({ error: "Failed to read campaign recipients.", detail: recErr.message }, { status: 500 });
  }
  const emails = Array.from(new Set((recRows ?? []).map(r => (r.email as string).trim().toLowerCase()).filter(Boolean)));
  if (emails.length === 0) return NextResponse.json({ error: "That campaign has no logged recipients." }, { status: 404 });
  if (emails.length > MAX_MEMBERS) return NextResponse.json({ error: `Campaign has too many recipients (${emails.length}).` }, { status: 400 });

  // Names come from the waitlist (best-effort; missing name → null).
  const nameByEmail = new Map<string, string | null>();
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    const { data: wl } = await supabaseAdmin.from("waitlist").select("email,name").in("email", chunk);
    for (const r of wl ?? []) nameByEmail.set((r.email as string).toLowerCase(), (r.name as string | null) ?? null);
  }

  const name = (typeof body.name === "string" && body.name.trim() ? body.name.trim() : campaignKey).slice(0, MAX_NAME);
  const description = (typeof body.description === "string" && body.description.trim()
    ? body.description.trim()
    : `Imported from campaign "${campaignKey}"`).slice(0, MAX_DESC);

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

  const rows = emails.map(email => ({ group_id: groupId, email, name: nameByEmail.get(email) ?? null, source: `campaign:${campaignKey}`.slice(0, 200) }));
  const { error: mErr } = await supabaseAdmin.from("growth_recipient_group_members").insert(rows);
  if (mErr) {
    await supabaseAdmin.from("growth_recipient_groups").delete().eq("id", groupId);
    return NextResponse.json({ error: "Failed to save recipients.", detail: mErr.message }, { status: 500 });
  }

  // Response is PII-free: id + count only, no emails.
  return NextResponse.json({ id: groupId, name, memberCount: emails.length }, { status: 201 });
}
