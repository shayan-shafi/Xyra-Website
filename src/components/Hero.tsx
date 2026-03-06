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

  const handleScrollDown = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth",
    });
  };

  return (
    <>
      <section className="relative z-40 h-screen w-full bg-white overflow-hidden">
        {/* Mobile: brain background + centered content */}
        {/* Desktop: split layout — left text, right brain */}

        <div className="h-full flex flex-col md:flex-row">
          {/* Left: Text content */}
          <div className="relative z-10 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-16 md:w-[45%] md:shrink-0">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="font-[family-name:var(--font-playfair)] text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-medium text-black tracking-tight"
            >
              Xyra
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.55 }}
              className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl lg:text-2xl text-black/50 mt-4 max-w-md leading-relaxed"
            >
              Your AI-native personal operating system.
              <br />
              <span className="text-black/35">You speak, Xyra builds.</span>
              <br />
              <span className="text-black/35">Xyra builds, Agents read.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="mt-8 flex flex-col sm:flex-row items-start gap-3.5"
            >
              <a
                href="#waitlist"
                className="px-7 py-3 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase hover:bg-black/85 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
              >
                Join the Beta
              </a>
              <button
                onClick={() => setShowVideo(true)}
                className="px-7 py-3 rounded-full border border-black/15 text-black/70 font-[family-name:var(--font-jetbrains)] text-xs tracking-widest uppercase hover:bg-black/5 hover:border-black/25 transition-all duration-300 flex items-center gap-2.5"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Demo
              </button>
            </motion.div>
          </div>

          {/* Right: Brain canvas — full height, fills remaining space */}
          <div className="relative flex-1 min-h-0">
            {/* Soft left edge fade on desktop so brain blends into white */}
            <div className="hidden md:block absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
            <BrainCanvas hideTitle hideLabels heroMode />
          </div>
        </div>

        {/* Scroll prompt — pinned bottom center */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
          onClick={handleScrollDown}
          className="absolute bottom-16 left-0 right-0 z-20 flex flex-col items-center gap-3 cursor-pointer group"
        >
          <span className="font-[family-name:var(--font-eb-garamond)] text-sm sm:text-base italic text-black/30 group-hover:text-black/50 transition-colors">
            Scroll down and keep scrolling to see how it works
          </span>
        </motion.button>
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
