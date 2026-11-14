"use client";

// ─── BrainHero ───────────────────────────────────────────────────────────────
// The top of the page: the wordmark with its "open beta" sticker, the line,
// the ways in (sign up on the web app, see it work), and under them the
// laptop: the web app running its scripted loop (hero/LaptopShowcase: connect
// your AIs, plug in your tools, one brain, any agent knows you). Which AIs
// read the brain is said under it. (2026-11-13: the laptop took the live
// brain's place here; hero/BrainWorld3D and BrainFile stay on disk.)

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { track } from "@/lib/analytics";
import { SIGN_IN_URL, signUpUrl } from "@/lib/site";
import { useSectionView } from "@/lib/useSectionView";
import LaptopShowcase from "./hero/LaptopShowcase";
import { Sticker } from "./hero/Sticker";
import { AGENT_NAMES, AgentMark } from "./hero/stickers";

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
  const laptopRef = useRef<HTMLDivElement>(null);
  const near = useInView(laptopRef, { margin: "200px" });

  return (
    <section ref={sectionRef} id="waitlist" className="relative w-full overflow-x-clip pb-14 md:pb-20">
      <Nav />

      {/* the wordmark, the line, the two ways in */}
      <div className="relative z-30 flex flex-col items-center px-6 pt-12 md:pt-11">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-[family-name:var(--font-playfair)] text-[64px] sm:text-[84px] md:text-[96px] font-medium text-black leading-none tracking-tight relative"
        >
          xyra
          {/* a sticker on the corner of the wordmark; drag it like the others */}
          <Sticker className="left-[86%] -top-[0.02em]" tilt={9}>
            <span
              className={`${MONO} block whitespace-nowrap rounded-full border-[3px] border-white bg-black px-3 py-[7px] text-[10px] sm:text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-white`}
              style={{ boxShadow: "0 3px 10px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.08)" }}
            >
              open beta
            </span>
          </Sticker>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-black/60 mt-2 text-center max-w-md"
          style={{ textShadow: "0 0 10px #fbfaf8, 0 0 4px #fbfaf8" }}
        >
          shared icloud storage, but for ai
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="mt-5 flex items-center gap-3"
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
            onClick={() => track("cta_click", { cta_location: "brain_hero", button_label: "phone companion" })}
            className={`${MONO} inline-flex items-center px-6 py-3 rounded-full border border-black/15 bg-[#fbfaf8]/80 text-xs tracking-wide text-black/70 hover:border-black/40 hover:text-black transition-colors`}
          >
            phone companion
          </a>
        </motion.div>
      </div>


      {/* the laptop */}
      <motion.div
        ref={laptopRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-8 px-4 sm:px-8 md:mt-7"
      >
        <LaptopShowcase active={near} hero />
      </motion.div>

      {/* who reads the brain */}
      <div className={`mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-5 ${MONO} text-[10px] uppercase tracking-[0.2em] text-black/45`}>
        read by
        {AGENT_NAMES.map((name) => (
          <span key={name} className="flex items-center gap-1.5 normal-case tracking-normal text-black/70"><AgentMark name={name} />{name}</span>
        ))}
      </div>
    </section>
  );
}
