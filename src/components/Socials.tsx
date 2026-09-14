"use client";

// ─── Socials ─────────────────────────────────────────────────────────────────
// The reels as a coverflow: the active one big in the middle, its neighbours
// stepping down in size and fading toward the edges, five in view. Every card
// with a clip plays it (muted, looping) while the section is on screen; the
// carousel advances every two seconds and pauses on hover; a side card click
// brings it to the middle, the middle card opens the post. Content:
// src/content/socials.ts.

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import { FEEDBACK_QUOTES, REELS, type Reel } from "@/content/socials";

const STEP_MS = 2000; // every card is already playing, so the middle can rotate quickly
// per |offset| from the active card: scale, x (in center-card widths), opacity
const RING = [
  { scale: 1, x: 0, opacity: 1 },
  { scale: 0.72, x: 1.12, opacity: 0.92 },
  { scale: 0.5, x: 1.86, opacity: 0.78 },
  { scale: 0.34, x: 2.4, opacity: 0 },
];

function ReelCard({ r, d, unit, playing, onPick }: { r: Reel; d: number; unit: number; playing: boolean; onPick: () => void }) {
  const ad = Math.min(Math.abs(d), 3);
  const ring = RING[ad];
  const active = d === 0;
  const h = (unit * 16) / 9;
  const videoRef = useRef<HTMLVideoElement>(null);
  // every visible clip runs while the section is on screen; the two hidden
  // (fully faded) cards rest so the browser isn't decoding nine streams for five
  const shouldPlay = playing && ad <= 2;
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (shouldPlay) v.play().catch(() => {});
    else v.pause();
  }, [shouldPlay]);
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
      {r.video ? (
        <video
          ref={videoRef}
          src={r.video}
          poster={r.cover}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      )}
      <span className="absolute top-3 left-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-white/90 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 lowercase">{r.platform}</span>
      {/* the middle card: a play glyph if it's only a poster, otherwise a quiet "open" cue */}
      <motion.span className="absolute inset-0 flex items-center justify-center" animate={{ opacity: active && !r.video ? 1 : 0 }} transition={{ duration: 0.3 }}>
        <span className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
          <svg className="w-5 h-5 translate-x-[1px]" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </motion.span>
      <motion.span className="absolute bottom-3 right-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-white/90 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1 lowercase" animate={{ opacity: active && r.video ? 1 : 0 }} transition={{ duration: 0.3 }}>
        watch on {r.platform} ↗
      </motion.span>
    </motion.a>
  );
}

// A ticker of quotes: one continuous line drifting left, the quote nearest the
// middle in full black, the rest greyed. Driven by rAF so the highlight can
// follow the real positions (quotes are different lengths); pauses on hover;
// holds still under prefers-reduced-motion.
function FeedbackTicker({ quotes }: { quotes: string[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const paused = useRef(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPEED = 70; // px per second
    let x = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused.current && !still) x -= SPEED * dt;
      const half = track.scrollWidth / 2; // content is doubled
      if (half > 0 && -x >= half) x += half;
      track.style.transform = `translateX(${x}px)`;
      const wc = wrap.getBoundingClientRect();
      const mid = wc.left + wc.width / 2;
      let best = -1;
      let bestD = Infinity;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      itemRefs.current.forEach((el, i) => {
        if (el) el.style.opacity = i === best ? "1" : "0.22";
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const items = [...quotes, ...quotes];
  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden py-2"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      <div ref={trackRef} className="flex w-max items-baseline gap-24 will-change-transform pr-24">
        {items.map((q, i) => (
          <span
            key={i}
            ref={(el) => { itemRefs.current[i] = el; }}
            className="whitespace-nowrap font-[family-name:var(--font-playfair)] text-3xl md:text-4xl lg:text-[2.75rem] font-medium tracking-tight text-black transition-opacity duration-300"
            style={{ opacity: 0.22 }}
          >
            &ldquo;{q}&rdquo;
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Socials() {
  const ref = useSectionView<HTMLElement>("socials");
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [unit, setUnit] = useState(300); // the center card's width, from the stage width
  const onScreen = useInView(stageRef, { margin: "120px" });

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
          return <ReelCard key={r.id} r={r} d={d} unit={unit} playing={onScreen} onPick={() => setActive(i)} />;
        })}
      </div>

      {/* what people said */}
      <div className="mt-20 md:mt-28">
        <div className="flex justify-center mb-8 md:mb-10">
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[0.2em] uppercase text-black/50 border border-black/15 rounded-full px-3 py-1.5">feedback</span>
        </div>
        <FeedbackTicker quotes={FEEDBACK_QUOTES} />
      </div>
    </section>
  );
}
