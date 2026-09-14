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
import { HandArrow, RecordingPillSticker } from "@/components/hero/stickers";

// "I Know You Want Me (Calle Ocho)"
const TRACK_EMBED = "https://open.spotify.com/embed/track/5RzFJd6W40SDTyZkX6xx45?utm_source=generator&theme=0";

function Sticker({ className = "", tilt = 0, children }: { className?: string; tilt?: number; children: ReactNode }) {
  return (
    <motion.div drag dragMomentum={false} className={`absolute z-10 select-none cursor-grab active:cursor-grabbing ${className}`}>
      <div style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>{children}</div>
    </motion.div>
  );
}

// ── new kinds, for this corner of the page ──

// "now playing" — a black pill with live bars, like the app's recorder but for the song
function NowPlaying() {
  return (
    <div className="flex items-center gap-2.5 bg-black text-white rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
      <span className="flex items-end gap-[2.5px] h-3.5">
        {[0, 0.2, 0.1, 0.3, 0.05].map((d, i) => (
          <span key={i} className="xyra-rec-bar w-[2.5px] rounded-full bg-white/85" style={{ animationDelay: `${d}s`, animationDuration: `${0.7 + i * 0.08}s` }} />
        ))}
      </span>
      <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/70 lowercase">now playing · calle ocho</span>
    </div>
  );
}

// a ticket stub: two halves, a perforation, notches punched out of the edge
function TicketStub() {
  return (
    <div className="relative flex bg-white border border-black/15 shadow-[0_4px_14px_rgba(0,0,0,0.08)]" style={{ borderRadius: 6 }}>
      <div className="px-3.5 py-2.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[0.18em] uppercase text-black/80 whitespace-nowrap">admit one</div>
      <div className="relative w-px self-stretch border-l border-dashed border-black/25">
        <span className="absolute -top-[6px] -left-[6px] w-3 h-3 rounded-full bg-[#fbfaf8] border-b border-black/15" />
        <span className="absolute -bottom-[6px] -left-[6px] w-3 h-3 rounded-full bg-[#fbfaf8] border-t border-black/15" />
      </div>
      <div className="px-3.5 py-2.5 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-[0.18em] uppercase text-black/45 whitespace-nowrap">xyra alpha · 2026</div>
    </div>
  );
}

// a rubber stamp: ring text + a check, inked at 75%
function Stamp() {
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="block" style={{ opacity: 0.78 }}>
      <defs><path id="stamp-ring" d="M52 52 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" /></defs>
      <circle cx="52" cy="52" r="48" fill="none" stroke="#111" strokeWidth="2.5" strokeDasharray="3 1.5" />
      <circle cx="52" cy="52" r="28" fill="none" stroke="#111" strokeWidth="1.5" />
      <text className="font-[family-name:var(--font-jetbrains)]" fontSize="10" letterSpacing="2.4" fill="#111" fontWeight="600">
        <textPath href="#stamp-ring" startOffset="0">TESTED · APPROVED · TESTED ·</textPath>
      </text>
      <path d="M40 53 l8 8 l16 -18" fill="none" stroke="#111" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// a post-it: sticky-note yellow, a lifted corner, one word
function PostIt({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[112px] h-[104px] shadow-[0_6px_16px_rgba(0,0,0,0.12)]" style={{ background: "linear-gradient(160deg, #fff1a8 0%, #fde68a 70%, #f5d76e 100%)" }}>
      <span className="absolute bottom-0 right-0 w-5 h-5" style={{ background: "linear-gradient(315deg, #fbfaf8 50%, #e6cf6a 50%)" }} />
      <div className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-playfair)] italic text-[22px] text-black/80">{children}</div>
    </div>
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
        <p className="font-[family-name:var(--font-jetbrains)] text-[9px] text-black/35 text-right mt-1 mr-1 lowercase">delivered</p>
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

      {/* a rubber stamp, lower left */}
      <Sticker className="left-[11%] top-[64%]" tilt={-12}>
        <Stamp />
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

      {/* the sign-off, on a post-it */}
      <Sticker className="left-[22%] top-[20%]" tilt={6}>
        <PostIt>dale.</PostIt>
      </Sticker>

      {/* now playing, above the player */}
      <Sticker className="left-[35%] top-[24%]" tilt={-2}>
        <NowPlaying />
      </Sticker>

      {/* a ticket stub, upper right */}
      <Sticker className="right-[22%] top-[8%]" tilt={4}>
        <TicketStub />
      </Sticker>

      {/* "here" — an arrow at the button */}
      <Sticker className="left-[58%] top-[60%]">
        <div className="flex items-center gap-2">
          <div className="rotate-180"><HandArrow width={110} bow={-8} /></div>
          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/60 lowercase -rotate-6">here.</span>
        </div>
      </Sticker>
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
