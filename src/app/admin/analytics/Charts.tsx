// Lightweight, dependency-free charts for the analytics dashboard. Pure
// SVG/CSS server components — no chart library, no client JS. Colors come from
// the shared getSourceColor() so every chart + table reads consistently.

import { getSourceColor, sourceLabel } from "@/lib/analyticsSource";
import type { TimePoint, SourceChartRow } from "./data";

// Format a YYYY-MM-DD (already America/Chicago) as "Jun 23" without re-applying
// a timezone (parsing as UTC noon avoids off-by-one day shifts).
function shortDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function EmptyChart({ label }: { label: string }) {
  return <p className="text-sm text-gray-400 italic">{label}</p>;
}

// Left gutter shared by the signups + visitors charts so both align vertically
// when stacked, and the x-axis row lines up under both.
const GUTTER = 34; // px

// Picks a clean axis top + integer tick step so gridline labels are round
// numbers (0, 2, 4, 6 …) rather than fractions. Aims for 3–5 gridlines.
function niceScale(max: number): { top: number; ticks: number[] } {
  const m = Math.max(1, Math.ceil(max));
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  let step = steps[steps.length - 1];
  for (const s of steps) {
    if (m / s <= 5) { step = s; break; }
  }
  let top = Math.ceil(m / step) * step;
  // Headroom: never let the tallest bar reach 100% (its value label sits just
  // above the bar and would clip at the plot-area top). Bump one step if tight.
  if (m / top > 0.85) top += step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return { top, ticks };
}

// How often to render an x-axis label so they never overlap. Targets ~8 labels
// max, and always includes the last day.
function labelStride(count: number): number {
  return Math.max(1, Math.ceil(count / 8));
}

function XAxis({ data }: { data: TimePoint[] }) {
  const stride = labelStride(data.length);
  const last = data.length - 1;
  return (
    <div className="flex" style={{ paddingLeft: GUTTER }}>
      <div className="flex flex-1">
        {data.map((d, i) => {
          const show = i % stride === 0 || i === last;
          // Avoid the forced last label colliding with the previous striped one.
          const collides = i === last && last % stride !== 0 && last - Math.floor(last / stride) * stride < stride / 2;
          return (
            <div key={d.date} className="flex-1 min-w-0 text-center overflow-visible">
              {show && !collides && (
                <span className="text-[9px] text-gray-400 whitespace-nowrap">{shortDay(d.date)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main chart: Real Signups Per Day ──────────────────────────────────────────
// Clean vertical bars, integer Y gridlines, thin centered bars, value labels
// above bars when the range is short, and a shared x-axis below.
export function SignupsPerDayChart({ data }: { data: TimePoint[] }) {
  if (data.length === 0) return <EmptyChart label="No signups in this range yet." />;

  const maxSignups = Math.max(...data.map(d => d.signups));
  const { top, ticks } = niceScale(maxSignups);
  const H = 170; // plot-area height (px)
  // Only annotate bar values when there's room (few enough days, and non-zero).
  const showValues = data.length <= 16;

  return (
    <div>
      <div className="flex">
        {/* Y-axis labels */}
        <div className="relative shrink-0" style={{ width: GUTTER, height: H }}>
          {ticks.map(v => (
            <span
              key={v}
              className="absolute right-1.5 -translate-y-1/2 text-[9px] text-gray-400 tabular-nums"
              style={{ bottom: `${(v / top) * 100}%` }}
            >
              {v}
            </span>
          ))}
        </div>

        {/* Plot area */}
        <div className="relative flex-1" style={{ height: H }}>
          {/* Horizontal gridlines */}
          {ticks.map(v => (
            <div
              key={v}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ bottom: `${(v / top) * 100}%` }}
            />
          ))}
          {/* Bars */}
          <div className="absolute inset-0 flex items-end gap-px">
            {data.map(d => {
              const hpct = (d.signups / top) * 100;
              return (
                <div key={d.date} className="relative flex-1 min-w-0 h-full" title={`${shortDay(d.date)}: ${d.signups} signup${d.signups === 1 ? "" : "s"}`}>
                  {d.signups > 0 ? (
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[62%] max-w-[15px] rounded-t-[2px] bg-gray-900"
                      style={{ height: `${hpct}%` }}
                    />
                  ) : (
                    // Zero day: faint 2px baseline stub so the day still reads.
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[62%] max-w-[15px] h-[2px] rounded-[1px] bg-gray-200" />
                  )}
                  {showValues && d.signups > 0 && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[9px] font-medium text-gray-600 tabular-nums"
                      style={{ bottom: `calc(${hpct}% + 2px)` }}
                    >
                      {d.signups}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <XAxis data={data} />
    </div>
  );
}

// ── Secondary chart: Visitors Per Day ─────────────────────────────────────────
// Deliberately understated supporting context — a muted line + soft area on its
// OWN scale, shorter than the signups chart, so it never competes with it.
export function VisitorsPerDayChart({ data }: { data: TimePoint[] }) {
  if (data.length === 0) return null;
  const vMax = Math.max(1, ...data.map(d => d.visitors));
  const H = 60; // px
  const n = data.length;

  // Coordinates in a 0..100 × 0..H box; stretched horizontally to fill width.
  const xOf = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yOf = (v: number) => H - (v / vMax) * H;
  const linePts = data.map((d, i) => `${xOf(i)},${yOf(d.visitors)}`).join(" ");
  const areaPts = `${xOf(0)},${H} ${linePts} ${xOf(n - 1)},${H}`;

  const peak = data.reduce((a, b) => (b.visitors > a.visitors ? b : a));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1" style={{ paddingLeft: GUTTER }}>
        <span className="text-[11px] font-medium text-gray-500">Visitors / day</span>
        <span className="text-[10px] text-gray-400">
          own scale · peak {peak.visitors} on {shortDay(peak.date)}
        </span>
      </div>
      <div className="flex">
        <div className="relative shrink-0" style={{ width: GUTTER, height: H }}>
          <span className="absolute right-1.5 top-0 -translate-y-1/2 text-[9px] text-gray-400 tabular-nums">{vMax}</span>
          <span className="absolute right-1.5 bottom-0 translate-y-1/2 text-[9px] text-gray-400 tabular-nums">0</span>
        </div>
        <div className="relative flex-1" style={{ height: H }}>
          <div className="absolute inset-x-0 bottom-0 border-t border-gray-100" />
          <svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="block">
            <polygon points={areaPts} fill="#9CA3AF" fillOpacity={0.1} />
            <polyline points={linePts} fill="none" stroke="#9CA3AF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Transparent per-day hover targets for tooltips (aligned via equal flex cells). */}
          <div className="absolute inset-0 flex">
            {data.map(d => (
              <div key={d.date} className="flex-1 min-w-0" title={`${shortDay(d.date)}: ${d.visitors} visitor${d.visitors === 1 ? "" : "s"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Horizontal bar chart of signups by source (colored per source) ────────────
export function SourceSignupsChart({ data }: { data: SourceChartRow[] }) {
  const rows = data.filter(r => r.signups > 0).slice(0, 8);
  if (rows.length === 0) return <EmptyChart label="No attributed signups in this range yet." />;
  const max = Math.max(1, ...rows.map(r => r.signups));

  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.source} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-gray-600 truncate" title={sourceLabel(r.source)}>
            {sourceLabel(r.source)}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full"
              style={{ width: `${(r.signups / max) * 100}%`, background: getSourceColor(r.source) }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums text-gray-700">
            {r.signups} <span className="text-gray-400">· {r.pctOfSignups}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Conversion rate by source (colored per source) ────────────────────────────
// Only sources with enough visitors to be meaningful, to avoid 1-visitor 100%
// noise dominating the chart.
export function SourceConversionChart({ data, minVisitors = 3 }: { data: SourceChartRow[]; minVisitors?: number }) {
  const rows = data.filter(r => r.visitors >= minVisitors).sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 8);
  if (rows.length === 0) return <EmptyChart label={`No source has ≥ ${minVisitors} tracked visitors yet.`} />;
  const max = Math.max(1, ...rows.map(r => r.conversionRate));

  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.source} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-gray-600 truncate" title={sourceLabel(r.source)}>
            {sourceLabel(r.source)}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full"
              style={{ width: `${(r.conversionRate / max) * 100}%`, background: getSourceColor(r.source) }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-gray-700">
            {r.conversionRate}% <span className="text-gray-400">· {r.visitors}v</span>
          </span>
        </div>
      ))}
    </div>
  );
}
