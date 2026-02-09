"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const features = [
  {
    number: "01",
    title: "Conversational Dashboards",
    description:
      "Say what you need, and Xyra instantly generates a functional, purpose-built dashboard. Call lists, workout trackers, project boards — all created through natural language.",
    accent: "No templates. No drag-and-drop.",
    media: { type: "image" as const, src: "/assets/feature-conversational.png" },
    imageAlt: "Xyra creating a period tracker dashboard via conversation",
  },
  {
    number: "02",
    title: "Brain Dump",
    description:
      "Pour out your scattered thoughts, and Xyra organizes them into their rightful home. Ideas become structured dashboards. Chaos becomes clarity.",
    accent: "De-cluster your mind.",
    media: { type: "image" as const, src: "/assets/feature-braindump.png" },
    imageAlt: "Xyra organizing a voice brain dump into structured tasks",
  },
  {
    number: "03",
    title: "Knowledge Graph",
    description:
      "Xyra constructs a visible 3D graph of your life — mapping the hidden connections between your health, work, relationships, and goals.",
    accent: "See how everything connects.",
    media: { type: "video" as const, src: "/assets/feature-knowledgegraph.mov" },
    imageAlt: "Xyra knowledge graph visualization",
  },
  {
    number: "04",
    title: "AI Advisor",
    description:
      "Powered by your personal knowledge graph, the Advisor layer offers proactive, intelligent insights. Get tailored advice on any goal or piece of your life, grounded in your own data.",
    accent: "Guidance that knows your context.",
    media: { type: "image" as const, src: "/assets/feature-advisor.png" },
    imageAlt: "Xyra AI Advisor providing personalized daily insights",
  },
];

export default function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="features" className="relative py-24 sm:py-32">
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
            Features
          </span>
        </motion.div>

        <motion.hr
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="kindle-divider mt-2 mb-12"
        />

        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-tight mb-16"
        >
          Everything you need.
          <br />
          <span className="italic">Nothing you don&apos;t.</span>
        </motion.h2>

        {/* Feature cards */}
        <div className="space-y-20 sm:space-y-28">
          {features.map((feature, i) => (
            <FeatureCard key={feature.number} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6 }}
    >
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center ${
          isEven ? "" : "lg:direction-rtl"
        }`}
        style={!isEven ? { direction: "rtl" } : undefined}
      >
        {/* Text content */}
        <div style={!isEven ? { direction: "ltr" } : undefined}>
          <span className="font-[family-name:var(--font-jetbrains)] text-sm text-ink-faint">
            {feature.number}
          </span>
          <h3 className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-ink font-medium mt-2 mb-4">
            {feature.title}
          </h3>
          <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-ink-light leading-relaxed mb-3">
            {feature.description}
          </p>
          <span className="font-[family-name:var(--font-jetbrains)] text-sm text-accent-dark">
            {feature.accent}
          </span>
        </div>

        {/* Phone mockup with media */}
        <div
          className="flex justify-center"
          style={!isEven ? { direction: "ltr" } : undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            {/* Phone frame */}
            <div className="relative w-[240px] sm:w-[260px] rounded-[2.2rem] border-[7px] border-ink/90 bg-ink/90 shadow-xl shadow-ink/15 overflow-hidden">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-ink/90 rounded-b-xl z-10" />
              {/* Media */}
              {feature.media.type === "image" ? (
                <Image
                  src={feature.media.src}
                  alt={feature.imageAlt}
                  width={520}
                  height={1128}
                  className="w-full h-auto"
                />
              ) : (
                <video
                  className="w-full h-auto"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src={feature.media.src} type="video/mp4" />
                </video>
              )}
            </div>
            {/* Subtle glow */}
            <div className="absolute -inset-3 bg-accent/5 rounded-[2.8rem] blur-xl -z-10" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
