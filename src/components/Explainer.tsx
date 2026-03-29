"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import Image from "next/image";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

function IPhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px] md:w-[300px]">
      {/* Phone shell */}
      <div className="relative rounded-[3rem] border-[8px] border-black bg-black overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />
        {/* Screen */}
        <div className="relative rounded-[2.2rem] overflow-hidden bg-white">
          <Image
            src={src}
            alt={alt}
            width={390}
            height={844}
            className="w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type WorldCard = "visualize" | "advisor" | "learns" | null;

function WorldCards() {
  const [active, setActive] = useState<WorldCard>(null);

  const toggle = (card: WorldCard) => {
    setActive(active === card ? null : card);
  };

  const cards: { id: WorldCard; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      id: "visualize",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Visualize",
      desc: "See your life as an interconnected graph. Finances, health, work, relationships, all linked.",
    },
    {
      id: "advisor",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
      ),
      title: "Advisor",
      desc: "Click into any node and get recommendations, feedback, and insights across every area of your life.",
    },
    {
      id: "learns",
      icon: (
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
        </svg>
      ),
      title: "Learns You",
      desc: "The more you use Xyra, the smarter it gets. It learns your patterns and helps you see what you can't.",
    },
  ];

  return (
    <Section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => toggle(card.id)}
            className={`border p-6 md:p-8 text-left transition-all duration-300 cursor-pointer ${
              active === card.id
                ? "border-black bg-black/[0.03]"
                : "border-black/10 hover:border-black/30"
            }`}
          >
            <div className="w-10 h-10 bg-black flex items-center justify-center mb-4">
              {card.icon}
            </div>
            <h4 className="font-[family-name:var(--font-playfair)] text-lg font-medium text-black">
              {card.title}
            </h4>
            <p className="font-[family-name:var(--font-eb-garamond)] text-base text-black/50 mt-2 leading-relaxed">
              {card.desc}
            </p>
            <span className="inline-block mt-3 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-widest uppercase text-black/30">
              {active === card.id ? "Close" : "See it"}
            </span>
          </button>
        ))}
      </div>

      {active && (
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="pt-10 md:pt-14"
        >
          <div className="flex justify-center">
            {active === "visualize" && (
              <div className="relative mx-auto w-[260px] sm:w-[280px] md:w-[300px]">
                <div className="relative rounded-[3rem] border-[8px] border-black bg-black overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />
                  <div className="relative rounded-[2.2rem] overflow-hidden bg-black">
                    <video autoPlay loop muted playsInline className="w-full h-auto">
                      <source src="/assets/brain-demo.mp4" type="video/mp4" />
                    </video>
                  </div>
                </div>
              </div>
            )}
            {active === "advisor" && (
              <div className="relative mx-auto w-[260px] sm:w-[280px] md:w-[300px]">
                <div className="relative rounded-[3rem] border-[8px] border-black bg-black overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-black rounded-b-2xl z-10" />
                  <div className="relative rounded-[2.2rem] overflow-hidden bg-white">
                    <Image
                      src="/assets/screenshot-advisor.png"
                      alt="Finance node insights in Xyra"
                      width={390}
                      height={844}
                      className="w-full h-auto"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-[24%] bg-white" />
                  </div>
                </div>
              </div>
            )}
            {active === "learns" && (
              <IPhoneFrame src="/assets/screenshot-learns.png" alt="Xyra learning your spending patterns via text" />
            )}
          </div>
        </motion.div>
      )}
    </Section>
  );
}

export default function Explainer() {
  return (
    <div className="bg-white">
      {/* ── Section 1: We Build ─────────────────────────────────── */}
      <section className="px-6 sm:px-12 lg:px-20 py-24 md:py-32 max-w-6xl mx-auto">
        <Section>
          <div className="max-w-3xl">
            <h2 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-medium text-black tracking-tight leading-[1.05]">
              We don&apos;t assist.
              <br />
              <span className="italic">We build.</span>
            </h2>
            <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl md:text-2xl text-black/50 mt-6 md:mt-8 max-w-xl leading-relaxed">
              Other apps give you AI helpers, copilots, assistants.
              Xyra actually builds the dashboards, trackers, and systems
              you need to see progress in everything you care about.
            </p>
          </div>
        </Section>
      </section>

      {/* ── Section 2: Brain Dump → Dashboard ───────────────────── */}
      <section className="px-6 sm:px-12 lg:px-20 py-20 md:py-28 bg-black/[0.02]">
        <div className="max-w-6xl mx-auto">
          <Section>
            <div className="text-center mb-12 md:mb-16">
              <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.25em] uppercase text-black/30">
                How it works
              </span>
              <h3 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-black tracking-tight mt-4">
                Just talk. Xyra handles the rest.
              </h3>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg md:text-xl text-black/50 mt-4 max-w-lg mx-auto leading-relaxed">
                Brain dump everything on your mind, by voice or text.
                Xyra extracts what matters and builds you a dashboard instantly.
              </p>
            </div>
          </Section>

          <Section className="flex flex-col md:flex-row items-center justify-center gap-10 md:gap-16">
            {/* Build screenshot — "Make me a period tracker" */}
            <div className="flex flex-col items-center gap-4">
              <IPhoneFrame src="/assets/screenshot-build.png" alt="Xyra building a period tracker from a voice command" />
              <p className="font-[family-name:var(--font-jetbrains)] text-xs text-black/40 text-center max-w-[240px]">
                &ldquo;Make me a period tracker.&rdquo; Done.
              </p>
            </div>

            {/* Tasks screenshot — voice brain dump */}
            <div className="flex flex-col items-center gap-4">
              <IPhoneFrame src="/assets/screenshot-tasks.png" alt="Tasks dashboard built from voice brain dump" />
              <p className="font-[family-name:var(--font-jetbrains)] text-xs text-black/40 text-center max-w-[240px]">
                Brain dump your day. Xyra extracts and organizes it.
              </p>
            </div>
          </Section>
        </div>
      </section>

      {/* ── Section 3: Text Xyra ────────────────────────────────── */}
      <section className="px-6 sm:px-12 lg:px-20 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
            <Section className="flex-1 order-2 md:order-1">
              <IPhoneFrame src="/assets/screenshot-text.png" alt="Texting Xyra via iMessage" />
            </Section>

            <Section className="flex-1 order-1 md:order-2">
              <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.25em] uppercase text-black/30">
                Always available
              </span>
              <h3 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-black tracking-tight mt-4 leading-[1.1]">
                Stop texting yourself.
                <br />
                <span className="italic text-black/60">Text Xyra.</span>
              </h3>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg md:text-xl text-black/50 mt-5 max-w-md leading-relaxed">
                Don&apos;t even need to open the app. Text Xyra what you need and it logs everything
                into your dashboards. Tasks, workouts, notes, anything.
                It even congratulates you on your PRs.
              </p>
            </Section>
          </div>
        </div>
      </section>

      {/* ── Section 4: Your World ───────────────────────────────── */}
      <section className="px-6 sm:px-12 lg:px-20 py-20 md:py-28 bg-black/[0.02]">
        <div className="max-w-6xl mx-auto">
          <Section>
            <div className="text-center mb-12 md:mb-16">
              <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.25em] uppercase text-black/30">
                Your World
              </span>
              <h3 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-black tracking-tight mt-4 leading-[1.1]">
                A living map of
                <br />
                <span className="italic">your entire life.</span>
              </h3>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg md:text-xl text-black/50 mt-5 max-w-lg mx-auto leading-relaxed">
                The World is a 3D knowledge graph that connects everything you track.
                It learns you as you use Xyra. Your habits, patterns, and progress.
                Click into any node to dive deeper.
              </p>
            </div>
          </Section>

          <WorldCards />
        </div>
      </section>
    </div>
  );
}
