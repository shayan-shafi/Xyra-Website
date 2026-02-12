"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Small delay so the video has time to start rendering
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-black">
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover"
          onLoadedData={() => setIsLoaded(true)}
        >
          <source src="/assets/xyra-hero.mp4" type="video/mp4" />
          <source src="/assets/xyra-hero.mov" type="video/quicktime" />
        </video>
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40" />
        {/* Black bar to cover subtitle/dialogue text in the video */}
        <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black z-[1]" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex h-full flex-col justify-between px-8 sm:px-12 lg:px-20 py-8">
        {/* Top: Logo */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="pt-24"
        >
          <Image
            src="/assets/xyra-logo-square.png"
            alt="Xyra"
            width={476}
            height={514}
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain brightness-0 invert"
            quality={100}
            unoptimized
            priority
          />
        </motion.div>

        {/* Middle: Main headline — left aligned */}
        <div className="flex-1 flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <h1 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium text-white leading-[1.1] tracking-tight">
              You speak,
              <br />
              Xyra builds.
            </h1>
          </motion.div>
        </div>

        {/* Bottom: Tagline centered in the black bar area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 1, delay: 1 }}
          className="flex items-center justify-center pb-1"
        >
          <p className="font-[family-name:var(--font-eb-garamond)] text-white/60 text-base sm:text-lg text-center">
            Your AI personal operating system. One conversation replaces every app you juggle.
          </p>
        </motion.div>
      </div>

    </section>
  );
}
