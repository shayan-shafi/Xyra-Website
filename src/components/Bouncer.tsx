"use client";

import { motion } from "framer-motion";
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

// The opener sits PRE-FILLED in the composer — the visitor sends it themselves
// as a real first turn (no auto-play, no canned reply; Xyra answers live).
// Twin of SEED_USER in /api/bouncer/route.ts, which uses it to recognize
// return replays. Keep in sync.
const SEED_USER = "who are you and can you send me access?";

const JAMMED_LINE = "door's jammed for a sec — say that again?";

// Away this long → the thread visually resets on return and the scripted
// question replays as a REAL turn on the SAME session: Xyra sees the déjà vu
// in her transcript and gets to call it ("we're doing this again?") while
// still knowing everything (name, email, their mess). Quick reloads under the
// threshold restore the thread as-is — no LLM call, no burned turn.
const RETURN_AFTER_MS = 30 * 60 * 1000;

// Typing indicator — the app's chrome ("· · ·" in an assistant-style bordered
// bubble) at the door's tighter scale: a sliver, not a slab.
function TypingDots() {
  return (
    <div className="w-fit border border-[#2a2a2a] px-[12px] py-[7px]">
      <span className="font-[family-name:var(--font-jetbrains)] text-[13px] leading-[13px] tracking-[2px] text-[#a89e88] animate-pulse">
        · · ·
      </span>
    </div>
  );
}

export default function Bouncer({ overlapMode = false }: { overlapMode?: boolean }) {
  // The door is the FRONT PAGE now — everything fires on mount, no scroll
  // trigger. (The old useInView gate left the hero invisible until the first
  // scroll event, which a landing visitor hasn't made yet.)
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    track("bouncer_view");
    trackOncePerSession("section:waitlist", "section_view", { section_name: "waitlist" });
  }, []);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [doorState, setDoorState] = useState<DoorState>("open");
  // The composer opens pre-filled with the question — sending it is the
  // visitor's first move. (Resume clears it when restoring a live thread.)
  const [input, setInput] = useState(SEED_USER);
  const sessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The door stays CLOSED — an intro (what Xyra is + two CTAs) sits over the
  // video until the visitor clicks Join Beta. Landing straight in a live chat
  // wasn't clear (Shayan 2026-07-11). Returning mid-thread visitors skip it.
  const [opened, setOpened] = useState(false);
  const openDoor = useCallback(() => {
    setOpened(true);
    track("bouncer_open");
  }, []);

  // Resume a session across reloads. Away 30+ min → fresh screen, SAME
  // session, composer pre-filled again: they send the same question and Xyra
  // gets to call the déjà vu with everything still on file.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved?.bubbles) || saved.bubbles.length === 0) return;
      sessionIdRef.current = typeof saved.sessionId === "string" ? saved.sessionId : null;
      const away = Date.now() - (typeof saved.lastActiveAt === "number" ? saved.lastActiveAt : 0);
      if (sessionIdRef.current && away > RETURN_AFTER_MS) {
        return; // fresh screen, same session, input stays pre-filled
      }
      // Older sessions may hold retired "invite" ticket entries — drop them.
      setBubbles(saved.bubbles.filter((b: Bubble) => b?.kind === "bubble"));
      setDoorState(saved.doorState === "granted" || saved.doorState === "closed" ? saved.doorState : "open");
      setInput(""); // mid-thread — no pre-fill
      setOpened(true); // returning mid-thread → straight back into the chat
    } catch {
      /* fresh door */
    }
  }, []);

  const persist = useCallback((next: Bubble[], state: DoorState) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sessionId: sessionIdRef.current,
          bubbles: next.slice(-60),
          doorState: state,
          lastActiveAt: Date.now(),
        })
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

  // One real turn against /api/bouncer: dots, fetch, replies with the texting
  // rhythm, door-state updates. Shared by typed messages and the return replay.
  const postTurn = async (text: string) => {
    setSending(true);
    // Dots appear almost immediately — an instant "on it" signal while the
    // model thinks (that latency is the real wait; don't pad it further).
    setTimeout(() => setTyping(true), 120);
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

      // Reveal bubbles one at a time. The FIRST lands as soon as the reply is
      // ready (just enough for the dots to register); later bubbles get a short
      // read-gap scaled to the previous bubble's length — the texting rhythm
      // without the drag (was a flat 1100/1400ms stacked on top of LLM latency).
      for (let i = 0; i < replies.length; i++) {
        const gap = i === 0 ? 280 : Math.min(260 + replies[i - 1].length * 9, 750);
        await new Promise((r) => setTimeout(r, gap));
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
    pushBubbles([{ kind: "bubble", role: "user", content: text }]);
    track("bouncer_message_sent");
    await postTurn(text);
  };

  return (
    <section
      id="waitlist"
      className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0a] sm:bg-black z-[45]"
      style={overlapMode ? { marginTop: "-100vh" } : undefined}
    >
      {/* Video Background — desktop only; on phones the section is pure black chat */}
      <div className="hidden sm:block absolute inset-0 z-0">
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
      <div className="relative z-10 flex min-h-[100svh] flex-col justify-between px-0 pt-20 pb-0 sm:px-12 lg:px-20 sm:py-8">
        {/* Top: Section label inside the black bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoaded ? 1 : 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="hidden sm:flex items-center justify-center h-[8vh]"
        >
          <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.3em] uppercase text-white/50">
            Early Access
          </span>
        </motion.div>

        {/* Middle */}
        <div className="flex-1 flex items-center justify-center py-0 sm:py-10">
          {!opened ? (
            /* INTRO over the video: what Xyra is + the two CTAs. The chat only
               opens on Join Beta — landing straight in a live thread wasn't
               clear what to do (Shayan 2026-07-11). */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-2xl px-6 text-center"
            >
              <span className="font-[family-name:var(--font-jetbrains)] text-xs tracking-[0.3em] uppercase text-white/50">
                The waitlist is a conversation
              </span>
              <h1 className="mt-6 font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl md:text-6xl font-medium text-white leading-[1.05]">
                Meet Xyra.
              </h1>
              <p className="mx-auto mt-5 max-w-md font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-white/60 leading-relaxed">
                Text Xyra your life — tasks, workouts, plans, whatever&apos;s in your
                head — and it builds the dashboards to run everything. Getting in
                is a conversation.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={openDoor}
                  className="w-full sm:w-auto rounded-full bg-white px-9 py-3.5 font-[family-name:var(--font-jetbrains)] text-sm tracking-[0.1em] uppercase text-black transition-transform hover:scale-[1.03] active:scale-95"
                >
                  Join Beta
                </button>
                <a
                  href="#learn"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("learn")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="font-[family-name:var(--font-jetbrains)] text-sm text-white/60 underline-offset-8 transition-colors hover:text-white hover:underline"
                >
                  or click here to learn what Xyra is ↓
                </a>
              </div>
            </motion.div>
          ) : (
          <div className="max-w-xl w-full">
            {/* The door — the app's ChatPanel language (bg #0a0a0a, assistant =
                transparent + #2a2a2a hairline, user = solid white, mono
                lowercase, sharp corners) at a deliberately TIGHTER scale than
                the app's 18/14 bubble padding: at web size those metrics read
                as cards, not texts (Shayan, 2026-07-10). Phones get the screen
                full-bleed; desktop gets it inside a phone frame. */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="relative w-full sm:mx-auto sm:h-[78vh] sm:max-h-[760px] sm:w-auto sm:aspect-[574/1146]"
            >
              {/* The chat screen. Phones: full-bleed. Desktop: absolutely inset to
                  the transparent screen of the iPhone frame image that overlays it
                  below (insets measured from the PNG: 6.62% sides, ~2.9% top/bot). */}
              <div className="bg-[#0a0a0a] overflow-hidden w-full sm:w-auto sm:absolute sm:left-[6.62%] sm:right-[6.62%] sm:top-[2.88%] sm:bottom-[2.97%] sm:flex sm:flex-col sm:rounded-[1.6rem]">
              {/* Contact header — desktop phone-frame chrome only; on phones the
                  site navbar (Xyra logo + menu) is the header. pt clears the notch. */}
              <div className="hidden sm:flex flex-col items-center border-b border-[#1a1a1a] px-4 pt-9 pb-4">
                <span className="font-[family-name:var(--font-jetbrains)] text-sm lowercase text-white">
                  xyra
                </span>
              </div>

              {/* Messages — the app's thread */}
              <div
                ref={scrollRef}
                className="h-[calc(100svh-190px)] sm:h-auto sm:flex-1 sm:min-h-0 overflow-y-auto px-5 py-4 space-y-2.5 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {bubbles.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] px-[12px] py-[8px] font-[family-name:var(--font-jetbrains)] text-[13px] leading-[19px] lowercase ${
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
              <form onSubmit={sendMessage} className="flex items-center gap-3 border-t border-[#1a1a1a] px-5 py-3">
                <div className="flex flex-1 items-center gap-2 border-b-2 border-white pb-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={600}
                    disabled={doorState !== "open"}
                    onFocus={(e) => {
                      // iOS keyboard: once it finishes sliding up, re-pin the
                      // thread to the newest message and keep the composer in
                      // view instead of letting Safari pan the page apart.
                      const input = e.currentTarget;
                      setTimeout(() => {
                        const el = scrollRef.current;
                        if (el) el.scrollTop = el.scrollHeight;
                        input.scrollIntoView({ block: "center", behavior: "smooth" });
                      }, 300);
                    }}
                    placeholder={
                      doorState === "granted"
                        ? "xyra has your email — talk soon."
                        : doorState === "closed"
                          ? "come back tomorrow."
                          : sending
                            ? "thinking…"
                            : "type a message…"
                    }
                    className="flex-1 bg-transparent font-[family-name:var(--font-jetbrains)] text-[16px] sm:text-sm text-white placeholder:text-[#555] focus:outline-none disabled:opacity-50 lowercase"
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
              </div>

              {/* The real iPhone frame — desktop only. Sits ON TOP; its screen is
                  transparent so the chat shows through, and pointer-events-none so
                  it never eats a tap on the input. drop-shadow hugs the phone. */}
              <img
                src="/assets/iphone-frame.png"
                alt=""
                aria-hidden
                className="hidden sm:block pointer-events-none select-none absolute inset-0 h-full w-full drop-shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              />

              {/* First-run hint (desktop) — the composer opens pre-filled with
                  Xyra's question; a bouncing arrow at the send button makes it
                  obvious it's theirs to send. Gone the moment they send. */}
              {doorState === "open" && bubbles.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="pointer-events-none absolute hidden select-none items-center gap-2 whitespace-nowrap sm:flex"
                  style={{ left: "calc(100% + 14px)", bottom: "3.5%" }}
                >
                  <motion.svg
                    animate={{ x: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                    width="36"
                    height="20"
                    viewBox="0 0 36 20"
                    fill="none"
                    className="text-white/70"
                  >
                    <path
                      d="M35 10 H4 M11 3 L4 10 L11 17"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.svg>
                  <span className="font-[family-name:var(--font-jetbrains)] text-sm text-white/80">
                    click send to start
                  </span>
                </motion.div>
              )}
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-8 hidden sm:flex items-center justify-center gap-6 text-white/40"
            >
              <span className="font-[family-name:var(--font-jetbrains)] text-xs">No spam</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xs">Free beta</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xs">First in line if xyra likes you</span>
            </motion.div>
          </div>
          )}
        </div>

        {/* Bottom spacer for the black bar (desktop only) */}
        <div className="hidden sm:block h-[8vh]" />
      </div>
    </section>
  );
}
