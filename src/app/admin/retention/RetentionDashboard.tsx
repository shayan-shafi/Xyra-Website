"use client";

import { useCallback, useMemo, useState } from "react";
import {
  COHORT_WINDOWS,
  cohorts,
  first72,
  fmtDuration,
  ladder,
  outcome72,
  pct,
  predictors,
  type Layer,
  type Outcome72,
  type RetentionData,
  type RetentionUser,
} from "./metrics";

// sessionStorage contract shared with the Users + Growth tabs — Email Ops reads
// this key to prefill recipients.
const RECIPIENTS_KEY = "xyra_growth_recipients";

const LABEL = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";
const TH = "pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em] whitespace-nowrap";
const CARD = "bg-white rounded-2xl border border-gray-200 p-5";
const H2 = "font-[family-name:var(--font-playfair)] text-xl text-gray-900";

// One data hue (magnitude) + a recessive gray for the comparison baseline.
const BLUE = "#2a78d6";
const BASELINE = "#d1d5db";
// Sequential ramp for the cohort heat table, light → dark.
const HEAT = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
// Step floors (%). Retention lives in the low range, so the ramp spends its
// resolution there instead of on 80–100% cells that never happen.
const HEAT_FLOORS = [1, 10, 20, 35, 50, 70];
const heatStep = (p: number | null) => (p === null ? -1 : HEAT_FLOORS.filter((f) => p >= f).length - 1);

const LAYER_META: Record<Layer, { tag: string; name: string }> = {
  1: { tag: "L1", name: "Brain dump → organized action" },
  2: { tag: "L2", name: "Smart nudges & reminders" },
  3: { tag: "L3", name: "Compounding memory" },
};

const OUTCOME_META: Record<Outcome72, { label: string; hint: string; pill: string; dot: string }> = {
  inflight: { label: "In first 72h", hint: "still inside their first 72 hours", pill: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  "inflight-quiet": { label: "Not back yet", hint: "past hour 24 of their first 72h and hasn't returned — the window to nudge", pill: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  kept: { label: "Kept", hint: "used Xyra on 2+ of their first 3 days", pill: "bg-green-100 text-green-700", dot: "bg-green-500" },
  oneday: { label: "One and done", hint: "used it on one day, never came back inside 72h", pill: "bg-red-100 text-red-700", dot: "bg-red-500" },
  never: { label: "Never started", hint: "did nothing in their first 72h", pill: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
};

// Tracker filters. "In first 72h" is everyone still inside the window — it
// overlaps "Not back yet" and in-flight "Kept" on purpose, so it always agrees
// with the tile up top.
const SEGMENTS: { key: string; label: string; hint: string; dot: string; match: (u: RetentionUser, o: Outcome72) => boolean }[] = [
  { key: "inflight", label: "In first 72h", hint: "signed up less than 72 hours ago", dot: OUTCOME_META.inflight.dot, match: (u) => u.ageHours < 72 },
  { key: "quiet", label: "Not back yet", hint: OUTCOME_META["inflight-quiet"].hint, dot: OUTCOME_META["inflight-quiet"].dot, match: (_, o) => o === "inflight-quiet" },
  { key: "kept", label: "Kept", hint: OUTCOME_META.kept.hint, dot: OUTCOME_META.kept.dot, match: (_, o) => o === "kept" },
  { key: "oneday", label: "One and done", hint: OUTCOME_META.oneday.hint, dot: OUTCOME_META.oneday.dot, match: (_, o) => o === "oneday" },
  { key: "never", label: "Never started", hint: OUTCOME_META.never.hint, dot: OUTCOME_META.never.dot, match: (_, o) => o === "never" },
];

const SINCE_OPTIONS: { days: number | null; label: string }[] = [
  { days: null, label: "All time" },
  { days: 90, label: "90d" },
  { days: 60, label: "60d" },
  { days: 30, label: "30d" },
];

const TZ = "America/Chicago";

const pctText = (n: number, d: number) => {
  const p = pct(n, d);
  return p === null ? "—" : `${p}%`;
};

function fmtAge(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 72) return `${Math.floor(hours)}h in`;
  const days = Math.floor(hours / 24);
  return days < 60 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function Tile({ label, value, sub, title }: { label: string; value: string; sub?: string; title?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4" title={title}>
      <div className={LABEL}>{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

function LayerTag({ layer }: { layer: Layer }) {
  return (
    <span className="inline-block font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[0.1em] text-gray-500 border border-gray-200 rounded px-1 py-px" title={LAYER_META[layer].name}>
      {LAYER_META[layer].tag}
    </span>
  );
}

// Horizontal bar against a fixed 0–100% track.
function Bar({ value, color = BLUE }: { value: number | null; color?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${value ?? 0}%`, background: color }} />
    </div>
  );
}

// 72 hour-of-life cells, grouped into three days. Filled = active that hour;
// faint = hasn't happened yet for someone still inside the window.
function HourStrip({ user }: { user: RetentionUser }) {
  const active = new Set(user.hours72);
  const CELL = 4, GAP = 1, DAY_GAP = 5, H = 14;
  const x = (h: number) => h * (CELL + GAP) + Math.floor(h / 24) * DAY_GAP;
  const width = x(71) + CELL;
  return (
    <svg width={width} height={H} role="img" aria-label={`Active in ${user.hours72.length} of first 72 hours`}>
      {Array.from({ length: 72 }, (_, h) => {
        const future = h > user.ageHours;
        return (
          <rect key={h} x={x(h)} y={0} width={CELL} height={H} rx={1}
            fill={active.has(h) ? BLUE : future ? "#ffffff" : "#eef0f3"}
            stroke={future ? "#e5e7eb" : "none"} strokeWidth={future ? 0.5 : 0}>
            {active.has(h) && <title>{`hour ${h} · day ${Math.floor(h / 24) + 1}`}</title>}
          </rect>
        );
      })}
    </svg>
  );
}

function Milestones({ user }: { user: RetentionUser }) {
  const m = user.ms;
  const chips: { label: string; h: number | null; layer: Layer }[] = [
    { label: "dump", h: m.dump, layer: 1 },
    { label: "came back", h: m.secondSession, layer: 1 },
    { label: "2nd board", h: m.secondBoard, layer: 1 },
    { label: "reminder", h: m.reminder, layer: 2 },
    { label: "nudge reply", h: m.nudgeReply, layer: 2 },
    { label: "3 facts", h: m.facts3, layer: 3 },
  ];
  const hit = chips.filter((c) => c.h !== null && c.h < 72);
  if (hit.length === 0) return <span className="text-[11px] text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {hit.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 text-[10px] text-gray-700 bg-gray-50 border border-gray-200 rounded px-1.5 py-px whitespace-nowrap"
          title={`${LAYER_META[c.layer].name} — reached at hour ${c.h}`}>
          <span className="font-[family-name:var(--font-jetbrains)] text-[8px] text-gray-400">{LAYER_META[c.layer].tag}</span>
          {c.label} <span className="text-gray-400 tabular-nums">{c.h}h</span>
        </span>
      ))}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export default function RetentionDashboard({ data }: { data: RetentionData }) {
  const [sinceDays, setSinceDays] = useState<number | null>(null);
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [grain, setGrain] = useState<"week" | "month">("week");
  const [segment, setSegment] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const internalN = useMemo(() => data.users.filter((u) => u.internal).length, [data.users]);
  const users = useMemo(
    () => data.users.filter((u) => (!excludeInternal || !u.internal) && (sinceDays === null || u.ageHours <= sinceDays * 24)),
    [data.users, excludeInternal, sinceDays],
  );

  const f72 = useMemo(() => first72(users), [users]);
  const pred = useMemo(() => predictors(users), [users]);
  const lad = useMemo(() => ladder(users), [users]);
  const cohortRows = useMemo(() => cohorts(users, grain), [users, grain]);

  const outcomes = useMemo(() => new Map(users.map((u) => [u.id, outcome72(u)])), [users]);
  const segmentCounts = useMemo(
    () => Object.fromEntries(SEGMENTS.map((s) => [s.key, users.filter((u) => s.match(u, outcomes.get(u.id)!)).length])),
    [users, outcomes],
  );
  const people = useMemo(() => {
    const seg = SEGMENTS.find((s) => s.key === segment);
    return seg ? users.filter((u) => seg.match(u, outcomes.get(u.id)!)) : users;
  }, [users, outcomes, segment]);
  const shown = showAll ? people : people.slice(0, 40);

  // Rank predictors by lift, but never let a tiny sample lead the list.
  const predRows = useMemo(() => {
    const lift = (r: (typeof pred.rows)[number]) => (pct(r.didRetained, r.didN) ?? 0) - (pct(r.notRetained, r.notN) ?? 0);
    const small = (r: (typeof pred.rows)[number]) => r.didN < 5 || r.notN < 5;
    return [...pred.rows].sort((a, b) => Number(small(a)) - Number(small(b)) || lift(b) - lift(a)).map((r) => ({ ...r, lift: lift(r), small: small(r) }));
  }, [pred]);

  const emailThese = useCallback(() => {
    try {
      sessionStorage.setItem(RECIPIENTS_KEY, JSON.stringify(people.map((u) => ({ name: u.name, email: u.email, refCode: null }))));
      window.location.href = "/admin/growth/email";
    } catch {
      setMsg("Could not stage recipients (storage blocked). Use Copy emails instead.");
    }
  }, [people]);
  const copyEmails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(people.map((u) => u.email).join(", "));
      setMsg(`Copied ${people.length} email${people.length === 1 ? "" : "s"}.`);
    } catch {
      setMsg("Clipboard blocked.");
    }
  }, [people]);

  const m = f72.maturedN;
  const cp = (key: string) => f72.checkpoints.find((c) => c.key === key)?.n ?? 0;
  const bucketMax = Math.max(1, ...f72.buckets.map((b) => b.n));
  const tenureShown = lad.l3.tenure.filter((t) => t.reachedN > 0);

  return (
    <div className="space-y-10">
      {/* Filters — one row, above everything they scope */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <span className={LABEL}>Signed up</span>
        <div className="flex items-center gap-1.5">
          {SINCE_OPTIONS.map((o) => (
            <button key={o.label} type="button" onClick={() => setSinceDays(o.days)}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${sinceDays === o.days ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={excludeInternal} onChange={(e) => setExcludeInternal(e.target.checked)} />
          Exclude team accounts <span className="text-gray-400 tabular-nums">({internalN})</span>
        </label>
        <span className="ml-auto text-xs text-gray-400 tabular-nums">{users.length} accounts · snapshot {new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ })} CT</span>
      </div>

      {/* ── First 72 hours ── */}
      <section className="space-y-4">
        <div>
          <h2 className={H2}>The first 72 hours</h2>
          <p className="text-sm text-gray-500 mt-1">
            {m === 0
              ? "No signups in this range have finished their first 72 hours yet."
              : `Of ${m} signups whose first 72h has closed: ${cp("started")} did something, ${cp("day2")} came back on day 2, ${cp("day3")} on day 3.`}
            {" "}Each person&apos;s clock starts at their own signup.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile label="In first 72h now" value={String(f72.inflightN)} sub={f72.inflightQuietN ? `${f72.inflightQuietN} not back yet — nudge` : "signed up < 72h ago"} />
          <Tile label="Started" value={pctText(cp("started"), m)} sub={`${cp("started")} of ${m} did anything`} />
          <Tile label="Back on day 2" value={pctText(cp("day2"), m)} sub={`${cp("day2")} of ${m} · hours 24–48`} />
          <Tile label="Back on day 3" value={pctText(cp("day3"), m)} sub={`${cp("day3")} of ${m} · hours 48–72`} />
          <Tile label="Kept" value={pctText(f72.keptN, m)} sub={`${f72.keptN} of ${m} used it 2+ of 3 days`} />
          <Tile label="Time to first dump" value={fmtDuration(f72.medianFirstDumpMin)} sub="median, signup → first dump" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className={CARD}>
            <div className={LABEL}>72h checkpoints · share of {m} closed signups</div>
            <div className="mt-4 space-y-3">
              {f72.checkpoints.map((c) => (
                <div key={c.key} className="grid grid-cols-[120px_1fr_72px] items-center gap-3" title={`${c.label}: ${c.hint} — ${c.n} of ${m}`}>
                  <span className="text-xs text-gray-700">{c.label}</span>
                  <Bar value={pct(c.n, m)} />
                  <span className="text-xs text-gray-900 tabular-nums text-right">
                    {pctText(c.n, m)} <span className="text-gray-400">· {c.n}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-gray-400">Independent checkpoints over one denominator — not a strict funnel.</p>
          </div>

          <div className={CARD}>
            <div className={LABEL}>When they show up · users active per 6h of life</div>
            <div className="mt-4 flex items-end gap-[2px] h-[120px]">
              {f72.buckets.map((b, i) => (
                <div key={b.from} className={`relative flex-1 h-full flex items-end ${i % 4 === 0 && i > 0 ? "ml-2" : ""}`}
                  title={`Hours ${b.from}–${b.from + 6} (day ${Math.floor(b.from / 24) + 1}): ${b.n} of ${m} users active (${pctText(b.n, m)})`}>
                  <div className="w-full rounded-t-[4px] hover:opacity-80" style={{ height: `${(b.n / bucketMax) * 100}%`, minHeight: b.n ? 2 : 0, background: BLUE }} />
                  {b.n > 0 && (i % 4 === 0 || b.n === bucketMax) && (
                    <span className="absolute left-1/2 -translate-x-1/2 text-[9px] text-gray-500 tabular-nums" style={{ bottom: `calc(${(b.n / bucketMax) * 100}% + 2px)` }}>{b.n}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2 text-center border-t border-gray-100 pt-1.5">
              {["Day 1 · 0–24h", "Day 2 · 24–48h", "Day 3 · 48–72h"].map((d) => <span key={d} className="text-[10px] text-gray-400">{d}</span>)}
            </div>
            <p className="mt-3 text-[11px] text-gray-400">The first bar includes the onboarding session itself — days 2–3 are the real signal.</p>
          </div>
        </div>
      </section>

      {/* ── What predicts staying ── */}
      <section className="space-y-4">
        <div>
          <h2 className={H2}>What in the first 72h predicts staying</h2>
          <p className="text-sm text-gray-500 mt-1">
            Week-2 retention (active on days 7–13) for people who did each thing in their first 72h vs people who didn&apos;t.
            {pred.eligibleN > 0 && ` Baseline: ${pctText(pred.baselineRetained, pred.eligibleN)} of ${pred.eligibleN} accounts 14+ days old.`}
          </p>
        </div>
        <div className={`${CARD} overflow-x-auto`}>
          {pred.eligibleN === 0 ? (
            <p className="text-sm text-gray-500">Needs accounts at least 14 days old in this range.</p>
          ) : (
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={TH}>In their first 72h they…</th>
                  <th className={`${TH} w-[34%]`}>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: BLUE }} />Did it → retained</span>
                    <span className="inline-flex items-center gap-1.5 ml-4"><span className="h-2 w-2 rounded-sm" style={{ background: BASELINE }} />Didn&apos;t → retained</span>
                  </th>
                  <th className={`${TH} text-right`}>Lift</th>
                </tr>
              </thead>
              <tbody>
                {predRows.map((r) => (
                  <tr key={r.key} className={`border-b border-gray-50 last:border-0 ${r.small ? "opacity-60" : ""}`}>
                    <td className="py-3 pr-4 text-sm text-gray-800 whitespace-nowrap">
                      <LayerTag layer={r.layer} /> <span className="ml-1.5">{r.label}</span>
                      {r.small && <span className="ml-2 text-[10px] text-gray-400 italic">small sample</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-[1fr_96px] items-center gap-2" title={`Did it: ${r.didRetained} of ${r.didN} retained in week 2`}>
                          <Bar value={pct(r.didRetained, r.didN)} />
                          <span className="text-[11px] text-gray-900 tabular-nums">{pctText(r.didRetained, r.didN)} <span className="text-gray-400">· {r.didRetained}/{r.didN}</span></span>
                        </div>
                        <div className="grid grid-cols-[1fr_96px] items-center gap-2" title={`Didn't: ${r.notRetained} of ${r.notN} retained in week 2`}>
                          <Bar value={pct(r.notRetained, r.notN)} color={BASELINE} />
                          <span className="text-[11px] text-gray-500 tabular-nums">{pctText(r.notRetained, r.notN)} <span className="text-gray-400">· {r.notRetained}/{r.notN}</span></span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                      {r.didN === 0 || r.notN === 0 ? <span className="text-gray-300 font-normal">—</span> : `${r.lift > 0 ? "+" : ""}${r.lift} pts`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] text-gray-400">
            Correlation, not proof — engaged people do more of everything. Use it to pick which moment to engineer into onboarding, then watch the cohorts below move.
            Onboarding (build 40+) walks everyone through one reminder, so the 2nd reminder is the voluntary one.
          </p>
        </div>
      </section>

      {/* ── Value ladder ── */}
      <section className="space-y-4">
        <div>
          <h2 className={H2}>Value ladder</h2>
          <p className="text-sm text-gray-500 mt-1">Layers 1–2 are what earn the first week. Layer 3 is the bet that justifies $20–25/mo — it should show up as usage getting deeper with tenure, not flatter.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className={CARD}>
            <div className="flex items-center justify-between"><LayerTag layer={1} /><span className="text-[10px] text-green-700 bg-green-100 rounded-full px-2 py-0.5 font-semibold">validated</span></div>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">{LAYER_META[1].name}</h3>
            <dl className="mt-4 space-y-3">
              <LadderStat label="Brain-dumped in first 72h" value={pctText(lad.l1.dumped72, lad.maturedN)} sub={`${lad.l1.dumped72} of ${lad.maturedN}`} />
              <LadderStat label="Signup → first dump" value={fmtDuration(lad.l1.medianFirstDumpMin)} sub="median" />
              <LadderStat label="Came back for a 2nd session in 72h" value={pctText(lad.l1.second72, lad.maturedN)} sub={`${lad.l1.second72} of ${lad.maturedN}`} />
            </dl>
          </div>

          <div className={CARD}>
            <div className="flex items-center justify-between"><LayerTag layer={2} /><span className="text-[10px] text-green-700 bg-green-100 rounded-full px-2 py-0.5 font-semibold">validated</span></div>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">{LAYER_META[2].name}</h3>
            <dl className="mt-4 space-y-3">
              <LadderStat label="Set a reminder / check-in in 72h" value={pctText(lad.l2.reminder72, lad.maturedN)} sub={`${lad.l2.reminderAgain72} set a 2nd on their own`} />
              <LadderStat label="Nudges answered within 3h" value={pctText(lad.l2.nudgesAnswered, lad.l2.nudgesSent)} sub={`${lad.l2.nudgesAnswered} of ${lad.l2.nudgesSent} sent`} />
              <LadderStat label="Push on" value={pctText(lad.l2.pushOn, lad.l2.accountsN)} sub={`${lad.l2.pushOn} of ${lad.l2.accountsN} — no push, no nudge`} />
            </dl>
          </div>

          <div className={`${CARD} border-gray-900`}>
            <div className="flex items-center justify-between"><LayerTag layer={3} /><span className="text-[10px] text-amber-700 bg-amber-100 rounded-full px-2 py-0.5 font-semibold">unproven — watch this</span></div>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">{LAYER_META[3].name}</h3>
            <dl className="mt-4 space-y-3">
              <LadderStat label="Accounts Xyra knows something about" value={pctText(lad.l3.usersWithFacts, lad.l3.accountsN)} sub={`${lad.l3.usersWithFacts} of ${lad.l3.accountsN}`} />
              <LadderStat label="Facts per known user" value={lad.l3.medianFacts === null ? "—" : String(Math.round(lad.l3.medianFacts))} sub={`median · ${lad.l3.deepMemoryN} with 10+`} />
            </dl>
          </div>
        </div>

        <div className={CARD}>
          <div className={LABEL}>The compounding test · days used per week, among people still using it that week</div>
          {tenureShown.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Needs accounts at least a week old.</p>
          ) : (
            <>
              <div className="mt-4 flex items-end gap-2 h-[130px] pl-7 relative">
                {[0, 7].map((v) => (
                  <span key={v} className="absolute left-0 text-[9px] text-gray-400 tabular-nums" style={{ bottom: v === 0 ? -2 : "calc(100% - 8px)" }}>{v}d</span>
                ))}
                {tenureShown.map((t) => (
                  <div key={t.week} className="relative flex-1 h-full flex items-end justify-center border-b border-gray-200"
                    title={`Week ${t.week} of life: ${t.activeN} of ${t.reachedN} still active · ${t.avgActiveDays?.toFixed(1) ?? "—"} days used · ${t.avgFacts?.toFixed(0) ?? "—"} facts known`}>
                    <div className="w-full max-w-[44px] rounded-t-[4px] hover:opacity-80" style={{ height: `${((t.avgActiveDays ?? 0) / 7) * 100}%`, minHeight: t.avgActiveDays ? 2 : 0, background: BLUE }} />
                    {t.avgActiveDays !== null && (
                      <span className="absolute text-[10px] text-gray-700 tabular-nums" style={{ bottom: `calc(${(t.avgActiveDays / 7) * 100}% + 3px)` }}>{t.avgActiveDays.toFixed(1)}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pl-7 mt-1.5">
                {tenureShown.map((t) => (
                  <div key={t.week} className="flex-1 text-center leading-tight">
                    <div className="text-[10px] text-gray-600">wk {t.week}</div>
                    <div className="text-[9px] text-gray-400 tabular-nums">{t.activeN}/{t.reachedN} active</div>
                    <div className="text-[9px] text-gray-400 tabular-nums">{t.avgFacts === null ? "—" : `${t.avgFacts.toFixed(0)} fact${t.avgFacts.toFixed(0) === "1" ? "" : "s"}`}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[11px] text-gray-400">
            How to read it: if memory compounds, the bars hold or climb as the fact count under them grows — survivors lean on Xyra more the longer it has known them.
            Flat-or-falling bars with rising facts means memory is accumulating but not yet felt.
          </p>
        </div>
      </section>

      {/* ── Cohorts ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={H2}>Signup cohorts</h2>
            <p className="text-sm text-gray-500 mt-1">Share of each cohort active inside each window of their life. Only people whose window has fully closed are counted.</p>
          </div>
          <div className="flex items-center gap-1.5">
            {(["week", "month"] as const).map((g) => (
              <button key={g} type="button" onClick={() => setGrain(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${grain === g ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
                By {g}
              </button>
            ))}
          </div>
        </div>
        <div className={`${CARD} overflow-x-auto`}>
          {cohortRows.length === 0 ? (
            <p className="text-sm text-gray-500">No signups in this range.</p>
          ) : (
            <table className="w-full min-w-[760px] border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className={TH}>{grain === "week" ? "Week of" : "Month"}</th>
                  <th className={`${TH} text-right pr-3`}>Signups</th>
                  {COHORT_WINDOWS.map((w) => <th key={w.key} className={`${TH} text-center`}>{w.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {cohortRows.slice(0, 16).map((row) => (
                  <tr key={row.key}>
                    <td className="py-1.5 pr-3 text-xs text-gray-700 whitespace-nowrap">{row.label}</td>
                    <td className="py-1.5 pr-3 text-xs text-right tabular-nums text-gray-500">{row.size}</td>
                    {row.cells.map((c, i) => {
                      const p = pct(c.active, c.eligible);
                      const step = heatStep(p);
                      const partial = c.eligible > 0 && c.eligible < row.size;
                      return (
                        <td key={COHORT_WINDOWS[i].key} className="p-0 text-center"
                          title={p === null ? `${COHORT_WINDOWS[i].label}: window hasn't closed for anyone in this cohort yet` : `${COHORT_WINDOWS[i].label}: ${c.active} of ${c.eligible} active${partial ? ` (${row.size - c.eligible} still inside the window)` : ""}`}>
                          <div className="rounded-[4px] py-1.5 text-xs tabular-nums"
                            style={{ background: step >= 0 ? HEAT[step] : p === 0 ? "#f3f4f6" : "transparent", color: step >= 4 ? "#ffffff" : p === null ? "#d1d5db" : p === 0 ? "#9ca3af" : "#0b0b0b" }}>
                            {p === null ? "·" : `${p}%`}{partial && <span className="opacity-60">*</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] text-gray-400">· window still open &nbsp; * part of the cohort is still inside the window — hover for counts. Cohorts this small swing hard on one person; read the counts, not just the color.</p>
        </div>
      </section>

      {/* ── People ── */}
      <section className="space-y-4">
        <div>
          <h2 className={H2}>72-hour tracker</h2>
          <p className="text-sm text-gray-500 mt-1">Every account&apos;s first 72 hours, hour by hour. “Not back yet” is the moment a personal note still lands.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSegment("")} className={`px-3 py-1 rounded-full text-xs font-medium border ${segment === "" ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            All <span className="opacity-60 tabular-nums">{users.length}</span>
          </button>
          {SEGMENTS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSegment(segment === s.key ? "" : s.key)} title={s.hint}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${segment === s.key ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label} <span className="opacity-60 tabular-nums">{segmentCounts[s.key]}</span>
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
          <button type="button" onClick={emailThese} disabled={people.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-black text-white disabled:opacity-40">Email these ({people.length})</button>
          <button type="button" onClick={copyEmails} disabled={people.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-gray-400 disabled:opacity-40">Copy emails</button>
          {msg && <p className="w-full text-xs text-gray-600 mt-1">{msg}</p>}
        </div>

        <div className={`${CARD} overflow-x-auto`}>
          {people.length === 0 ? (
            <p className="text-sm text-gray-500">No one here.</p>
          ) : (
            <table className="w-full min-w-[1040px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={TH}>User</th>
                  <th className={TH}>Signed up</th>
                  <th className={TH}>First 72h</th>
                  <th className={TH}>Day 1 · Day 2 · Day 3, hour by hour</th>
                  <th className={TH}>Milestones hit in 72h</th>
                  <th className={`${TH} text-right`} title="Distinct days active, all time">Days used</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => {
                  const o = OUTCOME_META[outcomes.get(u.id) ?? "never"];
                  return (
                    <tr key={u.id} className="border-b border-gray-50 last:border-0 align-middle">
                      <td className="py-2.5 pr-3">
                        <div className="text-sm text-gray-900 font-medium leading-tight">
                          {u.name ?? <span className="text-gray-400 italic">no name</span>}
                          {u.internal && <span className="ml-1.5 text-[9px] uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1">team</span>}
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">{u.email}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(u.signedUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ })}
                        <span className="text-gray-400"> · {fmtAge(u.ageHours)}</span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${o.pill}`} title={o.hint}>
                          <span className={`h-1.5 w-1.5 rounded-full ${o.dot}`} />{o.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4"><HourStrip user={u} /></td>
                      <td className="py-2.5 pr-3"><Milestones user={u} /></td>
                      <td className="py-2.5 text-sm text-right tabular-nums text-gray-700">{u.activeDays.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {people.length > shown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="mt-3 text-xs text-gray-700 underline underline-offset-2">Show all {people.length}</button>
          )}
        </div>
      </section>

      <p className="text-[11px] text-gray-400">
        Activity = something the user created: a dashboard, item, message, brain dump, or reminder. The app doesn&apos;t log app-opens yet, so a visit where someone only reads is invisible —
        these numbers are a floor. A session ends after 30 min of silence. Retained = active on days 7–13.
      </p>
    </div>
  );
}

function LadderStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-50 last:border-0 pb-3 last:pb-0">
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="text-right shrink-0">
        <span className="text-lg font-bold text-gray-900 tabular-nums">{value}</span>
        {sub && <span className="block text-[10px] text-gray-400">{sub}</span>}
      </dd>
    </div>
  );
}
