"use client";

// ─── Cta ─────────────────────────────────────────────────────────────────────
// The last word before the footer: one line (yes, Pitbull) and the tester form.

import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import { TEST_FORM_URL } from "@/components/DesktopHero";

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
        <h2 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl lg:text-7xl font-medium text-black tracking-tight leading-[1.05]">
          &ldquo;you know you want me.&rdquo;
        </h2>
        <p className="font-[family-name:var(--font-jetbrains)] text-[11px] tracking-[0.2em] lowercase text-black/40 mt-4">— pitbull</p>
        <a
          href={TEST_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("cta_click", { cta_location: "cta_bottom", button_label: "apply to test it" })}
          className="mt-10 inline-flex items-center px-7 py-3.5 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-sm tracking-wide hover:bg-black/85 transition-colors"
        >
          apply to test it
        </a>
      </div>
    </section>
  );
}
