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
      {/* A dark band with the phone's Three.js world running full-bleed on the
          right. The copy has to carry two ideas without jargon: this is where you
          see yourself, and it's the memory anything acting for you starts from. */}
      <section id="world" ref={worldRef} className="relative scroll-mt-20 bg-black text-[#ede9dc] overflow-hidden">
        {/* the world — bleeds to the right edge on desktop, a band of its own on mobile */}
        <div ref={brainRef} className="relative h-[62vh] md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-[54%]">
          {brainNear && <BrainWorldCanvas centerLabel="you" categories={BRAIN_CATEGORIES} dark />}
          {/* soften the seam into the copy */}
          <div className="hidden md:block absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 sm:px-12 lg:px-20 py-20 md:py-32 md:min-h-[88vh] flex items-center">
          <Section className="md:w-[42%]">
            <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.25em] uppercase text-[#ede9dc]/40">
              Your World
            </span>
            <h3 className="font-[family-name:var(--font-playfair)] text-4xl md:text-[2.6rem] lg:text-5xl font-medium tracking-tight mt-4 leading-[1.05]">
              Everything you say
              <br />
              <span className="italic text-[#ede9dc]/70">becomes a map of you.</span>
            </h3>
            <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-[#ede9dc]/60 mt-6 max-w-md leading-relaxed">
              Every vent, plan, and 2am thought lands somewhere on it. You never build it.
              It builds itself in the background, every time you talk.
            </p>

            <ul className="mt-10 space-y-6 max-w-md">
              <li>
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[0.2em] uppercase text-[#ede9dc]/45">See yourself</span>
                <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-[#ede9dc]/75 mt-1.5 leading-relaxed">
                  Tap any part of it and Xyra shows you what&apos;s really going on there. Where the money goes. What wrecks your sleep. Who you keep flaking on.
                </p>
              </li>
              <li>
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[0.2em] uppercase text-[#ede9dc]/45">Xyra reads it first</span>
                <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-[#ede9dc]/75 mt-1.5 leading-relaxed">
                  It&apos;s what Xyra checks before it answers you, so you never repeat yourself.
                </p>
              </li>
              <li>
                <span className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[0.2em] uppercase text-[#ede9dc]/45">So can anything that works for you</span>
                <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-[#ede9dc]/75 mt-1.5 leading-relaxed">
                  As AI starts doing things on your behalf, booking the trip, chasing the refund, planning the week, this is the one place it can start from already knowing you. No forms. No setup.
                </p>
              </li>
            </ul>
          </Section>
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
