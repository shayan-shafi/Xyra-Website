"use client";

// ─── Cta ─────────────────────────────────────────────────────────────────────
// The last word before the footer: the song (yes, Pitbull — Spotify's player,
// which also links out to the track), the tester form, and the sticker kit
// scattered around them, draggable like the hero's.

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import { Chip, TEST_FORM_URL } from "@/components/DesktopHero";
import { TornSticker } from "@/components/hero/TornSticker";
import { RecordingPillSticker } from "@/components/hero/stickers";

// "I Know You Want Me (Calle Ocho)"
const TRACK_EMBED = "https://open.spotify.com/embed/track/5RzFJd6W40SDTyZkX6xx45?utm_source=generator&theme=0";

function Sticker({ className = "", tilt = 0, children }: { className?: string; tilt?: number; children: ReactNode }) {
  return (
    <motion.div drag dragMomentum={false} className={`absolute z-10 select-none cursor-grab active:cursor-grabbing ${className}`}>
      <div style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>{children}</div>
    </motion.div>
  );
}

// Shayan's paper cutouts (2026-09-14): white knocked out, draggable like the rest.
function Cutout({ src, alt, className = "", width }: { src: string; alt: string; className?: string; width: number }) {
  return (
    <Sticker className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} className="block h-auto" draggable={false} style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.10))" }} />
    </Sticker>
  );
}

function Stickers() {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
      {/* xyra, making the ask */}
      <Sticker className="left-[7%] top-[16%]" tilt={-3}>
        <div className="w-[150px] bg-white border border-black/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed text-black/75 lowercase">so… you in?</p>
        </div>
      </Sticker>

      {/* you, caving */}
      <Sticker className="right-[6%] top-[20%]" tilt={3}>
        <div className="w-[170px] bg-black text-white rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed lowercase">ok fine. where do i sign up</p>
        </div>
      </Sticker>

      {/* xyra is typing… */}
      <Sticker className="right-[19%] top-[38%]">
        <div className="flex items-center gap-1.5 bg-white border border-black/12 rounded-full px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.15s" }} />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.3s" }} />
        </div>
      </Sticker>

      {/* the vent, mid-record */}
      <Sticker className="left-[5%] top-[44%]" tilt={-2}>
        <RecordingPillSticker />
      </Sticker>

      {/* the sign-off, on a torn scrap */}
      <Sticker className="left-[22%] top-[24%]" tilt={6}>
        <TornSticker seed={73} jx={9} jy={10} style={{ width: 96, height: 56 }}>
          <div className="w-full h-full flex items-center justify-center font-[family-name:var(--font-jetbrains)] text-[11px] text-black/70 lowercase">dale.</div>
        </TornSticker>
      </Sticker>

      {/* where this lands */}
      <Sticker className="right-[8%] top-[50%]" tilt={2}>
        <div className="flex flex-col items-start gap-1.5">
          <Chip>→ apply</Chip>
          <Chip>→ test it</Chip>
          <Chip>→ tell a friend</Chip>
        </div>
      </Sticker>

      {/* hold-to-talk */}
      <Sticker className="right-[5%] top-[72%]" tilt={-2}>
        <div className="flex items-center gap-2.5 bg-black text-white rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
          </svg>
          <span className="flex items-end gap-[2.5px] h-3.5">
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.12s" }} />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.24s" }} />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.36s" }} />
          </span>
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/70 lowercase">hold to talk</span>
        </div>
      </Sticker>

      {/* ── the paper cutouts, placed like the mock ── */}
      <Cutout src="/assets/stk-bolts.png" alt="" width={120} className="left-[30%] top-[3%]" />
      <Cutout src="/assets/stk-stars.png" alt="" width={130} className="right-[24%] top-[3%]" />
      <Cutout src="/assets/stk-hearts.png" alt="" width={80} className="left-[19%] top-[46%]" />
      <Cutout src="/assets/stk-lines-left.png" alt="" width={88} className="left-1/2 -ml-[218px] top-[50%]" />
      <Cutout src="/assets/stk-lines-right.png" alt="" width={88} className="left-1/2 ml-[128px] top-[50%]" />
      <Cutout src="/assets/stk-chevron.png" alt="" width={100} className="left-[66.5%] top-[55%]" />
      <Cutout src="/assets/stk-squiggle.png" alt="" width={104} className="left-1/2 -ml-[56px] top-[66%]" />
    </div>
  );
}

export default function Cta() {
  const ref = useSectionView<HTMLElement>("cta");
  return (
    <section id="apply" ref={ref} className="relative scroll-mt-20 px-6 sm:px-12 lg:px-20 pt-28 pb-36 md:pt-40 md:pb-48">
      <Stickers />
      <div className="relative max-w-6xl mx-auto flex flex-col items-center text-center">
        <div className="w-full max-w-[480px]">
          <iframe
            title="Pitbull — I Know You Want Me (Calle Ocho) on Spotify"
            src={TRACK_EMBED}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block rounded-xl"
            onLoad={() => track("section_view", { section: "cta_spotify" })}
          />
        </div>
        <a
          href={TEST_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("cta_click", { cta_location: "cta_bottom", button_label: "apply to test it" })}
          className="mt-8 inline-flex items-center px-7 py-3.5 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-sm tracking-wide hover:bg-black/85 transition-colors"
        >
          apply to test it
        </a>
      </div>
    </section>
  );
}
