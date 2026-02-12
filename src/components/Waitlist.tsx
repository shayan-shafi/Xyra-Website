"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, FormEvent } from "react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

type Step = "email" | "survey" | "done";

export default function Waitlist() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  // Step state
  const [step, setStep] = useState<Step>("email");

  // Email step
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "error">("idle");

  // Survey step
  const [surveyAppCount, setSurveyAppCount] = useState("");
  const [surveyCurrentApps, setSurveyCurrentApps] = useState("");
  const [surveyMustHave, setSurveyMustHave] = useState("");
  const [surveyStatus, setSurveyStatus] = useState<"idle" | "loading" | "error">("idle");

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setEmailStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setEmailStatus("idle");
        setStep("survey");
      } else {
        setEmailStatus("error");
      }
    } catch {
      setEmailStatus("error");
    }
  };

  const handleSurveySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSurveyStatus("loading");

    try {
      const res = await fetch("/api/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          surveyAppCount,
          surveyCurrentApps,
          surveyMustHave,
        }),
      });

      if (res.ok) {
        setSurveyStatus("idle");
        setStep("done");
      } else {
        setSurveyStatus("error");
      }
    } catch {
      setSurveyStatus("error");
    }
  };

  const handleSkipSurvey = () => {
    setStep("done");
  };

  const inputClass =
    "w-full px-5 py-3.5 rounded-2xl border border-ink-faint/30 bg-warm-white/80 font-[family-name:var(--font-jetbrains)] text-sm text-ink placeholder:text-ink-faint/60 focus:outline-none focus:border-ink-faint/60 focus:ring-1 focus:ring-ink-faint/20 transition-all";

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

        {/* Content area */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {/* ── Step 1: Email ─────────────────────────────────────── */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto">
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
                  disabled={emailStatus === "loading"}
                  className="px-7 py-3.5 bg-ink text-cream rounded-full font-[family-name:var(--font-jetbrains)] text-sm tracking-wide hover:bg-ink-light transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-ink/10 shrink-0"
                >
                  {emailStatus === "loading" ? (
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
              {emailStatus === "error" && (
                <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-red-600 mt-3">
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          )}

          {/* ── Step 2: Survey ────────────────────────────────────── */}
          {step === "survey" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-lg mx-auto"
            >
              <div className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-ink mb-3">
                You&apos;re on the list.
              </div>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-ink-light mb-2">
                We&apos;ll be in touch when Xyra is ready for you.
              </p>
              <p className="font-[family-name:var(--font-eb-garamond)] text-base text-ink-light mb-8">
                While you&apos;re here, help us build something great &mdash; answer a few quick questions:
              </p>

              <form onSubmit={handleSurveySubmit} className="space-y-5 text-left">
                {/* Q1 */}
                <div>
                  <label className="block font-[family-name:var(--font-jetbrains)] text-xs tracking-wide text-ink-light mb-2">
                    How many apps do you currently juggle for tracking things?
                  </label>
                  <input
                    type="text"
                    value={surveyAppCount}
                    onChange={(e) => setSurveyAppCount(e.target.value)}
                    placeholder="e.g. 3-4 apps"
                    className={inputClass}
                  />
                </div>

                {/* Q2 */}
                <div>
                  <label className="block font-[family-name:var(--font-jetbrains)] text-xs tracking-wide text-ink-light mb-2">
                    Which apps do you use to track things?
                  </label>
                  <input
                    type="text"
                    value={surveyCurrentApps}
                    onChange={(e) => setSurveyCurrentApps(e.target.value)}
                    placeholder="e.g. Notion, Google Sheets, Apple Notes"
                    className={inputClass}
                  />
                </div>

                {/* Q3 */}
                <div>
                  <label className="block font-[family-name:var(--font-jetbrains)] text-xs tracking-wide text-ink-light mb-2">
                    What is a must-have dashboard for you?
                  </label>
                  <textarea
                    value={surveyMustHave}
                    onChange={(e) => setSurveyMustHave(e.target.value)}
                    placeholder="e.g. A single view of all my tasks, habits, and goals"
                    rows={3}
                    className={inputClass + " rounded-2xl resize-none"}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={surveyStatus === "loading"}
                    className="px-7 py-3.5 bg-ink text-cream rounded-full font-[family-name:var(--font-jetbrains)] text-sm tracking-wide hover:bg-ink-light transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-ink/10"
                  >
                    {surveyStatus === "loading" ? (
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
                        Submitting...
                      </span>
                    ) : (
                      "Submit"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipSurvey}
                    className="font-[family-name:var(--font-jetbrains)] text-xs text-ink-faint hover:text-ink-light transition-colors"
                  >
                    Skip for now
                  </button>
                </div>

                {surveyStatus === "error" && (
                  <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-red-600 text-center">
                    Something went wrong. Please try again.
                  </p>
                )}
              </form>
            </motion.div>
          )}

          {/* ── Step 3: Done ──────────────────────────────────────── */}
          {step === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="py-8"
            >
              <div className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-ink mb-3">
                Thank you!
              </div>
              <p className="font-[family-name:var(--font-eb-garamond)] text-lg text-ink-light">
                We appreciate your feedback. We&apos;ll be in touch when Xyra is ready for you.
              </p>
            </motion.div>
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
