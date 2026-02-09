"use client";

import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-ink-faint/15 py-12 sm:py-16 bg-white">
      <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Image
              src="/assets/xyra-logo-square.png"
              alt="Xyra"
              width={32}
              height={32}
              className="h-7 w-7"
            />
            <span className="font-[family-name:var(--font-playfair)] text-lg text-ink">
              Xyra
            </span>
          </div>

          {/* Tagline */}
          <p className="font-[family-name:var(--font-eb-garamond)] text-ink-faint text-base text-center">
            The AI-native personal operating system.
          </p>

          {/* Copyright */}
          <p className="font-[family-name:var(--font-jetbrains)] text-xs text-ink-faint">
            &copy; {new Date().getFullYear()} Xyra
          </p>
        </div>

        {/* Bottom divider quote */}
        <div className="mt-10 pt-8 border-t border-ink-faint/10 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-sm italic text-ink-faint">
            &ldquo;Simplicity is the ultimate sophistication.&rdquo;
          </p>
        </div>
      </div>
    </footer>
  );
}
