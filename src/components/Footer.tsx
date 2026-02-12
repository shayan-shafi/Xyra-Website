"use client";

import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 sm:py-16 bg-black">
      <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/assets/xyra-logo-square.png"
              alt="Xyra"
              width={32}
              height={32}
              className="h-7 w-7 brightness-0 invert"
            />
            <span className="font-[family-name:var(--font-playfair)] text-lg text-white">
              Xyra
            </span>
          </div>

          {/* Tagline */}
          <p className="font-[family-name:var(--font-eb-garamond)] text-white/40 text-base text-center">
            The AI-native personal operating system.
          </p>

          {/* Copyright */}
          <p className="font-[family-name:var(--font-jetbrains)] text-xs text-white/30">
            &copy; {new Date().getFullYear()} Xyra
          </p>
        </div>

        {/* Bottom divider quote */}
        <div className="mt-10 pt-8 border-t border-white/[0.06] text-center">
          <p className="font-[family-name:var(--font-playfair)] text-sm italic text-white/25">
            &ldquo;Simplicity is the ultimate sophistication.&rdquo;
          </p>
        </div>
      </div>
    </footer>
  );
}
