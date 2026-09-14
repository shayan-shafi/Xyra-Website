"use client";

// ─── Cta ─────────────────────────────────────────────────────────────────────
// The last word before the footer: the song (yes, Pitbull — Spotify's player,
// which also links out to the track) and the tester form.

import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import { TEST_FORM_URL } from "@/components/DesktopHero";

// "I Know You Want Me (Calle Ocho)"
const TRACK_EMBED = "https://open.spotify.com/embed/track/5RzFJd6W40SDTyZkX6xx45?utm_source=generator&theme=0";

export default function Cta() {
  const ref = useSectionView<HTMLElement>("cta");
  return (
    <section id="apply" ref={ref} className="relative scroll-mt-20 px-6 sm:px-12 lg:px-20 pt-28 pb-36 md:pt-40 md:pb-48">
      {/* mr. worldwide, pointing at you from both sides — tilted polaroids */}
      <div className="hidden lg:block absolute left-[5%] xl:left-[7%] top-[14%] -rotate-[6deg] w-[190px] bg-white border border-black/10 shadow-[0_18px_50px_rgba(0,0,0,0.14)] p-2 pb-7 pointer-events-none select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/pitbull-2.jpg" alt="Pitbull, pointing at you" className="block w-full h-auto" draggable={false} />
      </div>
      <div className="hidden lg:block absolute right-[5%] xl:right-[7%] top-[10%] rotate-[7deg] w-[190px] bg-white border border-black/10 shadow-[0_18px_50px_rgba(0,0,0,0.14)] p-2 pb-7 pointer-events-none select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/pitbull.jpg" alt="Pitbull, pointing at you" className="block w-full h-auto" draggable={false} />
      </div>
      <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
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
