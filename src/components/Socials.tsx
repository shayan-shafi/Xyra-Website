"use client";

// ─── Socials ─────────────────────────────────────────────────────────────────
// Two marquees on the page grid: user feedback rolling one way up top, and the
// reels rolling the other way beneath — tall 9:16 cards that open the actual
// post. Content lives in src/content/socials.ts. Rows pause on hover and fade
// at the edges; no motion under prefers-reduced-motion.

import { ReactNode } from "react";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import { FEEDBACK, REELS, type Feedback, type Reel } from "@/content/socials";

const EDGE_FADE = "linear-gradient(to right, transparent, black 7%, black 93%, transparent)";

function Marquee({ children, reverse = false, seconds = 48 }: { children: ReactNode; reverse?: boolean; seconds?: number }) {
  return (
    <div className="group relative w-full overflow-hidden" style={{ WebkitMaskImage: EDGE_FADE, maskImage: EDGE_FADE }}>
      <div
        className={`xyra-marquee flex w-max items-stretch gap-5 pr-5 group-hover:[animation-play-state:paused] ${reverse ? "[animation-direction:reverse]" : ""}`}
        style={{ animationDuration: `${seconds}s` }}
      >
        {children}
      </div>
    </div>
  );
}

function FeedbackCard({ f }: { f: Feedback }) {
  return (
    <figure className="relative w-[300px] shrink-0 bg-white border border-black/10 rounded-2xl px-5 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.05)]">
      {f.sample && (
        <span className="absolute top-3 right-3 font-[family-name:var(--font-jetbrains)] text-[9px] tracking-[0.15em] uppercase text-amber-600/80 border border-amber-500/40 rounded-full px-1.5 py-0.5">sample</span>
      )}
      <blockquote className="font-[family-name:var(--font-eb-garamond)] text-lg leading-snug text-black">&ldquo;{f.quote}&rdquo;</blockquote>
      <figcaption className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/45 mt-3 lowercase">
        — {f.who}{f.via ? ` · ${f.via}` : ""}
      </figcaption>
    </figure>
  );
}

function ReelCard({ r }: { r: Reel }) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.cover} alt={r.caption} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent" />
      <span className="absolute top-3 left-3 font-[family-name:var(--font-jetbrains)] text-[10px] text-white/90 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 lowercase">{r.platform}</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition-transform group-hover/reel:scale-105">
          <svg className="w-4 h-4 translate-x-[1px]" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </span>
      <p className="absolute inset-x-0 bottom-0 px-3.5 pb-3.5 font-[family-name:var(--font-jetbrains)] text-[11px] text-white/90 lowercase leading-snug">{r.caption}</p>
    </>
  );
  const cls = "group/reel relative w-[210px] shrink-0 aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-black/10 shadow-[0_12px_32px_rgba(0,0,0,0.10)] transition-transform duration-300 hover:scale-[1.02]";
  return r.url ? (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      onClick={() => track("cta_click", { cta_location: "socials", button_label: `reel_${r.id}_${r.platform}` })}
    >
      {body}
    </a>
  ) : (
    <div className={cls} title="link coming">{body}</div>
  );
}

export default function Socials() {
  const ref = useSectionView<HTMLElement>("socials");
  const feedback = [...FEEDBACK, ...FEEDBACK];
  const reels = [...REELS, ...REELS];
  return (
    <section id="socials" ref={ref} className="scroll-mt-20 py-20 md:py-28">
      <div className="px-6 sm:px-12 lg:px-20 max-w-6xl mx-auto mb-10 md:mb-14">
        <h2 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl lg:text-7xl font-medium text-black tracking-tight leading-[1.05]">
          out in the wild.
        </h2>
      </div>

      <div className="flex flex-col gap-8">
        <Marquee seconds={55}>
          {feedback.map((f, i) => <FeedbackCard key={`${f.id}-${i}`} f={f} />)}
        </Marquee>
        <Marquee reverse seconds={70}>
          {reels.map((r, i) => <ReelCard key={`${r.id}-${i}`} r={r} />)}
        </Marquee>
      </div>
    </section>
  );
}
