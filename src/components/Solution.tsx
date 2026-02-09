"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const commands = [
  { command: "\"Xyra, make a dashboard for my call lists.\"", delay: 0.4 },
  { command: "\"Track my workouts this month.\"", delay: 0.6 },
  { command: "\"Brain dump: here are all my thoughts on the project...\"", delay: 0.8 },
  { command: "\"Show me how my goals connect to my daily habits.\"", delay: 1.0 },
];

export default function Solution() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="solution" className="relative py-24 sm:py-32 bg-warm-white">
      <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12" ref={ref}>
        {/* Section label */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.2em] uppercase text-ink-faint">
            The Solution
          </span>
        </motion.div>

        <motion.hr
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="kindle-divider mt-2 mb-12"
        />

        {/* Two-column layout: text + phone mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column: text content */}
          <div>
            {/* Headline */}
            <motion.h2
              variants={fadeUp}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-tight mb-8"
            >
              One interface.
              <br />
              <span className="italic">Infinite dashboards.</span>
            </motion.h2>

            {/* Body */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-10"
            >
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light leading-relaxed mb-6">
                Xyra is your AI everything dashboard. Tell it what you need
                and it builds it. No templates, no dragging boxes around, no
                setup guides.
              </p>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light leading-relaxed">
                Think of it as the opposite of Notion. Instead of assembling
                Lego pieces yourself, you just talk.{" "}
                <span className="text-ink font-medium">
                  Xyra does the rest.
                </span>
              </p>
            </motion.div>

            {/* Command examples */}
            <div className="space-y-3">
              {commands.map(({ command, delay }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay }}
                  className="flex items-start gap-3"
                >
                  <span className="font-[family-name:var(--font-jetbrains)] text-accent-dark text-sm mt-0.5 shrink-0">
                    &gt;
                  </span>
                  <span className="font-[family-name:var(--font-jetbrains)] text-sm text-ink leading-relaxed">
                    {command}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right column: phone mockup with app screenshot */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex justify-center lg:justify-end"
          >
            <div className="relative">
              {/* Phone frame */}
              <div className="relative w-[280px] sm:w-[300px] rounded-[2.5rem] border-[8px] border-ink/90 bg-ink/90 shadow-2xl shadow-ink/20 overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-ink/90 rounded-b-2xl z-10" />
                {/* Screenshot */}
                <Image
                  src="/assets/xyra-app-screenshot.png"
                  alt="Xyra app — dashboard view"
                  width={600}
                  height={1300}
                  className="w-full h-auto"
                />
              </div>
              {/* Subtle reflection/glow */}
              <div className="absolute -inset-4 bg-accent/5 rounded-[3rem] blur-2xl -z-10" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
