"use client";

// ─── Socials ─────────────────────────────────────────────────────────────────
// The reels as a coverflow: the active one big in the middle, its neighbours
// stepping down in size and fading toward the edges, five in view. Advances
// every two seconds, pauses on hover; a side card click brings it to the
// middle, the middle card opens the post. Content: src/content/socials.ts.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import { REELS, type Reel } from "@/content/socials";

const STEP_MS = 2000;
// per |offset| from the active card: scale, x (in center-card widths), opacity
const RING = [
  { scale: 1, x: 0, opacity: 1 },
  { scale: 0.72, x: 1.12, opacity: 0.92 },
  { scale: 0.5, x: 1.86, opacity: 0.78 },
  { scale: 0.34, x: 2.4, opacity: 0 },
];

function ReelCard({ r, d, unit, onPick }: { r: Reel; d: number; unit: number; onPick: () => void }) {
  const ad = Math.min(Math.abs(d), 3);
  const ring = RING[ad];
  const active = d === 0;
  const h = (unit * 16) / 9;
  return (
    <motion.a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`open reel on ${r.platform}`}
      onClick={(e) => {
        if (!active) {
          e.preventDefault();
          onPick();
          return;
        }
        track("cta_click", { cta_location: "socials", button_label: `reel_${r.id}` });
      }}
      className="absolute left-1/2 top-1/2 block overflow-hidden rounded-2xl border border-black/10 bg-black shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
      style={{ width: unit, height: h, marginLeft: -unit / 2, marginTop: -h / 2, zIndex: 10 - ad, cursor: active ? "pointer" : "w-resize", pointerEvents: ad >= 3 ? "none" : "auto" }}
      initial={false}
      animate={{ x: Math.sign(d) * ring.x * unit, scale: ring.scale, opacity: ring.opacity }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <span className="absolute top-3 left-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-white/90 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 lowercase">{r.platform}</span>
      <motion.span className="absolute inset-0 flex items-center justify-center" animate={{ opacity: active ? 1 : 0 }} transition={{ duration: 0.3 }}>
        <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
          <svg className="w-5 h-5 translate-x-[1px]" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </motion.span>
    </motion.a>
  );
}

export default function Socials() {
  const ref = useSectionView<HTMLElement>("socials");
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [unit, setUnit] = useState(300); // the center card's width, from the stage width

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setUnit(Math.max(170, Math.min(300, el.clientWidth / 4.7)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % REELS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const n = REELS.length;
  const h = (unit * 16) / 9;

  return (
    <section id="socials" ref={ref} className="scroll-mt-20 py-20 md:py-28">
      <div className="px-6 sm:px-12 lg:px-20 max-w-6xl mx-auto mb-8 md:mb-12">
        <h2 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl lg:text-7xl font-medium text-black tracking-tight leading-[1.05]">
          out in the wild.
        </h2>
      </div>

      <div
        ref={stageRef}
        className="relative mx-auto w-full max-w-[1600px] overflow-hidden"
        style={{ height: h + 48 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {REELS.map((r, i) => {
          // shortest way round the ring, so 8 → 0 slides one step, not eight
          let d = i - active;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          return <ReelCard key={r.id} r={r} d={d} unit={unit} onPick={() => setActive(i)} />;
        })}
      </div>
    </section>
  );
}
