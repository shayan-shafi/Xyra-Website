"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, FormEvent } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

export default function Waitlist() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="waitlist" className="relative py-24 sm:py-32 paper-texture">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 text-center" ref={ref}>
        {/* Section label */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.2em] uppercase text-ink-faint">
            Early Access
          </span>
        </motion.div>

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
          className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-tight mb-6"
        >
          Be the first to
          <br />
          <span className="italic">experience Xyra.</span>
        </motion.h2>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light leading-relaxed mb-10 max-w-lg mx-auto"
        >
          Sign up for the beta and get free access when we launch.
        </motion.p>

        {/* Form */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {status === "success" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8"
            >
              <div className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-ink mb-3">
                You&apos;re on the list.
              </div>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-ink-light">
                We&apos;ll be in touch when Xyra is ready for you.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-5 py-3.5 rounded-full border border-ink-faint/30 bg-warm-white/80 font-[family-name:var(--font-jetbrains)] text-sm text-ink placeholder:text-ink-faint/60 focus:outline-none focus:border-ink-faint/60 focus:ring-1 focus:ring-ink-faint/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="px-7 py-3.5 bg-ink text-cream rounded-full font-[family-name:var(--font-jetbrains)] text-sm tracking-wide hover:bg-ink-light transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-ink/10 shrink-0"
                >
                  {status === "loading" ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Joining...
                    </span>
                  ) : (
                    "Join Waitlist"
                  )}
                </button>
              </div>
              {status === "error" && (
                <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-red-600 mt-3">
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          )}
        </motion.div>

        {/* Trust signals */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex items-center justify-center gap-6 text-ink-faint"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs">No spam</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs">Free beta</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            <span className="font-[family-name:var(--font-jetbrains)] text-xs">Early access</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
