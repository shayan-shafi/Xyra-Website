"use client";

// ─── BrainShowcase ───────────────────────────────────────────────────────────
// The world on the page, running the site's original brain beat on a loop:
// orbit idle → glide the camera into the Finance node → its insights card
// opens beside it → hold → glide back out → idle. Zoom is written to a ref
// every frame (no React churn); only the card's open/close touches state.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BrainWorldCanvas from "./BrainWorldCanvas";
import { BRAIN_CATEGORIES } from "./PhoneScene";
import FinanceInsightsCard from "./FinanceInsightsCard";
import { AgentTile, ConnectorScrapsRow, HandArrow, RecordingPillSticker } from "./stickers";

const IDLE = 5000, ZOOM_IN = 2200, HOLD = 5200, ZOOM_OUT = 1600;
const CYCLE = IDLE + ZOOM_IN + HOLD + ZOOM_OUT;

export default function BrainShowcase({ active }: { active: boolean }) {
  const zoomRef = useRef(0);
  const [open, setOpen] = useState(false);
  // true from the first frame of the zoom-in until the zoom-out is nearly home:
  // the diagram around the world steps aside while the camera is in close
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    let wasOpen = false;
    let wasFocused = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = (now - t0) % CYCLE;
      let z = 0;
      if (t < IDLE) z = 0;
      else if (t < IDLE + ZOOM_IN) z = (t - IDLE) / ZOOM_IN;
      else if (t < IDLE + ZOOM_IN + HOLD) z = 1;
      else z = 1 - (t - IDLE - ZOOM_IN - HOLD) / ZOOM_OUT;
      zoomRef.current = z;
      const isOpen = t >= IDLE + ZOOM_IN - 300 && t < IDLE + ZOOM_IN + HOLD - 200;
      if (isOpen !== wasOpen) {
        wasOpen = isOpen;
        setOpen(isOpen);
      }
      const isFocused = t >= IDLE && t < CYCLE - 500;
      if (isFocused !== wasFocused) {
        wasFocused = isFocused;
        setFocused(isFocused);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      zoomRef.current = 0;
    };
  }, [active]);

  return (
    <div className="relative w-full h-full">
      {active && (
        <BrainWorldCanvas
          centerLabel="you"
          categories={BRAIN_CATEGORIES}
          dark={false}
          transparent
          paper="#fbfaf8"
          cameraPosition={[0, 9, 17.5]}
          zoomRef={zoomRef}
          zoomKey="finance"
          selected={open ? "finance" : null}
        />
      )}
      <div className="hidden md:block absolute z-20 right-[4%] lg:right-[8%] top-1/2 -translate-y-1/2 pointer-events-none">
        <AnimatePresence>{open && <FinanceInsightsCard key="card" />}</AnimatePresence>
      </div>

      {/* one line, swapped with the beat: the diagram's line up top while the world
          idles; the insights line along the bottom while the camera is in on
          Finance (the zoomed world crowds the top). Paper halo keeps it legible. */}
      <div className={`absolute inset-x-0 z-10 flex justify-center px-6 text-center pointer-events-none ${focused ? "bottom-[5%]" : "top-[4%]"}`}>
        <AnimatePresence mode="wait">
          <motion.h3
            key={focused ? "insights" : "context"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl font-medium text-black tracking-tight"
            style={{ textShadow: "0 0 18px #fbfaf8, 0 0 8px #fbfaf8, 0 0 3px #fbfaf8" }}
          >
            {focused ? "simple insights for you." : "seamless context for agents."}
          </motion.h3>
        </AnimatePresence>
      </div>

      {/* how it's built → what it feeds. Left: your voice + your connectors, arrows
          into the world. Right: an arrow out to the agents. Hidden while zoomed. */}
      <motion.div
        className="hidden lg:block absolute inset-0 z-10 pointer-events-none"
        initial={false}
        animate={{ opacity: focused ? 0 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute left-[3%] top-[30%] origin-left scale-[1.2]"><RecordingPillSticker /></div>
        <div className="absolute left-[17.5%] top-[31%] rotate-[16deg] origin-left"><HandArrow width={130} bow={-6} /></div>

        <div className="absolute left-[1.5%] top-[64%]"><ConnectorScrapsRow scale={0.8} /></div>
        <div className="absolute left-[17%] top-[61%] -rotate-[26deg] origin-left"><HandArrow width={118} bow={-10} /></div>

        <div className="absolute right-[11%] top-[43%]"><HandArrow width={140} bow={4} /></div>
        <div className="absolute right-[3.5%] top-[32%] flex flex-col gap-5">
          <AgentTile name="claude" />
          <AgentTile name="chatgpt" />
        </div>
      </motion.div>
    </div>
  );
}
