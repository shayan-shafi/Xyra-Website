"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import PeriodScene from "./showcase/PeriodScene";
import TaskScene from "./showcase/TaskScene";
import ExpandScene from "./showcase/ExpandScene";
import BrainScene from "./showcase/BrainScene";

/* ── Opening: Auto-playing intro + scroll-driven follow-up ──── */

const HOW_SO = "How so?";

function OpeningEffect() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Time-based intro: phase 0=blank, 1=user msg, 2=thinking, 3=reply, 4=scroll indicator
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => setPhase(3), 3500),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Scroll-driven follow-up conversation
  const [howSoText, setHowSoText] = useState("");
  const [showHowSoThinking, setShowHowSoThinking] = useState(false);
  const [showHowSoReply, setShowHowSoReply] = useState(false);

  const handleScroll = useCallback((v: number) => {
    // Typewriter "How so?" from 20% to 45%
    if (v >= 0.2 && v <= 0.45) {
      const t = (v - 0.2) / 0.25;
      const len = Math.floor(t * HOW_SO.length);
      setHowSoText(HOW_SO.slice(0, len));
    } else if (v < 0.2) {
      setHowSoText("");
    } else {
      setHowSoText(HOW_SO);
    }

    // Thinking dots from 50% to 65%
    setShowHowSoThinking(v >= 0.5 && v < 0.65);

    // Reply from 65% onward
    setShowHowSoReply(v >= 0.65);
  }, []);

  useMotionValueEvent(scrollYProgress, "change", handleScroll);

  // Conversation fades out at the end
  const allOpacity = useTransform(scrollYProgress, [0.8, 0.95], [1, 0]);
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0.05, 0.15], [1, 0]);

  const transition = "opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1)";

  return (
    <div ref={ref} className="h-[300vh] relative" style={{ marginBottom: "-100vh" }}>
<div className="sticky top-0 h-screen overflow-hidden bg-white z-30">
        <motion.div
          style={{ opacity: allOpacity }}
          className="absolute inset-0 z-10 flex items-center justify-center p-8"
        >
          <div className="max-w-2xl w-full flex flex-col gap-6">
            {/* 1. User: "What is the best way..." */}
            <div
              className="flex justify-end"
              style={{
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? "translateY(0)" : "translateY(10px)",
                transition,
              }}
            >
              <div className="bg-black text-white px-6 py-4 font-mono text-sm md:text-base max-w-lg">
                What is the best way to manage my personal life?
              </div>
            </div>

            {/* 2. Thinking dots (time-based) */}
            {phase === 2 && (
              <div className="flex justify-start">
                <div className="bg-white border border-black px-6 py-4 font-mono text-sm text-black">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            {/* 3. Xyra: "Xyra." */}
            <div
              className="flex justify-start"
              style={{
                opacity: phase >= 3 ? 1 : 0,
                transform: phase >= 3 ? "translateY(0)" : "translateY(10px)",
                transition,
              }}
            >
              <div className="bg-white border border-black px-6 py-4 font-mono text-sm md:text-base text-black">
                Xyra.
              </div>
            </div>

            {/* 4. User: "How so?" — scroll-driven typewriter */}
            {howSoText.length > 0 && (
              <div className="flex justify-end">
                <div className="bg-black text-white px-6 py-4 font-mono text-sm md:text-base max-w-lg">
                  {howSoText}
                  {howSoText.length < HOW_SO.length && (
                    <span className="inline-block w-[2px] h-[1.1em] bg-white ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            )}

            {/* 5. Thinking dots (scroll-driven) */}
            {showHowSoThinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-black px-6 py-4 font-mono text-sm text-black">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            {/* 6. Xyra: "Try it..." */}
            {showHowSoReply && (
              <div className="flex justify-start">
                <div className="bg-white border border-black px-6 py-4 font-mono text-sm md:text-base text-black">
                  Try it, track anything and let me do the rest.
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          style={{ opacity: scrollIndicatorOpacity }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30"
        >
          <div
            style={{
              opacity: phase >= 4 ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
            className="flex flex-col items-center gap-2"
          >
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/30">
              Scroll
            </span>
            <svg
              className="w-5 h-5 text-black/30 animate-scroll-bounce"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
              />
            </svg>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Main ScrollShowcase ─────────────────────────────────────── */

export default function ScrollShowcase() {
  return (
    <section className="bg-white">
      <OpeningEffect />
      <PeriodScene />
      <TaskScene />
      <ExpandScene />
      <BrainScene />
    </section>
  );
}
