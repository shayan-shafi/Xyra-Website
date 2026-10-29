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
import LaptopScene, { LAPTOP_W, LAPTOP_H } from "./LaptopScene";
import { Sticker } from "./Sticker";

// when each step starts, in the loop's ms (LaptopScene's TIMELINE beats:
// move_gcal, click_close, move_settings2)
const STEPS: [string, number][] = [
  ["connect your ai", 0],
  ["plug in your tools", 8200],
  ["one brain", 16100],
  ["any agent knows you", 19200],
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

export default function LaptopShowcase({ active }: { active: boolean }) {
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

  return (
    <div className="relative mx-auto w-full flex flex-col items-center">
      <div className="w-full flex flex-col-reverse md:flex-row md:items-end md:justify-between gap-6 mb-8 md:mb-10">
        <ol className="grid grid-cols-2 md:flex gap-x-6 gap-y-3 font-[family-name:var(--font-jetbrains)] text-[11px] tracking-wide">
          {STEPS.map(([label], i) => (
            <li key={label} className={`w-full md:w-36 transition-colors duration-500 ${i === step ? "text-black" : "text-black/35"}`}>
              <span className="tabular-nums">0{i + 1}</span> {label}
              <span className="block mt-2 h-[2px] w-full bg-black/10 overflow-hidden">
                <span ref={(el) => { bars.current[i] = el; }} className="block h-full bg-black origin-left" style={{ transform: "scaleX(0)" }} />
              </span>
            </li>
          ))}
        </ol>
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
