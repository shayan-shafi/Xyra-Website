"use client";

// ─── HowItStarts ─────────────────────────────────────────────────────────────
// What "start your brain" actually sets off, right under the hero: the app's
// real first run in three steps. Make the account, connect the AI you already
// use and say one line to it (the line the xyra connector listens for), watch
// what it knows land around you. Each card plays its step once when it comes
// into view; on a wide screen they play left to right. The numbers are the
// hero's demo brain (heroWorld), never anyone's real data.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInView } from "framer-motion";
import { track } from "@/lib/analytics";
import { signUpUrl } from "@/lib/site";
import { useSectionView } from "@/lib/useSectionView";
import { AgentMark } from "./hero/stickers";
import { MEMORY_COUNT, WORLD } from "./hero/heroWorld";

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";
const PROSE = "font-[family-name:var(--font-eb-garamond)]";

const ASK = "send everything you know about me to xyra.";
/** Wide screens: each card waits for the one before it. */
const STAGGER_MS = 2200;

const prefersStill = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Walks 1..times.length once `on`, each stage at its own moment (ms from the start). */
function useStages(on: boolean, times: number[]): number {
  const [stage, setStage] = useState(0);
  const key = times.join(",");
  useEffect(() => {
    if (!on) return;
    if (prefersStill()) { setStage(times.length); return; }
    const timers = times.map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);
  return stage;
}

/** Text that types itself in once `on`; it holds its full size from the start so nothing jumps. */
function Typed({ text, on, speed = 26 }: { text: string; on: boolean; speed?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (prefersStill()) { setN(text.length); return; }
    const t = window.setInterval(() => setN((k) => { if (k >= text.length) { window.clearInterval(t); return k; } return k + 1; }), speed);
    return () => window.clearInterval(t);
  }, [on, text, speed]);
  return (
    <span className="relative inline-block">
      <span className="invisible">{text}</span>
      <span className="absolute inset-0" aria-hidden>{text.slice(0, n)}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

// ── 01: the account ──────────────────────────────────────────────────────────
function AccountScene({ on }: { on: boolean }) {
  const stage = useStages(on, [100, 1100, 2000]);
  return (
    <div className="w-full max-w-[250px]">
      <div className={`${SERIF} text-[22px] font-medium leading-none text-black`}>start your brain.</div>
      <div className={`${MONO} mt-4 space-y-2 text-[11px]`}>
        <div className="flex h-9 items-center border border-black/15 bg-white px-3 text-black">
          {stage >= 1 ? <Typed text="you@email.com" on speed={45} /> : <span className="text-black/30">email</span>}
        </div>
        <div className="flex h-9 items-center border border-black/15 bg-white px-3 tracking-[0.2em] text-black">
          {stage >= 2 ? <Typed text="••••••••••" on speed={45} /> : <span className="tracking-normal text-black/30">password</span>}
        </div>
        <div className={`flex h-9 items-center justify-center transition-colors duration-300 ${stage >= 3 ? "bg-white text-black ring-1 ring-black" : "bg-black text-white"}`}>
          {stage >= 3 ? "✓ you're in" : "start my brain"}
        </div>
      </div>
    </div>
  );
}

// ── 02: the one line ─────────────────────────────────────────────────────────
function AskScene({ on }: { on: boolean }) {
  const stage = useStages(on, [100, 1700, 3100]);
  return (
    <div className="flex w-full max-w-[270px] flex-col gap-2.5">
      <div className={`${MONO} flex items-center gap-1.5 text-[10px] text-black/50`}><AgentMark name="claude" size={12} />claude</div>
      <div className={`self-end rounded-2xl rounded-br-sm bg-black px-3.5 py-2.5 ${PROSE} text-[15px] leading-snug text-white transition-opacity duration-300 ${stage >= 1 ? "opacity-100" : "opacity-0"}`}>
        <Typed text={ASK} on={stage >= 1} />
      </div>
      <div className={`${MONO} flex items-center gap-2 text-[10px] text-black/55 transition-opacity duration-300 ${stage >= 2 ? "opacity-100" : "opacity-0"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${stage >= 3 ? "bg-black" : "animate-pulse bg-black/40"}`} />
        xyra · import memories
      </div>
      <div className={`self-start rounded-2xl rounded-bl-sm border border-black/10 bg-white px-3.5 py-2.5 ${PROSE} text-[15px] leading-snug text-black transition-opacity duration-500 ${stage >= 3 ? "opacity-100" : "opacity-0"}`}>
        done. {MEMORY_COUNT} memories are in your xyra brain.
      </div>
    </div>
  );
}

// ── 03: the brain fills ──────────────────────────────────────────────────────
const CX = 140, CY = 84;
const NODES = WORLD.map((a, i) => {
  const t = (i / WORLD.length) * Math.PI * 2 - Math.PI / 2;
  return { key: a.key, label: a.label.toLowerCase(), x: CX + Math.cos(t) * 104, y: CY + Math.sin(t) * 58 };
});

function FillScene({ on }: { on: boolean }) {
  const shown = useStages(on, NODES.map((_, i) => 250 + i * 240));
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!on) return;
    if (prefersStill()) { setCount(MEMORY_COUNT); return; }
    const start = performance.now(), dur = 250 + NODES.length * 240;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setCount(Math.round(MEMORY_COUNT * p * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return (
    <div className="flex w-full flex-col items-center">
      <svg viewBox="0 0 280 168" className="w-full max-w-[290px]" role="img" aria-label="a brain filling with life areas">
        {NODES.map((n, i) => (
          <g key={n.key} style={{ opacity: shown > i ? 1 : 0, transition: "opacity 400ms" }}>
            <line x1={CX} y1={CY} x2={n.x} y2={n.y} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
            <circle cx={n.x} cy={n.y} r={7} fill="#fff" stroke="#000" strokeWidth={1} />
            <text x={n.x} y={n.y + (n.y < CY ? -12 : 19)} textAnchor="middle" className={MONO} style={{ fontSize: 8, fill: "rgba(0,0,0,0.6)" }}>{n.label}</text>
          </g>
        ))}
        <circle cx={CX} cy={CY} r={15} fill="#000" />
        <text x={CX} y={CY + 3} textAnchor="middle" className={MONO} style={{ fontSize: 8, fill: "#fff" }}>you</text>
      </svg>
      <div className={`${MONO} mt-1 text-[10px] uppercase tracking-[0.2em] text-black/50`}>
        <span className="tabular-nums text-black">{count}</span> memories
      </div>
    </div>
  );
}

const STEPS: { title: string; body: string; Scene: (p: { on: boolean }) => ReactNode }[] = [
  { title: "start your brain", body: "an email, a password, your first name. no card.", Scene: AccountScene },
  { title: "connect claude or chatgpt", body: "one click in the app, then say one line to it.", Scene: AskScene },
  { title: "watch it fill", body: "what it knows about you lands on shelves you can open, edit and forget.", Scene: FillScene },
];

function Step({ index, title, body, Scene }: { index: number; title: string; body: string; Scene: (p: { on: boolean }) => ReactNode }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: "-120px" });
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!seen) return;
    // side by side, the three read as one story; stacked, each plays as it arrives
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    const t = window.setTimeout(() => setOn(true), wide && !prefersStill() ? index * STAGGER_MS : 0);
    return () => window.clearTimeout(t);
  }, [seen, index]);
  return (
    <li ref={ref} className="flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white" style={{ boxShadow: "0 18px 44px rgba(0,0,0,0.06)" }}>
      <div className="flex h-[236px] items-center justify-center border-b border-black/[0.07] bg-[#fbfaf8] px-6">
        <Scene on={on} />
      </div>
      <div className="flex gap-3 p-6 sm:p-7">
        <span className={`${MONO} pt-[5px] text-[10px] text-black/35`}>0{index + 1}</span>
        <span>
          <span className={`block ${SERIF} text-[22px] leading-tight text-black`}>{title}</span>
          <span className={`mt-1.5 block ${PROSE} text-[17px] leading-snug text-black/55`}>{body}</span>
        </span>
      </div>
    </li>
  );
}

export default function HowItStarts() {
  const sectionRef = useSectionView<HTMLElement>("how_it_starts");
  return (
    <section id="how" ref={sectionRef} className="scroll-mt-16 px-6 sm:px-12 lg:px-20 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className={`${MONO} text-[10px] uppercase tracking-[0.2em] text-black/45`}>how it starts</div>
        <h2 className={`${SERIF} mt-4 text-5xl sm:text-6xl lg:text-7xl font-medium text-black tracking-tight leading-[1.05]`}>full in a minute.</h2>
        <p className={`${PROSE} mt-4 max-w-lg text-lg sm:text-xl text-black/60`}>
          you don&apos;t type your life in. the ai you already use hands over what it knows.
        </p>

        <ol className="mt-10 grid gap-5 md:mt-14 lg:grid-cols-3">
          {STEPS.map((s, i) => <Step key={s.title} index={i} {...s} />)}
        </ol>

        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href={signUpUrl("how")}
            onClick={() => track("cta_click", { cta_location: "how_it_starts", button_label: "start your brain" })}
            className={`${MONO} inline-flex items-center rounded-full bg-black px-6 py-3 text-xs tracking-wide text-white transition-colors hover:bg-black/85`}
          >
            start your brain
          </a>
          <span className={`${MONO} text-[11px] text-black/45`}>no card to start. $10 a seat a month once you&apos;ve seen it.</span>
        </div>
      </div>
    </section>
  );
}
