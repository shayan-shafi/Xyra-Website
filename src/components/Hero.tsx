"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainCanvas = dynamic(() => import("./showcase/BrainCanvas"), {
  ssr: false,
});

export default function Hero() {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);


  return (
    <>
      <section className="relative z-40 h-screen w-full bg-white overflow-hidden">
        {/* Mobile: brain background + centered content */}
        {/* Desktop: split layout — left text, right brain */}

        {/* Brain canvas — desktop only, right side */}
        <div className="absolute inset-0 left-[40%] z-0 hidden md:block">
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <BrainCanvas hideTitle hideLabels heroMode />
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
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-[family-name:var(--font-playfair)] text-6xl font-medium text-black tracking-tight"
          >
            Xyra
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="font-[family-name:var(--font-eb-garamond)] text-lg text-black/50 mt-3 leading-relaxed text-center"
          >
            Your AI-native personal operating system.
            <br />
            <span className="text-black/35">You speak, Xyra builds.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-6 flex flex-col items-center gap-3"
          >
            <a
              href="#waitlist"
              className="px-7 py-3 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase"
            >
              Join the Beta
            </a>
            <button
              onClick={() => setShowVideo(true)}
              className="px-7 py-3 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase flex items-center justify-center gap-2.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Demo
            </button>
            <a
              href="/demo"
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
        <div className="relative z-10 h-full hidden md:flex flex-col justify-center items-start px-12 lg:px-20 text-left w-[45%]">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="font-[family-name:var(--font-playfair)] text-7xl lg:text-8xl xl:text-9xl font-medium text-black tracking-tight"
          >
            Xyra
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="font-[family-name:var(--font-eb-garamond)] text-xl lg:text-2xl text-black/50 mt-4 max-w-md leading-relaxed"
          >
            Your AI-native personal operating system.
            <br />
            <span className="text-black/35">You speak, Xyra builds.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-8 flex flex-col items-start gap-4"
          >
            <a
              href="#waitlist"
              className="px-7 py-3 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase hover:bg-black/85 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
            >
              Join the Beta
            </a>
            <div className="flex flex-row items-center gap-3">
              <button
                onClick={() => setShowVideo(true)}
                className="px-5 py-2.5 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-[10px] tracking-widest uppercase hover:bg-black/5 hover:border-black/25 transition-all duration-300 flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </button>
              <a
                href="/demo"
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
