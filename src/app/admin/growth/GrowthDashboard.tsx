"use client";

import { useMemo, useState, useCallback } from "react";
import type { GrowthData, GrowthUser } from "./data";

// sessionStorage key the Email Ops page reads to prefill selected recipients.
const RECIPIENTS_KEY = "xyra_growth_recipients";

type SortKey = "recent" | "referrals" | "reward";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function csvCell(val: unknown): string {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const LABEL = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";

export default function GrowthDashboard({ data }: { data: GrowthData }) {
  const { users, leaderboard, alphaFieldsAvailable, sources, campaigns } = data;

  const [search, setSearch] = useState("");
  const [minReferrals, setMinReferrals] = useState(0);
  const [sourceFilter, setSourceFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [alphaFilter, setAlphaFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState(10);
  const [status, setStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users.filter(u => {
      if (q) {
        const hay = `${u.name ?? ""} ${u.email} ${u.refCode ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (minReferrals > 0 && u.referralCount < minReferrals) return false;
      if (sourceFilter && u.source !== sourceFilter) return false;
      if (campaignFilter && u.campaign !== campaignFilter) return false;
      if (dateFrom && u.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && u.createdAt.slice(0, 10) > dateTo) return false;
      if (alphaFilter) {
        if (alphaFilter === "__none__" && u.alphaStatus) return false;
        if (alphaFilter !== "__none__" && u.alphaStatus !== alphaFilter) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "referrals") return b.referralCount - a.referralCount || b.rewardReferrals - a.rewardReferrals;
      if (sortKey === "reward") return b.rewardReferrals - a.rewardReferrals || b.referralCount - a.referralCount;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }, [users, search, minReferrals, sourceFilter, campaignFilter, dateFrom, dateTo, alphaFilter, sortKey]);

  const alphaStatuses = useMemo(
    () => Array.from(new Set(users.map(u => u.alphaStatus).filter((s): s is string => Boolean(s)))).sort(),
    [users]
  );
  const selectedUsers = useMemo(() => users.filter(u => selected.has(u.email)), [users, selected]);

  const toggle = useCallback((email: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
    setStatus(null);
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelected(new Set(filtered.map(u => u.email)));
    setStatus(`Selected all ${filtered.length} filtered ${filtered.length === 1 ? "user" : "users"}.`);
  }, [filtered]);

  const clearSelection = useCallback(() => { setSelected(new Set()); setStatus(null); }, []);

  const selectTopReferrers = useCallback(() => {
    const top = [...users].filter(u => u.referralCount > 0).sort((a, b) => b.referralCount - a.referralCount).slice(0, Math.max(0, topN)).map(u => u.email);
    setSelected(new Set(top));
    setStatus(`Selected top ${top.length} ${top.length === 1 ? "referrer" : "referrers"} by reward count.`);
  }, [users, topN]);

  const copyEmails = useCallback(async () => {
    if (selectedUsers.length === 0) return setStatus("No recipients selected.");
    const text = selectedUsers.map(u => u.email).join(", ");
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${selectedUsers.length} email${selectedUsers.length === 1 ? "" : "s"} to clipboard.`);
    } catch {
      setStatus("Clipboard blocked by browser — use Export CSV instead.");
    }
  }, [selectedUsers]);

  const exportCsv = useCallback(() => {
    const rows = selectedUsers.length > 0 ? selectedUsers : filtered;
    const header = ["name", "email", "ref_code", "referral_count", "reward_referrals", "source", "campaign", "signup_date", "alpha_status"];
    const body = rows.map((u: GrowthUser) =>
      [u.name, u.email, u.refCode, u.referralCount, u.rewardReferrals, u.source, u.campaign, u.createdAt.slice(0, 10), u.alphaStatus].map(csvCell).join(",")
    );
    const csv = [header.join(","), ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xyra-waitlist-${selectedUsers.length > 0 ? "selected" : "filtered"}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setStatus(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to CSV.`);
  }, [selectedUsers, filtered]);

  const emailSelected = useCallback(() => {
    if (selectedUsers.length === 0) return setStatus("Select at least one recipient first.");
    const payload = selectedUsers.map(u => ({ name: u.name, email: u.email, refCode: u.refCode }));
    try {
      sessionStorage.setItem(RECIPIENTS_KEY, JSON.stringify(payload));
      window.location.href = "/admin/growth/email";
    } catch {
      setStatus("Could not stage recipients (storage blocked). Use Export CSV instead.");
    }
  }, [selectedUsers]);

  const inputCls = "px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400 bg-white";
  const cardCls = "bg-white rounded-2xl border border-gray-200 p-6";
  const h2Cls = "font-[family-name:var(--font-playfair)] text-xl text-gray-900";
  const btnSecondary = "px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors";

  return (
    <div className="space-y-6">
      {/* SQL note */}
      {!alphaFieldsAvailable && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <span className="shrink-0 mt-0.5">⚠</span>
          <p className="leading-snug">
            Alpha fields (<code className="bg-amber-100 px-1 rounded">alpha_status</code>, <code className="bg-amber-100 px-1 rounded">alpha_invited_at</code>, <code className="bg-amber-100 px-1 rounded">admin_notes</code>) aren&apos;t in the database yet. Apply section 7 of <code className="bg-amber-100 px-1 rounded">supabase/setup.sql</code> to enable alpha status, invite tracking, and notes. Everything else works without it.
          </p>
        </div>
      )}

      {/* Leaderboard */}
      <div className={cardCls}>
        <h2 className={h2Cls}>Referral Leaderboard</h2>
        <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-1 mb-4 leading-snug max-w-3xl">
          Ranked by <strong>reward credit</strong> — the <code className="bg-gray-100 px-1 rounded text-xs">referral_count</code> stored at signup,
          governed by <code className="bg-gray-100 px-1 rounded text-xs">referred_by</code> (first-referral-wins). The <span className="font-medium">Recomputed</span> column
          recounts <code className="bg-gray-100 px-1 rounded text-xs">referred_by</code> rows live; if it differs, the stored counter drifted. This is
          <em> reward/leaderboard credit</em>, <strong>not</strong> marketing attribution — session/UTM-based attribution lives in <span className="font-medium">Analytics</span> and can differ for users who clicked a different link before signing up.
        </p>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="text-left">
                  <th className={`pb-2 ${LABEL}`}>#</th>
                  <th className={`pb-2 ${LABEL}`}>Name</th>
                  <th className={`pb-2 ${LABEL}`}>Email</th>
                  <th className={`pb-2 ${LABEL}`}>Ref Code</th>
                  <th className={`pb-2 text-right ${LABEL}`}>Reward Count</th>
                  <th className={`pb-2 text-right ${LABEL}`}>Recomputed</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.email} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-sm text-gray-400 tabular-nums">{i + 1}</td>
                    <td className="py-2 text-sm font-medium text-gray-800">{r.name ?? "—"}</td>
                    <td className="py-2 text-sm text-gray-600">{r.email}</td>
                    <td className="py-2 text-sm font-mono text-gray-600">{r.refCode ?? "—"}</td>
                    <td className="py-2 text-sm text-gray-900 text-right font-semibold tabular-nums">{r.referralCount}</td>
                    <td className={`py-2 text-sm text-right tabular-nums ${r.rewardReferrals !== r.referralCount ? "text-amber-600 font-semibold" : "text-gray-400"}`}>{r.rewardReferrals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Waitlist / Alpha candidates */}
      <div className={cardCls}>
        <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
          <div>
            <h2 className={h2Cls}>Waitlist &amp; Alpha Candidates</h2>
            <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-gray-500 mt-0.5">Filter and search, then select people to email or export.</p>
          </div>
          <span className="font-[family-name:var(--font-jetbrains)] text-xs text-gray-500">{filtered.length.toLocaleString()} shown</span>
        </div>

        {/* Filters */}
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Search name, email, or ref code" value={search} onChange={e => setSearch(e.target.value)} />
            <label className="flex items-center gap-1.5"><span className={LABEL}>Min refs</span><input type="number" min={0} className={`${inputCls} w-20`} value={minReferrals} onChange={e => setMinReferrals(Math.max(0, parseInt(e.target.value) || 0))} /></label>
            <select className={inputCls} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
              <option value="">All sources</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {campaigns.length > 0 && (
              <select className={inputCls} value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
                <option value="">All campaigns</option>
                {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1.5"><span className={LABEL}>From</span><input type="date" className={inputCls} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
            <label className="flex items-center gap-1.5"><span className={LABEL}>To</span><input type="date" className={inputCls} value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
            {alphaFieldsAvailable && (
              <select className={inputCls} value={alphaFilter} onChange={e => setAlphaFilter(e.target.value)}>
                <option value="">All alpha statuses</option>
                <option value="__none__">No status</option>
                {alphaStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select className={inputCls} value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
              <option value="recent">Sort: Newest</option>
              <option value="referrals">Sort: Referral count</option>
              <option value="reward">Sort: Reward (recomputed)</option>
            </select>
          </div>
        </div>

        {/* Selection action bar */}
        <div className="flex flex-wrap items-center gap-2 mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
          <span className="font-[family-name:var(--font-jetbrains)] text-xs font-semibold text-gray-900">
            {selected.size} selected
          </span>
          <span className="text-gray-200">·</span>
          <button onClick={selectAllFiltered} className={btnSecondary}>Select filtered ({filtered.length})</button>
          <label className="flex items-center gap-1.5"><span className={LABEL}>Top</span><input type="number" min={1} className={`${inputCls} w-16`} value={topN} onChange={e => setTopN(Math.max(1, parseInt(e.target.value) || 1))} /></label>
          <button onClick={selectTopReferrers} className={btnSecondary}>Select top referrers</button>
          {selected.size > 0 && <button onClick={clearSelection} className={btnSecondary}>Clear</button>}
          <div className="flex-1" />
          <button onClick={copyEmails} disabled={selected.size === 0} className={`${btnSecondary} disabled:opacity-40`}>Copy emails</button>
          <button onClick={exportCsv} className={btnSecondary}>Export CSV</button>
          <button onClick={emailSelected} disabled={selected.size === 0} className="px-4 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Email {selected.size > 0 ? selected.size : ""} selected →
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Copy/Export use your <strong>selection</strong> (or the current filtered view if nothing is selected). “Email selected →” stages recipients and opens Email Ops.
        </p>

        {status && <p className="text-xs text-gray-600 mb-3 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{status}</p>}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="text-left">
                <th className="pb-2 w-8"></th>
                <th className={`pb-2 ${LABEL}`}>Name</th>
                <th className={`pb-2 ${LABEL}`}>Email</th>
                <th className={`pb-2 ${LABEL}`}>Signup</th>
                <th className={`pb-2 ${LABEL}`}>Ref Code</th>
                <th className={`pb-2 ${LABEL}`}>Referred By</th>
                <th className={`pb-2 text-right ${LABEL}`}>Refs</th>
                <th className={`pb-2 ${LABEL}`}>Source</th>
                <th className={`pb-2 ${LABEL}`}>Campaign</th>
                {alphaFieldsAvailable && <th className={`pb-2 ${LABEL}`}>Alpha</th>}
                {alphaFieldsAvailable && <th className={`pb-2 ${LABEL}`}>Invited</th>}
                {alphaFieldsAvailable && <th className={`pb-2 ${LABEL}`}>Notes</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={alphaFieldsAvailable ? 12 : 9} className="py-6 text-center text-sm text-gray-400 italic">No users match these filters.</td></tr>
              ) : (
                filtered.map(u => {
                  const isSel = selected.has(u.email);
                  return (
                    <tr key={u.email} className={`border-b border-gray-50 last:border-0 ${isSel ? "bg-gray-50" : ""}`}>
                      <td className="py-2"><input type="checkbox" checked={isSel} onChange={() => toggle(u.email)} aria-label={`Select ${u.email}`} /></td>
                      <td className="py-2 text-sm font-medium text-gray-800 whitespace-nowrap">{u.name ?? "—"}</td>
                      <td className="py-2 text-sm text-gray-600">{u.email}</td>
                      <td className="py-2 text-xs text-gray-400 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                      <td className="py-2 text-sm font-mono text-gray-600">{u.refCode ?? "—"}</td>
                      <td className="py-2 text-sm font-mono text-gray-500">{u.referredBy ?? "—"}</td>
                      <td className="py-2 text-sm text-gray-900 text-right font-semibold tabular-nums">{u.referralCount}</td>
                      <td className="py-2 text-sm text-gray-600 capitalize">{u.source}</td>
                      <td className="py-2 text-sm text-gray-500">{u.campaign ?? "—"}</td>
                      {alphaFieldsAvailable && <td className="py-2 text-sm text-gray-600">{u.alphaStatus ?? "—"}</td>}
                      {alphaFieldsAvailable && <td className="py-2 text-xs text-gray-400 whitespace-nowrap">{u.alphaInvitedAt ? fmtDate(u.alphaInvitedAt) : "—"}</td>}
                      {alphaFieldsAvailable && <td className="py-2 text-xs text-gray-400 max-w-[160px] truncate" title={u.adminNotes ?? ""}>{u.adminNotes ?? "—"}</td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
