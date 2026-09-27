"use client";

// ─── Sticker / Cutout ────────────────────────────────────────────────────────
// A draggable canvas artifact (the CTA's sticker kit, the apply page's too).
// `Cutout` is one of Shayan's paper cutouts (2026-09-14): white knocked out,
// draggable like the rest.

import { ReactNode } from "react";
import { motion } from "framer-motion";

export function Sticker({ className = "", tilt = 0, children }: { className?: string; tilt?: number; children: ReactNode }) {
  return (
    <motion.div drag dragMomentum={false} className={`absolute z-10 select-none cursor-grab active:cursor-grabbing ${className}`}>
      <div style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>{children}</div>
    </motion.div>
  );
}

export function Cutout({ src, alt, className = "", width }: { src: string; alt: string; className?: string; width: number }) {
  return (
    <Sticker className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={width} className="block h-auto" draggable={false} style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.10))" }} />
    </Sticker>
  );
}
