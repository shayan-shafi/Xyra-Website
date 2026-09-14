"use client";

// ─── VentStickers ────────────────────────────────────────────────────────────
// The hero's sticker kit, scattered around the "just vent." video: a venting
// bubble, xyra listening, typing dots, receipt chips, the hold-to-talk pill,
// and one torn-paper note. Draggable like the hero's; desktop-only so nothing
// lands on the video on narrow screens. Positions are % of the section band.

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Chip } from "@/components/DesktopHero";
import { TornSticker } from "./TornSticker";

function Sticker({ className = "", tilt = 0, children }: { className?: string; tilt?: number; children: ReactNode }) {
  return (
    <motion.div drag dragMomentum={false} className={`absolute z-10 select-none cursor-grab active:cursor-grabbing ${className}`}>
      <div style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>{children}</div>
    </motion.div>
  );
}

// Annular sector between radii r1..r2 from angle a0 to a1 (degrees, 180 = left, 0 = right).
function sector(cx: number, cy: number, r1: number, r2: number, a0: number, a1: number) {
  const pt = (r: number, a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)] as const;
  const [x0, y0] = pt(r2, a0), [x1, y1] = pt(r2, a1), [x2, y2] = pt(r1, a1), [x3, y3] = pt(r1, a0);
  return `M${x0} ${y0} A${r2} ${r2} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${r1} ${r1} 0 0 0 ${x3} ${y3} Z`;
}
const GAUGE = ["#16c848", "#8fd13f", "#f8c630", "#f5821f", "#ff1e1e"];

function CortisolGauge() {
  const cx = 100, cy = 98;
  return (
    <svg viewBox="0 0 200 126" className="block w-full h-auto">
      {GAUGE.map((c, i) => {
        const a0 = 180 - i * 36 - 2, a1 = 180 - (i + 1) * 36 + 2;
        return <path key={c} d={sector(cx, cy, 58, 92, a0, a1)} fill={c} />;
      })}
      <g className="font-[family-name:var(--font-jetbrains)]" fontSize="10" fontWeight="500" fill="#111" letterSpacing="0.6">
        <text x="12" y="88" transform="rotate(-90 12 88)" textAnchor="middle">LOW</text>
        <text x={cx} y="22" textAnchor="middle">MEDIUM</text>
        <text x="188" y="88" transform="rotate(90 188 88)" textAnchor="middle">HIGH</text>
        <text x={cx} y="122" textAnchor="middle" fontSize="13" fontWeight="700" letterSpacing="1.2">CORTISOL</text>
      </g>
      {/* needle drawn at LOW; the animation starts it rotated onto HIGH and lets it fall */}
      <g className="xyra-needle" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <path d={`M${cx} ${cy} L${cx - 68} ${cy - 22}`} stroke="#111" strokeWidth="5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="10" fill="#111" />
        <circle cx={cx} cy={cy} r="5.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

export default function VentStickers() {
  return (
    <div className="hidden xl:block absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
      {/* you, venting */}
      <Sticker className="left-[2.5%] top-[24%]" tilt={-3}>
        <div className="w-[165px] bg-black text-white rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed lowercase">
            ok so today was a lot and i don&apos;t even know where to start
          </p>
        </div>
      </Sticker>

      {/* xyra, listening */}
      <Sticker className="right-[2.5%] top-[27%]" tilt={2}>
        <div className="w-[150px] bg-white border border-black/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed text-black/75 lowercase">
            i&apos;m listening. keep going.
          </p>
        </div>
      </Sticker>

      {/* the vent itself — a voice memo mid-record (the app's RecordingWave pill) */}
      <Sticker className="right-[4%] top-[41%]" tilt={-2}>
        <div className="flex items-center gap-1.5 rounded-full pl-1.5 pr-1.5 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.12)]" style={{ background: "#2A2A2E" }}>
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white text-[11px] leading-none">✕</span>
          <span className="flex items-center gap-[2px] h-4 px-1">
            {Array.from({ length: 18 }, (_, i) => (
              <span
                key={i}
                className={i >= 6 ? "xyra-rec-bar w-[2px] rounded-full bg-white/90" : "w-[2px] h-[2px] rounded-full bg-white/90"}
                style={i >= 6 ? { animationDelay: `${((i * 7) % 9) / 10}s`, animationDuration: `${0.7 + ((i * 3) % 5) * 0.08}s` } : undefined}
              />
            ))}
          </span>
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-[#1C1C1E] text-[12px] leading-none">✓</span>
        </div>
      </Sticker>

      {/* a torn note */}
      <Sticker className="left-[3%] top-[50%]" tilt={-5}>
        <TornSticker seed={53} jx={8} jy={9} ruled style={{ width: 150, height: 74 }}>
          <div className="w-full h-full flex items-center justify-center font-[family-name:var(--font-playfair)] italic text-[17px] text-black/80 leading-tight text-center px-3">
            no forms.<br />no lists.
          </div>
        </TornSticker>
      </Sticker>

      {/* cortisol, after venting — the needle swings HIGH → LOW when this comes into view */}
      <Sticker className="right-[3.5%] top-[57%]" tilt={4}>
        <div className="w-[160px] rounded-2xl bg-white border border-black/10 shadow-[0_4px_14px_rgba(0,0,0,0.08)] px-3 pt-3 pb-2">
          <CortisolGauge />
        </div>
      </Sticker>

      {/* hold-to-talk */}
      <Sticker className="left-[5%] top-[72%]" tilt={2}>
        <div className="flex items-center gap-2.5 bg-black text-white rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
          </svg>
          <span className="flex items-end gap-[2.5px] h-3.5">
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.12s" }} />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.24s" }} />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.36s" }} />
          </span>
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/70 lowercase">hold to talk</span>
        </div>
      </Sticker>
    </div>
  );
}
