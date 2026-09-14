"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import VentStickers from "@/components/hero/VentStickers";
import BrainShowcase from "@/components/hero/BrainShowcase";
import Socials from "@/components/Socials";
import Cta from "@/components/Cta";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

// Sheza's cut (2026-09-14). Plays muted on a loop; tapping it turns the sound
// on — that's the whole UI.
function VentVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [sound, setSound] = useState(false);
  const [left, setLeft] = useState<number | null>(null); // seconds left in this pass of the clip
  const onTime = () => {
    const v = ref.current;
    if (!v || !Number.isFinite(v.duration)) return;
    setLeft(Math.max(0, Math.ceil(v.duration - v.currentTime)));
  };
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
          onLoadedMetadata={onTime}
          onTimeUpdate={onTime}
          className="block w-full h-auto rounded-2xl border border-black/10 bg-black"
        >
          <source src="/assets/sheza-vent.mp4" type="video/mp4" />
        </video>
      </button>
      <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 mt-3 tabular-nums">
        {sound ? "sound on" : "tap for sound"}
        {left !== null && <span className="text-black/30"> · {left}s left</span>}
      </p>
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
      {/* The world, centered on the page grid (light ink, transparent canvas),
          running the zoom-into-Finance beat on a loop. Shayan writes the copy
          around it. */}
      <section id="world" ref={worldRef} className="scroll-mt-20 px-6 sm:px-12 lg:px-20 py-12 md:py-20">
        <div ref={brainRef} className="relative mx-auto w-full max-w-[1600px] h-[84vh] min-h-[560px]">
          <BrainShowcase active={brainNear} />
        </div>
      </section>

      {/* ── Section 3: socials — feedback ticker + reels ─────────── */}
      <Socials />

      {/* ── Section 4: the ask ──────────────────────────────────── */}
      <Cta />
    </div>
  );
}
