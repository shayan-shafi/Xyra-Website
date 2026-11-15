"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShipEvent, ShipKind, SummaryItem } from "@/lib/changelog";
import type { ChangelogData, Compare, DayPoint } from "./data";

// Changelog tab UI. Light admin theme (the admin has no dark mode).
// Release kinds use categorical slots 1–5 of the validated default palette;
// three of them sit under 3:1 on white, so a kind is ALWAYS shown with its
// text label, never as a bare colored mark.

const KINDS: { key: ShipKind; label: string; color: string }[] = [
  { key: "web", label: "Web app", color: "#2a78d6" },
  { key: "website", label: "Website", color: "#eb6834" },
  { key: "functions", label: "Functions", color: "#1baf7a" },
  { key: "database", label: "Database", color: "#eda100" },
  { key: "phone", label: "Phone", color: "#e87ba4" },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.key, k])) as Record<ShipKind, (typeof KINDS)[number]>;

const TZ = "America/Chicago";
const dayKey = (t: string) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const shortDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const clock = (t: string) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
const ago = (t: string) => {
  const d = Math.floor((Date.now() - Date.parse(t)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

const SECTION_LABEL: Record<SummaryItem["type"], string> = { new: "New", fixed: "Fixed", under_the_hood: "Under the hood" };

function KindBadge({ kind }: { kind: ShipKind }) {
  const k = KIND[kind];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 font-[family-name:var(--font-jetbrains)]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} aria-hidden="true" />
      {k.label}
    </span>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Chart: active people (line) over signups (bars), release ticks ──────────

const W = 900;
const GUT = 34;
const PLOT = W - GUT - 8;

function niceTop(max: number) {
  const m = Math.max(1, Math.ceil(max));
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((s) => m / s <= 4) ?? 1000;
  let top = Math.ceil(m / step) * step;
  if (m / top > 0.85) top += step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

function ReleaseChart({ series, byDay, kinds }: { series: DayPoint[]; byDay: Map<string, ShipEvent[]>; kinds: Set<ShipKind> }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const n = series.length;
  const x = (i: number) => GUT + (n <= 1 ? PLOT / 2 : (i * PLOT) / (n - 1));
  const slot = PLOT / Math.max(1, n - 1);

  const A_TOP = 22, A_H = 150; // active panel
  const S_TOP = A_TOP + A_H + 46, S_H = 70; // signups panel
  const H = S_TOP + S_H + 26;

  const a = niceTop(Math.max(...series.map((p) => p.active)));
  const s = niceTop(Math.max(...series.map((p) => p.signups)));
  const ya = (v: number) => A_TOP + A_H - (v / a.top) * A_H;
  const ys = (v: number) => S_TOP + S_H - (v / s.top) * S_H;
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${ya(p.active).toFixed(1)}`).join("");

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - GUT) / PLOT) * (n - 1)))));
  };

  const hp = hover !== null ? series[hover] : null;
  const hReleases = hp ? (byDay.get(hp.day) ?? []).filter((e) => kinds.has(e.kind)) : [];
  const labelEvery = Math.ceil(n / 8);

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none select-none"
        role="img"
        aria-label="Active people and signups per day, with release markers"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <text x={GUT} y={12} className="fill-gray-500" fontSize="11">Active people per day</text>
        {a.ticks.map((t) => (
          <g key={`a${t}`}>
            <line x1={GUT} x2={W - 8} y1={ya(t)} y2={ya(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={GUT - 6} y={ya(t) + 3.5} textAnchor="end" fontSize="10" className="fill-gray-400">{t}</text>
          </g>
        ))}

        {/* release ticks: one per kind per day, side by side within the day's slot */}
        {series.map((p, i) => {
          const evs = (byDay.get(p.day) ?? []).filter((e) => kinds.has(e.kind));
          const ks = KINDS.filter((k) => evs.some((e) => e.kind === k.key));
          return ks.map((k, j) => {
            const off = (j - (ks.length - 1) / 2) * Math.min(4, slot / Math.max(1, ks.length));
            return (
              <line key={`${p.day}${k.key}`} x1={x(i) + off} x2={x(i) + off} y1={A_TOP} y2={S_TOP + S_H}
                stroke={k.color} strokeWidth={2} strokeOpacity={0.55} />
            );
          });
        })}

        <path d={line} fill="none" stroke="#111827" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <text x={GUT} y={S_TOP - 10} className="fill-gray-500" fontSize="11">Signups per day</text>
        {s.ticks.map((t) => (
          <g key={`s${t}`}>
            <line x1={GUT} x2={W - 8} y1={ys(t)} y2={ys(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={GUT - 6} y={ys(t) + 3.5} textAnchor="end" fontSize="10" className="fill-gray-400">{t}</text>
          </g>
        ))}
        {series.map((p, i) => {
          if (!p.signups) return null;
          const bw = Math.max(2, Math.min(10, slot - 2));
          const top = ys(p.signups);
          const h = S_TOP + S_H - top;
          const r = Math.min(4, bw / 2, h);
          return (
            <path key={`b${p.day}`}
              d={`M${x(i) - bw / 2},${S_TOP + S_H} V${top + r} Q${x(i) - bw / 2},${top} ${x(i) - bw / 2 + r},${top} H${x(i) + bw / 2 - r} Q${x(i) + bw / 2},${top} ${x(i) + bw / 2},${top + r} V${S_TOP + S_H} Z`}
              fill="#6b7280" />
          );
        })}

        {series.map((p, i) => {
          const last = i === n - 1;
          // every Nth day + the last, never a label crowding the last one
          if (!last && (i % labelEvery !== 0 || n - 1 - i < labelEvery * 0.6)) return null;
          return (
            <text key={`x${p.day}`} x={x(i)} y={H - 8} textAnchor={last ? "end" : i === 0 ? "start" : "middle"} fontSize="10" className="fill-gray-400">{shortDay(p.day)}</text>
          );
        })}

        {hp && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={A_TOP} y2={S_TOP + S_H} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={ya(hp.active)} r={4.5} fill="#111827" stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hp && hover !== null && (
        <div
          className="absolute top-6 z-10 w-64 rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg pointer-events-none"
          style={hover > n / 2 ? { right: `${100 - (x(hover) / W) * 100 + 2}%` } : { left: `${(x(hover) / W) * 100 + 2}%` }}
        >
          <p className="font-medium text-gray-900">{longDay(hp.day)}</p>
          <p className="text-gray-600 mt-1 tabular-nums">{hp.active} active · {hp.signups} signups · {hp.messages} messages</p>
          {hReleases.length > 0 && (
            <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
              {hReleases.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <KindBadge kind={e.kind} />
                  <span className="block text-gray-600 mt-0.5">{e.summary?.headline ?? e.commits[0]?.subject ?? "release"}</span>
                </li>
              ))}
              {hReleases.length > 5 && <li className="text-gray-400">+{hReleases.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Before / after for a release day ─────────────────────────────────────────

function Delta({ label, before, after }: { label: string; before: number; after: number }) {
  const d = after - before;
  const pct = before > 0 ? Math.round((d / before) * 100) : null;
  const arrow = Math.abs(d) < 0.05 ? "→" : d > 0 ? "↑" : "↓";
  return (
    <span className="tabular-nums">
      <span className="text-gray-500">{label}</span>{" "}
      <span className="text-gray-900">{before.toFixed(1)} {arrow} {after.toFixed(1)}</span>
      {pct !== null && Math.abs(d) >= 0.05 && <span className="text-gray-500"> ({pct > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}

function CompareRow({ c }: { c: Compare }) {
  if (c.days === 0)
    return <div className="text-xs text-gray-500">before/after shows once the first full day after this release is done</div>;
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      <span className="text-gray-500">
        avg/day, 7 days before → {c.days < 7 ? `${c.days} of 7 days after so far` : "7 days after"}:
      </span>
      <Delta label="active" before={c.activeBefore} after={c.activeAfter} />
      <Delta label="signups" before={c.signupsBefore} after={c.signupsAfter} />
      <Delta label="messages" before={c.messagesBefore} after={c.messagesAfter} />
    </div>
  );
}

// ── One release ──────────────────────────────────────────────────────────────

async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

function ReleaseCard({ e }: { e: ShipEvent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [headline, setHeadline] = useState(e.summary?.headline ?? "");
  const [draft, setDraft] = useState(() =>
    (["new", "fixed", "under_the_hood"] as const).map((t) =>
      (e.summary?.items ?? []).filter((i) => i.type === t).map((i) => i.text).join("\n"),
    ),
  );
  const [note, setNote] = useState(e.note ?? "");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); router.refresh(); } catch (x) { setErr(String((x as Error).message ?? x)); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    const types = ["new", "fixed", "under_the_hood"] as const;
    const items = types.flatMap((t, i) => draft[i].split("\n").map((s) => s.trim()).filter(Boolean).map((text) => ({ type: t, text })));
    await post("/admin/changelog/save", { id: e.id, headline, items, note });
    setEditing(false);
  });

  const ref = e.kind === "phone"
    ? (e.ref ? `build ${e.ref}` : e.status === "queued" ? "build queued" : null)
    : e.kind === "functions" || e.kind === "database" ? e.ref : null;

  return (
    <li className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <KindBadge kind={e.kind} />
        <span className="text-xs text-gray-500 tabular-nums">{clock(e.shipped_at)}</span>
        {e.sha && <code className="text-xs text-gray-500">{e.sha.slice(0, 7)}</code>}
        {e.branch && <span className="text-xs text-gray-400">{e.branch}</span>}
        {ref && <span className="text-xs text-gray-500 truncate max-w-[16rem]">{ref}</span>}
        {e.status !== "live" && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-700">{e.status === "queued" ? "queued, not on TestFlight yet" : "failed"}</span>
        )}
        {e.summary_edited && <span className="text-xs text-gray-400">edited</span>}
      </div>

      {!editing ? (
        <>
          <p className="mt-2 text-gray-900 font-medium">
            {e.summary?.headline ?? e.commits[0]?.subject ?? "No commits recorded"}
          </p>
          {e.summary && e.summary.items.length > 0 && (
            <div className="mt-2 space-y-2">
              {(["new", "fixed", "under_the_hood"] as const).map((t) => {
                const items = e.summary!.items.filter((i) => i.type === t);
                if (!items.length) return null;
                return (
                  <div key={t}>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">{SECTION_LABEL[t]}</p>
                    <ul className="mt-0.5 space-y-0.5 text-sm text-gray-700 list-disc pl-5">
                      {items.map((i, k) => <li key={k}>{i.text}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {e.note && <p className="mt-2 text-sm text-gray-600 italic">{e.note}</p>}
        </>
      ) : (
        <div className="mt-3 space-y-2">
          <input value={headline} onChange={(x) => setHeadline(x.target.value)} placeholder="Headline"
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          {(["New", "Fixed", "Under the hood"] as const).map((label, i) => (
            <label key={label} className="block">
              <span className="text-[11px] uppercase tracking-wide text-gray-400">{label} (one per line)</span>
              <textarea value={draft[i]} rows={Math.max(2, draft[i].split("\n").length)}
                onChange={(x) => setDraft((d) => d.map((v, j) => (j === i ? x.target.value : v)))}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
            </label>
          ))}
          <label className="block">
            <span className="text-[11px] uppercase tracking-wide text-gray-400">Note</span>
            <textarea value={note} rows={2} onChange={(x) => setNote(x.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {e.commits.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400">
            {open ? "Hide" : "Show"} {e.commits.length} commit{e.commits.length === 1 ? "" : "s"}
          </button>
        )}
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400">Edit</button>
        ) : (
          <>
            <button disabled={busy} onClick={save} className="px-2.5 py-1 rounded-full bg-black text-white disabled:opacity-50">Save</button>
            <button disabled={busy} onClick={() => setEditing(false)} className="px-2.5 py-1 rounded-full border border-gray-200 text-gray-600">Cancel</button>
          </>
        )}
        {!editing && e.commits.length > 0 && (
          <button disabled={busy}
            onClick={() => run(() => e.summary_edited
              ? post("/admin/changelog/save", { id: e.id, resetSummary: true }).then(() => post("/admin/changelog/summarize", { id: e.id }))
              : post("/admin/changelog/summarize", { id: e.id }))}
            className="px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50">
            {busy ? "Writing…" : e.summary ? "Rewrite summary" : "Write summary"}
          </button>
        )}
        {err && <span className="text-red-700">{err}</span>}
      </div>

      {open && (
        <ul className="mt-3 border-t border-gray-100 pt-3 space-y-1 text-xs">
          {e.commits.map((c) => (
            <li key={c.sha} className="flex gap-2">
              <code className="text-gray-400 shrink-0">{c.sha.slice(0, 7)}</code>
              <span className="text-gray-700">{c.subject}</span>
              {c.areas.length > 0 && <span className="text-gray-400 shrink-0">{c.areas.join(" · ")}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ChangelogDashboard({ data }: { data: ChangelogData }) {
  const router = useRouter();
  const [kinds, setKinds] = useState<Set<ShipKind>>(new Set(KINDS.map((k) => k.key)));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const visible = useMemo(() => data.events.filter((e) => kinds.has(e.kind)), [data.events, kinds]);
  const byDay = useMemo(() => {
    const m = new Map<string, ShipEvent[]>();
    for (const e of data.events) {
      const d = dayKey(e.shipped_at);
      const l = m.get(d);
      if (l) l.push(e); else m.set(d, [e]);
    }
    return m;
  }, [data.events]);
  const visibleDays = useMemo(() => {
    const days: string[] = [];
    for (const e of visible) { const d = dayKey(e.shipped_at); if (days[days.length - 1] !== d) days.push(d); }
    return days;
  }, [visible]);

  const week = Date.now() - 7 * 86_400_000;
  const lastWeek = data.events.filter((e) => Date.parse(e.shipped_at) >= week && e.status !== "failed");
  const weekByKind = KINDS.map((k) => [k.label, lastWeek.filter((e) => e.kind === k.key).length] as const).filter(([, n]) => n);
  const missingSummaries = data.events.filter((e) => !e.summary && e.commits.length > 0).length;

  const toggle = (k: ShipKind) =>
    setKinds((cur) => {
      const next = new Set(cur);
      if (next.has(k) && next.size === 1) return new Set(KINDS.map((x) => x.key)); // last one off → all on
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const writeMissing = async () => {
    setBusy(true); setMsg(null);
    try {
      const j = await post("/admin/changelog/summarize", { missing: true });
      setMsg(`Wrote ${j.written} summar${j.written === 1 ? "y" : "ies"}.`);
      router.refresh();
    } catch (x) { setMsg(String((x as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Releases, last 7 days" value={String(lastWeek.length)} sub={weekByKind.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(" · ") || "nothing shipped"} />
        <Tile label="Last phone build" value={data.lastPhone ? ago(data.lastPhone.shipped_at) : "none logged"}
          sub={data.lastPhone ? `${data.lastPhone.ref ? `build ${data.lastPhone.ref} · ` : ""}${data.lastPhone.status === "queued" ? "queued" : "live"}` : undefined} />
        <Tile label="Phone changes waiting for a build" value={String(data.pendingPhone.length)} sub="live on web or server, not in a phone build" />
        <Tile label="Releases logged" value={String(data.events.length)} sub={data.events.length ? `since ${shortDay(dayKey(data.events[data.events.length - 1].shipped_at))}` : undefined} />
      </div>

      {/* filters: one row, above the charts */}
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button key={k.key} onClick={() => toggle(k.key)} aria-pressed={kinds.has(k.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
              kinds.has(k.key) ? "bg-white border-gray-400 text-gray-900" : "bg-gray-100 border-gray-200 text-gray-400"}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: kinds.has(k.key) ? k.color : "#d1d5db" }} aria-hidden="true" />
            {k.label}
          </button>
        ))}
        {missingSummaries > 0 && (
          <button onClick={writeMissing} disabled={busy}
            className="ml-auto px-3 py-1.5 rounded-full text-xs bg-black text-white disabled:opacity-50">
            {busy ? "Writing…" : `Write ${Math.min(10, missingSummaries)} missing summar${missingSummaries === 1 ? "y" : "ies"}`}
          </button>
        )}
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
        {data.series ? (
          <>
            <ReleaseChart series={data.series} byDay={byDay} kinds={kinds} />
            <p className="mt-3 text-xs text-gray-500">
              Colored lines are release days (hover for what shipped). Active = opened the app or sent a message; team accounts left out.
              With this few people a number moves for many reasons, so read a jump next to a release as a hint, not proof.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            The daily numbers come from the app database. Set <code className="px-1 py-0.5 bg-gray-100 rounded">APP_SUPABASE_SERVICE_ROLE_KEY</code> (same key as the Users tab) to see them.
          </p>
        )}
      </div>

      {data.pendingPhone.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
          <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">Waiting for a phone build</h2>
          <p className="text-xs text-gray-500 mt-0.5">Commits that touch the phone app or shared code, already live another way, in no phone build yet.</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.pendingPhone.slice(0, 30).map((p) => (
              <li key={p.sha} className="flex flex-wrap gap-x-2">
                <code className="text-xs text-gray-400 pt-0.5">{p.sha.slice(0, 7)}</code>
                <span className="text-gray-800">{p.subject}</span>
                <span className="text-xs text-gray-400 pt-0.5">live via {KIND[p.via].label.toLowerCase()} {ago(p.shippedAt)}</span>
              </li>
            ))}
          </ul>
          {data.pendingPhone.length > 30 && <p className="text-xs text-gray-400 mt-2">+{data.pendingPhone.length - 30} more</p>}
        </div>
      )}

      {visibleDays.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">
          No releases logged yet. They appear here after the next ship script or xyra.dev deploy runs <code className="px-1 py-0.5 bg-gray-100 rounded">log-ship.mjs</code>.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleDays.map((d) => (
            <section key={d}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">{longDay(d)}</h2>
              </div>
              {data.compareByDay[d] && <div className="mb-2"><CompareRow c={data.compareByDay[d]} /></div>}
              <ul className="space-y-3">
                {visible.filter((e) => dayKey(e.shipped_at) === d).map((e) => <ReleaseCard key={e.id} e={e} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
