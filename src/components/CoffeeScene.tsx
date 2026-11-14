"use client";

// ─── CoffeeScene ─────────────────────────────────────────────────────────────
// The right half of the pricing card: what $10 a month is. Xyra (a brain node,
// turning) drinks two cups of coffee, $5 each, and that's the month. Each cup
// lifts, tips toward the node and drains; the tab under it adds up to $10.
// Loops while it's on screen; with reduced motion it just shows the end.

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import SpinningNode from "./hero/SpinningNode";

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";
const PROSE = "font-[family-name:var(--font-eb-garamond)]";

// 0 two full cups · 1 first cup going down · 2 one left · 3 second cup going down · 4 the tab
const PHASE_AT = [0, 1100, 3500, 4100, 6500];
const LOOP_MS = 11500;
const MOOD = ["needs coffee", "ahh", "one more", "ahh", "wide awake"];

function usePhase(on: boolean): number {
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase(4); return; }
    setPhase(0);
    const timers = PHASE_AT.map((ms, i) => window.setTimeout(() => setPhase(i), ms));
    timers.push(window.setTimeout(() => setRun((r) => r + 1), LOOP_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [on, run]);
  return phase;
}

const BODY = "M12 20h48v32a16 16 0 0 1-16 16H28a16 16 0 0 1-16-16z";

/** One mug. `side` is which side of xyra it sits on; it tips toward the middle. */
function Cup({ side, drinking, empty, id }: { side: "left" | "right"; drinking: boolean; empty: boolean; id: string }) {
  const toward = side === "left" ? 1 : -1;
  return (
    <motion.div
      className="relative"
      style={{ width: 84, height: 96, transformOrigin: side === "left" ? "80% 30%" : "20% 30%" }}
      initial={false}
      animate={drinking ? { x: toward * 34, y: -28, rotate: toward * 62 } : { x: 0, y: 0, rotate: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg viewBox="0 0 84 96" width={84} height={96} style={{ transform: side === "left" ? "scaleX(-1)" : undefined }} aria-hidden>
        <defs>
          <clipPath id={id}><path d={BODY} transform="translate(0 16)" /></clipPath>
        </defs>
        {/* steam, while there's something hot in it */}
        <g style={{ opacity: empty ? 0 : 1, transition: "opacity 400ms" }} stroke="rgba(0,0,0,0.35)" strokeWidth={1.6} fill="none" strokeLinecap="round">
          <path className="coffee-steam" d="M28 28c-4-5 4-8 0-13s4-8 0-12" />
          <path className="coffee-steam" style={{ animationDelay: "0.7s" }} d="M44 28c-4-5 4-8 0-13s4-8 0-12" />
        </g>
        <g transform="translate(0 16)">
          {/* handle (on the outside) */}
          <path d="M60 28h5a10 10 0 0 1 0 20h-5" fill="none" stroke="#000" strokeWidth={2.2} />
          <path d={BODY} fill="#fff" stroke="#000" strokeWidth={2.2} strokeLinejoin="round" />
        </g>
        {/* the coffee: drains as it's drunk */}
        <g clipPath={`url(#${id})`}>
          <motion.rect
            x={10} width={52} height={60}
            fill="#3a2418"
            initial={false}
            animate={{ y: empty ? 86 : 43 }}
            transition={empty ? { duration: 1.6, delay: 0.45, ease: "easeInOut" } : { duration: 0 }}
          />
        </g>
      </svg>
    </motion.div>
  );
}

function TabLine({ on, label, price, bold = false }: { on: boolean; label: string; price: string; bold?: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: on ? 1 : 0, y: on ? 0 : 6 }}
      transition={{ duration: 0.35 }}
      className={`flex items-baseline gap-2 ${MONO} ${bold ? "text-[13px] text-black" : "text-[11px] text-black/55"}`}
    >
      <span>{label}</span>
      <span className="flex-1 border-b border-dotted border-black/25" />
      <span className="tabular-nums">{price}</span>
    </motion.div>
  );
}

export default function CoffeeScene() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { margin: "-80px" });
  const phase = usePhase(seen);
  const gulp = phase === 1 || phase === 3;

  return (
    <div ref={ref} className="flex h-full flex-col p-8 sm:p-10">
      <style>{`
        @keyframes coffee-steam { 0% { opacity: 0; transform: translateY(4px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-6px); } }
        .coffee-steam { animation: coffee-steam 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .coffee-steam { animation: none; } }
      `}</style>

      <div className={`${MONO} border-b border-black/10 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-black/45`}>what xyra runs on</div>

      {/* xyra and its two coffees */}
      <div className="relative flex min-h-[230px] flex-1 items-center justify-center gap-3 sm:gap-8" role="img" aria-label="xyra drinking two cups of coffee, five dollars each">
        <div className="flex flex-col items-center">
          <Cup side="left" id="coffee-cup-1" drinking={phase === 1} empty={phase >= 1} />
          <span className={`${MONO} mt-1 text-[11px] ${phase >= 2 ? "text-black/30 line-through" : "text-black/60"}`}>$5</span>
        </div>

        <div className="flex flex-col items-center">
          <motion.div
            initial={false}
            animate={gulp ? { scale: [1, 1.07, 0.98, 1.07, 1] } : phase === 4 ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={gulp ? { duration: 1.9, delay: 0.5 } : { duration: 0.6 }}
          >
            {/* the canvas is mostly air around the sphere: let it overhang its box */}
            <div className="relative h-[124px] w-[124px] sm:h-[140px] sm:w-[140px]">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><SpinningNode size={330} dark={false} speed={0.012} /></div>
            </div>
          </motion.div>
          <span className={`${SERIF} mt-1 text-[22px] font-medium leading-none text-black`}>xyra</span>
          <motion.span key={MOOD[phase]} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`${MONO} mt-2 h-4 text-[10px] uppercase tracking-[0.2em] text-black/45`}>
            {MOOD[phase]}
          </motion.span>
        </div>

        <div className="flex flex-col items-center">
          <Cup side="right" id="coffee-cup-2" drinking={phase === 3} empty={phase >= 3} />
          <span className={`${MONO} mt-1 text-[11px] ${phase >= 4 ? "text-black/30 line-through" : "text-black/60"}`}>$5</span>
        </div>
      </div>

      {/* the tab */}
      <div className="space-y-2 border-t border-black/10 pt-4">
        <TabLine on={phase >= 2} label="coffee, the first" price="$5" />
        <TabLine on={phase >= 4} label="coffee, the second" price="$5" />
        <TabLine on={phase >= 4} label="xyra, awake all month" price="$10" bold />
      </div>
      <p className={`${PROSE} mt-4 text-[16px] leading-snug text-black/55`}>
        two coffees a month. that&apos;s what it takes to run your brain, your boards and every ai that reads them.
      </p>
    </div>
  );
}
