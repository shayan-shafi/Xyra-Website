"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import RotatingWord from "./RotatingWord";

const BrainCanvas = dynamic(() => import("./showcase/BrainCanvas"), {
  ssr: false,
});

export default function Hero() {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useSectionView<HTMLElement>("hero");


  return (
    <>
      <section ref={sectionRef} className="relative z-40 h-screen w-full bg-white overflow-hidden">
        {/* Mobile: brain background + centered content */}
        {/* Desktop: split layout — left text, right brain */}

        {/* Braindump demo video — desktop only, right side */}
        <div className="absolute inset-y-0 right-0 left-[52%] z-0 hidden md:flex items-center justify-center pr-12 lg:pr-16">
          <video
            autoPlay
            loop
            muted
            playsInline
            onEnded={(e) => {
              const v = e.currentTarget;
              v.currentTime = 0;
              v.play();
            }}
            className="w-full max-h-[78vh] object-contain"
          >
            <source src="/assets/braindump-demo.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Mobile layout */}
        {/* Brain — absolute, fills the top portion behind text */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="absolute top-0 left-0 right-0 h-[45%] z-0 md:hidden"
        >
          <BrainCanvas hideTitle hideLabels heroMode />
        </motion.div>

        {/* Mobile text — centered with same -mt-16 offset as before */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-8 md:hidden pt-28">
          <motion.img
            src="/assets/xyra-logo-black.png"
            alt="Xyra"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="h-8 w-auto"
          />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-[family-name:var(--font-playfair)] text-4xl font-medium text-black tracking-tight leading-[1.08] mt-4 text-center"
          >
            Braindump your <RotatingWord />.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="font-[family-name:var(--font-playfair)] text-2xl text-black/40 mt-4 leading-tight tracking-tight text-center"
          >
            start actually getting things done.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-6 flex flex-col items-center gap-3"
          >
            <a
              href="#waitlist"
              onClick={() => track("cta_click", { cta_location: "hero_mobile", button_label: "Join the Beta" })}
              className="px-7 py-3 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase"
            >
              Join the Beta
            </a>
            <button
              onClick={() => {
                track("cta_click", { cta_location: "hero_mobile", button_label: "Watch Demo" });
                setShowVideo(true);
              }}
              className="px-7 py-3 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase flex items-center justify-center gap-2.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Demo
            </button>
            <a
              href="/demo"
              onClick={() => track("cta_click", { cta_location: "hero_mobile", button_label: "Scroll Demo" })}
              className="px-7 py-3 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase flex items-center justify-center gap-2.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
              Scroll Demo
            </a>
          </motion.div>
        </div>

        {/* Desktop layout — left text, right brain */}
        <div className="relative z-10 h-full hidden md:flex flex-col justify-center items-start pl-16 lg:pl-28 xl:pl-36 pr-8 text-left w-[55%]">
          <motion.img
            src="/assets/xyra-logo-black.png"
            alt="Xyra"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="h-10 lg:h-12 w-auto"
          />

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-[family-name:var(--font-playfair)] text-4xl lg:text-5xl xl:text-6xl font-medium text-black tracking-tight leading-[1.08] mt-5 max-w-2xl"
          >
            <span className="whitespace-nowrap">
              Braindump your <RotatingWord />.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="font-[family-name:var(--font-playfair)] text-3xl lg:text-4xl text-black/40 mt-5 ml-1 max-w-lg leading-tight tracking-tight"
          >
            start actually getting things done.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 flex flex-col items-start gap-4"
          >
            <a
              href="#waitlist"
              onClick={() => track("cta_click", { cta_location: "hero_desktop", button_label: "Join the Beta" })}
              className="px-7 py-3 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase hover:bg-black/85 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
            >
              Join the Beta
            </a>
            <div className="flex flex-row items-center gap-3">
              <button
                onClick={() => {
                  track("cta_click", { cta_location: "hero_desktop", button_label: "Watch Demo" });
                  setShowVideo(true);
                }}
                className="px-5 py-2.5 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-widest uppercase hover:bg-black/5 hover:border-black/25 transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </button>
              <a
                href="/demo"
                onClick={() => track("cta_click", { cta_location: "hero_desktop", button_label: "Scroll Demo" })}
                className="px-5 py-2.5 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-widest uppercase hover:bg-black/5 hover:border-black/25 transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
                Scroll Demo
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Video modal */}
      {showVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVideo(false);
              if (videoRef.current) videoRef.current.pause();
            }
          }}
        >
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              controls
              playsInline
              className="w-full h-full object-contain"
              poster="/assets/xyra-demo-poster.jpg"
            >
              <source src="/assets/xyra-demo.mp4" type="video/mp4" />
            </video>
            <button
              onClick={() => {
                setShowVideo(false);
                if (videoRef.current) videoRef.current.pause();
              }}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
              aria-label="Close video"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
