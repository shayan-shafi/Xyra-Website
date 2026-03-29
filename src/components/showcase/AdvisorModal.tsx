"use client";

import { motion } from "framer-motion";

interface AdvisorModalProps {
  question?: string;
  showQuestion?: boolean;
  showThinking?: boolean;
  showModal?: boolean;
}

export default function AdvisorModal({
  question = "How am I doing on saving?",
  showQuestion = false,
  showThinking = false,
  showModal = false,
}: AdvisorModalProps) {
  return (
    <div className="w-full h-full flex items-center justify-center relative">

      {/* Question bubble at bottom */}
      {showQuestion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 max-w-sm"
        >
          <div className="bg-black text-white px-6 py-3 rounded-2xl font-mono text-sm">
            &ldquo;{question}&rdquo;
          </div>
        </motion.div>
      )}

      {/* Thinking dots */}
      {showThinking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2"
        >
          <div className="bg-white border border-black px-6 py-3 font-mono text-sm flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </motion.div>
      )}

      {/* Advisor modal */}
      {showModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl relative z-10"
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-serif">X</span>
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-black">
                  Xyra
                </p>
                <p className="text-xs text-black/40 font-mono">
                  Your Advisor
                </p>
              </div>
            </div>

            {/* Insight */}
            <p className="font-serif text-sm md:text-base text-black/70 leading-relaxed">
              You&apos;re on track for your $10,000 savings goal. Nice
              work. That said, you&apos;ve hit Starbucks 6 times this week.
              Maybe skip the daily matcha for a bit?
            </p>

            {/* Button */}
            <div className="mt-6 flex justify-end">
              <button className="bg-black text-white px-4 py-2 text-sm font-mono">
                Got it
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
