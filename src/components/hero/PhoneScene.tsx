"use client";

// ─── PhoneScene ──────────────────────────────────────────────────────────────
// The hero phone's scripted loop: xyra says hi → you tap the mic and dump your
// day → xyra shows the routing preview → you log it → xyra's receipt + chips →
// swipe to the dashboards grid → open To-Do → back → open Workout Tracker →
// back → swipe up into the brain ("Your World") → tap Finance → node insights
// → loop. Every surface is rebuilt from the app's real components
// (xyrav2 mobile, dark theme) — each block names its source. The canvas is
// the app's logical 390pt width; the height follows the frame's screen cutout.
//
// Dev aid: append ?beat=<name> to the URL (e.g. ?beat=preview) to freeze the
// scene on one beat. Beat names are the TIMELINE keys below.

import { useEffect, useLayoutEffect, useRef, useState, ReactNode, RefObject } from "react";
import { AnimatePresence, motion, useAnimationFrame } from "framer-motion";

export const SCREEN_W = 390;
export const SCREEN_H = 829;
const SAFE_TOP = 59;
const SAFE_BOTTOM = 34;

/* ── app tokens (dark) ─────────────────────────────────────────────────────
   mobile/src/theme/xyraPalette.ts (dark) + per-template accent consts.     */
const T = {
  bg: "#000000",
  fg: "#ede9dc", // palette.foreground
  card: "#0d0d0d", // palette.card
  muted: "#a89e88", // palette.mutedForeground
  border: "#333333", // palette.border
  hairline: "rgba(255,255,255,0.12)", // palette.borderMuted
  chatHairline: "#2a2a2a", // ChatPanel bubbles/chips + RoutingPreviewCard hairline
  chatMuted: "#888", // RoutingPreviewCard muted
  chatFaint: "#666", // RoutingPreviewCard faint
  pill: "#2A2A2E", // RecordingWave pill (dark)
  emerald: "#10b981", // TasksTemplate accent
  red: "#ef4444",
  orange: "#f97316", // WorkoutsTemplate accent
  orangeFill: "rgba(249,115,22,0.10)",
  persimmon: "#c2410c", // SchedulePreviewCard
  chalk: "#14532d", // HomeworkPreviewCard
  teal: "#14b8a6", // tagColor('school')
  violet: "#a855f7", // tagColor('personal')
  amber: "#f59e0b", // tagColor('errands')
  pink: "#ec4899", // custom-tag palette[0]
};
const MONO = "var(--font-jetbrains)"; // JetBrainsMono_400Regular / _500Medium
const SERIF = "var(--font-playfair)"; // PlayfairDisplay_400Regular (+ _Italic)
const GEORGIA = "Georgia, 'Times New Roman', serif"; // templates: Platform.OS === 'ios' ? 'Georgia' : 'serif'
const SYSTEM = "-apple-system, system-ui, sans-serif";

/* ── icons (Ionicons stand-ins, inline SVG) ──────────────────────────────── */

type IconProps = { size?: number; color?: string };
const svg = (size: number, children: ReactNode, extra: Record<string, unknown> = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" {...extra}>
    {children}
  </svg>
);
const MicIcon = ({ size = 24, color = "#000" }: IconProps) =>
  svg(size, <path fill={color} d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />);
const GearIcon = ({ size = 22, color = T.fg }: IconProps) =>
  svg(size, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>, { stroke: color, strokeWidth: 1.6 });
const MoonIcon = ({ size = 22, color = T.fg }: IconProps) =>
  svg(size, <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />, { stroke: color, strokeWidth: 1.6 });
const CloseIcon = ({ size = 20, color = "#fff" }: IconProps) => svg(size, <path d="M6 6l12 12M18 6L6 18" />, { stroke: color, strokeWidth: 2 });
const CheckIcon = ({ size = 22, color = "#1C1C1E" }: IconProps) => svg(size, <path d="M5 12.5l4.5 4.5L19 7.5" />, { stroke: color, strokeWidth: 2.2 });
const ChevronDownIcon = ({ size = 11, color = "#fff" }: IconProps) => svg(size, <path d="M6 9l6 6 6-6" />, { stroke: color, strokeWidth: 2.4 });
const KeypadIcon = ({ size = 12, color = "#666" }: IconProps) =>
  svg(size, <>{[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="2" fill={color} />))}</>);
const ArrowBackIcon = ({ size = 24, color = T.fg }: IconProps) => svg(size, <path d="M19 12H5M12 19l-7-7 7-7" />, { stroke: color, strokeWidth: 2 });
const EllipsisIcon = ({ size = 22, color = T.fg }: IconProps) =>
  svg(size, <>{[5, 12, 19].map((x) => <circle key={x} cx={x} cy="12" r="2.2" fill={color} />)}</>);
const CheckboxOutlineIcon = ({ size = 16, color = T.fg }: IconProps) =>
  svg(size, <><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M8 12.5l2.5 2.5L16 9.5" /></>, { stroke: color, strokeWidth: 1.8 });
const CalendarIcon = ({ size = 16, color = T.persimmon }: IconProps) =>
  svg(size, <><rect x="3" y="4" width="18" height="17" rx="2.5" fill={color} /><rect x="3" y="4" width="18" height="6" rx="2.5" fill={color} /><path d="M3 10h18" stroke="#000" strokeWidth="1.2" /><path d="M8 2v4M16 2v4" stroke={color} strokeWidth="2" /></>);
const BarbellIcon = ({ size = 16, color = T.orange, outline = false }: IconProps & { outline?: boolean }) =>
  svg(size, <><rect x="2" y="10.5" width="20" height="3" rx="1" /><rect x="5" y="7" width="3" height="10" rx="1" /><rect x="16" y="7" width="3" height="10" rx="1" /><rect x="8.5" y="9" width="2" height="6" rx=".6" /><rect x="13.5" y="9" width="2" height="6" rx=".6" /></>, outline ? { stroke: color, strokeWidth: 1.4 } : { fill: color });
const SchoolIcon = ({ size = 16, color = T.chalk }: IconProps) =>
  svg(size, <><path fill={color} d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" /><path fill={color} d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" /></>);
const AddIcon = ({ size = 28, color = "#fff" }: IconProps) => svg(size, <path d="M12 5v14M5 12h14" />, { stroke: color, strokeWidth: 2.2 });
const FlameIcon = ({ size = 16, color = T.orange }: IconProps) =>
  svg(size, <path fill={color} d="M12 23c-4.97 0-8-3.13-8-7.5 0-3.02 1.65-5.35 3.2-7.05.36-.4 1.02-.17 1.05.36.06 1.13.42 2.5 1.45 3.19-.34-2.7.9-6.26 4.06-8.65.42-.32 1.03 0 1 .53-.1 1.9.38 4.11 2.03 5.86C18.3 11.4 20 13.5 20 15.5 20 19.87 16.97 23 12 23z" />);

/* ── timeline ────────────────────────────────────────────────────────────── */

const TIMELINE = [
  ["start", 0],
  ["greet_typing", 700],
  ["greet", 1600],
  ["tap_mic", 2900],
  ["recording", 3150],
  ["tap_send", 5800],
  ["transcribing", 6050],
  ["dump1", 6650],
  ["dump2", 7200],
  ["preview_typing", 7900],
  ["preview", 8800],
  ["tap_confirm", 11000],
  ["receipt", 11300],
  ["swipe", 13100],
  ["tap_todo", 14400],
  ["todo", 14700],
  ["tap_back_todo", 17300],
  ["grid2", 17600],
  ["tap_workout", 18500],
  ["workout", 18800],
  ["tap_back_workout", 21400],
  ["grid3", 21700],
  ["swipe_up", 22700],
  ["tap_node", 25300],
  ["insights", 25600],
  ["end", 29000],
] as const;
type Beat = (typeof TIMELINE)[number][0];
const LOOP_MS = 29800;
const ORDER = TIMELINE.map(([b]) => b) as readonly Beat[];
const isBeat = (s: string | null): s is Beat => !!s && (ORDER as readonly string[]).includes(s);

// Which beats are taps, and what they tap (matched against data-tap attrs).
const TAP: Partial<Record<Beat, string>> = {
  tap_mic: "mic",
  tap_send: "send",
  tap_confirm: "confirm",
  tap_todo: "tile-todo",
  tap_back_todo: "back",
  tap_workout: "tile-workout",
  tap_back_workout: "back",
  tap_node: "node-finance",
};

function useTimeline() {
  const [beat, setBeat] = useState<Beat>("start");
  const [run, setRun] = useState(0);
  const [frozen, setFrozen] = useState<Beat | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("beat");
    if (isBeat(p)) setFrozen(p);
  }, []);

  useEffect(() => {
    if (frozen) {
      setBeat(frozen);
      return;
    }
    const timers = TIMELINE.map(([b, t]) => window.setTimeout(() => setBeat(b), t));
    timers.push(window.setTimeout(() => setRun((r) => r + 1), LOOP_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [run, frozen]);

  const at = (b: Beat) => ORDER.indexOf(beat) >= ORDER.indexOf(b);
  return { beat, at, frozen: frozen !== null };
}

/* ── tap ripple — finds the tapped element by data-tap and rings it ──────── */

// `hold` (frozen mode) keeps the ring on screen so a tap position can be inspected.
function TapRipple({ beat, canvasRef, hold = false }: { beat: Beat; canvasRef: RefObject<HTMLDivElement>; hold?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number; key: string } | null>(null);
  useLayoutEffect(() => {
    const target = TAP[beat];
    const canvas = canvasRef.current;
    if (!target || !canvas) return;
    // Measure a beat later than the state change: framer commits transforms on
    // the next frame, so a same-tick read can still see the previous layout.
    const id = window.setTimeout(() => {
      const el = canvas.querySelector<HTMLElement>(`[data-tap="${target}"]`);
      if (!el) return;
      const c = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const s = c.width / SCREEN_W; // undo the frame's CSS scale
      setPos({ x: (r.left - c.left + r.width / 2) / s, y: (r.top - c.top + r.height / 2) / s, key: beat });
    }, 80);
    return () => window.clearTimeout(id);
  }, [beat, canvasRef]);
  if (!pos) return null;
  return (
    <motion.div
      key={pos.key}
      initial={{ opacity: 0.9, scale: 0.4 }}
      animate={hold ? { opacity: 0.8, scale: 1 } : { opacity: 0, scale: 1.6 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="absolute rounded-full pointer-events-none z-50"
      style={{ left: pos.x - 22, top: pos.y - 22, width: 44, height: 44, background: "rgba(255,255,255,0.28)", border: "1.5px solid rgba(255,255,255,0.75)" }}
    />
  );
}

/* ── shared chrome ───────────────────────────────────────────────────────── */

function StatusBar({ color = T.fg }: { color?: string }) {
  return (
    <div className="absolute left-0 right-0 flex items-center justify-between pointer-events-none" style={{ top: 14, padding: "0 32px", height: 22, fontFamily: SYSTEM, fontSize: 15, fontWeight: 600, color }}>
      <span>9:41</span>
      <span className="flex items-center" style={{ gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill={color}><rect x="0" y="7" width="3" height="4" rx=".6" /><rect x="4.5" y="5" width="3" height="6" rx=".6" /><rect x="9" y="2.5" width="3" height="8.5" rx=".6" /><rect x="13.5" y="0" width="3" height="11" rx=".6" /></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke={color} strokeOpacity=".4" /><rect x="2" y="2" width="18" height="8" rx="1.5" fill={color} /><path d="M23 4v4a2 2 0 000-4z" fill={color} fillOpacity=".4" /></svg>
      </span>
    </div>
  );
}

const SunIcon = ({ size = 22, color = "#000" }: IconProps) =>
  svg(size, <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></>, { stroke: color, strokeWidth: 1.6 });

// [slug].tsx header: back 40×40 · serif 18/600 title · ellipsis 40×40, paddingVertical 12.
function BoardHeader({ title, fg = T.fg }: { title: string; fg?: string }) {
  return (
    <div className="flex items-center" style={{ paddingTop: SAFE_TOP + 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16 }}>
      <span data-tap="back" className="flex items-center justify-center" style={{ width: 40, height: 40 }}><ArrowBackIcon color={fg} /></span>
      <span className="flex-1 text-center truncate" style={{ fontFamily: GEORGIA, fontSize: 18, fontWeight: 600, color: fg }}>{title}</span>
      <span className="flex items-center justify-center" style={{ width: 40, height: 40 }}><EllipsisIcon color={fg} /></span>
    </div>
  );
}

// VoiceFAB: MIC_SIZE 64 circle in the board's accent, "manual" toggle 20px under it.
function BoardFab({ accent, icon, label }: { accent: string; icon: ReactNode; label?: string }) {
  return (
    <>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full" style={{ bottom: 32 + SAFE_BOTTOM, width: 64, height: 64, background: accent, boxShadow: `0 8px 14px ${accent}40` }}>{icon}</div>
      {label && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center" style={{ bottom: 32 + SAFE_BOTTOM - 20, gap: 4, height: 16, fontFamily: MONO, fontSize: 11, color: T.muted }}>
          <KeypadIcon color={T.muted} />{label}
        </div>
      )}
    </>
  );
}

/* ── chat primitives — ChatPanel.tsx + RecordingWave.tsx + RoutingPreviewCard.tsx ── */

// messageBubble: maxWidth 82%, padding 18/14, square. user = white on black (dark),
// xyra = transparent + 1px #2a2a2a. messageText 14/20 mono, display-lowercase.
function Bubble({ role, children }: { role: "user" | "xyra"; children: ReactNode }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={isUser ? "self-end" : "self-start"}
      style={{
        maxWidth: "82%",
        padding: "14px 18px",
        background: isUser ? "#fff" : "transparent",
        border: isUser ? "none" : `1px solid ${T.chatHairline}`,
        color: isUser ? "#000" : "#fff",
        fontFamily: MONO,
        fontSize: 14,
        lineHeight: "20px",
        textTransform: "lowercase",
      }}
    >
      {children}
    </motion.div>
  );
}

function Typing() {
  return (
    <span className="flex items-center" style={{ height: 20, gap: 4 }}>
      {[0, 0.15, 0.3].map((d) => (
        <span key={d} className="xyra-typing-dot rounded-full" style={{ width: 5, height: 5, background: "rgba(255,255,255,0.7)", animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

// linkChipRow / linkChip: the receipt chips under xyra's "done" line.
function ChipRow({ chips }: { chips: string[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="flex flex-wrap self-start" style={{ gap: 8, marginTop: 2 }}>
      {chips.map((c) => (
        <span key={c} style={{ border: `1px solid ${T.chatHairline}`, borderRadius: 20, padding: "8px 14px", fontFamily: MONO, fontSize: 12, color: "#fff" }}>{c}</span>
      ))}
    </motion.div>
  );
}

// RecordingWave (dark): pill h52 r26 pad6 gap6; cancel 40 @14% white; 28 bars 3px
// r1.5 rgba(255,255,255,.92) 3→22px; send 40 white. Left third rides flat like the
// app's calm history buffer, the rest is "live".
function RecordingPill() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="flex items-center" style={{ width: "calc(100% - 16px)", margin: "0 8px", height: 52, borderRadius: 26, padding: "0 6px", gap: 6, background: T.pill, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
      <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: "rgba(255,255,255,0.14)" }}><CloseIcon /></span>
      <span className="flex-1 flex items-center justify-center" style={{ height: 22, gap: 3, padding: "0 6px" }}>
        {Array.from({ length: 28 }, (_, i) => {
          const live = i >= 9;
          return (
            <span key={i} className={live ? "xyra-rec-bar" : undefined} style={{ width: 3, height: 3, borderRadius: 1.5, background: "rgba(255,255,255,0.92)", animationDelay: live ? `${((i * 7) % 9) / 10}s` : undefined, animationDuration: live ? `${0.7 + ((i * 3) % 5) * 0.08}s` : undefined }} />
          );
        })}
      </span>
      <span data-tap="send" className="flex items-center justify-center rounded-full bg-white shrink-0" style={{ width: 40, height: 40 }}><CheckIcon /></span>
    </motion.div>
  );
}

// ChatPanel voiceBar (idle): barMic 64 circle white (dark theme) · 8 · "type".
// While transcribing the mic dims to .5 and the status line replaces "type".
function MicBar({ status }: { status: string | null }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 8, paddingTop: 4 }}>
      <div data-tap="mic" className="flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: "#fff", opacity: status ? 0.5 : 1, boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}><MicIcon size={26} /></div>
      {status ? (
        <span style={{ fontFamily: MONO, fontSize: 12, height: 16, lineHeight: "16px", color: "#888" }}>{status}</span>
      ) : (
        <span className="flex items-center" style={{ gap: 4, height: 16, fontFamily: MONO, fontSize: 12, color: "#666" }}><KeypadIcon />type</span>
      )}
    </div>
  );
}

// RoutingPreviewCard: kicker → one block per DESTINATION (name · count, target chip)
// with the items sorted beneath → footer LOG IT ALL / Cancel. Confirmed = inert
// (opacity .45, kicker ROUTED, footer gone). All targets here are existing boards,
// so the chip collapses to "change" like the app.
const PREVIEW_BLOCKS = [
  { name: "Schedule", items: ["gym  · SAT 12  · 6:00 PM", "dentist  · TUE 15  · 5:00 PM", "mom's bday  · SAT 19"] },
  { name: "To-Do List", items: ["email prof about the essay extension  · SAT 12"] },
  { name: "Workout Tracker", items: ["push day — chest + tris  · SAT 12"] },
];
function PreviewCard({ confirmed }: { confirmed: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: confirmed ? 0.45 : 1, y: 0 }} transition={{ duration: 0.3 }} className="self-stretch" style={{ border: `1px solid ${T.chatHairline}`, padding: "14px 16px" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.chatMuted, marginBottom: 4 }}>{confirmed ? "ROUTED" : "ROUTING PREVIEW"}</div>
      {PREVIEW_BLOCKS.map((b, i) => (
        <div key={b.name} className="flex flex-col" style={{ padding: "10px 0", gap: 3, borderTop: i > 0 ? `1px solid ${T.chatHairline}` : "none" }}>
          <div className="flex items-center justify-between" style={{ gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: SERIF, fontSize: 18, color: "#fff" }}>
              {b.name}
              <span style={{ fontFamily: MONO, fontSize: 12, color: T.chatFaint }}>{"  · "}{b.items.length}</span>
            </span>
            <span className="flex items-center shrink-0" style={{ gap: 4, padding: "6px 12px", border: "1px solid #333", borderRadius: 20, background: "#111", fontFamily: MONO, fontSize: 12, color: "#fff" }}>
              change{!confirmed && <ChevronDownIcon />}
            </span>
          </div>
          {b.items.map((it) => (
            <div key={it} className="truncate" style={{ fontFamily: MONO, fontSize: 13, lineHeight: "19px", color: T.chatMuted }}>{it}</div>
          ))}
        </div>
      ))}
      {!confirmed && (
        <div className="flex flex-col" style={{ borderTop: `1px solid ${T.chatHairline}`, paddingTop: 12, marginTop: 4, gap: 8 }}>
          <div data-tap="confirm" className="flex items-center justify-center" style={{ background: "#fff", padding: "12px 0", fontFamily: MONO, fontWeight: 500, fontSize: 13, letterSpacing: 1.5, color: "#000" }}>LOG IT ALL</div>
          <div className="text-center" style={{ padding: "4px 0", fontFamily: MONO, fontSize: 12, color: T.chatFaint }}>Cancel</div>
        </div>
      )}
    </motion.div>
  );
}

/* ── screen 1: chat (ChatPanel.tsx, dark) ────────────────────────────────── */

function ChatScreen({ beat, at }: { beat: Beat; at: (b: Beat) => boolean }) {
  const listRef = useRef<HTMLDivElement>(null);
  // FlatList scrollToEnd({ animated: true }) on every new message.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const id = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 60);
    return () => window.clearTimeout(id);
  }, [beat]);

  const recording = at("recording") && !at("transcribing");
  const transcribing = at("transcribing") && !at("dump1");

  return (
    <div className="absolute inset-0" style={{ background: T.bg, color: T.fg }}>
      <StatusBar />
      {/* headerButtonLeft / Right: settings-outline + theme toggle, inset 12 + pad 8 */}
      <span className="absolute z-10" style={{ top: SAFE_TOP + 3, left: 20 }}><GearIcon /></span>
      <span className="absolute z-10" style={{ top: SAFE_TOP + 3, right: 20 }}><MoonIcon /></span>

      {/* messageList: paddingHorizontal 20, gap 14, top-anchored (flexGrow, no justify) */}
      <div ref={listRef} className="absolute left-0 right-0 overflow-hidden" style={{ top: SAFE_TOP, bottom: 150 }}>
        <div className="flex flex-col" style={{ padding: "49px 20px 16px", gap: 14 }}>
          {at("greet_typing") && !at("greet") && <Bubble role="xyra"><Typing /></Bubble>}
          {at("greet") && <Bubble role="xyra">yooo ready to lay it on me?</Bubble>}
          {at("dump1") && (
            <Bubble role="user">ok so gym at 6, dentist tues at 5, mom&apos;s bday next weekend and i still have to email my prof about the essay extension</Bubble>
          )}
          {at("dump2") && <Bubble role="user">also make me a push day for tonight, chest and tris</Bubble>}
          {at("preview_typing") && !at("preview") && <Bubble role="xyra"><Typing /></Bubble>}
          {at("preview") && <PreviewCard confirmed={at("receipt")} />}
          {at("receipt") && (
            <>
              <Bubble role="xyra">got it boss, gl with the prof</Bubble>
              <ChipRow chips={["→ Schedule", "→ To-Do List", "→ Workout Tracker"]} />
            </>
          )}
        </div>
      </div>

      {/* bottomBar: paddingHorizontal 16, paddingTop 10, paddingBottom 14 (+ home indicator) */}
      <div className="absolute left-0 right-0 bottom-0" style={{ padding: `10px 16px ${14 + SAFE_BOTTOM}px` }}>
        {recording ? (
          <div className="flex flex-col items-center" style={{ paddingTop: 4 }}><RecordingPill /></div>
        ) : (
          <MicBar status={transcribing ? "Transcribing…" : null} />
        )}
      </div>
    </div>
  );
}

/* ── screen 2: dashboards grid (DashboardPanel.tsx + LivingCards/*, dark) ── */

// PressableCard: 1px palette.border, bg palette.card, padding 12/12/8, BIG_CARD_H 184.
// Pressed → bg palette.primary, every color flips to onPrimary (the invert).
function Tile({ title, icon, pressed, tap, footer, footerRight, children }: {
  title: string;
  icon: (fg: string) => ReactNode;
  pressed?: boolean;
  tap?: string;
  footer: string;
  footerRight?: ReactNode;
  children: (c: { fg: string; muted: string }) => ReactNode;
}) {
  const fg = pressed ? "#000" : T.fg;
  const muted = pressed ? "#000" : T.muted;
  const divider = pressed ? "#000" : T.hairline;
  return (
    <div data-tap={tap} className="flex flex-col min-w-0" style={{ height: 184, border: `1px solid ${T.border}`, background: pressed ? T.fg : T.card, padding: "12px 12px 8px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span className="truncate" style={{ fontFamily: SERIF, fontSize: 16, color: fg, paddingRight: 6 }}>{title}</span>
        {icon(fg)}
      </div>
      <div className="flex-1 flex flex-col justify-center min-h-0">{children({ fg, muted })}</div>
      <div className="flex items-center justify-between" style={{ borderTop: `1px solid ${divider}`, paddingTop: 6, marginTop: 4, fontFamily: MONO, fontSize: 9, color: muted }}>
        <span>{footer}</span>
        {footerRight}
      </div>
    </div>
  );
}

function DashboardsScreen({ beat }: { beat: Beat }) {
  return (
    <div className="absolute inset-0" style={{ background: T.bg, color: T.fg }}>
      <StatusBar />
      {/* header: title Playfair 32 centered, gear/theme absolute at inset 12 + pad 8 */}
      <div className="relative text-center" style={{ paddingTop: SAFE_TOP + 12, paddingBottom: 24 }}>
        <span className="absolute" style={{ left: 20, top: SAFE_TOP + 21 }}><GearIcon /></span>
        <span className="absolute" style={{ right: 20, top: SAFE_TOP + 21 }}><MoonIcon /></span>
        {/* title: Playfair 32, maxWidth SCREEN_WIDTH - 112 + adjustsFontSizeToFit → this
            name lands at ~28px so it clears the gear/theme buttons like the app does */}
        <div className="mx-auto truncate" style={{ fontFamily: SERIF, fontSize: 28, lineHeight: "40px", maxWidth: SCREEN_W - 112 }}>Shayan&apos;s Dashboards</div>
      </div>

      {/* masonry: PADDING 16, COLUMN_GAP 16, all preview-on so a clean 2×2 */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16, padding: "0 16px" }}>
        {/* TaskCard — next-up variant (1 due today) */}
        <Tile title="To-Do List" tap="tile-todo" pressed={beat === "tap_todo"} icon={(fg) => <CheckboxOutlineIcon color={fg} />} footer="4 active">
          {({ fg, muted }) => (
            <div className="flex items-start" style={{ gap: 10 }}>
              <span className="shrink-0 rounded-full" style={{ width: 16, height: 16, border: `1.5px solid ${fg}`, marginTop: 4 }} />
              <span className="flex-1 min-w-0">
                <span style={{ display: "block", fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: 1.2, color: muted }}>TODAY</span>
                <span style={{ display: "block", fontFamily: SERIF, fontSize: 14, lineHeight: "18px", letterSpacing: -0.2, marginTop: 2, color: fg }}>email prof about the essay extension</span>
              </span>
              <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: T.red, marginTop: 8 }} />
            </div>
          )}
        </Tile>

        {/* HomeworkPreviewCard — "Classes" */}
        <Tile title="Classes" icon={() => <SchoolIcon />} footer="2 THIS WEEK">
          {({ fg, muted }) => (
            <div>
              <div className="flex items-baseline" style={{ gap: 6 }}>
                <span style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: -1, lineHeight: "30px", color: fg }}>2</span>
                <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: muted }}>due this week</span>
              </div>
              <div className="truncate" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: muted, marginTop: 4 }}>TMRW: ECON 2010 PROBLEM SET 2</div>
              <div className="flex" style={{ gap: 6, marginTop: 8 }}>
                {["#3b82f6", "#16a34a", "#16a34a", "#3b82f6"].map((c, i) => <span key={i} className="rounded-full" style={{ width: 9, height: 9, background: c }} />)}
              </div>
            </div>
          )}
        </Tile>

        {/* SchedulePreviewCard — next up */}
        <Tile title="Schedule" icon={() => <CalendarIcon />} footer="1 EVENT TODAY">
          {({ fg, muted }) => (
            <div>
              <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: 1.4, color: T.persimmon, marginBottom: 2 }}>NEXT UP</div>
              <div style={{ fontFamily: SERIF, fontSize: 26, letterSpacing: -1, lineHeight: "30px", color: fg }}>6 PM</div>
              <div className="truncate" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 11, color: muted, marginTop: 4 }}>gym</div>
            </div>
          )}
        </Tile>

        {/* WorkoutsPreviewCard — streak + last lift */}
        <Tile title="Workout Tracker" tap="tile-workout" pressed={beat === "tap_workout"} icon={(fg) => <BarbellIcon color={beat === "tap_workout" ? fg : T.orange} />} footer="2 this week">
          {({ fg, muted }) => (
            <div>
              <div className="flex items-baseline" style={{ gap: 6 }}>
                <FlameIcon color={beat === "tap_workout" ? fg : T.orange} />
                <span style={{ fontFamily: SERIF, fontSize: 32, letterSpacing: -1, color: fg }}>3</span>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.4, color: muted }}>DAYS</span>
              </div>
              <div className="truncate" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: muted, marginTop: 6 }}>BENCH PRESS · 3×8 @ 185</div>
            </div>
          )}
        </Tile>
      </div>

      {/* micButton: MIC_SIZE 64, palette.primary, centered above the home indicator */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full" style={{ bottom: 80, width: 64, height: 64, background: T.fg, boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}><MicIcon size={26} /></div>
    </div>
  );
}

/* ── screen 3: To-Do board (TasksTemplate.tsx, dark) ─────────────────────── */

type TodoRow = { title: string; tag: string; color: string; time?: string; high?: boolean };
const TODO_SECTIONS: { label: string; rows: TodoRow[] }[] = [
  { label: "SATURDAY 12", rows: [{ title: "email prof about the essay extension", tag: "school", color: T.teal, high: true }] },
  { label: "SUNDAY 13", rows: [{ time: "11:00 AM", title: "call mom about next weekend", tag: "personal", color: T.violet }] },
  { label: "LATER", rows: [{ title: "ECON 2010: problem set 2", tag: "econ 2010", color: T.pink }, { title: "renew parking permit", tag: "errands", color: T.amber }] },
];

function TodoScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: T.bg, color: T.fg }}>
      <StatusBar />
      <BoardHeader title="To-Do List" />
      <div style={{ padding: "14px 20px 0" }}>
        {/* hero: weekday · big day + month · stats */}
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 11, letterSpacing: 1.8, color: T.muted, marginBottom: 6 }}>SATURDAY</div>
          <div className="flex items-baseline" style={{ gap: 12 }}>
            <span style={{ fontFamily: GEORGIA, fontSize: 64, letterSpacing: -2.5, lineHeight: "68px" }}>12</span>
            <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 14, letterSpacing: 1.6, color: T.muted }}>SEPTEMBER</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.4, color: T.muted, marginTop: 12 }}>1 LEFT</div>
        </div>

        {/* tag filter bar: ALL (filled) + tag chips in their tagColor */}
        <div className="flex overflow-hidden whitespace-nowrap" style={{ gap: 8, padding: "4px 0", marginTop: 10 }}>
          <span style={{ border: `1px solid ${T.fg}`, background: T.fg, color: T.bg, borderRadius: 999, padding: "6px 14px", fontFamily: MONO, fontWeight: 500, fontSize: 11, letterSpacing: 1.2 }}>ALL</span>
          {[["SCHOOL", T.teal], ["PERSONAL", T.violet], ["ECON 2010", T.pink], ["ERRANDS", T.amber]].map(([t, c]) => (
            <span key={t} style={{ border: `1px solid ${c}`, color: c, borderRadius: 999, padding: "6px 14px", fontFamily: MONO, fontWeight: 500, fontSize: 11, letterSpacing: 1.2 }}>{t}</span>
          ))}
        </div>

        {/* sections */}
        {TODO_SECTIONS.map((s) => (
          <div key={s.label} style={{ marginTop: 14 }}>
            <div className="flex items-center justify-between" style={{ padding: 4, marginBottom: 4 }}>
              <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 10, letterSpacing: 1.8, color: T.muted }}>{s.label}</span>
              <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 11, letterSpacing: 0.8, color: T.muted }}>{s.rows.length}</span>
            </div>
            {s.rows.map((r, i) => (
              <div key={r.title} className="flex items-start" style={{ padding: "14px 6px", gap: 14, borderBottom: i < s.rows.length - 1 ? `1px solid ${T.hairline}` : "none" }}>
                <span className="shrink-0 rounded-full" style={{ width: 22, height: 22, border: `1.5px solid ${T.fg}`, marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline" style={{ gap: 10 }}>
                    {r.time && <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 11, letterSpacing: 1.2, minWidth: 64, color: T.muted }}>{r.time}</span>}
                    <span style={{ fontFamily: GEORGIA, fontSize: 16, letterSpacing: -0.2, lineHeight: "22px" }}>{r.title}</span>
                  </div>
                  <div className="flex" style={{ marginTop: 5 }}>
                    <span style={{ border: `1px solid ${r.color}`, color: r.color, borderRadius: 999, padding: "2px 8px", fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: 1.2 }}>{r.tag.toUpperCase()}</span>
                  </div>
                </div>
                {r.high && <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: T.red, marginTop: 8 }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
      <BoardFab accent={T.emerald} icon={<MicIcon size={26} color="#fff" />} label="manual" />
    </div>
  );
}

/* ── screen 4: Workout board (WorkoutsTemplate.tsx, dark) ────────────────── */

const ROUTINE = [
  { day: "Push", lifts: [["Bench Press", T.red], ["Incline DB Press", T.red], ["Cable Flys", T.red], ["Tricep Pushdowns", T.emerald]] },
  { day: "Pull", lifts: [["Deadlift", "#3b82f6"], ["Barbell Row", "#3b82f6"], ["Lat Pulldown", "#3b82f6"], ["Hammer Curls", T.emerald]] },
  { day: "Legs", lifts: [["Back Squat", T.violet], ["RDL", T.violet], ["Leg Press", T.violet]] },
];
const STATS: [string, string, string, string?][] = [
  ["THIS WEEK", "2", "sessions"],
  ["WEEK VOLUME", "14.2K", "lbs lifted"],
  ["STREAK", "3", "days", T.orange],
  ["PRS · 30 DAYS", "1", "lift"],
];

function WorkoutScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: T.bg, color: T.fg }}>
      <StatusBar />
      <BoardHeader title="Workout Tracker" />
      <div style={{ padding: "14px 20px 0" }}>
        {/* heroCard (not done today): kicker + streak pill · "Log a lift" CTA */}
        <div style={{ border: `1px solid ${T.hairline}`, borderRadius: 18, padding: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.6, color: T.muted }}>NO WORKOUT YET TODAY</span>
            <span className="flex items-center" style={{ gap: 4, padding: "4px 10px", borderRadius: 999, background: T.orangeFill }}>
              <FlameIcon size={11} /><span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 10, letterSpacing: 1.4, color: T.orange }}>3 DAYS</span>
            </span>
          </div>
          {/* heroCta is bg #000 in the app, so on the dark page it reads as a bare row */}
          <div className="flex items-center justify-center" style={{ gap: 8, height: 52, borderRadius: 14, background: "#000", marginTop: 4 }}>
            <BarbellIcon size={20} color="#fff" />
            <span style={{ fontFamily: SYSTEM, fontWeight: 700, fontSize: 16, color: "#fff" }}>Log a lift</span>
          </div>
        </div>

        {/* statsGrid 2×2 */}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          {STATS.map(([label, value, sub, accent]) => (
            <div key={label} style={{ border: `1px solid ${T.hairline}`, borderRadius: 16, padding: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.4, color: T.muted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: GEORGIA, fontSize: 26, letterSpacing: -1, lineHeight: "30px", color: accent ?? T.fg }}>{value}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, color: T.muted, marginTop: 2 }}>{sub.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* ROUTINE / SPLIT — horizontal routine cards 150×132 */}
        <div style={{ marginTop: 28 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1.8, color: T.muted, marginLeft: 4 }}>ROUTINE</span>
            <span className="flex items-center" style={{ gap: 2 }}><AddIcon size={14} color={T.orange} /><span style={{ fontFamily: MONO, fontWeight: 500, fontSize: 10, letterSpacing: 1.4, color: T.orange }}>DAY</span></span>
          </div>
          <div className="flex overflow-hidden" style={{ gap: 10 }}>
            {ROUTINE.map((d) => (
              <div key={d.day} className="flex flex-col justify-between shrink-0" style={{ width: 150, minHeight: 132, border: `1px solid ${T.hairline}`, borderRadius: 16, padding: 14 }}>
                <div>
                  <div style={{ fontFamily: GEORGIA, fontSize: 18, letterSpacing: -0.3, marginBottom: 8 }}>{d.day}</div>
                  <div className="flex flex-col" style={{ gap: 5 }}>
                    {d.lifts.map(([name, c]) => (
                      <div key={name} className="flex items-center" style={{ gap: 7 }}>
                        <span className="shrink-0 rounded-full" style={{ width: 6, height: 6, background: c }} />
                        <span className="truncate" style={{ fontFamily: GEORGIA, fontSize: 13, color: T.muted }}>{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1.4, color: T.muted, marginTop: 10 }}>{d.lifts.length} LIFTS</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* the template's own FAB: 56 orange circle, "add" 28 */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full" style={{ bottom: 32 + SAFE_BOTTOM, width: 56, height: 56, background: T.orange, boxShadow: "0 8px 14px rgba(249,115,22,0.25)" }}><AddIcon /></div>
    </div>
  );
}

/* ── screen 5: the brain — "Your World" (BrainSheet.tsx + brain/BrainWorld.tsx) ── */

// BrainWorld's world as a 2D projection. The camera is pitched steeper than the
// app's constant (0,4.5,24) — Shayan's reference shows the orbit as a tall
// ellipse with big globes, so this looks down at ~49° like that shot. Vertical
// FOV 45. Nucleus r1.5 solid; category globes r0.55 wireframe; spokes @12%;
// time-based spin 0.16 rad/s; depth fade. RING 4.6 (app: 6) — the extreme side
// node can kiss the screen edge, exactly like the reference.
const CAM = { y: 16, z: 14 };
const CAM_D = Math.hypot(CAM.y, CAM.z);
const FWD = { y: -CAM.y / CAM_D, z: -CAM.z / CAM_D };
const UP = { y: -FWD.z, z: FWD.y };
const FOCAL = SCREEN_H / 2 / Math.tan((45 / 2) * (Math.PI / 180));
const RING = 4.6;
const SPIN_SPEED = 0.00016; // rad/ms
function project(x: number, y: number, z: number) {
  const qy = y - CAM.y;
  const qz = z - CAM.z;
  const depth = qy * FWD.y + qz * FWD.z;
  const yc = qy * UP.y + qz * UP.z;
  return { sx: SCREEN_W / 2 + (FOCAL * x) / depth, sy: SCREEN_H / 2 - (FOCAL * yc) / depth, depth };
}

// brainGraph CATEGORY_META labels; order picks who's out front when Finance gets
// tapped. `lift` bobs each globe off the orbital plane so the world reads as a
// 3D scatter (the reference's moons sit at different heights), not a flat ring.
const BRAIN_NODES = [
  { key: "people", label: "People", lift: 1.1 },
  { key: "finance", label: "Finance", lift: -0.5 },
  { key: "health", label: "Health", lift: 0.5 },
  { key: "work", label: "Work", lift: -1.0 },
  { key: "personal", label: "Personal", lift: 1.6 },
];
const RING_OFFSET = -0.48; // radians — with 2.6s of spin after opening, Finance sits front-right at tap time

// Light palette for the brain + insights (the app's light theme, which is what
// Shayan's reference shows): white page, black ink, charcoal nucleus.
const L = { bg: "#ffffff", fg: "#000000", muted: "#4d4d4d", nucleus: "#2b2b2b", hairline: "rgba(0,0,0,0.10)" };
const PITCH = Math.atan2(CAM.y, CAM.z); // how far the camera looks down → parallels open into ellipses

// A wireframe globe like BrainWorld's EdgesGeometry sphere: outline + 6 meridians
// + 7 parallels, thin gray lines over a white fill so it reads light and airy.
function Globe({ sx, sy, r, o, active }: { sx: number; sy: number; r: number; o: number; active: boolean }) {
  const so = active ? 0.75 : 0.42;
  const sw = active ? 0.9 : 0.65;
  const meridians = [0, 30, 60, 90, 120, 150].map((deg) => Math.abs(Math.cos((deg * Math.PI) / 180)) * r);
  const parallels = [-68, -45, -20, 0, 20, 45, 68].map((deg) => {
    const t = (deg * Math.PI) / 180;
    return { cy: sy - r * Math.sin(t) * Math.cos(PITCH), rx: r * Math.cos(t), ry: r * Math.cos(t) * Math.sin(PITCH) };
  });
  return (
    <g opacity={o} stroke={L.fg} strokeOpacity={so} strokeWidth={sw} fill="none">
      <circle cx={sx} cy={sy} r={r} fill={L.bg} />
      {meridians.map((rx, i) => (rx < 0.5 ? <line key={i} x1={sx} y1={sy - r} x2={sx} y2={sy + r} /> : <ellipse key={i} cx={sx} cy={sy} rx={rx} ry={r} />))}
      {parallels.map((p, i) => <ellipse key={`p${i}`} cx={sx} cy={p.cy} rx={p.rx} ry={Math.max(p.ry, 0.3)} />)}
    </g>
  );
}

function BrainSheet({ open, selected }: { open: boolean; selected: string | null }) {
  const [spin, setSpin] = useState(0);
  const last = useRef<number | null>(null);
  // Constant angular velocity (BrainWorld's SPIN_SPEED), clocked from the moment
  // the sheet opens so every loop finds Finance in the same place at tap time;
  // the world holds still once a node is picked so the tap reads.
  useEffect(() => {
    if (open) setSpin(0);
    last.current = null;
  }, [open]);
  useAnimationFrame((t) => {
    if (!open || selected) {
      last.current = null;
      return;
    }
    if (last.current === null) last.current = t;
    const dt = t - last.current;
    last.current = t;
    setSpin((v) => v + dt * SPIN_SPEED);
  });

  const nucleus = project(0, 0, 0);
  const nucR = (1.5 / nucleus.depth) * FOCAL;
  const nodes = BRAIN_NODES.map((n, i) => {
    const a = (i / BRAIN_NODES.length) * Math.PI * 2 + RING_OFFSET + spin;
    const p = project(Math.cos(a) * RING, n.lift, Math.sin(a) * RING);
    return { ...n, ...p, r: (0.55 / p.depth) * FOCAL, o: Math.max(0.45, Math.min(1, 1 - (p.depth - 17) / 26)) };
  });
  const back = nodes.filter((n) => n.depth >= nucleus.depth).sort((a, b) => b.depth - a.depth);
  const front = nodes.filter((n) => n.depth < nucleus.depth).sort((a, b) => b.depth - a.depth);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: L.bg, color: L.fg }}>
      <StatusBar color={L.fg} />
      <svg className="absolute inset-0" width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`}>
        {nodes.map((n) => (
          <line key={`spoke-${n.key}`} x1={nucleus.sx} y1={nucleus.sy} x2={n.sx} y2={n.sy} stroke={L.fg} strokeOpacity={0.12} strokeWidth={1} />
        ))}
        {back.map((n) => <Globe key={n.key} sx={n.sx} sy={n.sy} r={n.r} o={n.o} active={selected === n.key} />)}
        <circle cx={nucleus.sx} cy={nucleus.sy} r={nucR} fill={L.nucleus} />
        {front.map((n) => <Globe key={n.key} sx={n.sx} sy={n.sy} r={n.r} o={n.o} active={selected === n.key} />)}
      </svg>

      {/* labels: nucleus serifBold 24 over the top of the orb, categories serif 15 sit 24 above */}
      <div className="absolute text-center pointer-events-none" style={{ left: nucleus.sx - 75, top: nucleus.sy - 56, width: 150, fontFamily: SERIF, fontWeight: 700, fontSize: 24, letterSpacing: -0.3, textShadow: `0 0 4px ${L.bg}` }}>Shayan</div>
      {nodes.map((n) => (
        <div key={`lbl-${n.key}`} className="absolute" style={{ left: n.sx, top: n.sy, width: 0, height: 0, opacity: n.o }}>
          <span data-tap={`node-${n.key}`} className="absolute rounded-full" style={{ left: -26, top: -26, width: 52, height: 52 }} />
          {/* label stays on screen even when its globe rides past the edge */}
          <div className="absolute text-center whitespace-nowrap" style={{ left: Math.min(Math.max(n.sx, 44), SCREEN_W - 44) - n.sx - 75, top: -n.r - 20, width: 150, fontFamily: SERIF, fontSize: selected === n.key ? 17 : 15, letterSpacing: -0.2, textShadow: `0 0 4px ${L.bg}` }}>{n.label}</div>
        </div>
      ))}

      {/* header floats over the world: serif title / serif-italic subtitle, inset 24, top safe+10 */}
      <div className="absolute left-0 right-0" style={{ top: SAFE_TOP + 10, padding: "0 24px 8px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 34, letterSpacing: -0.5, lineHeight: "40px" }}>Your World</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: L.muted, marginTop: 2 }}>Your universe, mapped by Xyra.</div>
      </div>
      <span className="absolute" style={{ right: 20, top: SAFE_TOP + 24 }}><SunIcon /></span>

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full" style={{ bottom: 80, width: 64, height: 64, background: L.fg, boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }}><MicIcon size={26} color="#fff" /></div>
    </div>
  );
}

/* ── screen 6: node insights (this site's BrainScene finance panel, dark) ──── */

const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const INSIGHT_STATS: [string, string, string?][] = [
  ["Days Active", "47"],
  ["Money Saved", "$2,340", EMERALD],
  ["Total Spent", "$4,120"],
  ["Budget Left", "$760", AMBER],
];
const ACTIVITY: [string, string, string?][] = [
  ["Groceries", "-$67"],
  ["Paycheck", "+$2,400", EMERALD],
  ["Uber", "-$18"],
];

function InsightsScreen() {
  const cell = { border: `1px solid ${L.hairline}`, padding: 8 } as const;
  const label = { fontFamily: MONO, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase" as const, color: "rgba(0,0,0,0.4)" };
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: L.bg, color: L.fg }}>
      <StatusBar color={L.fg} />
      <BoardHeader title="Finances" fg={L.fg} />
      <div className="flex flex-col" style={{ padding: "0 20px 0", gap: 8 }}>
        <div style={{ borderBottom: `1px solid ${L.hairline}`, paddingBottom: 8 }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: "26px" }}>Finances</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: "rgba(0,0,0,0.4)", marginTop: 3 }}>Node insights powered by Xyra</div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {INSIGHT_STATS.map(([k, v, c]) => (
            <div key={k} style={cell}>
              <div style={label}>{k}</div>
              <div style={{ fontFamily: SYSTEM, fontWeight: 700, fontSize: 18, lineHeight: "22px", marginTop: 2, color: c ?? L.fg }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={cell}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(0,0,0,0.4)" }}>Savings Goal</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: EMERALD }}>78%</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(0,0,0,0.05)" }}>
            <motion.div className="h-full rounded-full" style={{ background: EMERALD }} initial={{ width: 0 }} animate={{ width: "78%" }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.35 }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(0,0,0,0.3)", marginTop: 5 }}>$2,340 of $3,000 goal</div>
        </div>

        <div style={{ background: "#000", color: "#fff", padding: 10 }}>
          <div className="flex items-center" style={{ gap: 8, marginBottom: 5 }}>
            <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 18, height: 18, background: "#fff", color: "#000", fontFamily: SERIF, fontWeight: 700, fontSize: 9 }}>X</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>Xyra Insight</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, lineHeight: "16px", color: "rgba(255,255,255,0.9)" }}>You&apos;ve cut dining out by 32% this month. Your savings rate is up 15% since you started tracking. Keep it up!</div>
        </div>

        <div>
          <div style={{ ...label, fontSize: 10, marginBottom: 2 }}>Recent Activity</div>
          {ACTIVITY.map(([k, v, c]) => (
            <div key={k} className="flex items-center justify-between" style={{ padding: "5px 0", borderBottom: `1px solid rgba(0,0,0,0.05)`, fontFamily: MONO, fontSize: 12 }}>
              <span>{k}</span>
              <span style={{ color: c ?? "rgba(0,0,0,0.6)" }}>{v}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center" style={{ gap: 8 }}>
          <div className="flex-1" style={{ border: `1px solid rgba(0,0,0,0.15)`, padding: "8px 12px", fontFamily: MONO, fontSize: 12, color: "rgba(0,0,0,0.3)" }}>Ask about your finances...</div>
          <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 36, height: 36, background: "#000" }}><MicIcon size={18} color="#fff" /></span>
        </div>
      </div>
    </div>
  );
}

// The swipe-up: a finger ring rising from just above the mic while the sheet follows.
function SwipeHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none z-50"
      style={{ left: SCREEN_W / 2 - 22, width: 44, height: 44, background: "rgba(255,255,255,0.28)", border: "1.5px solid rgba(255,255,255,0.75)" }}
      initial={{ top: SCREEN_H - 168, opacity: 0.9, scale: 0.6 }}
      animate={{ top: SCREEN_H - 480, opacity: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

/* ── the scene ───────────────────────────────────────────────────────────── */

// A board pushed on the router stack — iOS slide from the right.
function Pushed({ bg = T.bg, children }: { bg?: string; children: ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 z-20"
      style={{ background: bg, boxShadow: "-8px 0 24px rgba(0,0,0,0.5)" }}
      initial={{ x: SCREEN_W }}
      animate={{ x: 0 }}
      exit={{ x: SCREEN_W }}
      transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function PhoneScene() {
  const { beat, at, frozen } = useTimeline();
  const canvasRef = useRef<HTMLDivElement>(null);

  const todoOpen = at("todo") && !at("grid2");
  const workoutOpen = at("workout") && !at("grid3");
  const brainOpen = at("swipe_up");
  const insightsOpen = at("insights");
  const pushed = todoOpen || workoutOpen || insightsOpen;
  // BrainSheet's SPRING = { damping: 22, stiffness: 220, mass: 0.7 }
  const sheetSpring = { type: "spring" as const, stiffness: 220, damping: 22, mass: 0.7 };
  // HomePager: chat is page 0, dashboards page 1 → the swipe moves content left.
  // A pushed board parallaxes the page under it by 30% like the iOS stack.
  const pagerX = (at("swipe") ? -SCREEN_W : 0) - (pushed ? SCREEN_W * 0.3 : 0);
  const instant = beat === "start" || frozen; // frozen: land on the beat, don't animate to it

  return (
    <div ref={canvasRef} className="absolute inset-0 overflow-hidden" style={{ background: T.bg }}>
      <motion.div
        className="absolute top-0 bottom-0 left-0 flex"
        style={{ width: SCREEN_W * 2 }}
        animate={{ x: pagerX }}
        transition={instant ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="relative shrink-0" style={{ width: SCREEN_W }}><ChatScreen beat={beat} at={at} /></div>
        <div className="relative shrink-0" style={{ width: SCREEN_W }}><DashboardsScreen beat={beat} /></div>
      </motion.div>

      {/* "Your World" — the brain sheet, pulled up from the dashboards page */}
      <motion.div
        className="absolute inset-0 z-[6]"
        style={{ boxShadow: "0 -4px 16px rgba(0,0,0,0.18)" }}
        initial={false}
        animate={{ y: brainOpen ? 0 : SCREEN_H, x: pushed ? -SCREEN_W * 0.3 : 0 }}
        transition={instant ? { duration: 0 } : { y: { ...sheetSpring, delay: 0.12 }, x: { duration: 0.38 } }}
      >
        <BrainSheet open={brainOpen} selected={at("tap_node") ? "finance" : null} />
      </motion.div>

      <motion.div className="absolute inset-0 z-10 pointer-events-none" style={{ background: "#000" }} initial={false} animate={{ opacity: pushed ? 0.35 : 0 }} transition={{ duration: 0.38 }} />

      <AnimatePresence>
        {todoOpen && <Pushed key="todo"><TodoScreen /></Pushed>}
        {workoutOpen && <Pushed key="workout"><WorkoutScreen /></Pushed>}
        {insightsOpen && <Pushed key="insights" bg={L.bg}><InsightsScreen /></Pushed>}
      </AnimatePresence>

      <SwipeHint show={beat === "swipe_up"} />
      <TapRipple beat={beat} canvasRef={canvasRef} hold={frozen} />

      {/* loop seam: fade to black at the end, come back up on the fresh start */}
      <motion.div
        className="absolute inset-0 z-40 pointer-events-none"
        style={{ background: "#000" }}
        initial={false}
        animate={{ opacity: beat === "end" ? 1 : 0 }}
        transition={beat === "end" ? { duration: 0.4 } : { duration: 0.5, delay: 0.3 }}
      />
    </div>
  );
}
