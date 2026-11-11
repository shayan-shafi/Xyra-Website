"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import VentStickers from "@/components/hero/VentStickers";
import PhoneCanvas from "@/components/PhoneCanvas";
import Socials from "@/components/Socials";
import Cta from "@/components/Cta";
import Pricing from "@/components/Pricing";

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


export default function Explainer() {
  const explainerRef = useSectionView<HTMLDivElement>("explainer");
  const phoneRef = useRef<HTMLDivElement>(null);
  const phoneNear = useInView(phoneRef, { once: true, margin: "300px" });

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

      {/* ── Section 2: the phone on its canvas ───────────────────── */}
      {/* The page's old hero, in the slot the laptop held: the phone running
          its loop, the floating screens and every sticker. The loop only
          starts once the section is near the viewport. (The laptop,
          hero/LaptopShowcase.tsx, stays on disk.) */}
      <div ref={phoneRef}>
        <PhoneCanvas active={phoneNear} />
      </div>

      {/* ── Section 3: socials — feedback ticker + reels ─────────── */}
      <Socials />

      {/* ── Section 4: one plan, $10 a seat ──────────────────────── */}
      <Pricing />

      {/* ── Section 5: the ask ──────────────────────────────────── */}
      <Cta />
    </div>
  );
}
