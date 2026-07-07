"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Date-range controls for the analytics dashboard: three rolling presets plus a
// custom start/end range. Navigating updates the URL query params (?range= or
// ?start=&end=), which the server component reads and resolves. Kept a client
// component only for the inputs + navigation; all data work stays on the server.

type Preset = "7d" | "30d" | "all" | "custom";

const PRESETS: { label: string; value: "7d" | "30d" | "all" }[] = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

export default function RangeControls({
  preset,
  startDateCT,
  endDateCT,
  windowLabel,
  error,
}: {
  preset: Preset;
  startDateCT: string | null;
  endDateCT: string | null;
  windowLabel: string;
  error: string | null;
}) {
  const router = useRouter();
  const [start, setStart] = useState(startDateCT ?? "");
  const [end, setEnd] = useState(endDateCT ?? "");
  const [open, setOpen] = useState(preset === "custom");

  function goPreset(value: string) {
    router.push(`/admin/analytics?range=${value}`);
  }

  function applyCustom() {
    if (!start || !end) return;
    const params = new URLSearchParams({ start, end });
    router.push(`/admin/analytics?${params.toString()}`);
  }

  const pillBase =
    "px-3.5 py-1.5 rounded-full text-xs font-medium font-[family-name:var(--font-jetbrains)] tracking-wide transition-colors";
  const activePill = "bg-black text-white";
  const idlePill = "bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900";

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-1.5 justify-start sm:justify-end">
        {PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => goPreset(p.value)}
            className={`${pillBase} ${preset === p.value ? activePill : idlePill}`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`${pillBase} ${preset === "custom" ? activePill : idlePill}`}
          aria-expanded={open}
        >
          Custom range
        </button>
      </div>

      {open && (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 sm:min-w-[340px]">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.12em]">
                Start · inclusive
              </span>
              <input
                type="date"
                value={start}
                max={end || undefined}
                onChange={e => setStart(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.12em]">
                End · exclusive
              </span>
              <input
                type="date"
                value={end}
                min={start || undefined}
                onChange={e => setEnd(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
            </label>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!start || !end}
              className="px-4 py-1.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              Apply
            </button>
          </div>
          <p className="mt-2 text-[11px] text-gray-400 leading-snug">
            Dates are read in <strong>America/Chicago</strong>. Start is included; end is
            <strong> excluded</strong> — e.g. an ad that ran June&nbsp;23–25 is{" "}
            <span className="font-mono">start=2026-06-23</span>,{" "}
            <span className="font-mono">end=2026-06-26</span>.
          </p>
        </div>
      )}

      <div className="mt-2 text-right">
        <span className="text-[11px] text-gray-400">
          Showing: <span className="font-medium text-gray-600">{windowLabel}</span>
        </span>
      </div>
      {error && (
        <p className="mt-1 text-right text-[11px] text-red-500">{error} Showing last 30 days instead.</p>
      )}
    </div>
  );
}
