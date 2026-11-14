"use client";

// ─── LaptopShowcase ──────────────────────────────────────────────────────────
// "seamless context for agents." on a laptop: the web app running the scripted
// loop in LaptopScene (connect two AIs → their memories import → three tools →
// the world fills → a third AI asks "what do you know about me?" and knows).
// The laptop is drawn in CSS (lid, bezel, notch, base); the scene is authored
// at 1280×800 and scaled to the screen. Four steps beside the headline track
// the loop, each with its own progress bar (filled from the frame loop, no
// re-renders).

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LaptopScene, { LAPTOP_W, LAPTOP_H } from "./LaptopScene";
import { Sticker } from "./Sticker";

// when each step starts, in the loop's ms (LaptopScene's TIMELINE beats:
// move_gcal, click_close, move_settings2, claude_open, phone)
const STEPS: [string, number][] = [
  ["connect your ai", 0],
  ["plug in your tools", 8200],
  ["one brain", 16100],
  ["any agent knows you", 19200],
  ["your work saves itself", 30600],
  ["get it on your phone", 41400],
];

/** The hero's caption for each step: what's happening on the laptop right now. */
const STEP_NOTES = [
  "claude and chatgpt connect in a click, and what they already know about you comes over.",
  "google calendar, granola and canvas feed it. each import shows you exactly what landed.",
  "it all sits on shelves around you. open a node and it reads like a file.",
  "a new ai connects, asks what xyra knows about you, and answers from your brain.",
  "ask claude for a competitor analysis of your startup. it saves it to xyra as a note, without being asked.",
  "settings has the testflight link. install the iphone app and sign in with the same account.",
];

function Laptop({ children }: { children: React.ReactNode }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / LAPTOP_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative w-full">
      {/* lid: aluminium edge → black bezel → screen */}
      <div className="relative mx-auto rounded-[2.2%/3.4%] p-[0.35%]" style={{ background: "linear-gradient(180deg, #d9d9dc, #a9a9ae)" }}>
        <div className="relative rounded-[2%/3.1%] bg-[#0b0b0c] px-[2.1%] pt-[2.4%] pb-[2.6%]">
          <div ref={screenRef} className="relative w-full overflow-hidden rounded-[0.6%] bg-black" style={{ aspectRatio: `${LAPTOP_W} / ${LAPTOP_H}` }}>
            {scale > 0 && (
              <div className="absolute left-0 top-0 origin-top-left" style={{ width: LAPTOP_W, height: LAPTOP_H, transform: `scale(${scale})` }}>
                {children}
              </div>
            )}
          </div>
          {/* notch + camera */}
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[11%] h-[3.2%] rounded-b-[10px] bg-[#0b0b0c] flex items-center justify-center">
            <span className="block w-[7%] aspect-square rounded-full bg-[#1d2430]" />
          </div>
        </div>
      </div>
      {/* base: a wedge a little wider than the lid, with the thumb cut */}
      <div className="relative -mx-[5.5%] h-[clamp(10px,2.2vw,22px)]">
        <div className="absolute inset-x-0 top-0 h-[62%] rounded-t-[3px] rounded-b-[40%_100%]" style={{ background: "linear-gradient(180deg, #e7e7ea 0%, #c3c3c8 55%, #8e8e94 100%)" }} />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[13%] h-[30%] rounded-b-[8px] bg-[#a3a3a8]" />
        <div className="absolute left-[3%] right-[3%] bottom-0 h-[38%] rounded-b-[50%] bg-black/10 blur-[6px]" />
      </div>
    </div>
  );
}

// Shayan's robot sticker (2026-10-29), low on the laptop's left where he
// dragged it, hung off the edge so it never covers the screen. Offset and width
// are % of the laptop's width (top % of its height), so it scales with it.
// Draggable like the rest of the canvas; only where there's room beside it.
const SIDE_STICKERS: { src: string; width: string; tilt: number; pos: string }[] = [
  { src: "/assets/stk-robot.png", width: "w-[9.5%]", tilt: 8, pos: "right-[calc(100%+22.5%)] top-[61%]" },
];

function SideStickers() {
  return (
    <div className="hidden min-[1360px]:block absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
      {SIDE_STICKERS.map((st) => (
        <Sticker key={st.src} className={`${st.pos} ${st.width}`} tilt={st.tilt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={st.src} alt="" className="block w-full h-auto" draggable={false} style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.10))" }} />
        </Sticker>
      ))}
    </div>
  );
}

/** `hero`: the laptop at the top of the page. No headline of its own (the hero
 *  has the wordmark); the steps sit under the laptop, and it's sized to show
 *  whole under the hero's text on a laptop screen. */
export default function LaptopShowcase({ active, hero = false }: { active: boolean; hero?: boolean }) {
  const [loop, setLoop] = useState<{ start: number; ms: number } | null>(null);
  const [step, setStep] = useState(0);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!loop) return;
    let raf = 0;
    let was = -1;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = (now - loop.start) % loop.ms;
      let i = 0;
      while (i + 1 < STEPS.length && t >= STEPS[i + 1][1]) i++;
      if (i !== was) {
        was = i;
        setStep(i);
      }
      STEPS.forEach(([, from], j) => {
        const to = j + 1 < STEPS.length ? STEPS[j + 1][1] : loop.ms;
        const p = j < i ? 1 : j > i ? 0 : (t - from) / (to - from);
        const el = bars.current[j];
        if (el) el.style.transform = `scaleX(${Math.min(1, Math.max(0, p)).toFixed(4)})`;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loop]);

  const steps = (
        <ol className={`grid grid-cols-2 md:flex gap-x-6 gap-y-3 font-[family-name:var(--font-jetbrains)] text-[11px] tracking-wide ${hero ? "w-full max-w-[780px] md:justify-center" : ""}`}>
          {STEPS.map(([label], i) => (
            <li key={label} className={`w-full ${hero ? "md:w-44" : "md:w-36"} transition-colors duration-500 ${i === step ? "text-black" : "text-black/35"}`}>
              <span className="tabular-nums">0{i + 1}</span> {label}
              <span className="block mt-2 h-[2px] w-full bg-black/10 overflow-hidden">
                <span ref={(el) => { bars.current[i] = el; }} className="block h-full bg-black origin-left" style={{ transform: "scaleX(0)" }} />
              </span>
            </li>
          ))}
        </ol>
  );

  if (hero) {
    // The laptop, and beside it (under it on a phone) what the step on screen
    // is doing: the caption changes as each step starts.
    return (
      <div className="relative mx-auto flex w-full flex-col items-center gap-7 lg:flex-row lg:items-center lg:justify-center lg:gap-12">
        <div className="relative shrink-0" style={{ width: "min(900px, 100%, max(300px, calc((100svh - 320px) / 0.66)))" }}>
          <Laptop>{active && <LaptopScene onLoopStart={(start, ms) => setLoop({ start, ms })} />}</Laptop>
        </div>
        <div className="w-full max-w-[420px] lg:w-[270px] lg:shrink-0">
          <div className="relative min-h-[150px] lg:min-h-[210px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <div className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.2em] text-black/45">
                  step 0{step + 1} of 0{STEPS.length}
                </div>
                <div className="mt-3 font-[family-name:var(--font-playfair)] text-[30px] font-medium leading-[1.08] tracking-tight text-black lg:text-[34px]">
                  {STEPS[step][0]}
                </div>
                <p className="mt-3 font-[family-name:var(--font-eb-garamond)] text-[18px] leading-snug text-black/60">
                  {STEP_NOTES[step]}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-5 flex gap-1.5" aria-hidden>
            {STEPS.map(([label], i) => (
              <span key={label} className="block h-[2px] flex-1 overflow-hidden bg-black/10">
                <span ref={(el) => { bars.current[i] = el; }} className="block h-full origin-left bg-black" style={{ transform: "scaleX(0)" }} />
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full flex flex-col items-center">
      <div className="w-full flex flex-col-reverse md:flex-row md:items-end md:justify-between gap-6 mb-8 md:mb-10">
        {steps}
        <h3 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl font-medium text-black tracking-tight leading-[1.05] md:text-right max-w-[440px]">
          seamless context for agents.
        </h3>
      </div>

      <div className="relative" style={{ width: "min(1060px, 89%, calc((86vh - 150px) / 0.71))" }}>
        <SideStickers />
        <Laptop>{active && <LaptopScene onLoopStart={(start, ms) => setLoop({ start, ms })} />}</Laptop>
      </div>
    </div>
  );
}
