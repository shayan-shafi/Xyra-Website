"use client";

// ─── Pricing ─────────────────────────────────────────────────────────────────
// One plan: $10 a seat, a month. A seat is one person and their brain. The
// card is the price on the left and what a seat gets on the right, every line
// something the product does today; the small print matches the terms page
// (billed monthly through Stripe, cancel any time, access to the end of the
// paid period). Sits between the reels and the last ask.

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { track } from "@/lib/analytics";
import { signUpUrl } from "@/lib/site";
import { useSectionView } from "@/lib/useSectionView";

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";
const PROSE = "font-[family-name:var(--font-eb-garamond)]";

const INCLUDED: [string, string][] = [
  ["say it, it's filed", "braindump by voice or text. xyra sorts it onto your schedule, to-dos and boards."],
  ["boards that build themselves", "workouts, classes, budget, sleep, goals and more, each designed for what it tracks."],
  ["one brain", "everything xyra learns about you, on shelves you can open, edit and forget."],
  ["your tools, plugged in", "google calendar, apple health, canvas, granola and wispr flow feed it."],
  ["every ai knows you", "claude, chatgpt and gemini read from your brain, with your say-so."],
  ["phone and laptop", "the iphone app and the web app, always in step."],
  ["it looks out for you", "reminders, nudges before deadlines and a weekly recap."],
];

export default function Pricing() {
  const sectionRef = useSectionView<HTMLElement>("pricing");
  const cardRef = useRef<HTMLDivElement>(null);
  const seen = useInView(cardRef, { once: true, margin: "-80px" });

  return (
    <section id="pricing" ref={sectionRef} className="scroll-mt-16 px-6 sm:px-12 lg:px-20 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <h2 className={`${SERIF} text-5xl sm:text-6xl lg:text-7xl font-medium text-black tracking-tight leading-[1.05]`}>one plan.</h2>
        <p className={`${PROSE} mt-4 text-lg sm:text-xl text-black/60 max-w-md`}>a seat is one person and their brain. everything is in it.</p>

        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 30 }}
          animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 md:mt-14 grid overflow-hidden rounded-2xl border border-black/10 bg-white md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.08)" }}
        >
          {/* the price */}
          <div className="flex flex-col justify-between gap-10 bg-black p-8 text-white sm:p-10">
            <div>
              <div className={`${MONO} text-[10px] uppercase tracking-[0.2em] text-white/50`}>xyra</div>
              <div className="mt-6 flex items-end gap-3">
                <span className={`${SERIF} text-[88px] sm:text-[104px] font-medium leading-[0.85] tracking-tight`}>$10</span>
                <span className={`${MONO} pb-2 text-xs leading-relaxed text-white/60`}>
                  a seat
                  <br />a month
                </span>
              </div>
              <p className={`${PROSE} mt-6 text-lg leading-snug text-white/70`}>no tiers and nothing held back for a bigger plan.</p>
            </div>
            <div>
              <a
                href={signUpUrl("pricing")}
                onClick={() => track("cta_click", { cta_location: "pricing", button_label: "start your brain" })}
                className={`${MONO} inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3.5 text-xs tracking-wide text-black transition-colors hover:bg-white/85`}
              >
                start your brain
              </a>
              <p className={`${MONO} mt-4 text-[10px] leading-relaxed text-white/45`}>
                billed monthly through stripe. cancel any time in settings and keep access to the end of the month you paid for.
              </p>
            </div>
          </div>

          {/* what a seat gets */}
          <div className="p-8 sm:p-10">
            <div className={`${MONO} border-b border-black/10 pb-1.5 text-[10px] uppercase tracking-[0.2em] text-black/45`}>a seat gets</div>
            <ul>
              {INCLUDED.map(([name, what]) => (
                <li key={name} className="flex gap-3 border-b border-black/[0.06] py-3.5 last:border-b-0 last:pb-0">
                  <span className={`${MONO} pt-[3px] text-[11px] text-black/35`}>→</span>
                  <span className="min-w-0">
                    <span className={`block ${SERIF} text-[17px] leading-tight text-black`}>{name}</span>
                    <span className={`mt-1 block ${PROSE} text-[15px] leading-snug text-black/55`}>{what}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <p className={`${MONO} mt-5 text-[11px] text-black/40`}>
          got an invite from a friend? their link gives you a week free.
        </p>
      </div>
    </section>
  );
}
