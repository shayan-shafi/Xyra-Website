"use client";

// ─── StartButton ─────────────────────────────────────────────────────────────
// Every "start your brain" on the site. On a laptop it's a plain link to app
// sign-up (the href, so it works before JS too). On a phone it opens the
// "send it to my laptop" sheet instead: one email field, and we email the
// link (src/lib/handoff.ts). "start on this phone anyway" stays one tap away.
//
// `from` names the button (site_<from> on the app side, cta_location here).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  fireXConversion,
  fireXPurchase,
  getCurrentTouch,
  getFirstTouch,
  getVisitorId,
  getXAttribution,
  track,
} from "@/lib/analytics";
import { signUpUrl } from "@/lib/site";

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";
const PROSE = "font-[family-name:var(--font-eb-garamond)]";

/** Phone = touch-first and narrow, or a phone user agent. iPads and laptops go straight to sign-up. */
export function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPod|Android.+Mobile|Windows Phone|Mobile.+Firefox/i.test(ua)) return true;
  return window.matchMedia("(pointer: coarse) and (max-width: 767px)").matches;
}

/** The visit's attribution: this page's ad tags if it has any (the ad they just
 *  clicked), otherwise the first visit's. Same shape as getFirstTouch(). */
function adTouch() {
  const ft = getFirstTouch();
  const cur = getCurrentTouch();
  if (!cur.utm_source) return ft;
  return {
    ...ft,
    utm_source: cur.utm_source,
    utm_medium: cur.utm_medium,
    utm_campaign: cur.utm_campaign,
    utm_content: cur.utm_content,
  };
}

/** The app sign-up link for this button, carrying the visit's UTM tags (no personal data). */
function signUpHref(from: string): string {
  const base = signUpUrl(from);
  if (typeof window === "undefined") return base;
  const ft = adTouch();
  const p = new URLSearchParams();
  if (ft.utm_source) p.set("utm_source", ft.utm_source);
  if (ft.utm_medium) p.set("utm_medium", ft.utm_medium);
  if (ft.utm_campaign) p.set("utm_campaign", ft.utm_campaign);
  if (ft.utm_content) p.set("utm_content", ft.utm_content);
  const q = p.toString();
  return q ? `${base}&${q}` : base;
}

export default function StartButton({
  from,
  location,
  label = "start your brain",
  className,
  children,
}: {
  from: string;
  /** cta_location in the site's analytics; defaults to `from`. */
  location?: string;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const where = location ?? from;

  return (
    <>
      <a
        href={signUpUrl(from)}
        onClick={(e) => {
          track("cta_click", { cta_location: where, button_label: label, destination: isPhone() ? "handoff" : "app_signup" });
          if (isPhone()) {
            e.preventDefault();
            track("handoff_open", { cta_location: where });
            setOpen(true);
          } else {
            e.currentTarget.href = signUpHref(from);
          }
        }}
        className={className}
      >
        {children ?? label}
      </a>
      <AnimatePresence>{open && <HandoffSheet from={from} location={where} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function HandoffSheet({ from, location, onClose }: { from: string; location: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setProblem("that email doesn't look right");
      return;
    }
    setState("sending");
    setProblem(null);
    track("handoff_submit", { cta_location: location });
    const x = getXAttribution();
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, visitor_id: getVisitorId(), first_touch: adTouch(), x }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "something went wrong");
      track("handoff_success", { cta_location: location, resent: !!data.resent });
      if (res.status === 201) {
        fireXConversion("signup", x);
        // The live X campaign optimizes on the test "Purchase" event, which the
        // waitlist and /apply also fire. Kept here so moving ads to this flow
        // doesn't starve it; drop once the campaign optimizes on "Sign up".
        fireXPurchase(x);
      }
      setState("sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "something went wrong";
      track("handoff_error", { cta_location: location, message: msg.slice(0, 120) });
      setProblem(msg);
      setState("error");
    }
  };

  const skip = (
    <a
      href={signUpHref(from)}
      onClick={() => track("handoff_skip", { cta_location: location, after: state === "sent" ? "sent" : "before" })}
      className={`${MONO} text-[11px] text-black/50 underline underline-offset-4 decoration-black/25`}
    >
      start on this phone anyway
    </a>
  );

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="send it to my laptop"
    >
      <button aria-label="close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md rounded-t-[28px] bg-[#fbfaf8] px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.18)]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-black/15" />
        {state === "sent" ? (
          <div>
            <p className={`${SERIF} text-[28px] font-medium leading-[1.1] tracking-tight text-black`}>sent. open it on your laptop.</p>
            <p className={`${PROSE} mt-3 text-[17px] leading-snug text-black/60`}>
              it&apos;s from shayan@xyra.dev. not there in a minute? check promotions or spam.
            </p>
            <button
              onClick={onClose}
              className={`${MONO} mt-7 inline-flex w-full items-center justify-center rounded-full bg-black px-6 py-3.5 text-xs tracking-wide text-white`}
            >
              done
            </button>
            <div className="mt-5 text-center">{skip}</div>
          </div>
        ) : (
          <form onSubmit={send} noValidate>
            <p className={`${SERIF} text-[28px] font-medium leading-[1.1] tracking-tight text-black`}>xyra&apos;s built for your laptop.</p>
            <p className={`${PROSE} mt-3 text-[17px] leading-snug text-black/60`}>
              leave your email and we&apos;ll send the link there. no card until you&apos;ve seen it.
            </p>
            <input
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (problem) setProblem(null);
              }}
              className={`${MONO} mt-6 w-full rounded-full border border-black/15 bg-white px-5 py-3.5 text-[16px] text-black outline-none placeholder:text-black/30 focus:border-black/50`}
            />
            {problem && <p className={`${MONO} mt-2 px-2 text-[11px] text-red-600`}>{problem}</p>}
            <button
              type="submit"
              disabled={state === "sending"}
              className={`${MONO} mt-3 inline-flex w-full items-center justify-center rounded-full bg-black px-6 py-3.5 text-xs tracking-wide text-white disabled:opacity-60`}
            >
              {state === "sending" ? "sending…" : "send it to my laptop"}
            </button>
            <p className={`${MONO} mt-4 text-center text-[10px] leading-relaxed text-black/40`}>
              the link plus two reminders at most. stop them anytime. <a href="/privacy" className="underline">privacy</a>
            </p>
            <div className="mt-4 text-center">{skip}</div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
