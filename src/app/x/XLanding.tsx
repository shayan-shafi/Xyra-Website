"use client";

// ─── /x · the X ad landing ───────────────────────────────────────────────────
// Says the ad's line back, shows the idea in one picture, and asks for one
// thing. Phone: the "send it to my laptop" email form, inline. Laptop: one
// button to app sign-up. Events use cta_location "x_landing" so the funnel
// can tell this page from the home page.

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HandoffForm, isPhone, signUpHref } from "@/components/StartButton";
import { openPrivacySettings } from "@/components/AnalyticsProvider";
import { track } from "@/lib/analytics";
import { signUpUrl } from "@/lib/site";
import { useSectionView } from "@/lib/useSectionView";

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";
const PROSE = "font-[family-name:var(--font-eb-garamond)]";
const FROM = "x";
const WHERE = "x_landing";

const AIS = ["chatgpt", "claude", "gemini"];

const STEPS = [
  "sign in on your laptop",
  "connect chatgpt and claude",
  "they hand xyra what they already know about you",
];

export default function XLanding() {
  // Most X clicks are phones, so the phone form renders first; laptops swap to the button on mount.
  const [phone, setPhone] = useState(true);
  useEffect(() => setPhone(isPhone()), []);
  const heroRef = useSectionView<HTMLElement>(WHERE);

  return (
    <div className="xyra-canvas min-h-[100dvh] flex flex-col">
      <header className="mx-auto w-full max-w-md px-6 pt-6 flex items-center gap-2">
        <Image src="/assets/xyra-logo-square.png" alt="" width={32} height={32} className="h-6 w-6" priority />
        <span className={`${SERIF} text-xl font-semibold text-black`}>xyra</span>
      </header>

      <main ref={heroRef} className="mx-auto w-full max-w-md flex-1 px-6 pt-8 pb-10">
        <p className={`${MONO} text-[10px] uppercase tracking-[0.18em] text-black/45`}>for anyone who uses two or more AIs</p>
        <h1 className={`${SERIF} mt-3 text-[40px] font-medium leading-[1.05] tracking-tight text-black`}>
          one memory every AI you use can read.
        </h1>
        <p className={`${PROSE} mt-4 text-[19px] leading-snug text-black/65`}>
          tell chatgpt once. claude, gemini and whatever comes out next already know you.
        </p>

        {/* the idea in one picture: every AI reads the same brain */}
        <div className="mt-7 flex items-center gap-3" aria-hidden>
          <div className="flex flex-col gap-1.5">
            {AIS.map((ai) => (
              <span key={ai} className={`${MONO} rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] text-black/70`}>
                {ai}
              </span>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-[22px]">
            {AIS.map((ai) => (
              <span key={ai} className="h-px w-full bg-black/25" />
            ))}
          </div>
          <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full bg-black text-center">
            <span className={`${MONO} text-[10px] leading-tight text-white`}>
              your
              <br />
              brain
            </span>
          </div>
        </div>

        <div className="mt-9">
          {phone ? (
            <>
              <p className={`${PROSE} mb-3 text-[17px] leading-snug text-black/70`}>
                xyra lives on your laptop. leave your email and we&apos;ll send you the link.
              </p>
              <HandoffForm from={FROM} location={WHERE} intro={null} submitLabel="email me the link" />
            </>
          ) : (
            <>
              <a
                href={signUpUrl(FROM)}
                onClick={(e) => {
                  track("cta_click", { cta_location: WHERE, button_label: "start your brain", destination: "app_signup" });
                  e.currentTarget.href = signUpHref(FROM);
                }}
                className={`${MONO} inline-flex w-full items-center justify-center rounded-full bg-black px-6 py-4 text-sm tracking-wide text-white hover:bg-black/85 transition-colors`}
              >
                start your brain
              </a>
              <p className={`${MONO} mt-3 text-center text-[11px] text-black/45`}>takes about a minute</p>
            </>
          )}
        </div>

        <ol className="mt-12 space-y-3 border-t border-black/10 pt-6">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-baseline gap-3">
              <span className={`${MONO} text-[11px] text-black/40`}>0{i + 1}</span>
              <span className={`${PROSE} text-[18px] leading-snug text-black/80`}>{step}</span>
            </li>
          ))}
        </ol>
        <p className={`${PROSE} mt-6 text-[17px] leading-snug text-black/55`}>
          $10 a month. no card until you&apos;ve seen it.
        </p>
      </main>

      <footer className={`${MONO} mx-auto w-full max-w-md px-6 pb-[max(24px,env(safe-area-inset-bottom))] flex items-center gap-5 text-[11px] text-black/40`}>
        <Link href="/privacy" className="hover:text-black">privacy</Link>
        <Link href="/terms" className="hover:text-black">terms</Link>
        <button onClick={openPrivacySettings} className="underline underline-offset-4 decoration-black/20 hover:text-black">
          privacy settings
        </button>
      </footer>
    </div>
  );
}
