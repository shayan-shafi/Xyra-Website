"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export default function Hero() {
  const fullText = "You speak, Xyra builds.";
  const [displayedText, setDisplayedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < fullText.length) {
        setDisplayedText(fullText.slice(0, index + 1));
        index++;
      } else {
        setIsTypingDone(true);
        clearInterval(timer);
      }
    }, 65);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center paper-texture overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute top-20 right-10 w-64 h-64 rounded-full bg-accent/5 blur-3xl" />
      <div className="absolute bottom-20 left-10 w-48 h-48 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 sm:px-8 text-center pt-24 pb-16">
        {/* Small logo icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-10"
        >
          <Image
            src="/assets/xyra-logo-square.png"
            alt="Xyra"
            width={120}
            height={120}
            className="mx-auto h-20 w-20 sm:h-28 sm:w-28"
            priority
          />
        </motion.div>

        {/* Typewriter headline */}
        <div className="min-h-[80px] sm:min-h-[100px] flex items-center justify-center mb-6">
          <h1
            className={`font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium text-ink leading-tight tracking-tight ${
              !isTypingDone ? "typewriter-cursor" : ""
            }`}
          >
            {displayedText}
          </h1>
        </div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isTypingDone ? 1 : 0, y: isTypingDone ? 0 : 20 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="font-[family-name:var(--font-eb-garamond)] text-xl sm:text-2xl text-ink-light max-w-2xl mx-auto leading-relaxed mb-4"
        >
          The AI-native personal operating system that replaces fragmented 
          productivity tools with a single conversational interface.
        </motion.p>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: isTypingDone ? 1 : 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="font-[family-name:var(--font-jetbrains)] text-sm text-ink-faint tracking-wider uppercase mb-10"
        >
          No templates. No setup. Just speak.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isTypingDone ? 1 : 0, y: isTypingDone ? 0 : 20 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#waitlist"
            className="font-[family-name:var(--font-jetbrains)] text-sm px-8 py-3.5 bg-ink text-cream rounded-full hover:bg-ink-light transition-all duration-300 tracking-wide hover:shadow-lg hover:shadow-ink/10"
          >
            Join the Beta — It&apos;s Free
          </a>
          <a
            href="#demo"
            className="font-[family-name:var(--font-eb-garamond)] text-lg text-ink-light hover:text-ink transition-colors flex items-center gap-2 group"
          >
            Watch the demo
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3"
              />
            </svg>
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isTypingDone ? 0.5 : 0 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg
              className="w-5 h-5 text-ink-faint"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
