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

      {/* xyra is typing… */}
      <Sticker className="right-[9%] top-[40%]">
        <div className="flex items-center gap-1.5 bg-white border border-black/12 rounded-full px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.15s" }} />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.3s" }} />
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

      {/* where it all lands */}
      <Sticker className="right-[4%] top-[56%]" tilt={3}>
        <div className="flex flex-col items-start gap-1.5">
          <Chip>→ journal</Chip>
          <Chip>→ to-do</Chip>
          <Chip>→ reminders</Chip>
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
