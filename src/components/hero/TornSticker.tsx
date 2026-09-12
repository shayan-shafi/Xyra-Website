"use client";

// ─── TornSticker ─────────────────────────────────────────────────────────────
// A scrap of old paper with a ripped edge: jagged clip-path + paper grain +
// a soft drop shadow that follows the torn silhouette. The tear comes from a
// seeded jitter, so every scrap rips differently and identically on server and
// client (no hydration drift). Optional faint ruled lines for the notebook /
// newspaper feel.

import { CSSProperties, ReactNode } from "react";

// mulberry32 — tiny seeded PRNG
function rng(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jagged rectangle as a clip-path polygon. jx/jy = how deep the tear can bite, in % of each axis. */
export function tornPolygon(seed: number, jx = 7, jy = 7): string {
  const r = rng(seed);
  // Uneven spacing (3–9%) and mostly-shallow bites with the odd deep one — a
  // paper rip, not a sawtooth.
  const ticks = () => {
    const t: number[] = [0];
    while (t[t.length - 1] < 100) t.push(Math.min(100, t[t.length - 1] + 3 + r() * 6));
    return t;
  };
  const bite = (j: number) => (r() < 0.18 ? 0.55 + r() * 0.45 : r() * r() * 0.6) * j;
  const pts: string[] = [];
  const P = (x: number, y: number) => pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
  for (const x of ticks()) P(x, bite(jy)); // top, left → right
  for (const y of ticks()) P(100 - bite(jx), y); // right, top → bottom
  for (const x of ticks().reverse()) P(x, 100 - bite(jy)); // bottom, right → left
  for (const y of ticks().reverse()) P(bite(jx), y); // left, bottom → top
  return `polygon(${pts.join(", ")})`;
}

// paper grain: low-alpha fractal noise
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0.10 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";
// faint blue-gray notebook rules
const RULES = "repeating-linear-gradient(180deg, transparent 0px, transparent 9px, rgba(70,90,140,0.13) 9px, rgba(70,90,140,0.13) 10px)";
const SHADOW = "drop-shadow(0 1px 1px rgba(0,0,0,0.16)) drop-shadow(0 5px 9px rgba(0,0,0,0.10))";

export function TornSticker({
  seed,
  jx,
  jy,
  rotate = 0,
  ruled = false,
  className = "",
  style,
  innerStyle,
  children,
}: {
  seed: number;
  jx?: number;
  jy?: number;
  rotate?: number;
  ruled?: boolean;
  className?: string;
  style?: CSSProperties; // outer box (size, margins) — the shadow lives here
  innerStyle?: CSSProperties; // the paper (padding etc.)
  children: ReactNode;
}) {
  const clip = tornPolygon(seed, jx, jy);
  return (
    <div className={className} style={{ filter: SHADOW, transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}>
      <div
        className="w-full h-full"
        style={{
          clipPath: clip,
          WebkitClipPath: clip,
          backgroundColor: "#f6f3ea",
          backgroundImage: ruled ? `${GRAIN}, ${RULES}, linear-gradient(135deg, #f9f7f0, #ece7da)` : `${GRAIN}, linear-gradient(135deg, #f9f7f0, #ece7da)`,
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
