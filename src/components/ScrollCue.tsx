"use client";

import { motion } from "framer-motion";

/**
 * The "keep scrolling" cue that lives at the bottom of every section — a small
 * button that smooth-scrolls to the next section, so the whole page reads as
 * one guided, one-page scroll (echoes the bouncer's "click here to learn"). A
 * plain anchor-jump would pop; this always glides.
 */
type Props = {
  targetId: string;
  label: string;
  /** On a dark background (white text) vs light (default). */
  dark?: boolean;
  /** Point the arrow up (e.g. a "back to the top" cue). */
  up?: boolean;
  /** Override the default in-flow wrapper (e.g. pin absolutely to a section). */
  wrapperClassName?: string;
};

export default function ScrollCue({ targetId, label, dark = false, up = false, wrapperClassName }: Props) {
  const go = () =>
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className={wrapperClassName ?? "flex justify-center pt-16 md:pt-24"}>
      <button
        onClick={go}
        className={`group flex flex-col items-center gap-2.5 font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[0.25em] uppercase transition-colors ${
          dark ? "text-white/50 hover:text-white" : "text-black/40 hover:text-black"
        }`}
      >
        <span>{label}</span>
        <motion.svg
          animate={{ y: up ? [0, -5, 0] : [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
        </motion.svg>
      </button>
    </div>
  );
}
