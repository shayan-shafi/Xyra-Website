"use client";

// ─── DesktopHero ─────────────────────────────────────────────────────────────
// Xyra's hero canvas: a conversation with your life scattered around it.
// The scatter-canvas + hover-focus interaction was inspired by heyclicky.com,
// but the metaphor here is Xyra's own — this is NOT a mac desktop. Everything
// floating on the canvas is a real product artifact: lowercase chat bubbles,
// receipt chips, phone-framed screen recordings, a hold-to-talk mic pill, a
// typing indicator. Center stack = wordmark → one-liner → email-only waitlist
// pill. The demo sits at the bottom as a rich message card from xyra.
// Xyra design language: Playfair display, EB Garamond prose, JetBrains Mono
// chips, black/white, rounded-soft.

import { useEffect, useRef, useState, FormEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { getFirstTouch, getVisitorId, track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";

// faint "+" builder grid — reads as a canvas being built on, not graph paper
const PLUS_GRID =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='30' height='30'%3E%3Cpath d='M15 12v6M12 15h6' stroke='rgba(0,0,0,0.07)' stroke-width='1'/%3E%3C/svg%3E\")";

/* ── floaters (draggable, hover = focus) ────────────────────────────────── */

type FloaterProps = {
  id: string;
  caption?: string; // lowercase chip caption under the floater
  className?: string;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  onOpen?: () => void; // click/tap → open big (framer onTap won't fire after a drag)
  children: ReactNode;
};

// A draggable canvas artifact. Hover → it goes active (scales up, video
// plays), every other floater fades way out.
function Floater({ id, caption, className = "", activeId, setActiveId, onOpen, children }: FloaterProps) {
  const isActive = activeId === id;
  const isDimmed = activeId !== null && !isActive;

  return (
    <motion.div
      drag
      dragMomentum={false}
      onHoverStart={() => setActiveId(id)}
      onHoverEnd={() => setActiveId(null)}
      onTap={onOpen}
      animate={{ opacity: isDimmed ? 0.05 : 1, scale: isActive ? 1.1 : 1 }}
      transition={{ opacity: { duration: 0.35 }, scale: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      className={`absolute select-none ${onOpen ? "cursor-pointer" : "cursor-grab"} active:cursor-grabbing ${isActive ? "z-[60]" : "z-10"} ${className}`}
    >
      <div className="flex flex-col items-center gap-2">
        {children}
        {caption && (
          <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/45 leading-none whitespace-nowrap">
            {caption}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// iPhone-style frame — Xyra lives on your phone, so screens float in phones.
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] bg-black p-[5px] shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
      <div className="relative rounded-[23px] overflow-hidden bg-black">
        {/* dynamic island */}
        <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[40px] h-[11px] bg-black rounded-full z-10" />
        {children}
      </div>
    </div>
  );
}

// Video that plays while its floater is active, pauses otherwise.
function HoverVideo({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [active]);

  return (
    <video
      ref={ref}
      loop
      muted
      playsInline
      preload="metadata"
      className="block w-full h-auto pointer-events-none"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

/* ── decor: real product artifacts, draggable ───────────────────────────── */

function Decor({
  id,
  className = "",
  tilt = 0,
  activeId,
  children,
}: {
  id: string;
  className?: string;
  tilt?: number; // degrees — inner div so framer's drag transform doesn't clobber it
  activeId: string | null;
  children: ReactNode;
}) {
  const isDimmed = activeId !== null && activeId !== id;
  return (
    <motion.div
      drag
      dragMomentum={false}
      animate={{ opacity: isDimmed ? 0.05 : 1 }}
      transition={{ duration: 0.35 }}
      className={`absolute z-10 select-none cursor-grab active:cursor-grabbing ${className}`}
    >
      <div style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>{children}</div>
    </motion.div>
  );
}

// Photos-app-style flower icon (our own SVG — 8 translucent petals) on a
// white app-icon tile. Clicking it opens the camera-roll collage.
function PhotosIcon() {
  const petals = [
    "#ff3b30", "#ff9500", "#ffcc00", "#34c759",
    "#00c7be", "#007aff", "#af52de", "#ff2d55",
  ];
  return (
    <div className="w-16 h-16 rounded-[16px] bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] border border-black/5 flex items-center justify-center">
      <svg viewBox="0 0 64 64" className="w-12 h-12">
        {petals.map((c, i) => (
          <ellipse
            key={c}
            cx="32"
            cy="17"
            rx="8.5"
            ry="13"
            fill={c}
            fillOpacity="0.72"
            transform={`rotate(${i * 45} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="2.6" fill="#fff" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

// Destination chip — the app's receipt chips, verbatim energy.
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-jetbrains)] text-[10px] leading-none text-black/60 bg-white border border-black/15 rounded-full px-2 py-1">
      {children}
    </span>
  );
}

/* ── nav ────────────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <div className="absolute top-0 inset-x-0 z-[70] flex items-center justify-between px-5 sm:px-8 h-12">
      <div className="flex items-baseline gap-5">
        <span className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-black">
          xyra
        </span>
        {/* blog link hidden until the blog is ready — route still exists at /blog */}
        <a
          href="#learn"
          onClick={() => track("cta_click", { cta_location: "hero_nav", button_label: "what is xyra" })}
          className="hidden sm:block font-[family-name:var(--font-jetbrains)] text-xs text-black/50 hover:text-black transition-colors"
        >
          what is xyra?
        </a>
      </div>

      <a
        href="#join"
        onClick={() => track("cta_click", { cta_location: "hero_nav", button_label: "join beta" })}
        className="font-[family-name:var(--font-jetbrains)] text-xs text-black underline underline-offset-4 decoration-black/30 hover:decoration-black transition-all"
      >
        join the beta
      </a>
    </div>
  );
}

/* ── email-only waitlist form ───────────────────────────────────────────── */

type FormStatus = "idle" | "loading" | "done" | "exists" | "error";

function EmailForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    track("waitlist_email_submit", { form: "desktop_hero" });

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          visitor_id: getVisitorId() || undefined,
          first_touch: getFirstTouch(),
        }),
      });

      if (res.status === 201) {
        setStatus("done");
        track("waitlist_email_success", { form: "desktop_hero" });
      } else if (res.status === 200) {
        setStatus("exists");
        track("waitlist_email_duplicate", { form: "desktop_hero" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "done" || status === "exists") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="font-[family-name:var(--font-playfair)] text-2xl text-black">
          {status === "done" ? "you're on the list." : "you're already on the list."}
        </p>
        <p className="font-[family-name:var(--font-eb-garamond)] text-base text-black/50 mt-1.5">
          we&apos;ll text you when xyra is ready for you.
        </p>
      </motion.div>
    );
  }

  return (
    // pointer-events-auto here (not on the full-width wrapper) so the dead
    // space beside the pill stays click-through for dragging floaters
    <form onSubmit={submit} className="w-full max-w-md pointer-events-auto">
      <div className="flex items-center gap-2 p-1.5 rounded-full border border-black/15 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.08)] focus-within:border-black/40 transition-colors">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          autoCapitalize="none"
          className="flex-1 min-w-0 bg-transparent px-4 py-2.5 font-[family-name:var(--font-jetbrains)] text-sm text-black placeholder:text-black/35 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="shrink-0 px-5 py-2.5 bg-black text-white rounded-full font-[family-name:var(--font-jetbrains)] text-xs tracking-wide hover:bg-black/85 transition-colors disabled:opacity-60"
        >
          {status === "loading" ? "joining..." : "join the waitlist"}
        </button>
      </div>
      {status === "error" && (
        <p className="font-[family-name:var(--font-eb-garamond)] text-sm text-red-500 text-center mt-3">
          something went wrong. please try again.
        </p>
      )}
    </form>
  );
}

/* ── the hero ───────────────────────────────────────────────────────────── */

export default function DesktopHero() {
  const sectionRef = useSectionView<HTMLElement>("desktop_hero");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [lightbox, setLightbox] = useState<{ kind: "video" | "image"; src: string } | null>(null);
  const demoRef = useRef<HTMLVideoElement>(null);

  const openLightbox = (kind: "video" | "image", src: string, label: string) => {
    track("cta_click", { cta_location: "desktop_hero", button_label: `floater_open_${label}` });
    setLightbox({ kind, src });
  };

  const playDemo = () => {
    const v = demoRef.current;
    if (!v) return;
    track("cta_click", { cta_location: "desktop_hero", button_label: "play demo" });
    v.muted = false;
    v.play().catch(() => {});
    setDemoPlaying(true);
  };

  return (
    <section
      ref={sectionRef}
      id="waitlist"
      className="relative w-full overflow-hidden bg-[#fbfaf8]"
      style={{ backgroundImage: PLUS_GRID, backgroundSize: "30px 30px" }}
    >
      <Nav />

      {/* ── floating phone screens (desktop only) ── */}

      {/* braindump recording — upper left. Landscape video, so it gets the
          video-message card (a phone frame reads wrong on landscape). */}
      <Floater
        id="braindump"
        caption="the 2am braindump"
        className="hidden md:block left-[4%] top-[8%] w-[190px] lg:w-[210px]"
        activeId={activeId}
        setActiveId={setActiveId}
        onOpen={() => openLightbox("video", "/assets/braindump-demo.mp4", "braindump")}
      >
        <div className="w-full rounded-2xl rounded-tl-md overflow-hidden border border-black/10 bg-black shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <HoverVideo src="/assets/braindump-demo.mp4" active={activeId === "braindump"} />
        </div>
      </Floater>

      {/* day in the life — landscape, framed as a video message from xyra */}
      <Floater
        id="dayinlife"
        caption="a day with xyra"
        className="hidden md:block right-[8%] top-[10.5%] w-[195px] lg:w-[220px]"
        activeId={activeId}
        setActiveId={setActiveId}
      >
        <div className="w-full rounded-2xl rounded-tr-md overflow-hidden border border-black/10 bg-black shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <HoverVideo src="/assets/xyra-day-in-life-2-compressed.mp4" active={activeId === "dayinlife"} />
        </div>
      </Floater>

      {/* self insights — right edge, between the video message and the tasks phone */}
      <Floater
        id="learn-urself"
        caption="learn about urself"
        className="hidden lg:block right-[3.5%] top-[29%] w-[105px]"
        activeId={activeId}
        setActiveId={setActiveId}
      >
        <PhoneFrame>
          <HoverVideo src="/assets/learn-about-urself.mp4" active={activeId === "learn-urself"} />
        </PhoneFrame>
      </Floater>

      {/* second brain — lower left, flanking the demo */}
      <Floater
        id="brain"
        caption="your second brain"
        className="hidden lg:block left-[3%] top-[46%] w-[150px]"
        activeId={activeId}
        setActiveId={setActiveId}
      >
        <PhoneFrame>
          <HoverVideo src="/assets/brain-demo.mp4" active={activeId === "brain"} />
        </PhoneFrame>
      </Floater>

      {/* tasks screen — lower right, flanking the demo */}
      <Floater
        id="tasks"
        caption="it tracks everything"
        className="hidden lg:block right-[13%] top-[48%] w-[135px]"
        activeId={activeId}
        setActiveId={setActiveId}
      >
        <PhoneFrame>
          <HoverVideo src="/assets/it-tracks-everything.mp4" active={activeId === "tasks"} />
        </PhoneFrame>
      </Floater>

      {/* camera roll — the ppl building it. click → collage */}
      <Floater
        id="camera-roll"
        caption="camera roll"
        className="hidden md:block left-[20%] top-[6%]"
        activeId={activeId}
        setActiveId={setActiveId}
        onOpen={() => openLightbox("image", "/assets/xyra-camera-roll.jpg", "camera_roll")}
      >
        <PhotosIcon />
      </Floater>

      {/* ── decor: the conversation, scattered (desktop only) ── */}

      {/* you, dumping your week */}
      <Decor id="dump-bubble" className="hidden md:block left-[5.5%] top-[29%]" tilt={-3} activeId={activeId}>
        <div className="w-[195px]">
          <div className="bg-black text-white rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
            <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed lowercase">
              gym at 6, dentist tues, mom&apos;s bday next week, need to eat better
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 mt-2">
            <Chip>→ schedule</Chip>
            <Chip>→ birthdays</Chip>
            <Chip>→ diet</Chip>
          </div>
        </div>
      </Decor>

      {/* xyra, replying */}
      <Decor id="reply-bubble" className="hidden md:block right-[26.5%] top-[14%]" tilt={2} activeId={activeId}>
        <div className="w-[150px] bg-white border border-black/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed text-black/75 lowercase">
            on it. built your week.
          </p>
        </div>
      </Decor>

      {/* xyra is typing… */}
      <Decor id="typing" className="hidden lg:block left-[24%] top-[34%]" activeId={activeId}>
        <div className="flex items-center gap-1.5 bg-white border border-black/12 rounded-full px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.15s" }} />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.3s" }} />
        </div>
      </Decor>

      {/* hold-to-talk mic pill — the wispr pill energy */}
      <Decor id="mic" className="hidden lg:block left-[26%] top-[16%]" tilt={-2} activeId={activeId}>
        <div className="flex items-center gap-2.5 bg-black text-white rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
          </svg>
          <span className="flex items-end gap-[2.5px] h-3.5">
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.12s" }} />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.24s" }} />
            <span className="xyra-wave-bar w-[2.5px] bg-white/80 rounded-full" style={{ animationDelay: "0.36s" }} />
          </span>
          <span className="font-[family-name:var(--font-jetbrains)] text-[10px] text-white/70 lowercase">
            hold to talk
          </span>
        </div>
      </Decor>

      {/* logo sticker */}
      <Decor id="logo-sticker" className="hidden lg:block left-[16%] top-[53%]" tilt={8} activeId={activeId}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/xyra-logo-square.png" alt="" className="w-9 h-9 opacity-80" />
      </Decor>

      {/* stray receipt chips — dashboards being born */}
      <Decor id="chips" className="hidden lg:block right-[25%] top-[30%]" tilt={3} activeId={activeId}>
        <div className="flex flex-col items-start gap-1.5">
          <Chip>→ finances</Chip>
          <Chip>→ workouts</Chip>
          <Chip>→ reminders</Chip>
        </div>
      </Decor>

      {/* ── center stack ── */}
      {/* pointer-events-none so the full-width column doesn't block hover/drag
          on the floaters behind it; re-enabled per interactive child. */}
      <div className="relative z-30 flex flex-col items-center px-6 pt-24 md:pt-28 pointer-events-none">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="font-[family-name:var(--font-playfair)] text-[64px] sm:text-[84px] md:text-[96px] font-medium text-black leading-none tracking-tight"
        >
          xyra
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-black/60 mt-4 text-center max-w-md"
        >
          the outlet for your ambitious mind
        </motion.p>

        <motion.div
          id="join"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="mt-8 w-full flex flex-col items-center scroll-mt-24"
        >
          <EmailForm />
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 mt-4">
            free beta · no spam · early access
          </p>
        </motion.div>

        {/* ── the demo, as a rich message card from xyra ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative z-30 w-full max-w-3xl mt-12 md:mt-16 mb-[-1px] pointer-events-auto"
        >
          <div className="rounded-t-3xl border border-b-0 border-black/12 bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.08)] overflow-hidden">
            {/* sender row — a text from xyra */}
            <div className="flex items-center gap-2.5 px-4 py-3">
              <span className="w-7 h-7 rounded-full border border-black/10 bg-white flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/xyra-logo-square.png" alt="" className="w-[18px] h-[18px]" />
              </span>
              <span className="font-[family-name:var(--font-jetbrains)] text-xs text-black">xyra</span>
              <span className="font-[family-name:var(--font-jetbrains)] text-[11px] text-black/35">now</span>
              <span className="ml-auto font-[family-name:var(--font-jetbrains)] text-[11px] text-black/45 lowercase">
                watch what happens when you text me your day
              </span>
            </div>
            <div className="relative bg-black mx-1.5 mb-1.5 rounded-2xl overflow-hidden">
              <video
                ref={demoRef}
                loop
                playsInline
                muted
                controls={demoPlaying}
                preload="metadata"
                poster="/assets/xyra-demo-poster.jpg"
                className="block w-full h-auto"
                onClick={() => !demoPlaying && playDemo()}
              >
                <source src="/assets/xyra-demo-compressed.mp4" type="video/mp4" />
              </video>
              {!demoPlaying && (
                <button
                  onClick={playDemo}
                  className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                  aria-label="Play demo video"
                >
                  <span className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-black/70 backdrop-blur-sm text-white font-[family-name:var(--font-jetbrains)] text-sm group-hover:bg-black/85 group-hover:scale-105 transition-all duration-300">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    play the demo
                  </span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* credit where it's due */}
      <a
        href="https://heyclicky.com"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 left-5 z-[40] font-[family-name:var(--font-jetbrains)] text-[10px] text-black/30 hover:text-black/60 transition-colors lowercase"
      >
        homepage inspo: shoutout heyclicky ♡
      </a>

      {/* ── floater lightbox — click a phone, watch it big (with sound) ── */}
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(null);
          }}
        >
          <div className="relative max-h-[85vh] max-w-[92vw] rounded-[32px] overflow-hidden bg-black shadow-2xl">
            {lightbox.kind === "video" ? (
              <video autoPlay controls playsInline className="h-[85vh] w-auto max-w-full object-contain">
                <source src={lightbox.src} type="video/mp4" />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lightbox.src} alt="" className="block max-h-[85vh] w-auto max-w-full object-contain" />
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
              aria-label="Close video"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
