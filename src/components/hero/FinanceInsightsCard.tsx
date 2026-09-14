"use client";

// ─── FinanceInsightsCard ─────────────────────────────────────────────────────
// The finance node, opened: this site's BrainScene insights panel (light) as a
// card that appears beside the zoomed-in node.

import { motion } from "framer-motion";

const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const STATS: [string, string, string?][] = [
  ["Days Active", "47"],
  ["Money Saved", "$2,340", EMERALD],
  ["Total Spent", "$4,120"],
  ["Budget Left", "$760", AMBER],
];
const ACTIVITY: [string, string, string?][] = [
  ["Groceries", "-$67"],
  ["Paycheck", "+$2,400", EMERALD],
  ["Uber", "-$18"],
];

export default function FinanceInsightsCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-[320px] bg-white border border-black/10 shadow-[0_18px_50px_rgba(0,0,0,0.12)] p-5 space-y-3"
    >
      <div className="border-b border-black/10 pb-3">
        <h4 className="font-[family-name:var(--font-playfair)] text-2xl text-black">Finances</h4>
        <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 mt-1">Node insights powered by Xyra</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STATS.map(([k, v, c]) => (
          <div key={k} className="border border-black/10 p-2.5">
            <div className="font-[family-name:var(--font-jetbrains)] text-[9px] text-black/40 uppercase tracking-wider">{k}</div>
            <div className="text-lg font-bold mt-0.5" style={{ color: c ?? "#000" }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="border border-black/10 p-2.5">
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40">Savings Goal</span>
          <span className="font-[family-name:var(--font-jetbrains)] text-[11px]" style={{ color: EMERALD }}>78%</span>
        </div>
        <div className="w-full h-1 bg-black/5 rounded-full overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: EMERALD }} initial={{ width: 0 }} animate={{ width: "78%" }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} />
        </div>
        <p className="font-[family-name:var(--font-jetbrains)] text-[9px] text-black/30 mt-1">$2,340 of $3,000 goal</p>
      </div>

      <div className="bg-black p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-4 h-4 bg-white rounded-full flex items-center justify-center text-black text-[8px] font-[family-name:var(--font-playfair)] font-bold">X</span>
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/60">Xyra Insight</span>
        </div>
        <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-white/90 leading-relaxed">
          You&apos;ve cut dining out by 32% this month. Your savings rate is up 15% since you started tracking. Keep it up!
        </p>
      </div>

      <div>
        <h5 className="font-[family-name:var(--font-jetbrains)] text-[10px] text-black/40 uppercase tracking-wider mb-1">Recent Activity</h5>
        {ACTIVITY.map(([k, v, c]) => (
          <div key={k} className="flex items-center justify-between py-1.5 border-b border-black/5 font-[family-name:var(--font-jetbrains)] text-[11px]">
            <span className="text-black">{k}</span>
            <span style={{ color: c ?? "rgba(0,0,0,0.6)" }}>{v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
