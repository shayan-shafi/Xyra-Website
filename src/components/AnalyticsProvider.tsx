"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getFirstTouch,
  getVisitorId,
  getSessionId,
  hasSeenConsent,
  markConsentSeen,
  isOptedOut,
  optIn,
  optOut,
  track,
  trackOncePerSession,
} from "@/lib/analytics";

const SCROLL_THRESHOLDS = [25, 50, 75, 90] as const;

const OPEN_SETTINGS_EVENT = "xyra:open-privacy-settings";

// Exposed for the Footer link.
export function openPrivacySettings(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showNotice, setShowNotice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [optedOut, setOptedOut] = useState(false);

  // Initialize identity + first-touch + decide whether to show notice.
  useEffect(() => {
    // Touch visitor/session/first-touch once on mount. These are no-ops on
    // subsequent visits, but ensure first-touch is captured before any event.
    getVisitorId();
    getSessionId();
    getFirstTouch();
    setOptedOut(isOptedOut());
    if (!hasSeenConsent()) {
      setShowNotice(true);
    }
  }, []);

  // Pageview on route change. searchParams is in the deps so utm changes also fire.
  useEffect(() => {
    if (!pathname) return;
    track("pageview");
    if (pathname.startsWith("/ref/")) {
      const code = pathname.split("/")[2];
      if (code) {
        track("ref_link_visit", { ref_code: code });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams?.toString()]);

  // Listen for "open privacy settings" requests from the footer.
  useEffect(() => {
    const handler = () => {
      setOptedOut(isOptedOut());
      setShowSettings(true);
    };
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

  // Scroll depth — fire each threshold at most once per session. rAF-throttled
  // so we never touch per-pixel events or anything resembling mouse tracking.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let ticking = false;

    const measure = () => {
      const doc = document.documentElement;
      const viewport = window.innerHeight;
      const scrollable = doc.scrollHeight - viewport;
      if (scrollable <= 0) return;
      const scrolled = window.scrollY || doc.scrollTop || 0;
      const pct = Math.min(100, Math.max(0, Math.round((scrolled / scrollable) * 100)));
      for (const threshold of SCROLL_THRESHOLDS) {
        if (pct >= threshold) {
          trackOncePerSession(`scroll_depth:${threshold}`, "scroll_depth", {
            threshold,
          });
        }
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        measure();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // Measure once in case the page loaded already scrolled (anchor links, refresh).
    measure();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleContinue = useCallback(() => {
    markConsentSeen();
    setShowNotice(false);
  }, []);

  const handleOpenAdvanced = useCallback(() => {
    setOptedOut(isOptedOut());
    setShowSettings(true);
  }, []);

  const handleToggle = useCallback((nextEnabled: boolean) => {
    if (nextEnabled) {
      optIn();
    } else {
      optOut();
    }
    setOptedOut(!nextEnabled);
  }, []);

  const handleCloseSettings = useCallback(() => {
    markConsentSeen();
    setShowSettings(false);
    setShowNotice(false);
  }, []);

  return (
    <>
      {showNotice && !showSettings && (
        <div
          role="region"
          aria-label="Privacy notice"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[200] pointer-events-auto"
        >
          <div className="rounded-2xl bg-black/90 backdrop-blur-md border border-white/10 shadow-2xl p-5 text-white">
            <p className="font-[family-name:var(--font-eb-garamond)] text-sm leading-relaxed text-white/80">
              We use first-party analytics to understand which pages and signup
              links are working. No ad tracking. No data selling.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={handleContinue}
                className="px-4 py-2 rounded-full bg-white text-black font-[family-name:var(--font-jetbrains)] text-xs tracking-wide hover:bg-white/90 transition-colors"
              >
                Continue
              </button>
              <button
                onClick={handleOpenAdvanced}
                className="px-4 py-2 rounded-full border border-white/20 text-white/80 font-[family-name:var(--font-jetbrains)] text-xs tracking-wide hover:bg-white/10 hover:text-white transition-colors"
              >
                Advanced settings
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Privacy settings"
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSettings();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white text-black p-6 shadow-2xl">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-medium">
              Privacy settings
            </h2>
            <p className="font-[family-name:var(--font-eb-garamond)] text-base text-black/60 mt-2 leading-relaxed">
              We use first-party analytics (anonymous visitor and session IDs,
              pageviews, and signup events) to understand which pages and
              signup links are working. We do not use ad tracking, session
              replay, fingerprinting, or third-party analytics.
            </p>

            <div className="mt-6 flex items-center justify-between rounded-xl border border-black/10 px-4 py-3">
              <div>
                <div className="font-[family-name:var(--font-jetbrains)] text-sm">
                  Analytics
                </div>
                <div className="font-[family-name:var(--font-eb-garamond)] text-xs text-black/50 mt-0.5">
                  {optedOut ? "Off — events are not collected." : "On — first-party only."}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={!optedOut}
                onClick={() => handleToggle(optedOut)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  optedOut ? "bg-black/20" : "bg-black"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    optedOut ? "translate-x-0" : "translate-x-5"
                  }`}
                />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={handleCloseSettings}
                className="px-5 py-2 rounded-full bg-black text-white font-[family-name:var(--font-jetbrains)] text-xs tracking-wide hover:bg-black/85 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
