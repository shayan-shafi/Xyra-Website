"use client";

// ─── BrainHero ───────────────────────────────────────────────────────────────
// The top of the page is the brain: the app's world, live, on the site's paper.
// It turns on its own; tap a node (or its label) and the camera glides onto it
// and its file opens beside it, the way it does in the app. Until someone
// touches it, it opens a few nodes by itself. The wordmark, the line and the
// ways in (sign up on the web app, see it work, or apply) sit over it and let clicks through to the world everywhere else.
// Wide screens: the file is a card on the right. Phones: a sheet at the bottom.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { track } from "@/lib/analytics";
import { SIGN_IN_URL, signUpUrl } from "@/lib/site";
import { useSectionView } from "@/lib/useSectionView";
import BrainFile from "./hero/BrainFile";
import { AGENT_NAMES, AgentMark } from "./hero/stickers";
import { MEMORY_COUNT, SOURCES, selId, type Selection } from "./hero/heroWorld";
import type { WorldApi } from "./hero/BrainWorld3D";

const BrainWorld3D = dynamic(() => import("./hero/BrainWorld3D"), { ssr: false });

const MONO = "font-[family-name:var(--font-jetbrains)]";

function Nav() {
  return (
    <div className="absolute top-0 inset-x-0 z-[70] flex items-center justify-between px-5 sm:px-8 h-12 pointer-events-none">
      <span className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-black">xyra</span>
      <div className={`${MONO} pointer-events-auto flex items-center gap-5 text-xs`}>
        <a
          href="#pricing"
          onClick={() => track("cta_click", { cta_location: "hero_nav", button_label: "pricing" })}
          className="text-black/60 hover:text-black transition-colors"
        >
          pricing
        </a>
        <a
          href={SIGN_IN_URL}
          onClick={() => track("cta_click", { cta_location: "hero_nav", button_label: "sign in" })}
          className="text-black/60 hover:text-black transition-colors"
        >
          sign in
        </a>
        <a
          href={signUpUrl("nav")}
          onClick={() => track("cta_click", { cta_location: "hero_nav", button_label: "start your brain" })}
          className="text-black underline underline-offset-4 decoration-black/30 hover:decoration-black transition-all"
        >
          start your brain
        </a>
      </div>
    </div>
  );
}

export default function BrainHero() {
  const sectionRef = useSectionView<HTMLElement>("brain_hero");
  const apiRef = useRef<WorldApi | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [touched, setTouched] = useState(false);
  // phones: the file is a bottom sheet and the world sits a little lower
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setSheet(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const took = useCallback(() => {
    apiRef.current?.stopTour();
    setTouched(true);
  }, []);

  const onSelect = useCallback((s: Selection | null) => setSelection(s), []);
  const open = useCallback((s: Selection) => {
    track("cta_click", { cta_location: "brain_hero", button_label: `node_${selId(s)}` });
    if (!apiRef.current?.select(s)) setSelection(s);
  }, []);
  const close = useCallback(() => apiRef.current?.deselect(), []);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, close]);

  return (
    <section
      ref={sectionRef}
      id="waitlist"
      onPointerDownCapture={took}
      className="relative w-full h-[100svh] min-h-[640px] max-h-[1100px] overflow-hidden"
    >
      <Nav />

      {/* the world: the whole section is its box, so nothing clips at an edge */}
      <BrainWorld3D apiRef={apiRef} onSelect={onSelect} sheet={sheet} lift={sheet ? 0.1 : 0.1} />

      {/* the wordmark, the line, the two ways in */}
      <div className="relative z-30 flex flex-col items-center px-6 pt-14 md:pt-16 pointer-events-none">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-[family-name:var(--font-playfair)] text-[64px] sm:text-[84px] md:text-[96px] font-medium text-black leading-none tracking-tight"
        >
          xyra
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-black/60 mt-3 text-center max-w-md"
          style={{ textShadow: "0 0 10px #fbfaf8, 0 0 4px #fbfaf8" }}
        >
          the outlet for your ambitious mind
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="mt-6 flex items-center gap-3 pointer-events-auto"
        >
          <a
            href={signUpUrl("hero")}
            onClick={() => track("cta_click", { cta_location: "brain_hero", button_label: "start your brain" })}
            className={`${MONO} inline-flex items-center px-6 py-3 bg-black text-white rounded-full text-xs tracking-wide hover:bg-black/85 transition-colors`}
          >
            start your brain
          </a>
          <a
            href="#phone"
            onClick={() => track("cta_click", { cta_location: "brain_hero", button_label: "see it work" })}
            className={`${MONO} inline-flex items-center px-6 py-3 rounded-full border border-black/15 bg-[#fbfaf8]/80 text-xs tracking-wide text-black/70 hover:border-black/40 hover:text-black transition-colors`}
          >
            see it work
          </a>
        </motion.div>
      </div>

      {/* what you're looking at, along the bottom; steps aside for the file */}
      <motion.div
        initial={false}
        animate={{ opacity: selection ? 0 : 1 }}
        transition={{ duration: 0.35 }}
        className={`absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-5 pb-5 sm:px-8 md:flex-row md:items-end md:justify-between pointer-events-none ${MONO} text-[10px] uppercase tracking-[0.2em] text-black/45`}
      >
        <span>
          {MEMORY_COUNT} memories <span className="text-black/20">·</span> {SOURCES.length} sources
        </span>
        <span className={`hidden md:inline transition-opacity duration-500 ${touched ? "opacity-0" : "text-black/35"}`}>tap a node</span>
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 md:justify-end">
          read by
          {AGENT_NAMES.map((name) => (
            <span key={name} className="flex items-center gap-1.5 normal-case tracking-normal text-black/70"><AgentMark name={name} />{name}</span>
          ))}
        </span>
      </motion.div>

      {/* the node's file */}
      <AnimatePresence>
        {selection && <BrainFile key="file" selection={selection} onSelect={open} onClose={close} sheet={sheet} />}
      </AnimatePresence>
    </section>
  );
}
