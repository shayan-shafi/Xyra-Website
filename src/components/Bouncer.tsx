"use client";

import { motion, useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState, FormEvent } from "react";
import { getVisitorId, track, trackOncePerSession } from "@/lib/analytics";

// BOUNCER XYRA — the waitlist is a conversation. Xyra works the door: asks why
// you want in and what you'd track, pushes back on low effort, and when she's
// convinced, the TestFlight link drops right in the chat. Same voice as the
// app (lowercase texting, earned sass) — this is most people's first taste of it.
//
// All state lives server-side in bouncer_sessions via /api/bouncer; the client
// keeps only sessionId + rendered bubbles (localStorage, so a reload resumes).

// The close is pure conversation — she takes your name + email and says she'll
// reach out. No ticket, no link (the app isn't open yet), so bubbles are all
// there is.
type Bubble = { kind: "bubble"; role: "user" | "assistant"; content: string };

type DoorState = "open" | "granted" | "closed";

const STORAGE_KEY = "xyra:bouncer";

// Canned openers — deterministic, no LLM. One is picked per fresh session.
const OPENERS: string[][] = [
  ["i'm xyra. i work the door.", "everyone inside told me what they're actually building toward. so — why do you want in?"],
  ["so you found the door.", "there's no form. you're talking to me. what would you even track if i let you in?"],
  ["this is the waitlist. it's a conversation.", "convince me. what's the mess in your life that got you here?"],
];

const JAMMED_LINE = "door's jammed for a sec — say that again?";

// Typing indicator — the app's exact chrome: "· · ·" in an assistant-style
// bordered bubble (ChatPanel's typingDotsFooter), not generic bouncing dots.
function TypingDots() {
  return (
    <div className="w-fit border border-[#2a2a2a] px-[18px] py-[14px]">
      <span className="font-[family-name:var(--font-jetbrains)] text-base leading-4 tracking-[2px] text-[#a89e88] animate-pulse">
        · · ·
      </span>
    </div>
  );
}

export default function Bouncer({ overlapMode = false }: { overlapMode?: boolean }) {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const viewTrackedRef = useRef(false);
  useEffect(() => {
    if (isInView && !viewTrackedRef.current) {
      viewTrackedRef.current = true;
      track("bouncer_view");
      trackOncePerSession("section:waitlist", "section_view", { section_name: "waitlist" });
    }
  }, [isInView]);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [doorState, setDoorState] = useState<DoorState>("open");
  const [input, setInput] = useState("");
  const sessionIdRef = useRef<string | null>(null);
  const openedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resume a session across reloads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved?.bubbles) && saved.bubbles.length > 0) {
        sessionIdRef.current = typeof saved.sessionId === "string" ? saved.sessionId : null;
        // Older sessions may hold retired "invite" ticket entries — drop them.
        setBubbles(saved.bubbles.filter((b: Bubble) => b?.kind === "bubble"));
        setDoorState(saved.doorState === "granted" || saved.doorState === "closed" ? saved.doorState : "open");
        openedRef.current = true;
      }
    } catch {
      /* fresh door */
    }
  }, []);

  const persist = useCallback((next: Bubble[], state: DoorState) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessionId: sessionIdRef.current, bubbles: next.slice(-60), doorState: state })
      );
    } catch {
      /* storage unavailable — session just won't survive reload */
    }
  }, []);

  const pushBubbles = useCallback(
    (added: Bubble[], state?: DoorState) => {
      setBubbles((prev) => {
        const next = [...prev, ...added];
        persist(next, state ?? doorState);
        return next;
      });
      if (state) setDoorState(state);
    },
    [persist, doorState]
  );

  // Xyra opens when the section scrolls into view on a fresh session.
  useEffect(() => {
    if (!isInView || openedRef.current) return;
    openedRef.current = true;
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 900));
      if (cancelled) return;
      setTyping(true);
      for (let i = 0; i < opener.length; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 1100 : 1400));
        if (cancelled) return;
        pushBubbles([{ kind: "bubble", role: "assistant", content: opener[i] }]);
      }
      setTyping(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  // Keep the newest bubble in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles, typing]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || doorState !== "open") return;

    setInput("");
    setSending(true);
    pushBubbles([{ kind: "bubble", role: "user", content: text }]);
    track("bouncer_message_sent");

    // Let the send land before the dots appear — texting rhythm.
    setTimeout(() => setTyping(true), 350);

    try {
      const res = await fetch("/api/bouncer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current || undefined,
          message: text,
          visitor_id: getVisitorId() || undefined,
        }),
      });
      const data = await res.json();

      if (typeof data?.sessionId === "string") sessionIdRef.current = data.sessionId;
      const replies: string[] = Array.isArray(data?.messages) && data.messages.length > 0
        ? data.messages
        : [JAMMED_LINE];
      const nextState: DoorState = data?.granted
        ? "granted"
        : data?.closed || data?.rateLimited
          ? "closed"
          : "open";

      // Reveal bubbles one at a time, dots between beats.
      for (let i = 0; i < replies.length; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 1100 : 1400));
        const isLast = i === replies.length - 1;
        pushBubbles(
          [{ kind: "bubble", role: "assistant", content: replies[i] }],
          isLast && nextState !== "open" ? nextState : undefined
        );
      }

      if (data?.granted) {
        track("bouncer_granted");
      }
    } catch {
      await new Promise((r) => setTimeout(r, 800));
      pushBubbles([{ kind: "bubble", role: "assistant", content: JAMMED_LINE }]);
    } finally {
      setTyping(false);
      setSending(false);
    }
  };

  return (
    <section
      id="waitlist"
      className="relative min-h-screen w-full overflow-hidden bg-black z-[45]"
      style={overlapMode ? { marginTop: "-100vh" } : undefined}
      ref={sectionRef}
    >
      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/assets/xyra-waitlist-poster.jpg"
          className="h-full w-full object-cover"
          onLoadedData={() => setIsLoaded(true)}
        >
          <source src="/assets/xyra-waitlist-hq.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute top-0 left-0 right-0 h-[8%] bg-black z-[1]" />
        <div className="absolute bottom-0 left-0 right-0 h-[8%] bg-black z-[1]" />
      </div>

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between px-6 sm:px-12 lg:px-20 py-8">
        {/* Top: Section label inside the black bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isInView && isLoaded ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="flex items-center justify-center h-[8vh]"
        >
          <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.3em] uppercase text-white/50">
            Early Access
          </span>
        </motion.div>

        {/* Middle */}
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="max-w-xl w-full">
            {/* The door — a pixel-honest replica of the app's ChatPanel.
                Phones get the app screen full-bleed; desktop gets it inside a
                phone frame, like watching Xyra run. Colors/typography lifted
                from mobile ChatPanel.tsx (bg #0a0a0a, assistant = transparent
                + #2a2a2a hairline, user = solid white, mono 14px lowercase,
                sharp corners). */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="bg-[#0a0a0a] overflow-hidden -mx-6 sm:mx-auto sm:max-w-[390px] sm:rounded-[2.75rem] sm:border sm:border-white/20 sm:shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            >
              {/* Contact header — like opening a thread with her */}
              <div className="relative flex flex-col items-center border-b border-[#1a1a1a] px-4 pt-5 pb-3 sm:pt-6">
                <span className="font-[family-name:var(--font-jetbrains)] text-sm lowercase text-white">
                  xyra
                </span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[10px] lowercase text-[#666] mt-0.5">
                  {doorState === "granted" ? "has your number" : doorState === "closed" ? "left the door" : "at the door"}
                </span>
                <span
                  className={`absolute right-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                    doorState === "granted" ? "bg-emerald-400" : doorState === "closed" ? "bg-red-400/80" : "bg-white/50 animate-pulse"
                  }`}
                />
              </div>

              {/* Messages — the app's thread */}
              <div ref={scrollRef} className="h-[62vh] max-h-[560px] sm:h-[min(600px,64vh)] sm:max-h-none overflow-y-auto px-5 py-4 space-y-3.5 scroll-smooth">
                {bubbles.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] px-[18px] py-[14px] font-[family-name:var(--font-jetbrains)] text-sm leading-5 lowercase ${
                        b.role === "user"
                          ? "bg-white text-black"
                          : "border border-[#2a2a2a] text-white"
                      }`}
                    >
                      {b.content}
                    </div>
                  </motion.div>
                ))}
                {typing && <TypingDots />}
              </div>

              {/* Composer — the app's editorial text bar: underline input + circular send */}
              <form onSubmit={sendMessage} className="flex items-center gap-3 border-t border-[#1a1a1a] px-5 py-4">
                <div className="flex flex-1 items-center gap-2 border-b-2 border-white pb-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={600}
                    disabled={doorState !== "open"}
                    placeholder={
                      doorState === "granted"
                        ? "she has your email — talk soon."
                        : doorState === "closed"
                          ? "come back tomorrow."
                          : sending
                            ? "thinking…"
                            : "type a message…"
                    }
                    className="flex-1 bg-transparent font-[family-name:var(--font-jetbrains)] text-sm text-white placeholder:text-[#555] focus:outline-none disabled:opacity-50 lowercase"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim() || doorState !== "open"}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:opacity-30 transition-opacity"
                    aria-label="Send"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-8 flex items-center justify-center gap-6 text-white/40"
            >
              <span className="font-[family-name:var(--font-jetbrains)] text-xs">No spam</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xs">Free beta</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xs">First in line if she likes you</span>
            </motion.div>
          </div>
        </div>

        {/* Bottom spacer for the black bar */}
        <div className="h-[8vh]" />
      </div>
    </section>
  );
}
