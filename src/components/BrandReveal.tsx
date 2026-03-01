"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

export default function BrandReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // White → Black background transition
  const bgOpacity = useTransform(scrollYProgress, [0, 0.15], [0, 1]);

  // Logo: scales in from 0 → 1.05 (slight overshoot) → 1
  const logoScale = useTransform(scrollYProgress, [0.1, 0.2, 0.28], [0, 1.05, 1]);
  const logoOpacity = useTransform(scrollYProgress, [0.1, 0.15, 0.75, 0.95], [0, 1, 1, 0]);

  // Tagline fades in shortly after logo
  const taglineOpacity = useTransform(scrollYProgress, [0.25, 0.35, 0.75, 0.95], [0, 1, 1, 0]);
  const taglineY = useTransform(scrollYProgress, [0.25, 0.35], [20, 0]);

  // Brand name
  const nameOpacity = useTransform(scrollYProgress, [0.2, 0.3, 0.75, 0.95], [0, 1, 1, 0]);

  // Video overlay: starts fully black, gradually reveals video
  const overlayOpacity = useTransform(scrollYProgress, [0.4, 0.65], [1, 0.35]);

  // Whole section fades out at the end
  const sectionOpacity = useTransform(scrollYProgress, [0.8, 1], [1, 0]);

  return (
    <div ref={ref} id="brand-reveal" className="h-[150vh] relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div style={{ opacity: sectionOpacity }} className="relative w-full h-full">
          {/* Background video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster="/assets/xyra-hero-poster.jpg"
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/assets/xyra-hero-compressed.mp4" type="video/mp4" />
          </video>

          {/* Dark overlay — white→black transition then reveals video */}
          <motion.div
            style={{ opacity: overlayOpacity }}
            className="absolute inset-0 bg-black"
          />

          {/* White→Black bg transition overlay */}
          <motion.div
            style={{ opacity: bgOpacity }}
            className="absolute inset-0 bg-black z-[1]"
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6">
            {/* Logo */}
            <motion.div style={{ scale: logoScale, opacity: logoOpacity }}>
              <Image
                src="/assets/xyra-logo-square.png"
                alt="Xyra"
                width={120}
                height={120}
                className="w-20 h-20 sm:w-28 sm:h-28 brightness-0 invert"
                priority
              />
            </motion.div>

            {/* Brand name */}
            <motion.h1
              style={{ opacity: nameOpacity, scale: logoScale }}
              className="font-[family-name:var(--font-playfair)] text-5xl sm:text-7xl md:text-8xl font-medium text-white tracking-tight"
            >
              Xyra
            </motion.h1>

            {/* Tagline */}
            <motion.p
              style={{ opacity: taglineOpacity, y: taglineY }}
              className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl md:text-2xl text-white/70 text-center max-w-md"
            >
              You speak, Xyra builds.
            </motion.p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
