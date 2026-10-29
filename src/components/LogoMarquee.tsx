"use client";

// ─── LogoMarquee ─────────────────────────────────────────────────────────────
// "used by legends at" over two endless rows: the schools drifting left, the
// companies right under them drifting right. Logos are Shayan's sheet
// (2026-10-29), cut to /assets/logos. Each row is its list twice over, slid by
// half its width, so the loop never shows a seam. Hover holds a row still;
// reduced motion holds both (globals.css).

import { useSectionView } from "@/lib/useSectionView";

type Logo = { src: string; alt: string; h: number }; // h: px tall, set by eye so they read the same size

const SCHOOLS: Logo[] = [
  { src: "/assets/logos/harvard.png", alt: "Harvard University", h: 34 },
  { src: "/assets/logos/texas.png", alt: "The University of Texas at Austin", h: 34 },
  { src: "/assets/logos/georgetown.png", alt: "Georgetown University", h: 36 },
  { src: "/assets/logos/nyu.png", alt: "NYU", h: 44 },
  { src: "/assets/logos/illinois.png", alt: "University of Illinois Urbana-Champaign", h: 32 },
  { src: "/assets/logos/sdsu.png", alt: "San Diego State University", h: 30 },
  { src: "/assets/logos/penn.png", alt: "University of Pennsylvania", h: 34 },
  { src: "/assets/logos/tamu.png", alt: "Texas A&M University", h: 32 },
  { src: "/assets/logos/uchicago.png", alt: "The University of Chicago", h: 32 },
];

const COMPANIES: Logo[] = [
  { src: "/assets/logos/meta.png", alt: "Meta", h: 26 },
  { src: "/assets/logos/vista.png", alt: "Vista Equity Partners", h: 36 },
  { src: "/assets/logos/schwab.png", alt: "Charles Schwab", h: 42 },
  { src: "/assets/logos/jpmorgan.png", alt: "JPMorgan Chase", h: 24 },
  { src: "/assets/logos/mckinsey.png", alt: "McKinsey & Company", h: 38 },
];

function Row({ logos, reverse, seconds }: { logos: Logo[]; reverse?: boolean; seconds: number }) {
  // the companies list is short: repeat it so one copy is wider than the screen
  const one = logos.length < 8 ? [...logos, ...logos] : logos;
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        className={`xyra-marquee flex w-max items-center group-hover:[animation-play-state:paused] ${reverse ? "xyra-marquee-reverse" : ""}`}
        style={{ animationDuration: `${seconds}s` }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-14 pr-14 md:gap-20 md:pr-20" aria-hidden={copy === 1 || undefined}>
            {one.map((l, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${l.src}-${i}`}
                src={l.src}
                alt={copy === 0 && i < logos.length ? l.alt : ""}
                style={{ height: l.h }}
                className="block w-auto max-w-none shrink-0 select-none"
                draggable={false}
                loading="lazy"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LogoMarquee() {
  const ref = useSectionView<HTMLElement>("logos");
  return (
    <section ref={ref} className="py-12 md:py-16">
      <h2 className="text-center font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl font-medium text-black tracking-tight mb-8 md:mb-10">
        used by legends at
      </h2>
      <div className="flex flex-col gap-8 md:gap-10">
        <Row logos={SCHOOLS} seconds={48} />
        <Row logos={COMPANIES} reverse seconds={40} />
      </div>
    </section>
  );
}
