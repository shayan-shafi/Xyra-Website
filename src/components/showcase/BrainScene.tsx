"use client";

import { useRef, useState, useCallback } from "react";
import { useScroll, useTransform, useMotionValueEvent, motion } from "framer-motion";
import dynamic from "next/dynamic";

const BrainCanvas = dynamic(() => import("./BrainCanvas"), { ssr: false });

export default function BrainScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const [brainVisible, setBrainVisible] = useState(false);
  const [zoomProgress, setZoomProgress] = useState(0);
  const [showUser, setShowUser] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);

  const brainOpacity = useTransform(scrollYProgress, [0.0, 0.08, 0.90, 0.97], [0, 1, 1, 0]);
  const chatOpacity = useTransform(scrollYProgress, [0.08, 0.14, 0.38, 0.44], [0, 1, 1, 0]);
  const insightsOpacity = useTransform(scrollYProgress, [0.62, 0.68, 0.88, 0.93], [0, 1, 1, 0]);
  const blackOverlayOpacity = useTransform(scrollYProgress, [0.90, 0.97], [0, 1]);

  // Brain shifts left when insights appear
  const brainX = useTransform(scrollYProgress, [0.58, 0.68], ["0%", "-25%"]);

  const handleProgress = useCallback((v: number) => {
    setBrainVisible(v >= 0.0 && v < 0.97);

    // Conversation
    setShowUser(v >= 0.12);
    setShowThinking(v >= 0.22 && v < 0.30);
    setShowReply(v >= 0.30);

    // Zoom into finance node: 0.50 → 0.65
    if (v >= 0.50 && v <= 0.65) {
      setZoomProgress((v - 0.50) / 0.15);
    } else if (v < 0.50) {
      setZoomProgress(0);
    } else {
      setZoomProgress(1);
    }

    // Insights panel
    setInsightsVisible(v >= 0.62 && v < 0.93);
  }, []);

  useMotionValueEvent(scrollYProgress, "change", handleProgress);

  return (
    <div ref={ref} className="h-[600vh] relative z-40" style={{ marginTop: "-100vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-white z-40">
        {/* 3D Brain canvas — shifts left when insights show */}
        {brainVisible && (
          <motion.div
            style={{ opacity: brainOpacity, x: brainX }}
            className="absolute inset-0 z-10"
          >
            <BrainCanvas zoomProgress={zoomProgress} />
          </motion.div>
        )}

        {/* Conversation overlay */}
        <motion.div style={{ opacity: chatOpacity }} className="absolute inset-0 z-20 pointer-events-none">
          <div className="w-full h-full flex flex-col justify-end pb-20 md:pb-28 px-6 md:px-12">
            <div className="max-w-md mx-auto w-full space-y-4">
              {showUser && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-end"
                >
                  <div className="bg-black text-white px-6 py-4 font-mono text-sm md:text-base max-w-sm">
                    Hey, what is this?
                  </div>
                </motion.div>
              )}

              {showThinking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-black px-6 py-4 font-mono text-sm text-black">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </motion.div>
              )}

              {showReply && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-black px-6 py-4 font-mono text-sm md:text-base text-black max-w-sm">
                    This is where I visualize your life. Let me show you your finances as an example.
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Xyra advisor bubble — bottom left under the brain */}
        {insightsVisible && (
          <motion.div
            style={{ opacity: insightsOpacity }}
            className="absolute bottom-32 md:bottom-40 left-[15%] md:left-[22%] z-30 pointer-events-none max-w-xs md:max-w-sm"
          >
            <div className="bg-white border border-black px-5 py-4 font-mono text-xs md:text-sm text-black leading-relaxed">
              Oh yeah, I also act as your advisor for everything you do. Got you with recommendations, feedback, or tips.
            </div>
          </motion.div>
        )}

        {/* Finance insights panel — right side */}
        {insightsVisible && (
          <motion.div
            style={{ opacity: insightsOpacity }}
            className="absolute top-0 right-0 w-full md:w-1/2 h-full z-30 flex items-center justify-center pointer-events-none"
          >
            <div className="w-full max-w-sm mx-auto px-6 md:px-8 space-y-4">
              {/* Header */}
              <div className="border-b border-black/10 pb-3">
                <h2 className="font-serif text-xl md:text-2xl text-black">Finances</h2>
                <p className="font-mono text-[10px] md:text-xs text-black/40 mt-1">
                  Node insights powered by Xyra
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-black/10 p-3">
                  <div className="font-mono text-[9px] md:text-[10px] text-black/40 uppercase tracking-wider">
                    Days Active
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-black mt-1">47</div>
                </div>
                <div className="border border-black/10 p-3">
                  <div className="font-mono text-[9px] md:text-[10px] text-black/40 uppercase tracking-wider">
                    Money Saved
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-emerald-500 mt-1">$2,340</div>
                </div>
                <div className="border border-black/10 p-3">
                  <div className="font-mono text-[9px] md:text-[10px] text-black/40 uppercase tracking-wider">
                    Total Spent
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-black mt-1">$4,120</div>
                </div>
                <div className="border border-black/10 p-3">
                  <div className="font-mono text-[9px] md:text-[10px] text-black/40 uppercase tracking-wider">
                    Budget Left
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-amber-500 mt-1">$760</div>
                </div>
              </div>

              {/* Savings progress */}
              <div className="border border-black/10 p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-[10px] md:text-xs text-black/40">Savings Goal</span>
                  <span className="font-mono text-[10px] md:text-xs text-emerald-500">78%</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '78%' }} />
                </div>
                <p className="font-mono text-[9px] md:text-[10px] text-black/30 mt-1.5">
                  $2,340 of $3,000 goal
                </p>
              </div>

              {/* Xyra insight */}
              <div className="bg-black p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-black text-[10px] font-serif font-bold">X</span>
                  </div>
                  <span className="font-mono text-[10px] text-white/60">Xyra Insight</span>
                </div>
                <p className="font-mono text-xs text-white/90 leading-relaxed">
                  You&apos;ve cut dining out by 32% this month. Your savings rate is up 15% since you started tracking. Keep it up!
                </p>
              </div>

              {/* Recent activity */}
              <div className="space-y-2">
                <h3 className="font-mono text-[10px] md:text-xs text-black/40 uppercase tracking-wider">
                  Recent Activity
                </h3>
                <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                  <span className="font-mono text-xs text-black">Groceries</span>
                  <span className="font-mono text-xs text-black/60">-$67</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                  <span className="font-mono text-xs text-black">Paycheck</span>
                  <span className="font-mono text-xs text-emerald-500">+$2,400</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-black/5">
                  <span className="font-mono text-xs text-black">Uber</span>
                  <span className="font-mono text-xs text-black/60">-$18</span>
                </div>
              </div>

              {/* Mic button */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white border border-black/15 px-4 py-3 font-mono text-sm text-black/30">
                  Ask about your finances...
                </div>
                <button className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {/* Black overlay — crossfade to black before waitlist */}
        <motion.div
          style={{ opacity: blackOverlayOpacity }}
          className="absolute inset-0 bg-black z-50 pointer-events-none"
        />
      </div>
    </div>
  );
}
