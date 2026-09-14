"use client";

// ─── Footer ──────────────────────────────────────────────────────────────────
// Sits on the page grid like everything else: a hairline, the wordmark, the
// tagline, the year, privacy settings. Lowercase, quiet, no quote.

import Image from "next/image";
import { openPrivacySettings } from "@/components/AnalyticsProvider";
import { useSectionView } from "@/lib/useSectionView";

export default function Footer() {
  const footerRef = useSectionView<HTMLElement>("footer");
  return (
    <footer ref={footerRef} className="border-t border-black/10 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-6 sm:px-12 lg:px-20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* wordmark, like the hero nav */}
          <div className="flex items-center gap-2.5">
            <Image src="/assets/xyra-logo-square.png" alt="" width={32} height={32} className="h-6 w-6 opacity-80" />
            <span className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-black">xyra</span>
          </div>

          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-black/50 text-center">
            the outlet for your ambitious mind
          </p>

          <div className="flex items-center gap-5 font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 lowercase">
            <span>&copy; {new Date().getFullYear()} xyra</span>
            <button onClick={openPrivacySettings} className="hover:text-black transition-colors underline underline-offset-4 decoration-black/20 hover:decoration-black">
              privacy settings
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
