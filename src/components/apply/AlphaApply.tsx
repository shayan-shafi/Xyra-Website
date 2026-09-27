"use client";

// ─── AlphaApply ──────────────────────────────────────────────────────────────
// The alpha application as a conversation on the canvas — the site's own
// language instead of a Google Form (2026-09-27). Same five questions, same
// wording, asked one at a time: xyra asks in a white bubble, you answer in a
// black one, the receipt chips fill in as you go. The last question (the $10)
// is two chips, and picking one is the submit. Answers land on the applicant's
// waitlist row via /api/alpha-apply.
// Xyra design language: Playfair display, EB Garamond prose, JetBrains Mono
// bubbles + chips, black/white on the warm "+" canvas, stickers you can drag.

import { useCallback, useEffect, useRef, useState, FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getFirstTouch, getVisitorId, track } from "@/lib/analytics";
import { isValidEmail } from "@/lib/emailValidation";
import { useSectionView } from "@/lib/useSectionView";
import { Cutout, Sticker } from "@/components/hero/Sticker";
import { TornSticker } from "@/components/hero/TornSticker";

/* ── the questions — verbatim from the form they replace ────────────────── */

type StepKey = "name" | "whatsUp" | "email" | "why" | "payOk";

const STEPS: { key: StepKey; chip: string; question: string; placeholder: string; max: number }[] = [
  { key: "name", chip: "name", question: "name?", placeholder: "your name", max: 120 },
  {
    key: "whatsUp",
    chip: "what you're up to",
    question: "what are you up to these days? (what school/wyd for work)",
    placeholder: "school, work, both, neither…",
    max: 600,
  },
  { key: "email", chip: "email", question: "email?", placeholder: "your@email.com", max: 254 },
  {
    key: "why",
    chip: "why",
    question: "why do you want to use xyra? tell us why you want in.",
    placeholder: "be honest",
    max: 2000,
  },
  {
    key: "payOk",
    chip: "the $10",
    question:
      "are you okay with paying $10 to test to help us prove traction and in return get your first 1 month off at official launch? (plus a thank you gift..)",
    placeholder: "",
    max: 0,
  },
];

const PAY_STEP = STEPS.length - 1;
const NO_LABEL = "no :((((((";

type Bubble = { id: number; role: "xyra" | "you"; text: string };
type Phase = "asking" | "submitting" | "done" | "error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const firstName = (name: string) => name.trim().split(/\s+/)[0];

/* ── pieces ──────────────────────────────────────────────────────────────── */

// xyra is typing… (the hero's dots, in a bubble)
function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="flex items-center gap-1.5 bg-white border border-black/12 rounded-2xl rounded-bl-md px-3.5 py-3 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
        <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" />
        <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.15s" }} />
        <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.3s" }} />
      </div>
    </motion.div>
  );
}

function ChatBubble({ bubble }: { bubble: Bubble }) {
  const you = bubble.role === "you";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${you ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[84%] px-3.5 py-2.5 rounded-2xl font-[family-name:var(--font-jetbrains)] text-[13px] leading-relaxed whitespace-pre-wrap break-words shadow-[0_4px_14px_rgba(0,0,0,0.08)] ${
          you
            ? "bg-black text-white rounded-br-md"
            : "bg-white text-black/75 border border-black/12 rounded-bl-md lowercase"
        }`}
      >
        {bubble.text}
      </div>
    </motion.div>
  );
}

// A chip you can press — the receipt chips, made clickable.
function ChoiceChip({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-[family-name:var(--font-jetbrains)] text-xs leading-none whitespace-nowrap text-black bg-white border border-black/20 rounded-full px-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:bg-black hover:text-white hover:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// The sticker kit around the thread (desktop only, draggable like the hero's).
function Stickers() {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none [&>*]:pointer-events-auto">
      <Cutout src="/assets/stk-bolts.png" alt="" width={92} className="left-[4%] top-[6%]" />
      <Cutout src="/assets/stk-stars.png" alt="" width={100} className="right-[6%] top-[4%]" />

      {/* xyra, making the ask */}
      <Sticker className="right-[7%] top-[34%]" tilt={3}>
        <div className="w-[150px] bg-white border border-black/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed text-black/75 lowercase">so… you in?</p>
        </div>
      </Sticker>

      {/* the sign-off, on a torn scrap */}
      <Sticker className="left-[7%] top-[44%]" tilt={-6}>
        <TornSticker seed={73} jx={9} jy={10} style={{ width: 96, height: 56 }}>
          <div className="w-full h-full flex items-center justify-center font-[family-name:var(--font-jetbrains)] text-[11px] text-black/70 lowercase">dale.</div>
        </TornSticker>
      </Sticker>

      <Cutout src="/assets/stk-hearts.png" alt="" width={60} className="right-[12%] top-[64%]" />
      <Cutout src="/assets/stk-squiggle.png" alt="" width={78} className="left-[9%] top-[74%]" />
    </div>
  );
}

/* ── the conversation ───────────────────────────────────────────────────── */

export default function AlphaApply() {
  const sectionRef = useSectionView<HTMLElement>("alpha_apply");

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});
  const [payOk, setPayOk] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("asking");
  // busy = xyra is mid-sentence; sends wait for her (starts true: the opening
  // question hasn't landed yet, and a fast first send would render above it).
  const [busy, setBusy] = useState(true);
  const [input, setInput] = useState("");

  const idRef = useRef(0);
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const push = useCallback((role: Bubble["role"], text: string) => {
    setBubbles((prev) => [...prev, { id: ++idRef.current, role, text }]);
  }, []);

  // xyra says things one bubble at a time: dots first, then the line. The
  // read-gap scales with the previous line so it keeps a texting rhythm.
  const say = useCallback(
    async (lines: string[], firstDelay = 650) => {
      for (let i = 0; i < lines.length; i++) {
        setTyping(true);
        await sleep(i === 0 ? firstDelay : Math.min(320 + lines[i - 1].length * 8, 900));
        setTyping(false);
        push("xyra", lines[i]);
        await sleep(80);
      }
    },
    [push]
  );

  // The box never disables while xyra is typing (a fast typer can start the
  // next answer early — only the send waits); this just puts the caret back
  // after a step change, e.g. when the chips step hands back to text.
  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  // Opening line on mount (guarded: strict mode runs effects twice in dev).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      await say([STEPS[0].question], 500);
      setBusy(false);
      focusInput();
    })();
  }, [say, focusInput]);

  // Keep the newest bubble (and the composer under it) in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [bubbles, typing, phase]);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const sendText = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy || phase !== "asking" || step >= PAY_STEP) return;
    const s = STEPS[step];

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    push("you", text);
    setBusy(true);

    // Conversational validation: a bad email gets asked again, not a red box.
    if (s.key === "email" && !isValidEmail(text)) {
      track("alpha_apply_invalid_email");
      await say(["hm, that email looks off. one more time?"], 450);
      setBusy(false);
      focusInput();
      return;
    }

    if (step === 0) track("alpha_apply_start");
    track("alpha_apply_step", { step: s.key, step_index: step + 1 });
    setAnswers((prev) => ({ ...prev, [s.key]: text.slice(0, s.max) }));

    const ack = s.key === "name" ? [`hey ${firstName(text)}.`] : s.key === "email" ? ["noted."] : [];
    await say([...ack, STEPS[step + 1].question], 450);
    setStep(step + 1);
    setBusy(false);
    if (step + 1 < PAY_STEP) focusInput();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // enter sends; shift+enter makes a new line (the "why" can run long)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendText();
    }
  };

  // The $10 question — picking a chip IS the submit.
  const choosePay = async (ok: boolean, retry = false) => {
    if (busy) return;
    setBusy(true);
    setPayOk(ok);
    if (!retry) {
      push("you", ok ? "yes" : NO_LABEL);
      track("alpha_apply_step", { step: "payOk", step_index: PAY_STEP + 1, pay_ok: ok });
    }
    setPhase("submitting");
    setTyping(true);
    track("alpha_apply_submit", { pay_ok: ok, retry });

    try {
      const res = await fetch("/api/alpha-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: answers.name,
          whatsUp: answers.whatsUp,
          email: answers.email,
          why: answers.why,
          payOk: ok,
          visitor_id: getVisitorId() || undefined,
          first_touch: getFirstTouch(),
        }),
      });
      if (!res.ok) throw new Error(`alpha-apply ${res.status}`);
      setTyping(false);
      await say(
        [ok ? "dale. you're in the pile." : "fair. you're still in the pile.", `we'll be in touch soon. keep an eye on ${answers.email}.`],
        200
      );
      setPhase("done");
      track("alpha_apply_success", { pay_ok: ok, returning: res.status === 200 });
    } catch (err) {
      console.error(err);
      setTyping(false);
      await say(["hm, that didn't go through. give it another shot?"], 300);
      setPhase("error");
      track("alpha_apply_error", { pay_ok: ok });
    } finally {
      setBusy(false);
    }
  };

  const chipDone = (i: number) => (i < PAY_STEP ? i < step : payOk !== null && phase !== "error");
  const chipActive = (i: number) => phase === "asking" && i === step;

  return (
    <div className="xyra-canvas min-h-screen">
      {/* nav — the hero's, with a way back */}
      <div className="relative z-[70] flex items-center justify-between px-5 sm:px-8 h-12">
        <Link href="/" className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-black">
          xyra
        </Link>
        <Link
          href="/"
          onClick={() => track("cta_click", { cta_location: "apply_nav", button_label: "back" })}
          className="font-[family-name:var(--font-jetbrains)] text-xs text-black underline underline-offset-4 decoration-black/30 hover:decoration-black transition-all lowercase"
        >
          ← back
        </Link>
      </div>

      <main ref={sectionRef} className="relative max-w-6xl mx-auto px-6 sm:px-12 lg:px-20 pt-10 sm:pt-16 pb-28 min-h-[calc(100vh-3rem)]">
        <Stickers />

        <div className="relative z-20 max-w-[560px] mx-auto">
          {/* the ask — the form's own title + blurb */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl font-medium text-black leading-[1.05] tracking-tight"
          >
            join the xyra alpha squad
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-black/60 mt-3 max-w-md"
          >
            ready to help us build the future? apply here to snag an early spot and test out xyra before anyone else.
          </motion.p>

          {/* the receipt — fills in as you answer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap gap-1.5 mt-6"
            aria-label="progress"
          >
            {STEPS.map((s, i) => {
              const done = chipDone(i);
              const active = chipActive(i);
              return (
                <span
                  key={s.key}
                  className={`font-[family-name:var(--font-jetbrains)] text-[10px] leading-none whitespace-nowrap rounded-full px-2 py-1 border transition-colors duration-300 ${
                    done
                      ? "bg-black text-white border-black"
                      : active
                        ? "bg-white text-black border-black/40"
                        : "bg-white text-black/40 border-black/15"
                  }`}
                >
                  {done ? "✓" : "→"} {s.chip}
                </span>
              );
            })}
            {phase === "done" && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-[family-name:var(--font-jetbrains)] text-[10px] leading-none whitespace-nowrap rounded-full px-2 py-1 border bg-black text-white border-black"
              >
                ✓ applied
              </motion.span>
            )}
          </motion.div>

          {/* the thread */}
          <div className="mt-8 space-y-2.5">
            {bubbles.map((b) => (
              <ChatBubble key={b.id} bubble={b} />
            ))}
            {typing && <TypingBubble />}
          </div>

          {/* the composer */}
          <div className="mt-5">
            {phase === "asking" && step < PAY_STEP && (
              <form onSubmit={sendText}>
                <div className="flex items-end gap-2 p-1.5 rounded-[26px] border border-black/15 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] focus-within:border-black/40 transition-colors">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onInput={resizeInput}
                    onKeyDown={onKeyDown}
                    maxLength={STEPS[step].max}
                    placeholder={STEPS[step].placeholder}
                    inputMode={STEPS[step].key === "email" ? "email" : "text"}
                    autoCapitalize={STEPS[step].key === "email" ? "none" : "sentences"}
                    autoComplete={STEPS[step].key === "email" ? "email" : STEPS[step].key === "name" ? "name" : "off"}
                    aria-label={STEPS[step].question}
                    className="flex-1 min-w-0 resize-none bg-transparent px-4 py-2.5 font-[family-name:var(--font-jetbrains)] text-[16px] sm:text-sm text-black placeholder:text-black/35 focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    aria-label="send"
                    className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-black text-white hover:bg-black/85 transition-colors disabled:opacity-30"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
                <p className="font-[family-name:var(--font-jetbrains)] text-[10px] text-black/35 mt-3 lowercase">
                  enter to send · shift+enter for a new line
                </p>
              </form>
            )}

            {phase === "asking" && step === PAY_STEP && !typing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap justify-end gap-2">
                <ChoiceChip onClick={() => void choosePay(true)} disabled={busy}>yes</ChoiceChip>
                <ChoiceChip onClick={() => void choosePay(false)} disabled={busy}>{NO_LABEL}</ChoiceChip>
              </motion.div>
            )}

            {phase === "error" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap justify-end gap-2">
                <ChoiceChip onClick={() => void choosePay(payOk ?? true, true)} disabled={busy}>try again</ChoiceChip>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex justify-center pt-4">
                <Link
                  href="/"
                  onClick={() => track("cta_click", { cta_location: "apply_done", button_label: "back home" })}
                  className="inline-flex items-center px-7 py-3.5 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-sm tracking-wide hover:bg-black/85 transition-colors lowercase"
                >
                  back to xyra
                </Link>
              </motion.div>
            )}
          </div>

          {phase !== "done" && (
            <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 mt-8 lowercase">
              no spam. we&apos;ll only use this to reach you about the alpha.
            </p>
          )}

          <div ref={endRef} className="h-px" />
        </div>
      </main>
    </div>
  );
}
