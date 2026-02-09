"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export default function Demo() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <section id="demo" className="relative py-24 sm:py-32 bg-warm-white">
      <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12" ref={ref}>
        {/* Section label */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6 }}
          className="mb-6 text-center"
        >
          <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.2em] uppercase text-ink-faint">
            See it in action
          </span>
        </motion.div>

        <motion.h2
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-tight mb-4 text-center"
        >
          A day in the life
        </motion.h2>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light text-center max-w-xl mx-auto mb-12"
        >
          See what using Xyra actually looks like.
        </motion.p>

        {/* Video container */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="relative rounded-xl overflow-hidden shadow-2xl shadow-ink/10 border border-ink-faint/10 bg-ink/5"
        >
          {/* Video aspect ratio container */}
          <div className="relative aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              controls={isPlaying}
              playsInline
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src="/assets/xyra-demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Custom play overlay */}
            {!isPlaying && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex items-center justify-center bg-ink/10 hover:bg-ink/20 transition-colors cursor-pointer group"
                aria-label="Play video"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-cream/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-ink ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            )}
          </div>
        </motion.div>

        {/* Caption */}
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="font-[family-name:var(--font-jetbrains)] text-xs text-ink-faint text-center mt-6 tracking-wide"
        >
          Early preview
        </motion.p>
      </div>
    </section>
  );
}
