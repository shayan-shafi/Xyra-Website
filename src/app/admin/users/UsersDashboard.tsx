"use client";

import { useCallback, useMemo, useState } from "react";
import type { AlphaUser, UsersData, UserStatus } from "./data";

// sessionStorage key the Email Ops page reads to prefill recipients (same
// contract as the Growth tab's "Email selected").
const RECIPIENTS_KEY = "xyra_growth_recipients";
const GROUPS_API = "/admin/growth/email/recipient-groups";

const LABEL = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";
const TH = "pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em] whitespace-nowrap";

type SortKey = "lastActive" | "signedUp" | "activeDays" | "dashboards" | "chats" | "email";

const STATUS_META: Record<UserStatus, { label: string; hint: string; pill: string; dot: string }> = {
  active: { label: "Active", hint: "used the app in the last 7 days", pill: "bg-green-100 text-green-700", dot: "bg-green-500" },
  cooling: { label: "Cooling", hint: "8–30 days since last activity", pill: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  dormant: { label: "Dormant", hint: "30+ days since last activity", pill: "bg-red-100 text-red-700", dot: "bg-red-500" },
  idle: { label: "Never used", hint: "has an account, created nothing yet", pill: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  invited: { label: "Invited", hint: "invited to the alpha, no account yet", pill: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  waitlist: { label: "Waitlist", hint: "on the waitlist, not invited", pill: "bg-gray-100 text-gray-500", dot: "bg-gray-300" },
};
const STATUS_ORDER: UserStatus[] = ["active", "cooling", "dormant", "idle", "invited", "waitlist"];

// Ready-made segments — the "who do I email for what" presets.
const SEGMENTS: { key: string; label: string; hint: string; match: (u: AlphaUser) => boolean }[] = [
  { key: "all-accounts", label: "All accounts", hint: "everyone who signed up", match: (u) => u.hasAccount },
  { key: "power", label: "Power users", hint: "5+ active days in the last 30", match: (u) => u.activeDays30 >= 5 },
  { key: "winback", label: "Win-back", hint: "were active, now quiet 8+ days", match: (u) => u.status === "cooling" || u.status === "dormant" },
  { key: "stuck", label: "Stuck at signup", hint: "account but never created anything", match: (u) => u.status === "idle" },
  { key: "invited-no-account", label: "Invited, no account", hint: "nudge them to install", match: (u) => u.status === "invited" },
  { key: "feedback-givers", label: "Gave feedback", hint: "sent at least one ticket", match: (u) => u.feedback > 0 },
  { key: "no-push", label: "Push off", hint: "accounts with no push token", match: (u) => u.hasAccount && !u.pushEnabled },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtAgo(days: number | null): string {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function csvCell(val: unknown): string {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function StatCard({ label, value, sub, onClick, active }: { label: string; value: number; sub?: string; onClick?: () => void; active?: boolean }) {
  const cls = `bg-white rounded-2xl border p-4 text-left transition-colors ${active ? "border-black" : "border-gray-200"} ${onClick ? "hover:border-gray-400" : ""}`;
  const body = (
    <>
      <div className={LABEL}>{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

function Pill({ status }: { status: UserStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.pill}`} title={m.hint}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function UsersDashboard({ data }: { data: UsersData }) {
  const { users, funnel, byStatus } = data;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [segment, setSegment] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState("");

  const q = search.trim().toLowerCase();
  const seg = SEGMENTS.find((s) => s.key === segment);
  const matchesSearch = useCallback(
    (u: AlphaUser) => !q || `${u.name ?? ""} ${u.email} ${u.source ?? ""} ${u.alphaStatus ?? ""}`.toLowerCase().includes(q),
    [q],
  );

  // Counts shown on the pills are CONTEXTUAL: a status pill counts people
  // matching that status AND the active segment/search, and vice versa — so a
  // combination that would yield nobody reads "0" before you click it.
  const statusCounts = useMemo(() => {
    const c: Record<UserStatus, number> = { active: 0, cooling: 0, dormant: 0, idle: 0, invited: 0, waitlist: 0 };
    for (const u of users) if (matchesSearch(u) && (!seg || seg.match(u))) c[u.status] += 1;
    return c;
  }, [users, matchesSearch, seg]);
  const segmentCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const sg of SEGMENTS) c[sg.key] = users.filter((u) => matchesSearch(u) && (!statusFilter || u.status === statusFilter) && sg.match(u)).length;
    return c;
  }, [users, matchesSearch, statusFilter]);
  const allCount = useMemo(() => users.filter((u) => matchesSearch(u) && (!seg || seg.match(u))).length, [users, matchesSearch, seg]);

  const activeFilters = [
    statusFilter ? { key: "status", label: `Status: ${STATUS_META[statusFilter].label}`, clear: () => setStatusFilter("") } : null,
    seg ? { key: "segment", label: `Segment: ${seg.label}`, clear: () => setSegment("") } : null,
    q ? { key: "search", label: `Search: “${search.trim()}”`, clear: () => setSearch("") } : null,
  ].filter((f): f is { key: string; label: string; clear: () => void } => f !== null);
  const clearAll = () => { setStatusFilter(""); setSegment(""); setSearch(""); };

  const filtered = useMemo(() => {
    const list = users.filter((u) => {
      if (!matchesSearch(u)) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (seg && !seg.match(u)) return false;
      return true;
    });
    const t = (iso: string | null) => (iso ? new Date(iso).getTime() : -1);
    list.sort((a, b) => {
      switch (sortKey) {
        case "lastActive": return t(b.lastActiveAt) - t(a.lastActiveAt);
        case "signedUp": return t(b.signedUpAt ?? b.waitlistedAt) - t(a.signedUpAt ?? a.waitlistedAt);
        case "activeDays": return b.activeDays30 - a.activeDays30;
        case "dashboards": return b.dashboards - a.dashboards;
        case "chats": return b.chats + b.dumps - (a.chats + a.dumps);
        case "email": return a.email.localeCompare(b.email);
      }
    });
    return list;
  }, [users, matchesSearch, statusFilter, seg, sortKey]);

  // What actions operate on: the checked rows, else everything currently shown.
  const targets = useMemo(
    () => (selected.size > 0 ? filtered.filter((u) => selected.has(u.key)) : filtered),
    [filtered, selected],
  );

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === filtered.length && filtered.length > 0 ? new Set() : new Set(filtered.map((u) => u.key))));
  }, [filtered]);

  const exportCsv = useCallback(() => {
    const header = ["email", "name", "status", "signed_up", "last_active", "days_since_active", "active_days_30", "dashboards", "items", "chats", "dumps", "feedback", "push", "subscription", "alpha_status", "source"];
    const rows = targets.map((u) =>
      [u.email, u.name, u.status, u.signedUpAt?.slice(0, 10), u.lastActiveAt?.slice(0, 10), u.daysSinceActive, u.activeDays30, u.dashboards, u.items, u.chats, u.dumps, u.feedback, u.pushEnabled ? "on" : "off", u.subscription, u.alphaStatus, u.source]
        .map(csvCell).join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `xyra-users-${segment || statusFilter || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [targets, segment, statusFilter]);

  const copyEmails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(targets.map((u) => u.email).join(", "));
      setMsg(`Copied ${targets.length} email${targets.length === 1 ? "" : "s"}.`);
    } catch {
      setMsg("Clipboard blocked — use Export CSV.");
    }
  }, [targets]);

  const emailThese = useCallback(() => {
    try {
      const payload = targets.map((u) => ({ name: u.name, email: u.email, refCode: null }));
      sessionStorage.setItem(RECIPIENTS_KEY, JSON.stringify(payload));
      window.location.href = "/admin/growth/email";
    } catch {
      setMsg("Could not stage recipients (storage blocked). Use Export CSV instead.");
    }
  }, [targets]);

  const saveGroup = useCallback(async () => {
    const seg = SEGMENTS.find((s) => s.key === segment);
    const name = groupName.trim() || (seg ? `${seg.label} — ${new Date().toISOString().slice(0, 10)}` : `Users ${statusFilter || "all"} — ${new Date().toISOString().slice(0, 10)}`);
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(GROUPS_API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: seg ? `Users tab · ${seg.hint}` : `Users tab · ${statusFilter || "all"}${search ? ` · "${search}"` : ""}`,
          members: targets.map((u) => ({ email: u.email, name: u.name })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? `Save failed (${res.status})`); return; }
      setMsg(`Saved group “${json.name}” with ${json.memberCount} recipient(s) — it's ready in Email Ops → Groups.`);
      setGroupName("");
    } catch (e) {
      setMsg(`Save error: ${String(e)}`);
    } finally { setBusy(false); }
  }, [targets, groupName, segment, statusFilter, search]);

  const activationPct = funnel.accounts ? Math.round((funnel.activated / funnel.accounts) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Funnel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Waitlist" value={funnel.waitlist} sub={`${funnel.invited} invited`} onClick={() => { setStatusFilter("waitlist"); setSegment(""); }} active={statusFilter === "waitlist" && !segment} />
        <StatCard label="Accounts" value={funnel.accounts} sub="created an account" onClick={() => { setSegment("all-accounts"); setStatusFilter(""); }} active={segment === "all-accounts" && !statusFilter} />
        <StatCard label="Activated" value={funnel.activated} sub={`${activationPct}% of accounts`} />
        <StatCard label="Active 7d" value={funnel.active7} sub="used this week" onClick={() => { setStatusFilter("active"); setSegment(""); }} active={statusFilter === "active"} />
        <StatCard label="Active 30d" value={funnel.active30} sub="used this month" />
        <StatCard label="Gone quiet" value={byStatus.cooling + byStatus.dormant} sub="cooling + dormant" onClick={() => { setSegment("winback"); setStatusFilter(""); }} active={segment === "winback"} />
      </div>

      {/* Status strip */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setStatusFilter("")} className={`px-3 py-1 rounded-full text-xs font-medium border ${statusFilter === "" ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            All <span className="opacity-60 tabular-nums">{allCount}</span>
          </button>
          {STATUS_ORDER.map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(statusFilter === s ? "" : s)} title={STATUS_META[s].hint}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusFilter === s ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label} <span className="opacity-60 tabular-nums">{statusCounts[s]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className={`${LABEL} mr-1`}>Segments</span>
          {SEGMENTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSegment(segment === s.key ? "" : s.key)} title={s.hint}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${segment === s.key ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {s.label} <span className="opacity-60 tabular-nums">{segmentCounts[s.key]}</span>
            </button>
          ))}
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className={`${LABEL} mr-1`}>Showing</span>
            {activeFilters.map((f) => (
              <button key={f.key} type="button" onClick={f.clear} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 hover:bg-gray-200" title="Remove this filter">
                {f.label} <span aria-hidden="true" className="text-gray-400">×</span>
              </button>
            ))}
            {activeFilters.length > 1 && <span className="text-[11px] text-gray-400">(all must match)</span>}
            <button type="button" onClick={clearAll} className="ml-auto text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900">Clear all</button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, source…"
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white">
          <option value="lastActive">Sort: last active</option>
          <option value="signedUp">Sort: signed up</option>
          <option value="activeDays">Sort: days used (30d)</option>
          <option value="dashboards">Sort: dashboards</option>
          <option value="chats">Sort: chats + dumps</option>
          <option value="email">Sort: email</option>
        </select>
        <span className="text-xs text-gray-400 tabular-nums">
          {filtered.length} shown{selected.size > 0 && ` · ${selected.size} selected`}
        </span>
        <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
        <button type="button" onClick={emailThese} disabled={targets.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black text-white disabled:opacity-40">
          Email {selected.size > 0 ? "selected" : "these"} ({targets.length})
        </button>
        <button type="button" onClick={copyEmails} disabled={targets.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-gray-400 disabled:opacity-40">Copy emails</button>
        <button type="button" onClick={exportCsv} disabled={targets.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-gray-400 disabled:opacity-40">Export CSV</button>
        <div className="flex items-center gap-1.5">
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name (optional)"
            className="w-44 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400" />
          <button type="button" onClick={saveGroup} disabled={busy || targets.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-gray-400 disabled:opacity-40">
            {busy ? "Saving…" : "Save as group"}
          </button>
        </div>
        {msg && <p className="w-full text-xs text-gray-600 mt-1">{msg}</p>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-500">
            <p>
              No one matches{activeFilters.length > 0 ? ` ${activeFilters.map((f) => f.label.toLowerCase()).join(" + ")}` : ""}.
              {activeFilters.length > 1 && " Those filters combine — remove one above."}
            </p>
            {activeFilters.length > 0 && (
              <button type="button" onClick={clearAll} className="mt-2 text-xs text-gray-700 underline underline-offset-2">Clear all filters</button>
            )}
          </div>
        ) : (
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 pr-2 w-6"><input type="checkbox" aria-label="Select all" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th className={TH}>User</th>
                <th className={TH}>Status</th>
                <th className={TH}>Last active</th>
                <th className={`${TH} text-right`} title="Distinct days with activity in the last 30">Days/30</th>
                <th className={`${TH} text-right`}>Boards</th>
                <th className={`${TH} text-right`}>Items</th>
                <th className={`${TH} text-right`} title="User chat messages + brain dumps">Chats</th>
                <th className={`${TH} text-right`}>Feedback</th>
                <th className={TH}>Signed up</th>
                <th className={TH}>Waitlist</th>
                <th className={TH}>Signals</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.key} className={`border-b border-gray-50 last:border-0 align-top ${selected.has(u.key) ? "bg-gray-50" : ""}`}>
                  <td className="py-2.5 pr-2"><input type="checkbox" aria-label={`Select ${u.email}`} checked={selected.has(u.key)} onChange={() => toggle(u.key)} /></td>
                  <td className="py-2.5 pr-3">
                    <div className="text-sm text-gray-900 font-medium leading-tight">{u.name ?? <span className="text-gray-400 italic">no name</span>}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{u.email}</div>
                  </td>
                  <td className="py-2.5 pr-3"><Pill status={u.status} /></td>
                  <td className="py-2.5 pr-3 text-xs text-gray-700 whitespace-nowrap">
                    {u.hasAccount ? <><span className="font-medium">{fmtAgo(u.daysSinceActive)}</span>{u.lastActiveAt && <span className="text-gray-400"> · {fmtDate(u.lastActiveAt)}</span>}</> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-sm text-right tabular-nums text-gray-800">{u.hasAccount ? u.activeDays30 : "—"}</td>
                  <td className="py-2.5 pr-3 text-sm text-right tabular-nums text-gray-600">{u.hasAccount ? u.dashboards : "—"}</td>
                  <td className="py-2.5 pr-3 text-sm text-right tabular-nums text-gray-600">{u.hasAccount ? u.items : "—"}</td>
                  <td className="py-2.5 pr-3 text-sm text-right tabular-nums text-gray-600">{u.hasAccount ? u.chats + u.dumps : "—"}</td>
                  <td className="py-2.5 pr-3 text-sm text-right tabular-nums text-gray-600">{u.feedback || <span className="text-gray-300">0</span>}</td>
                  <td className="py-2.5 pr-3 text-xs text-gray-500 whitespace-nowrap">
                    {u.signedUpAt ? fmtDate(u.signedUpAt) : <span className="text-gray-300">no account</span>}
                    {u.provider && u.provider !== "email" && <span className="ml-1 text-[10px] text-gray-400 uppercase">{u.provider}</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-gray-500 whitespace-nowrap">
                    {u.onWaitlist ? <>{u.alphaStatus ?? "joined"} <span className="text-gray-400">· {fmtDate(u.waitlistedAt)}</span>{u.source && <span className="text-gray-400"> · {u.source}</span>}</> : <span className="text-gray-300">not on list</span>}
                  </td>
                  <td className="py-2.5 text-[10px] text-gray-500 whitespace-nowrap space-x-1.5">
                    {u.hasAccount && <span className={u.pushEnabled ? "text-green-600" : "text-gray-300"} title={u.pushEnabled ? "push notifications on" : "no push token"}>push</span>}
                    {u.subscription && <span className="text-indigo-600" title={`subscription: ${u.subscription}`}>{u.subscription}</span>}
                    {u.adminNotes && <span className="text-gray-400" title={u.adminNotes}>note</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Activity = any dashboard, item, chat message, or brain dump the user created. Active ≤7d · Cooling 8–30d · Dormant &gt;30d ·
        “Never used” = account with zero activity. Waitlist rows are matched to accounts by email. Snapshot {new Date(data.generatedAt).toLocaleTimeString()}.
      </p>
    </div>
  );
}
