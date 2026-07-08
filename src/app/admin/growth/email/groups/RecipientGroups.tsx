"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseRecipientText } from "@/lib/recipientParsing";
import type { GroupSummary, GroupDetail, CampaignSummary } from "../recipient-groups/types";

// API lives under a sibling segment (recipient-groups) because this page owns
// the /groups path — a page and a route handler can't share one segment.
const API = "/admin/growth/email/recipient-groups";

const card = "bg-white rounded-2xl border border-gray-200 p-5";
const h2 = "font-[family-name:var(--font-playfair)] text-lg text-gray-900";
const label = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";
const input = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-gray-400 bg-white";
const btnDark = "px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 disabled:opacity-50";
const btnLight = "px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Live valid/duplicate/invalid counts for a paste box.
function ParseCounts({ text }: { text: string }) {
  const r = useMemo(() => parseRecipientText(text), [text]);
  if (!text.trim()) return null;
  return (
    <div className="mt-1.5 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
      <span className="text-green-600 font-medium">{r.validCount} valid</span>
      {r.duplicateCount > 0 && <span>{r.duplicateCount} duplicate{r.duplicateCount === 1 ? "" : "s"} removed</span>}
      {r.invalidCount > 0 && (
        <span className="text-red-600">
          {r.invalidCount} invalid: <span className="font-mono">{r.invalid.slice(0, 5).join(", ")}{r.invalid.length > 5 ? "…" : ""}</span>
        </span>
      )}
    </div>
  );
}

export default function RecipientGroups() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [paste, setPaste] = useState("");

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [addPaste, setAddPaste] = useState("");

  // Campaign import
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?archived=${showArchived}`);
      const json = await res.json();
      if (json.setupNeeded) { setSetupNeeded(true); setGroups([]); }
      else { setSetupNeeded(false); setGroups(json.groups ?? []); }
    } catch (e) {
      setMsg(`Failed to load groups: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createGroup = useCallback(async () => {
    if (!name.trim()) { setMsg("Give the group a name first."); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, emailsText: paste }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? `Create failed (${res.status})`); return; }
      setMsg(`Created “${json.name}” with ${json.memberCount} recipient(s).`);
      setName(""); setDesc(""); setPaste("");
      await refresh();
    } catch (e) { setMsg(`Create error: ${String(e)}`); } finally { setBusy(false); }
  }, [name, desc, paste, refresh]);

  const openEdit = useCallback(async (id: number) => {
    if (editId === id) { setEditId(null); setDetail(null); return; }
    setEditId(id); setDetail(null); setMsg(null);
    try {
      const res = await fetch(`${API}/${id}`);
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? "Failed to open group"); return; }
      const d = json.group as GroupDetail;
      setDetail(d); setEditName(d.name); setEditDesc(d.description ?? ""); setAddPaste("");
    } catch (e) { setMsg(`Open error: ${String(e)}`); }
  }, [editId]);

  const patch = useCallback(async (id: number, payload: Record<string, unknown>, note?: string) => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`${API}/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? `Update failed (${res.status})`); return; }
      if (json.group) { setDetail(json.group as GroupDetail); }
      if (note) setMsg(note);
      await refresh();
    } catch (e) { setMsg(`Update error: ${String(e)}`); } finally { setBusy(false); }
  }, [refresh]);

  const saveEdit = useCallback((id: number) => {
    void patch(id, { name: editName, description: editDesc, addEmailsText: addPaste }, "Saved group.");
    setAddPaste("");
  }, [patch, editName, editDesc, addPaste]);

  const archive = useCallback((id: number, archived: boolean) => {
    void patch(id, { archived }, archived ? "Archived." : "Restored.");
  }, [patch]);

  const removeMember = useCallback((id: number, email: string) => {
    void patch(id, { removeEmails: [email] });
  }, [patch]);

  const del = useCallback(async (id: number, gname: string) => {
    if (!window.confirm(`Permanently delete “${gname}” and its recipients? This cannot be undone. (Tip: Archive keeps it recoverable.)`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? "Delete failed"); return; }
      if (editId === id) { setEditId(null); setDetail(null); }
      setMsg("Deleted.");
      await refresh();
    } catch (e) { setMsg(`Delete error: ${String(e)}`); } finally { setBusy(false); }
  }, [editId, refresh]);

  const loadCampaigns = useCallback(async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`${API}/from-campaign`);
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? "Failed to load campaigns"); return; }
      setCampaigns(json.campaigns ?? []);
    } catch (e) { setMsg(`Campaigns error: ${String(e)}`); } finally { setBusy(false); }
  }, []);

  const createFromCampaign = useCallback(async (c: CampaignSummary) => {
    const gname = window.prompt(`Name the group created from campaign “${c.campaignKey}” (${c.recipientCount} recipients):`, c.campaignKey);
    if (gname === null) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`${API}/from-campaign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignKey: c.campaignKey, name: gname }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? "Import failed"); return; }
      setMsg(`Created “${json.name}” with ${json.memberCount} recipient(s) from ${c.campaignKey}.`);
      setCampaigns(null);
      await refresh();
    } catch (e) { setMsg(`Import error: ${String(e)}`); } finally { setBusy(false); }
  }, [refresh]);

  return (
    <div className="space-y-6">
      {setupNeeded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 leading-snug">
          Recipient groups need a one-time database setup — apply <span className="font-mono">supabase/setup.sql §12</span> (creates the
          <span className="font-mono"> growth_recipient_groups</span> tables). Until then, saving/loading groups is unavailable.
        </div>
      )}

      {/* Create */}
      <div className={card}>
        <h2 className={h2}>New group</h2>
        <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-0.5 mb-3">
          Paste recipients in any common format — one per line, comma/semicolon separated, or <span className="font-mono">Name &lt;email&gt;</span>. Duplicates and invalid addresses are handled automatically.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Group name</label>
            <input className={`${input} mt-1`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alpha Group 1" />
          </div>
          <div>
            <label className={label}>Description (optional)</label>
            <input className={`${input} mt-1`} value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. First cohort invited June 2026" />
          </div>
        </div>
        <div className="mt-3">
          <label className={label}>Recipients</label>
          <textarea className={`${input} mt-1 resize-y font-mono text-xs`} rows={5} value={paste} onChange={e => setPaste(e.target.value)}
            placeholder={"alice@example.com\nBob Smith <bob@example.com>\ncarol@example.com, dan@example.com"} />
          <ParseCounts text={paste} />
        </div>
        <button onClick={createGroup} disabled={busy || setupNeeded} className={`${btnDark} mt-3`}>Create group</button>
      </div>

      {/* Create from previous campaign */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h2 className={h2}>Create from a previous send</h2>
          <button onClick={loadCampaigns} disabled={busy} className={btnLight}>{campaigns ? "Refresh" : "Show past campaigns"}</button>
        </div>
        <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-0.5">
          Rebuild a group from a real send that was logged (e.g. the first Alpha invite). Recipient emails aren&apos;t shown here — only the count.
        </p>
        {campaigns && (
          campaigns.length === 0 ? (
            <p className="text-sm text-gray-400 italic mt-3">No logged campaigns found.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {campaigns.map(c => (
                <li key={c.campaignKey} className="flex items-center justify-between py-2 gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-gray-800">{c.campaignKey}</span>
                    <span className="text-xs text-gray-400 ml-2">{c.templateId} · {c.recipientCount} recipient(s) · {fmt(c.lastSentAt)}</span>
                  </div>
                  <button onClick={() => createFromCampaign(c)} disabled={busy} className={btnLight}>Create group</button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {/* List */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={h2}>Saved groups</h2>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show archived
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 italic">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No groups yet. Create one above, or import from a previous send.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map(g => (
              <li key={g.id} className={`rounded-xl border ${g.archivedAt ? "border-gray-100 bg-gray-50" : "border-gray-200"}`}>
                <div className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{g.name}</span>
                      <span className="shrink-0 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{g.memberCount}</span>
                      {g.archivedAt && <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">archived</span>}
                    </div>
                    {g.description && <p className="text-xs text-gray-500 truncate mt-0.5">{g.description}</p>}
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Created {fmt(g.createdAt)} · Updated {fmt(g.updatedAt)} · Last used {fmt(g.lastUsedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(g.id)} className={btnLight}>{editId === g.id ? "Close" : "Edit"}</button>
                    <button onClick={() => archive(g.id, !g.archivedAt)} disabled={busy} className={btnLight}>{g.archivedAt ? "Restore" : "Archive"}</button>
                    <button onClick={() => del(g.id, g.name)} disabled={busy} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">Delete</button>
                  </div>
                </div>

                {/* Inline editor */}
                {editId === g.id && (
                  <div className="border-t border-gray-100 p-3 space-y-3">
                    {!detail ? (
                      <p className="text-sm text-gray-400 italic">Loading members…</p>
                    ) : (
                      <>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className={label}>Name</label>
                            <input className={`${input} mt-1`} value={editName} onChange={e => setEditName(e.target.value)} />
                          </div>
                          <div>
                            <label className={label}>Description</label>
                            <input className={`${input} mt-1`} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className={label}>Add recipients (paste)</label>
                          <textarea className={`${input} mt-1 resize-y font-mono text-xs`} rows={3} value={addPaste} onChange={e => setAddPaste(e.target.value)} placeholder="Paste more emails to add…" />
                          <ParseCounts text={addPaste} />
                        </div>
                        <button onClick={() => saveEdit(g.id)} disabled={busy} className={btnDark}>Save changes</button>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className={label}>Members ({detail.members.length})</span>
                          </div>
                          <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
                            {detail.members.map(m => (
                              <div key={m.email} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                                <span className="min-w-0 truncate">
                                  <span className="font-mono text-gray-700">{m.email}</span>
                                  {m.name && <span className="text-gray-400 ml-2">{m.name}</span>}
                                </span>
                                <button onClick={() => removeMember(g.id, m.email)} disabled={busy} className="shrink-0 text-red-500 hover:text-red-700" title="Remove">✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {msg && <div className={`${card} text-sm text-gray-700`}>{msg}</div>}

      <p className="text-xs text-gray-400">
        Loading a group into the composer happens in <Link href="/admin/growth/email" className="underline">Email Ops</Link>. Groups only populate the recipient list — they never send.
      </p>
    </div>
  );
}
