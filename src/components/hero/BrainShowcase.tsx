"use client";

// ─── BrainShowcase ───────────────────────────────────────────────────────────
// The world on the page, running the site's original brain beat on a loop:
// orbit idle → glide the camera into the Finance node → its insights card
// opens beside it → hold → glide back out → idle. Zoom is written to a ref
// every frame (no React churn); only the card's open/close touches state.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import BrainWorldCanvas from "./BrainWorldCanvas";
import { BRAIN_CATEGORIES } from "./PhoneScene";
import FinanceInsightsCard from "./FinanceInsightsCard";

const IDLE = 3000, ZOOM_IN = 2200, HOLD = 5200, ZOOM_OUT = 1600;
const CYCLE = IDLE + ZOOM_IN + HOLD + ZOOM_OUT;

export default function BrainShowcase({ active }: { active: boolean }) {
  const zoomRef = useRef(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    let wasOpen = false;
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
          cameraPosition={[0, 8, 15.5]}
          zoomRef={zoomRef}
          zoomKey="finance"
          selected={open ? "finance" : null}
        />
      )}
      <div className="hidden md:block absolute z-20 right-[4%] lg:right-[8%] top-1/2 -translate-y-1/2 pointer-events-none">
        <AnimatePresence>{open && <FinanceInsightsCard key="card" />}</AnimatePresence>
      </div>
    </div>
  );
}
