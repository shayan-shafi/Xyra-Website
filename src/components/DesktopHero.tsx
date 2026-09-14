"use client";

// ─── DesktopHero ─────────────────────────────────────────────────────────────
// Xyra's hero canvas: a conversation with your life scattered around it.
// The scatter-canvas + hover-focus interaction was inspired by heyclicky.com,
// but the metaphor here is Xyra's own — this is NOT a mac desktop. Everything
// floating on the canvas is a real product artifact: lowercase chat bubbles,
// receipt chips, phone-framed screen recordings, a hold-to-talk mic pill, a
// typing indicator. Center stack = wordmark → one-liner → THE PHONE: a
// center-stage iPhone running the app's chat surface. That phone is the stage
// running the scripted loop in hero/PhoneScene.tsx (greet → braindump →
// routing preview → receipt → dashboards → To-Do → Workout; the brain beat is
// next). The screen renders at the app's native 390pt width and is scaled to
// fit, so everything inside uses the app's real pixel values. The demo video lives in
// the "a day with xyra" floater (click → plays big, with sound).
// Xyra design language: Playfair display, EB Garamond prose, JetBrains Mono
// chips, black/white, rounded-soft.

import { useEffect, useRef, useState, CSSProperties, FormEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import { getFirstTouch, getVisitorId, track } from "@/lib/analytics";
import { useSectionView } from "@/lib/useSectionView";
import PhoneScene, { SCREEN_W, SCREEN_H } from "./hero/PhoneScene";
import { TornSticker } from "./hero/TornSticker";

// The warm "+" grid backdrop is page-level now (.xyra-canvas in globals.css)
// so it runs unbroken past the hero.

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

/* ── the center-stage phone ─────────────────────────────────────────────── */

// The app's logical iPhone canvas (SCREEN_W × SCREEN_H, from PhoneScene) is
// authored at the app's 390pt width and scaled to whatever the frame's screen
// cutout measures; the height follows the frame image's screen aspect (358:761).

// /assets/iphone-15-frame.png — a real iPhone 15 Pro render (Shayan's pick,
// 2026-09-12) with the screen cut to transparent and the drop shadow turned
// into alpha so it composites on the warm canvas. Measured in image px:
//   image 598×917 · phone body 394×798 at (0,0) · screen 358×761 at (19,17)
// The container is the phone BODY box (the shadow overflows right + bottom);
// the screen content sits in a cutout-aligned div underneath the PNG, padded
// PAD px outward so it also sits under the bezel's anti-aliased inner edge.
const FRAME = {
  src: "/assets/iphone-15-frame.png",
  img: { w: 598, h: 917 },
  body: { w: 394, h: 798 },
  screen: { x: 19, y: 17, w: 358, h: 761 },
};
const PAD = 2;
const pct = (n: number, d: number) => `${(n / d) * 100}%`;

function HeroPhone({ children }: { children: ReactNode }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / SCREEN_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { body, screen, img } = FRAME;
  const outerW = screen.w + PAD * 2;
  const outerH = screen.h + PAD * 2;
  // CSS px per frame-image px. The cutout's corner radius measures ~45 image
  // px and the body's outer corner ~60; rounding the content rect at 40 keeps
  // its corners under the bezel while still covering the whole cutout.
  const imgPx = (scale * SCREEN_W) / screen.w;

  return (
    <div className="relative h-[min(680px,66vh)]" style={{ aspectRatio: `${body.w} / ${body.h}` }}>
      {/* screen content — under the frame, aligned to its cutout */}
      <div
        className="absolute overflow-hidden bg-black"
        style={{
          left: pct(screen.x - PAD, body.w),
          top: pct(screen.y - PAD, body.h),
          width: pct(outerW, body.w),
          height: pct(outerH, body.h),
          borderRadius: 40 * imgPx,
        }}
      >
        <div
          ref={screenRef}
          className="absolute"
          style={{
            left: pct(PAD, outerW),
            top: pct(PAD, outerH),
            width: pct(screen.w, outerW),
            height: pct(screen.h, outerH),
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
      </div>
      {/* the frame on top — bezel, dynamic island, buttons, shadow */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={FRAME.src}
        alt=""
        draggable={false}
        className="absolute top-0 left-0 max-w-none pointer-events-none select-none"
        style={{ width: pct(img.w, body.w), height: pct(img.h, body.h) }}
      />
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
  style,
  tilt = 0,
  activeId,
  children,
}: {
  id: string;
  className?: string;
  style?: CSSProperties; // at-rest left/top when they come from data, not a class
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
      style={style}
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

// Destination chip — the app's receipt chips, verbatim energy. (Shared with the
// vent section's stickers.)
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="font-[family-name:var(--font-jetbrains)] text-[10px] leading-none whitespace-nowrap text-black/60 bg-white border border-black/15 rounded-full px-2 py-1">
      {children}
    </span>
  );
}

// Connectors, torn into four scraps (Shayan's crops, 2026-09-12), laid in a
// row at rest: "coming soon" text · wearables + microsoft · school + google +
// health · notion + bank + luma + contacts. Each scrap is its own draggable
// decor item so they can be pulled apart one at a time. w/h fit each image's
// aspect with a 7px paper margin.
export const CONNECTOR_SCRAPS = [
  { src: "/assets/connectors-1.png", alt: "connectors coming soon", seed: 7, w: 74, h: 61, rotate: -5, left: "3%", top: "42.5%" },
  { src: "/assets/connectors-2.png", alt: "oura, whoop, outlook, teams", seed: 19, w: 62, h: 75, rotate: 4, left: "8%", top: "41%" },
  { src: "/assets/connectors-3.png", alt: "canvas, google calendar, apple health, google drive", seed: 29, w: 58, h: 77, rotate: -3, left: "12.3%", top: "41.8%" },
  { src: "/assets/connectors-4.png", alt: "notion, bank of america, luma, contacts", seed: 43, w: 72, h: 67, rotate: 5, left: "16.3%", top: "41.6%" },
];

/* ── nav ────────────────────────────────────────────────────────────────── */

const TEST_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeV8Eky5rWqVz9LWXd9bTVzm-Pei3F7HxikHe4EC7iqUbFN_A/viewform?usp=header";

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
        href={TEST_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("cta_click", { cta_location: "hero_nav", button_label: "apply to test it" })}
        className="font-[family-name:var(--font-jetbrains)] text-xs text-black underline underline-offset-4 decoration-black/30 hover:decoration-black transition-all"
      >
        apply to test it
      </a>
    </div>
  );
}

/* ── email-only waitlist form ───────────────────────────────────────────── */

type FormStatus = "idle" | "loading" | "done" | "exists" | "error";

// Parked: the waitlist pill is off the hero for now (the phone took center
// stage). Kept intact so it can come back with one line.
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
// At-rest positions = Shayan's hand-dragged arrangement (2026-09-12), read off
// a 1600px-wide viewport: left/right in % of width, top in % of the section.
// Left-side items anchor left, right-side items anchor right, so the canvas
// spreads symmetrically around the center phone on wider screens.

export default function DesktopHero() {
  const sectionRef = useSectionView<HTMLElement>("desktop_hero");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ kind: "video" | "image"; src: string } | null>(null);

  const openLightbox = (kind: "video" | "image", src: string, label: string) => {
    track("cta_click", { cta_location: "desktop_hero", button_label: `floater_open_${label}` });
    setLightbox({ kind, src });
  };

  return (
    <section
      ref={sectionRef}
      id="waitlist"
      className="relative w-full min-h-screen overflow-hidden"
    >
      <Nav />

      {/* ── floating phone screens (desktop only) ── */}

      {/* braindump recording (Sofia's CapCut cut, 2026-09-14) — left, above the
          dump bubble. Landscape, so it gets the video-message card. Hover plays
          the muted 360p preview; click opens the 720p cut with sound. */}
      <Floater
        id="braindump"
        caption="the 2am braindump"
        className="hidden md:block left-[4%] top-[15.5%] w-[190px] lg:w-[210px]"
        activeId={activeId}
        setActiveId={setActiveId}
        onOpen={() => openLightbox("video", "/assets/sofia-braindump.mp4", "braindump")}
      >
        <div className="w-full rounded-2xl rounded-tl-md overflow-hidden border border-black/10 bg-black shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <HoverVideo src="/assets/sofia-braindump-preview.mp4" active={activeId === "braindump"} />
        </div>
      </Floater>

      {/* a day with xyra — this IS the demo now. Hover previews the light
          day-in-life clip; click plays the full demo big, with sound (it used
          to sit under the wordmark as a message card). */}
      <Floater
        id="dayinlife"
        caption="a day with xyra"
        className="hidden md:block right-[4.8%] top-[35%] w-[195px] lg:w-[220px]"
        activeId={activeId}
        setActiveId={setActiveId}
        onOpen={() => openLightbox("video", "/assets/xyra-demo-compressed.mp4", "day_with_xyra")}
      >
        <div className="w-full rounded-2xl rounded-tr-md overflow-hidden border border-black/10 bg-black shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
          <HoverVideo src="/assets/xyra-day-in-life-2-compressed.mp4" active={activeId === "dayinlife"} />
        </div>
      </Floater>

      {/* self insights — top right */}
      <Floater
        id="learn-urself"
        caption="learn about urself"
        className="hidden lg:block right-[16.4%] top-[6.2%] w-[105px]"
        activeId={activeId}
        setActiveId={setActiveId}
      >
        <PhoneFrame>
          <HoverVideo src="/assets/learn-about-urself.mp4" active={activeId === "learn-urself"} />
        </PhoneFrame>
      </Floater>

      {/* second brain — left of the center phone */}
      <Floater
        id="brain"
        caption="your second brain"
        className="hidden lg:block left-[23.8%] top-[31.4%] w-[150px]"
        activeId={activeId}
        setActiveId={setActiveId}
      >
        <PhoneFrame>
          <HoverVideo src="/assets/brain-demo.mp4" active={activeId === "brain"} />
        </PhoneFrame>
      </Floater>

      {/* tasks screen — lower right of the center phone */}
      <Floater
        id="tasks"
        caption="it tracks everything"
        className="hidden lg:block right-[20.8%] top-[58.7%] w-[135px]"
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
        className="hidden md:block left-[26.8%] top-[10.4%]"
        activeId={activeId}
        setActiveId={setActiveId}
        onOpen={() => openLightbox("image", "/assets/xyra-camera-roll.jpg", "camera_roll")}
      >
        <PhotosIcon />
      </Floater>

      {/* ── decor: the conversation, scattered (desktop only) ── */}

      {/* you, dumping your week */}
      <Decor id="dump-bubble" className="hidden md:block left-[2.2%] top-[67%]" tilt={-3} activeId={activeId}>
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
      <Decor id="reply-bubble" className="hidden md:block right-[32.7%] top-[6.2%]" tilt={2} activeId={activeId}>
        <div className="w-[150px] bg-white border border-black/12 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] leading-relaxed text-black/75 lowercase">
            on it. built your week.
          </p>
        </div>
      </Decor>

      {/* xyra is typing… */}
      <Decor id="typing" className="hidden lg:block right-[9.1%] top-[69%]" activeId={activeId}>
        <div className="flex items-center gap-1.5 bg-white border border-black/12 rounded-full px-3.5 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.08)]">
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.15s" }} />
          <span className="xyra-typing-dot w-1.5 h-1.5 rounded-full bg-black/40" style={{ animationDelay: "0.3s" }} />
        </div>
      </Decor>

      {/* hold-to-talk mic pill — the wispr pill energy */}
      <Decor id="mic" className="hidden lg:block left-[26.8%] top-[79%]" tilt={-2} activeId={activeId}>
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

      {/* connectors — coming soon, as four small ripped scraps. One Decor each
          so every scrap drags on its own; multiply-blend drops each crop's
          white into the paper. Positions come from CONNECTOR_SCRAPS. */}
      {CONNECTOR_SCRAPS.map((c) => (
        <Decor key={c.src} id={`connector-${c.seed}`} className="hidden lg:block" style={{ left: c.left, top: c.top }} activeId={activeId}>
          <TornSticker seed={c.seed} jx={9} jy={9} rotate={c.rotate} style={{ width: c.w, height: c.h }} innerStyle={{ padding: 7 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.src} alt={c.alt} className="block w-full h-auto" style={{ mixBlendMode: "multiply" }} draggable={false} />
          </TornSticker>
        </Decor>
      ))}

      {/* stray receipt chips — dashboards being born */}
      <Decor id="chips" className="hidden lg:block right-[27.2%] top-[36.2%]" tilt={3} activeId={activeId}>
        <div className="flex flex-col items-start gap-1.5">
          <Chip>→ finances</Chip>
          <Chip>→ workouts</Chip>
          <Chip>→ reminders</Chip>
          <Chip>→ anything</Chip>
        </div>
      </Decor>

      {/* ── center stack ── */}
      {/* pointer-events-none so the full-width column doesn't block hover/drag
          on the floaters behind it; re-enabled per interactive child. */}
      <div
        id="join"
        className="relative z-30 flex flex-col items-center px-6 pt-14 md:pt-16 pb-10 pointer-events-none scroll-mt-24"
      >
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
          className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-black/60 mt-3 text-center max-w-md"
        >
          the outlet for your ambitious mind
        </motion.p>

        {/* ── the phone — xyra lives here ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.24 }}
          className="mt-6 pointer-events-auto"
        >
          <HeroPhone>
            <PhoneScene />
          </HeroPhone>
        </motion.div>

        <a
          href={TEST_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("cta_click", { cta_location: "hero_form", button_label: "wanna test it" })}
          className="pointer-events-auto font-[family-name:var(--font-jetbrains)] text-[11px] text-black/40 hover:text-black mt-5 underline underline-offset-4 decoration-black/20 hover:decoration-black transition-all"
        >
          wanna test it?
        </a>
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
