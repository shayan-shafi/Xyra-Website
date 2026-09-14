"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import Image from "next/image";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import VentStickers from "@/components/hero/VentStickers";
import BrainWorldCanvas from "@/components/hero/BrainWorldCanvas";
import { BRAIN_CATEGORIES } from "@/components/hero/PhoneScene";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

// Sheza's cut (2026-09-14). Plays muted on a loop; tapping it turns the sound
// on — that's the whole UI.
function VentVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = sound;
    setSound(!sound);
    if (v.paused) v.play().catch(() => {});
    track("cta_click", { cta_location: "explainer_vent", button_label: sound ? "mute" : "unmute" });
  };
  return (
    <div>
      <button type="button" onClick={toggle} aria-label={sound ? "Mute" : "Unmute"} className="block w-full cursor-pointer">
        <video
          ref={ref}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/sheza-vent-poster.jpg"
          className="block w-full h-auto rounded-2xl border border-black/10 bg-black"
        >
          <source src="/assets/sheza-vent.mp4" type="video/mp4" />
        </video>
      </button>
      <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 mt-3">
        {sound ? "sound on" : "tap for sound"}
      </p>
    </div>
  );
}

function IPhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px] md:w-[300px]">
      {/* Phone shell */}
      <div className="relative rounded-[3rem] border-[8px] border-black bg-black overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />
        {/* Screen */}
        <div className="relative rounded-[2.2rem] overflow-hidden bg-white">
          <Image
            src={src}
            alt={alt}
            width={390}
            height={844}
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type WorldCard = "visualize" | "advisor" | "learns" | null;


export default function Explainer() {
  const explainerRef = useSectionView<HTMLDivElement>("explainer");
  const worldRef = useSectionView<HTMLElement>("world");
  // mount the GL world only once it's near the viewport
  const brainRef = useRef<HTMLDivElement>(null);
  const brainNear = useInView(brainRef, { once: true, margin: "300px" });

  return (
    <div ref={explainerRef}>
      {/* ── Section 1: just vent ────────────────────────────────── */}
      <div className="relative">
        <VentStickers />
        <section className="px-6 sm:px-12 lg:px-20 py-24 md:py-32 max-w-6xl mx-auto">
          <Section className="flex flex-col gap-6 md:gap-8">
            <h2 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl lg:text-7xl font-medium text-black tracking-tight leading-[1.05]">
              just vent.
            </h2>
            <VentVideo />
          </Section>
        </section>
      </div>

      {/* ── Section 2: Your World — the brain ───────────────────── */}
      {/* Just the world for now, centered on the page grid (light ink, transparent
          canvas). Shayan writes the copy around it once it's on screen. */}
      <section id="world" ref={worldRef} className="scroll-mt-20 px-6 sm:px-12 lg:px-20 py-12 md:py-20">
        <div ref={brainRef} className="relative mx-auto w-full max-w-5xl h-[72vh] min-h-[480px]">
          {brainNear && <BrainWorldCanvas centerLabel="you" categories={BRAIN_CATEGORIES} dark={false} transparent paper="#fbfaf8" />}
        </div>
      </section>

      {/* ── Section 3: Text Xyra ────────────────────────────────── */}
      <section id="text-xyra" className="scroll-mt-20 px-6 sm:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
            <Section className="flex-1 order-2 md:order-1">
              <IPhoneFrame src="/assets/xyra-chat-companion.png" alt="Texting Xyra in the app" />
            </Section>

            <Section className="flex-1 order-1 md:order-2">
              <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.25em] uppercase text-black/30">
                Always available
              </span>
              <h3 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-black tracking-tight mt-4 leading-[1.1]">
                Stop texting yourself.
                <br />
                <span className="italic text-black/60">Text Xyra.</span>
              </h3>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg md:text-xl text-black/50 mt-5 max-w-md leading-relaxed">
                Instead of texting yourself reminders you&apos;ll never open again,
                just tell Xyra &mdash; by voice or text. It files every thought into
                the right dashboard: tasks, workouts, notes, anything.
                It even celebrates your PRs.
              </p>
            </Section>
          </div>
        </div>
      </section>

    </div>
  );
}
