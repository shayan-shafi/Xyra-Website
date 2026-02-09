"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const apps = [
  { name: "Notion", rotate: -2 },
  { name: "Google Calendar", rotate: 1.5 },
  { name: "Todoist", rotate: -1 },
  { name: "Trello", rotate: 2.5 },
  { name: "Slack", rotate: -1.8 },
  { name: "Asana", rotate: 1 },
  { name: "Evernote", rotate: -2.5 },
  { name: "Obsidian", rotate: 1.8 },
  { name: "Monday", rotate: -0.5 },
  { name: "ClickUp", rotate: 2 },
  { name: "Reminders", rotate: -1.5 },
  { name: "Notes", rotate: 0.8 },
];

export default function Problem() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="problem" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12" ref={ref}>
        {/* Section label */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.2em] uppercase text-ink-faint">
            The Problem
          </span>
        </motion.div>

        {/* Kindle-style divider */}
        <motion.hr
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="kindle-divider mt-2 mb-12"
        />

        {/* Headline */}
        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-tight mb-8"
        >
          Your life is scattered across
          <br />
          <span className="italic">a dozen different apps.</span>
        </motion.h2>

        {/* Body text */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-2xl mb-12"
        >
          <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light leading-relaxed mb-6">
            Ambitious knowledge workers, founders, and students are forced to
            &ldquo;app-hop&rdquo; between calendars, to-do lists, note-taking
            apps, and habit trackers. Every tool demands manual configuration
            and constant maintenance.
          </p>
          <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light leading-relaxed">
            The result?{" "}
            <span className="text-ink font-medium">App fatigue.</span> Systems
            are abandoned because they are too high-friction to manage. Your
            productivity stack becomes the very thing slowing you down.
          </p>
        </motion.div>

        {/* Scattered apps visualization */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative py-10"
        >
          <div className="flex flex-wrap gap-3 justify-center max-w-xl mx-auto relative">
            {apps.map((app, i) => (
              <motion.span
                key={app.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isInView
                    ? {
                        opacity: 0.5,
                        scale: 1,
                        rotate: app.rotate,
                      }
                    : {}
                }
                transition={{ duration: 0.4, delay: 0.6 + i * 0.06 }}
                className="font-[family-name:var(--font-jetbrains)] text-xs sm:text-sm px-3 py-1.5 border border-ink-faint/30 rounded-md text-ink-faint bg-warm-white/50 line-through decoration-ink-faint/60 cursor-default"
              >
                {app.name}
              </motion.span>
            ))}
          </div>

          {/* Diagonal strike-through */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={isInView ? { scaleX: 1, opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 1.4, ease: "easeOut" }}
            className="absolute top-1/2 left-[10%] right-[10%] -translate-y-1/2 origin-left"
          >
            <div className="h-[2px] bg-gradient-to-r from-transparent via-ink/30 to-transparent w-full -rotate-2" />
          </motion.div>
        </motion.div>

        {/* Pull quote */}
        <motion.blockquote
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-12 border-l-2 border-accent pl-6 max-w-lg"
        >
          <p className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl italic text-ink leading-relaxed">
            &ldquo;The tools meant to organize your life became the chaos
            themselves.&rdquo;
          </p>
        </motion.blockquote>
      </div>
    </section>
  );
}
