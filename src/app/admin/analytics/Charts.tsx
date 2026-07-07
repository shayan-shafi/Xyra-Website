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

// ── Signups over time (+ optional visitors line) ──────────────────────────────
// Vertical bars = signups per day; a thin overlaid line = visitors per day
// (scaled to its own max) so traffic spikes that did/didn't convert are visible.
export function SignupsOverTimeChart({ data }: { data: TimePoint[] }) {
  if (data.length === 0) return <EmptyChart label="No signups or visits in this range yet." />;

  const maxSignups = Math.max(1, ...data.map(d => d.signups));
  const maxVisitors = Math.max(1, ...data.map(d => d.visitors));
  const H = 160; // chart body height in px
  const barW = 26; // px per day column (chart scrolls horizontally if wide)
  const chartW = data.length * barW;

  // Visitors polyline points (scaled to maxVisitors), in the same coordinate box.
  const points = data
    .map((d, i) => {
      const x = i * barW + barW / 2;
      const y = H - (d.visitors / maxVisitors) * H;
      return `${x},${y}`;
    })
    .join(" ");

  // Show at most ~12 x-axis labels to avoid crowding.
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#111827" }} /> Signups / day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ background: "#9CA3AF" }} /> Visitors / day
        </span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ width: Math.max(chartW, 100), minWidth: "100%" }}>
          <svg width="100%" height={H} viewBox={`0 0 ${chartW} ${H}`} preserveAspectRatio="none" className="block">
            {data.map((d, i) => {
              const h = (d.signups / maxSignups) * H;
              return (
                <rect
                  key={d.date}
                  x={i * barW + 4}
                  y={H - h}
                  width={barW - 8}
                  height={h}
                  rx={2}
                  fill="#111827"
                >
                  <title>{`${d.date}: ${d.signups} signups, ${d.visitors} visitors`}</title>
                </rect>
              );
            })}
            {/* Visitors overlay line (non-scaling stroke keeps it crisp). */}
            <polyline points={points} fill="none" stroke="#9CA3AF" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex" style={{ width: chartW }}>
            {data.map((d, i) => (
              <div key={d.date} style={{ width: barW }} className="text-center">
                {i % labelEvery === 0 && (
                  <span className="text-[9px] text-gray-400 whitespace-nowrap">{shortDay(d.date)}</span>
                )}
              </div>
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
