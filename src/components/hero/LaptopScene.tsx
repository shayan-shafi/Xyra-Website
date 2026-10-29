"use client";

// ─── LaptopScene ─────────────────────────────────────────────────────────────
// The laptop's scripted loop, the PhoneScene idea on the web app: the world
// (your brain) sits nearly empty → settings (slides in from the left, by the rail) → connect claude (consent → its
// memories import) → connect chatgpt (same) → connect google calendar, granola
// and canvas (each pops its receipt) → back to the world, now full → connect
// gemini → a gemini window asks "what do you know about me?" → it answers with
// everything, each line tagged with where xyra got it → loop. Every surface is
// rebuilt from xyrav2-org/web (dark theme): WorkspaceRail, the world pane's
// pills, Settings → agents / connectors, OAuthConsent, ConnectorReceiptModal.
// Each block names its source. The canvas is a 1280×800 laptop screen; the
// frame scales it.
//
// Dev aid: append ?laptop=<beat> to the URL (e.g. ?laptop=answer) to freeze the
// scene on one beat. Beat names are the TIMELINE keys below.

import { useEffect, useLayoutEffect, useRef, useState, ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { NotebookPen } from "lucide-react";
import BrainWorldCanvas, { type BrainCategory } from "./BrainWorldCanvas";

export const LAPTOP_W = 1280;
export const LAPTOP_H = 800;
const RAIL_W = 200;
const PANE_W = 470;

/* ── web app tokens (dark) ───────────────────────────────────────────────── */
const T = {
  bg: "#000000",
  rail: "#111111",
  fg: "#ede9dc",
  white: "#ffffff",
  muted: "#8a8a8a",
  faint: "#5c5c5c",
  border: "#333333",
  hairline: "#1f1f1f",
};
const MONO = "var(--font-jetbrains)";
const SERIF = "var(--font-playfair)";
const SANS = "-apple-system, system-ui, sans-serif";

/* ── marks (xyrav2-org/web workspace/agentMarks + connectorMarks) ──────── */

type MarkProps = { size?: number };
const ClaudeMark = ({ size = 18 }: MarkProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="#D97757" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
);
const OpenAIMark = ({ size = 18, color = T.fg }: MarkProps & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill={color} d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);
const GeminiMark = ({ size = 18 }: MarkProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="#8E75B2" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
  </svg>
);
const PerplexityMark = ({ size = 18 }: MarkProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="#1FB8CD" d="M22.3977 7.0896h-2.3106V.0676l-7.5094 6.3542V.1577h-1.1554v6.1966L4.4904 0v7.0896H1.6023v10.3976h2.8882V24l6.932-6.3591v6.2005h1.1554v-6.0469l6.9318 6.1807v-6.4879h2.8882V7.0896zm-3.4657-4.531v4.531h-5.355l5.355-4.531zm-13.2862.0676 4.8691 4.4634H5.6458V2.6262zM2.7576 16.332V8.245h7.8476l-6.1149 6.1147v1.9723H2.7576zm2.8882 5.0404v-3.8852h.0001v-2.6488l5.7763-5.7764v7.0111l-5.7764 5.2993zm12.7086.0248-5.7766-5.1509V9.0618l5.7766 5.7766v6.5588zm2.8882-5.0652h-1.733v-1.9723L13.3948 8.245h7.8478v8.087z" />
  </svg>
);
const GoogleCalendarMark = ({ size = 18 }: MarkProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z" />
  </svg>
);
// Granola isn't in simple-icons, so the app gives it lucide's NotebookPen.
const GranolaMark = ({ size = 18 }: MarkProps) => <NotebookPen size={size} strokeWidth={1.5} color={T.fg} aria-hidden />;
// Canvas isn't either: a drawn ring of dots in its red.
const CanvasMark = ({ size = 18 }: MarkProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="#E72429">
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return <circle key={i} cx={12 + Math.cos(a) * 8.5} cy={12 + Math.sin(a) * 8.5} r={1.9} />;
    })}
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="#E72429" strokeWidth={2.2} />
  </svg>
);

/* ── small icons (lucide stand-ins, inline) ──────────────────────────────── */
const icon = (size: number, children: ReactNode, color = T.fg, width = 1.6) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
const GearIcon = () => icon(14, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.16V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.2 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>, T.muted);
const HelpIcon = () => icon(14, <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>, T.muted);
const MoonIcon = () => icon(16, <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />, T.fg);
const MicIcon = ({ size = 18, color = "#000" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill={color} d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
  </svg>
);
const CloseIcon = ({ color = T.muted }: { color?: string }) => icon(16, <path d="M6 6l12 12M18 6L6 18" />, color, 1.8);
const ArrowUpIcon = () => icon(16, <path d="M12 19V5M5 12l7-7 7 7" />, "#fff", 2.2);

/* ── timeline ────────────────────────────────────────────────────────────── */

const TIMELINE = [
  ["start", 0],
  ["move_settings", 600],
  ["click_settings", 1400],
  ["move_claude", 2100],
  ["click_claude", 2700],
  ["move_allow1", 3200],
  ["click_allow1", 3900],
  ["import_claude", 4300],
  ["move_chatgpt", 5300],
  ["click_chatgpt", 5800],
  ["move_allow2", 6200],
  ["click_allow2", 6800],
  ["import_chatgpt", 7200],
  ["move_gcal", 8200],
  ["click_gcal", 8700],
  ["move_gotit1", 9400],
  ["click_gotit1", 10300],
  ["move_granola", 10600],
  ["click_granola", 11100],
  ["move_gotit2", 11800],
  ["click_gotit2", 12700],
  ["move_canvas", 13000],
  ["click_canvas", 13500],
  ["move_gotit3", 14200],
  ["click_gotit3", 15100],
  ["move_close", 15500],
  ["click_close", 16100],
  ["world_full", 16500],
  ["move_settings2", 19200],
  ["click_settings2", 19800],
  ["move_gemini", 20400],
  ["click_gemini", 21000],
  ["move_allow3", 21400],
  ["click_allow3", 22000],
  ["gemini_open", 22400],
  ["typing", 23100],
  ["move_send", 24500],
  ["click_send", 24900],
  ["tools", 25200],
  ["answer", 26300],
  ["end", 33500],
] as const;
type Beat = (typeof TIMELINE)[number][0];
export const LAPTOP_LOOP_MS = 34300;
const ORDER = TIMELINE.map(([b]) => b) as readonly Beat[];
const isBeat = (s: string | null): s is Beat => !!s && (ORDER as readonly string[]).includes(s);

// Where the cursor heads on each beat (matched against data-tap attrs) …
const AIM: Partial<Record<Beat, string>> = {
  move_settings: "settings",
  move_claude: "agent-claude",
  move_allow1: "allow",
  move_chatgpt: "agent-chatgpt",
  move_allow2: "allow",
  move_gcal: "conn-gcal",
  move_gotit1: "gotit",
  move_granola: "conn-granola",
  move_gotit2: "gotit",
  move_canvas: "conn-canvas",
  move_gotit3: "gotit",
  move_close: "pane-close",
  move_settings2: "settings",
  move_gemini: "agent-gemini",
  move_allow3: "allow",
  move_send: "send",
};
// … and which beats are clicks.
const CLICKS = new Set<Beat>([
  "click_settings", "click_claude", "click_allow1", "click_chatgpt", "click_allow2", "click_gcal", "click_gotit1",
  "click_granola", "click_gotit2", "click_canvas", "click_gotit3", "click_close", "click_settings2", "click_gemini",
  "click_allow3", "click_send",
]);

function useTimeline(onLoopStart?: (startedAt: number, loopMs: number) => void) {
  const [beat, setBeat] = useState<Beat>("start");
  const [run, setRun] = useState(0);
  const [frozen, setFrozen] = useState<Beat | null>(null);
  const onLoopStartRef = useRef(onLoopStart);
  onLoopStartRef.current = onLoopStart;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("laptop");
    if (isBeat(p)) setFrozen(p);
  }, []);

  useEffect(() => {
    if (frozen) {
      setBeat(frozen);
      return;
    }
    onLoopStartRef.current?.(performance.now(), LAPTOP_LOOP_MS);
    const timers = TIMELINE.map(([b, t]) => window.setTimeout(() => setBeat(b), t));
    timers.push(window.setTimeout(() => setRun((r) => r + 1), LAPTOP_LOOP_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [run, frozen]);

  const at = (b: Beat) => ORDER.indexOf(beat) >= ORDER.indexOf(b);
  return { beat, at, frozen: frozen !== null };
}

/* ── the cursor — glides to the aimed element, presses on clicks ─────────── */

const ARROW_TIP = { x: 4, y: 3 }; // where the arrow's point sits in its 22×22 box

function Cursor({ beat, canvasRef }: { beat: Beat; canvasRef: RefObject<HTMLDivElement> }) {
  const [pos, setPos] = useState({ x: 760, y: 520 });
  const [press, setPress] = useState(0);
  useLayoutEffect(() => {
    if (CLICKS.has(beat)) setPress((n) => n + 1);
    const target = AIM[beat];
    const canvas = canvasRef.current;
    if (!target || !canvas) return;
    // A beat later than the state change, so anything sliding in has landed.
    const id = window.setTimeout(() => {
      const els = canvas.querySelectorAll<HTMLElement>(`[data-tap="${target}"]`);
      const el = els[els.length - 1]; // the newest one (a fresh modal over an old)
      if (!el) return;
      const c = canvas.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const s = c.width / LAPTOP_W; // undo the frame's CSS scale
      setPos({ x: (r.left - c.left + r.width * 0.55) / s, y: (r.top - c.top + r.height * 0.6) / s });
    }, 60);
    return () => window.clearTimeout(id);
  }, [beat, canvasRef]);
  return (
    <motion.div
      className="absolute left-0 top-0 z-[60] pointer-events-none"
      initial={false}
      animate={{ x: pos.x - ARROW_TIP.x, y: pos.y - ARROW_TIP.y }}
      transition={{ duration: 0.55, ease: [0.45, 0, 0.2, 1] }}
    >
      <AnimatePresence>
        {press > 0 && (
          <motion.span
            key={press}
            className="absolute rounded-full"
            style={{ left: ARROW_TIP.x - 16, top: ARROW_TIP.y - 16, width: 32, height: 32, border: "1.5px solid rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.18)" }}
            initial={{ opacity: 0.9, scale: 0.3 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      <motion.svg key={`p${press}`} width="22" height="22" viewBox="0 0 22 22" initial={{ scale: press ? 0.82 : 1 }} animate={{ scale: 1 }} transition={{ duration: 0.25 }} style={{ transformOrigin: "4px 3px", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}>
        <path d="M4 3l13 7.2-5.6 1.3 3.3 6.4-2.4 1.2-3.3-6.4L4 17z" fill="#000" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </motion.svg>
    </motion.div>
  );
}

/* ── the world's nodes, and when each lands ──────────────────────────────── */
// stage 0: what you've already told xyra · 1 claude's import · 2 chatgpt's
// import · 3 google calendar · 4 granola · 5 canvas.
const WORLD: BrainCategory[] = [
  { key: "health", label: "Health", children: ["Workout Tracker", "Runs", "Sleep"], childStages: [0, 2, 2] },
  { key: "work", label: "Work", stage: 1, children: ["Career", "Side Project", "Meetings"], childStages: [1, 1, 4] },
  { key: "personal", label: "Personal", children: ["To-Do List", "About You", "Schedule"], childStages: [0, 1, 3] },
  { key: "goals", label: "Goals", stage: 1, children: ["Bench 225", "Summer Trip"] },
  { key: "learning", label: "Learning", stage: 2, children: ["Essays", "Classes", "Exams"], childStages: [2, 5, 5] },
  { key: "social", label: "Social", stage: 2, children: ["Family", "Friends", "Design Club"], childStages: [2, 2, 4] },
  { key: "finance", label: "Finance", stage: 2, children: ["Budget"] },
];
const MEMORIES = [12, 41, 66, 81, 95, 118];

const STAGE_AT: [Beat, number][] = [
  ["import_claude", 1],
  ["import_chatgpt", 2],
  ["click_gcal", 3],
  ["click_granola", 4],
  ["click_canvas", 5],
];

/* ── rail (workspace/WorkspaceRail.tsx, on the world) ────────────────────── */

const AREAS = ["health", "work", "personal", "goals", "learning", "social", "finance"];
const AREA_STAGE: Record<string, number> = { health: 0, personal: 0, work: 1, goals: 1, learning: 2, social: 2, finance: 2 };

function Rail({ stage, settingsOn }: { stage: number; settingsOn: boolean }) {
  return (
    <div className="absolute left-0 top-0 bottom-0 flex flex-col" style={{ width: RAIL_W, background: T.rail, padding: "28px 22px 22px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 30, lineHeight: "30px", color: T.white, letterSpacing: -0.5 }}>xyra</div>
      <div className="flex flex-col" style={{ marginTop: 34, gap: 8 }}>
        {AREAS.map((a) => (
          <AnimatePresence key={a} initial={false}>
            {stage >= AREA_STAGE[a] && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{ fontFamily: SERIF, fontSize: 21, lineHeight: "28px", color: T.fg }}
              >
                {a}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
        <div style={{ fontFamily: SERIF, fontSize: 21, lineHeight: "28px", color: T.faint, marginTop: 2 }}>+ add a node</div>
      </div>
      <div className="mt-auto flex flex-col" style={{ gap: 14, fontFamily: MONO, fontSize: 13 }}>
        <div data-tap="settings" className="flex items-center" style={{ gap: 10, color: settingsOn ? T.white : T.fg }}>
          <GearIcon />settings
        </div>
        <div className="flex items-center" style={{ gap: 10, color: T.muted }}><HelpIcon />help</div>
        <div style={{ marginTop: 8, marginLeft: 2 }}><MoonIcon /></div>
      </div>
    </div>
  );
}

/* ── the world pane (Workspace.tsx: world + pills + mic) ─────────────────── */

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center" style={{ height: 26, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 999, fontFamily: MONO, fontSize: 9.5, letterSpacing: 2, color: T.muted }}>
      {children}
    </span>
  );
}

/* ── settings pane (SettingsPane → AgentsSection + ConnectorsSection) ────── */

const Kicker = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center justify-between" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 2.2, color: T.muted, textTransform: "uppercase" }}>
    <span>{children}</span>
    {right}
  </div>
);

const AGENTS = [
  { key: "claude", mark: <ClaudeMark />, title: "connect to claude", sub: "claude.ai and its phone app" },
  { key: "chatgpt", mark: <OpenAIMark />, title: "connect to chatgpt", sub: "chatgpt plus or pro" },
  { key: "gemini", mark: <GeminiMark />, title: "connect to gemini", sub: "gemini, us personal accounts" },
  { key: "perplexity", mark: <PerplexityMark />, title: "connect to perplexity", sub: "perplexity pro, max or enterprise" },
];

const CONNECTORS = [
  { key: "gcal", mark: <GoogleCalendarMark />, name: "google calendar", desc: "two-way: your google events appear in xyra's schedule, and events xyra logs land on your calendar." },
  { key: "granola", mark: <GranolaMark />, name: "granola", desc: "your meeting notes land in your brain: who you met, what came of it, and what you said you'd do." },
  { key: "canvas", mark: <CanvasMark />, name: "canvas", desc: "every assignment, quiz and exam lands on your classes board with its due date." },
];

const IMPORTS = [
  { from: "claude", line: "imported 29 memories onto /personal/about-you.md, /work/career.md and 4 more" },
  { from: "chatgpt", line: "imported 25 memories onto /health/runs.md, /learning/essays.md and 5 more" },
];

function SettingsPane({ at, beat }: { at: (b: Beat) => boolean; beat: Beat }) {
  const connected = [
    at("click_allow1") && "claude",
    at("click_allow2") && "chatgpt",
    at("click_allow3") && "gemini",
  ].filter(Boolean) as string[];
  const imports = IMPORTS.filter((_, i) => at(i === 0 ? "import_claude" : "import_chatgpt")).reverse(); // newest first
  const conn: Record<string, boolean> = { gcal: at("click_gcal"), granola: at("click_granola"), canvas: at("click_canvas") };
  const pressed = (b: Beat) => beat === b;

  return (
    <div className="absolute top-0 bottom-0 left-0 overflow-hidden" style={{ width: PANE_W, background: T.bg, borderRight: `1px solid ${T.hairline}`, padding: "30px 32px", color: T.fg }}>
      <div className="flex items-start justify-between">
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 38, lineHeight: "42px", color: T.white }}>settings</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.muted, marginTop: 4 }}>the laptop&apos;s few knobs.</div>
        </div>
        <span data-tap="pane-close" className="flex items-center justify-center" style={{ width: 30, height: 30, border: `1px solid ${pressed("click_close") ? T.white : T.border}`, marginTop: 4 }}><CloseIcon /></span>
      </div>

      <div style={{ borderTop: `1px solid ${T.hairline}`, marginTop: 18, paddingTop: 16 }}>
        <Kicker>agents</Kicker>
        <div style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: "16px", color: "#bdbdbd", marginTop: 8 }}>
          let the ai you already use read your brain: every shelf, every memory, every board, live from xyra.
        </div>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8, marginTop: 12 }}>
          {AGENTS.map((a) => {
            const on = pressed(`click_${a.key}` as Beat);
            return (
              <div key={a.key} data-tap={`agent-${a.key}`} className="flex items-center min-w-0" style={{ gap: 10, padding: "9px 12px", border: `1px solid ${on ? T.white : T.border}`, background: on ? "#1a1a1a" : "transparent" }}>
                <span className="shrink-0">{a.mark}</span>
                <span className="min-w-0">
                  <span className="block truncate" style={{ fontFamily: SERIF, fontSize: 15, lineHeight: "18px", color: T.white }}>{a.title}</span>
                  <span className="block truncate" style={{ fontFamily: MONO, fontSize: 8.5, color: T.muted }}>{a.sub}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* connected apps */}
        <div style={{ marginTop: 6 }}>
          <AnimatePresence initial={false}>
            {connected.map((name) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 30 }}
                transition={{ duration: 0.35 }}
                className="flex items-center overflow-hidden"
                style={{ borderBottom: `1px solid ${T.hairline}` }}
              >
                <span style={{ width: 92, fontFamily: SERIF, fontSize: 16, color: T.white }}>{name}</span>
                <span className="flex-1" style={{ fontFamily: MONO, fontSize: 9.5, color: T.muted }}>connected app · reads + writes · just now</span>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1.6, color: T.faint }}>DISCONNECT</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* what agents changed */}
        <AnimatePresence initial={false}>
          {imports.length > 0 && (
            <motion.div key="changes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 14 }}>
              <Kicker>what agents changed</Kicker>
              {imports.map((im) => (
                <motion.div
                  key={im.from}
                  layout
                  initial={{ opacity: 0, y: -6, backgroundColor: "rgba(237,233,220,0.12)" }}
                  animate={{ opacity: 1, y: 0, backgroundColor: "rgba(237,233,220,0)" }}
                  transition={{ duration: 0.5, backgroundColor: { duration: 1.6 } }}
                  className="flex items-start justify-between"
                  style={{ gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.hairline}`, fontFamily: MONO, fontSize: 9.5, lineHeight: "14px" }}
                >
                  <span style={{ color: "#d4d4d4" }}>{im.line}<span style={{ color: T.muted }}> · {im.from} · just now</span></span>
                  <span className="shrink-0" style={{ fontSize: 8, letterSpacing: 1.6, color: T.faint }}>UNDO IMPORT</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ borderTop: `1px solid ${T.hairline}`, marginTop: 16, paddingTop: 14 }}>
        <Kicker>connectors</Kicker>
        {CONNECTORS.map((c) => {
          const on = conn[c.key];
          const pressing = pressed(`click_${c.key}` as Beat);
          return (
            <div key={c.key} className="flex items-start" style={{ gap: 12, padding: "11px 0", borderBottom: `1px solid ${T.hairline}` }}>
              <span className="shrink-0" style={{ marginTop: 2 }}>{c.mark}</span>
              <span style={{ width: 120 }} className="shrink-0">
                <span className="block" style={{ fontFamily: SERIF, fontSize: 16, lineHeight: "20px", color: T.white }}>{c.name}</span>
                {on && <span className="block" style={{ fontFamily: MONO, fontSize: 8.5, color: T.muted }}>just now</span>}
              </span>
              <span className="flex-1" style={{ fontFamily: MONO, fontSize: 9, lineHeight: "13px", color: T.muted }}>{c.desc}</span>
              <span
                data-tap={`conn-${c.key}`}
                className="shrink-0 text-center"
                style={{
                  width: 84,
                  padding: "5px 0",
                  border: `1px solid ${on ? "transparent" : pressing ? T.white : T.border}`,
                  background: pressing ? T.white : "transparent",
                  fontFamily: MONO,
                  fontSize: 8.5,
                  letterSpacing: 1.6,
                  color: pressing ? "#000" : on ? T.muted : T.fg,
                }}
              >
                {on ? "CONNECTED" : "CONNECT"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── consent (pages/OAuthConsent.tsx) ────────────────────────────────────── */

function Consent({ name }: { name: string }) {
  return (
    <motion.div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.78)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div initial={{ y: 14, scale: 0.98 }} animate={{ y: 0, scale: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ width: 460, background: "#050505", border: `1px solid ${T.border}`, padding: "34px 36px 26px" }}>
        <div className="text-center" style={{ fontFamily: SERIF, fontSize: 30, lineHeight: "36px", color: T.white }}>connect {name} to your brain?</div>
        <div className="flex flex-col" style={{ gap: 12, marginTop: 20, fontFamily: MONO, fontSize: 11.5, lineHeight: "18px", color: "rgba(255,255,255,0.8)" }}>
          <p>{name} will be able to read your brain: every shelf, every memory, every board. never your passwords boards.</p>
          <p className="flex items-start" style={{ gap: 10 }}>
            <span className="shrink-0 flex items-center justify-center" style={{ width: 13, height: 13, marginTop: 3, background: T.white, borderRadius: 2 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#000" strokeWidth="3.2" fill="none" /></svg>
            </span>
            <span>let it write too: remember, fix, forget and move memories, and log to boards.</span>
          </p>
          <p style={{ color: "rgba(255,255,255,0.55)" }}>you can disconnect it any time in settings → agents.</p>
        </div>
        <div data-tap="allow" className="flex items-center justify-center" style={{ marginTop: 22, height: 44, background: T.white, fontFamily: MONO, fontSize: 13, color: "#000" }}>connect · reads + writes</div>
        <div className="text-center" style={{ marginTop: 10, fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>don&apos;t connect</div>
      </motion.div>
    </motion.div>
  );
}

/* ── receipts (workspace/ConnectorReceiptModal.tsx, StudioModal) ─────────── */

const RECEIPTS: Record<string, { title: string; headline: string; sub: string; group: string; items: string[] }> = {
  gcal: {
    title: "google calendar connected",
    headline: "your events now flow both ways.",
    sub: "next 2 weeks, into schedule",
    group: "personal → schedule",
    items: ["dentist · tue 5:00 pm", "mom's bday dinner · sat 7:00 pm", "design club · thu 6:30 pm"],
  },
  granola: {
    title: "granola connected",
    headline: "6 meetings read, 2 things filed.",
    sub: "from design club sync, 1:1 with priya, intro call and 3 more",
    group: "work → meetings",
    items: ["you'll send priya the deck by friday", "design club wants a demo on the 14th"],
  },
  canvas: {
    title: "canvas connected",
    headline: "11 assignments, on your classes board.",
    sub: "econ 304k, rhetoric 306, m 408c",
    group: "classes",
    items: ["econ midterm · nov 6", "rhetoric essay draft · nov 3", "calc problem set 8 · fri"],
  },
};

function Receipt({ which }: { which: string }) {
  const r = RECEIPTS[which];
  return (
    <motion.div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} style={{ width: 520, background: "#0a0a0a", border: `1px solid ${T.border}`, color: T.fg }}>
        <div className="flex items-center justify-between" style={{ padding: "14px 22px", borderBottom: `1px solid ${T.hairline}`, fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: T.muted, textTransform: "uppercase" }}>
          {r.title}
          <CloseIcon />
        </div>
        <div style={{ padding: "18px 22px 20px" }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: "28px", color: T.white }}>{r.headline}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.muted, marginTop: 4 }}>{r.sub}</div>
          <div className="flex items-baseline justify-between" style={{ marginTop: 18, paddingBottom: 6, borderBottom: "1px solid rgba(237,233,220,0.15)", fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: T.muted, textTransform: "uppercase" }}>
            <span>{r.group}</span>
            <span style={{ letterSpacing: 0 }}>{r.items.length}</span>
          </div>
          {r.items.map((it, i) => (
            <motion.div
              key={it}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.3 }}
              style={{ padding: "9px 0", borderBottom: i < r.items.length - 1 ? "1px solid rgba(237,233,220,0.05)" : "none", fontFamily: SERIF, fontSize: 15, lineHeight: "22px" }}
            >
              {it}
            </motion.div>
          ))}
          <div data-tap="gotit" className="inline-flex items-center" style={{ marginTop: 14, padding: "7px 16px", border: `1px solid ${T.border}`, fontFamily: MONO, fontSize: 11, color: T.fg }}>got it</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── the gemini window (a chat app with xyra connected) ──────────────────── */

const QUESTION = "what do you know about me?";

const ANSWER: { label: string; text: string; from: string }[] = [
  { label: "you", text: "junior at UT, econ major, building a budgeting app on weekends", from: "claude" },
  { label: "training", text: "push / pull / legs, 4× a week. push day tonight: chest + tris", from: "xyra · chatgpt" },
  { label: "this week", text: "dentist tue 5pm, design club thu, mom's bday dinner sat", from: "google calendar" },
  { label: "you owe", text: "priya the deck by friday, and your prof an email about the essay", from: "granola · xyra" },
  { label: "due soon", text: "rhetoric essay draft nov 3, econ midterm nov 6", from: "canvas" },
  { label: "goals", text: "bench 225 by december, $2k saved for the summer trip", from: "claude" },
];

function GeminiWindow({ at, beat }: { at: (b: Beat) => boolean; beat: Beat }) {
  const [typed, setTyped] = useState(0);
  const started = at("typing");
  const typing = started && !at("click_send");
  useEffect(() => {
    if (!started) { setTyped(0); return; }
    if (!typing) { setTyped(QUESTION.length); return; }
    const id = window.setInterval(() => setTyped((n) => Math.min(QUESTION.length, n + 1)), 48);
    return () => window.clearInterval(id);
  }, [started, typing]);
  const sent = at("click_send");

  return (
    <motion.div
      className="absolute z-40 flex flex-col overflow-hidden"
      style={{ left: 230, top: 70, width: 820, height: 660, background: "#ffffff", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)", color: "#1f1f1f", fontFamily: SANS }}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* title bar */}
      <div className="relative flex items-center shrink-0" style={{ height: 40, padding: "0 14px", background: "#f3f3f3", borderBottom: "1px solid #e4e4e4" }}>
        <span className="flex" style={{ gap: 7 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="rounded-full" style={{ width: 11, height: 11, background: c }} />)}
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 flex items-center" style={{ gap: 7, fontSize: 13, fontWeight: 600, color: "#444" }}>
          <GeminiMark size={15} />gemini
        </span>
        <span className="ml-auto flex items-center" style={{ gap: 6, padding: "3px 10px", borderRadius: 999, background: "#111", color: "#ede9dc", fontFamily: SERIF, fontSize: 13 }}>
          <span className="rounded-full" style={{ width: 6, height: 6, background: "#22c55e" }} />xyra
        </span>
      </div>

      {/* thread */}
      <div className="flex-1 overflow-hidden" style={{ padding: "26px 40px 0" }}>
        {sent && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
            <span style={{ padding: "10px 16px", borderRadius: 20, background: "#f0f0f0", fontSize: 15 }}>{QUESTION}</span>
          </motion.div>
        )}
        {at("tools") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col" style={{ marginTop: 18, gap: 6 }}>
            {[
              ["xyra_read", "/index.md"],
              ["xyra_search", "this week · goals · owed"],
            ].map(([tool, arg], i) => (
              <motion.span key={tool} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.35 }} className="flex items-center" style={{ gap: 8, fontFamily: MONO, fontSize: 11, color: "#6b6b6b" }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: at("answer") || i === 0 ? "#22c55e" : "#d4d4d4" }} />
                used <span style={{ color: "#1f1f1f" }}>{tool}</span> {arg}
              </motion.span>
            ))}
          </motion.div>
        )}
        {at("answer") && (
          <div className="flex" style={{ gap: 14, marginTop: 18 }}>
            <span className="shrink-0" style={{ marginTop: 2 }}><GeminiMark size={22} /></span>
            <div className="flex-1 min-w-0">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 15.5, lineHeight: "22px" }}>
                here&apos;s what your xyra brain says about you:
              </motion.div>
              <div className="flex flex-col" style={{ marginTop: 10 }}>
                {ANSWER.map((a, i) => (
                  <motion.div
                    key={a.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + i * 0.5, duration: 0.35 }}
                    className="flex items-baseline"
                    style={{ gap: 12, padding: "8px 0", borderBottom: i < ANSWER.length - 1 ? "1px solid #efefef" : "none" }}
                  >
                    <span className="shrink-0" style={{ width: 84, fontSize: 14, fontWeight: 600 }}>{a.label}</span>
                    <span className="flex-1 min-w-0" style={{ fontSize: 14.5, lineHeight: "21px", color: "#2b2b2b" }}>{a.text}</span>
                    <span className="shrink-0" style={{ padding: "2px 8px", border: "1px solid #e2e2e2", borderRadius: 999, fontFamily: MONO, fontSize: 9.5, color: "#6b6b6b" }}>{a.from}</span>
                  </motion.div>
                ))}
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 + ANSWER.length * 0.5 + 0.2 }} style={{ marginTop: 10, fontSize: 14.5, color: "#555" }}>
                want me to block an hour tomorrow for priya&apos;s deck?
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="shrink-0" style={{ padding: "12px 40px 22px" }}>
        <div className="flex items-center" style={{ height: 52, padding: "0 8px 0 20px", borderRadius: 26, border: "1px solid #e2e2e2", background: "#fafafa" }}>
          <span className="flex-1 truncate" style={{ fontSize: 15, color: sent || typed ? "#1f1f1f" : "#9a9a9a" }}>
            {sent ? "" : typed ? QUESTION.slice(0, typed) : "ask gemini"}
            {typing && <span className="inline-block align-middle" style={{ width: 1.5, height: 18, marginLeft: 1, background: "#1f1f1f" }} />}
          </span>
          <span data-tap="send" className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: beat === "click_send" ? "#555" : typed && !sent ? "#1f1f1f" : "#d4d4d4" }}>
            <ArrowUpIcon />
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── the scene ───────────────────────────────────────────────────────────── */

export default function LaptopScene({ onLoopStart }: { onLoopStart?: (startedAt: number, loopMs: number) => void } = {}) {
  const { beat, at, frozen } = useTimeline(onLoopStart);
  const canvasRef = useRef<HTMLDivElement>(null);

  let stage = 0;
  for (const [b, s] of STAGE_AT) if (at(b)) stage = s;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const paneOpen = (at("click_settings") && !at("click_close")) || (at("click_settings2") && !at("end"));
  const consent =
    at("click_claude") && !at("click_allow1") ? "claude"
    : at("click_chatgpt") && !at("click_allow2") ? "chatgpt"
    : at("click_gemini") && !at("click_allow3") ? "gemini"
    : null;
  const receipt =
    at("click_gcal") && !at("click_gotit1") ? "gcal"
    : at("click_granola") && !at("click_gotit2") ? "granola"
    : at("click_canvas") && !at("click_gotit3") ? "canvas"
    : null;
  const instant = beat === "start" || frozen;
  const sources = Math.min(stage, 5);

  return (
    <div ref={canvasRef} className="absolute inset-0 overflow-hidden" style={{ background: T.bg, color: T.fg }}>
      <Rail stage={stage} settingsOn={paneOpen} />

      {/* the world pane */}
      <div className="absolute top-0 bottom-0 right-0 overflow-hidden" style={{ left: RAIL_W }}>
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ x: paneOpen ? PANE_W / 2 : 0, scale: paneOpen ? 0.78 : 1 }}
          transition={instant ? { duration: 0 } : { duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        >
          <BrainWorldCanvas
            centerLabel="you"
            categories={WORLD}
            dark
            paper="#000000"
            cameraPosition={[0, 10, 21]}
            stageRef={stageRef}
          />
        </motion.div>

        {/* top left: what's in the brain, ticking up as things land */}
        <motion.div
          className="absolute flex items-center"
          style={{ left: 24, top: 22, gap: 8, fontFamily: MONO, fontSize: 9.5, letterSpacing: 2, color: T.muted }}
          initial={false}
          animate={{ x: paneOpen ? PANE_W : 0 }}
          transition={instant ? { duration: 0 } : { duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.span key={stage} initial={{ color: "#ffffff" }} animate={{ color: T.muted }} transition={{ duration: 1.2 }}>
            {MEMORIES[stage]} MEMORIES · {sources ? `${sources} SOURCE${sources > 1 ? "S" : ""}` : "TAP A NODE"}
          </motion.span>
        </motion.div>
        <div className="absolute flex" style={{ right: 22, top: 18, gap: 8 }}>
          <Pill>BOARDS</Pill>
          <Pill>FILTER</Pill>
          <Pill>HANDS</Pill>
        </div>
        <motion.div
          className="absolute flex items-center justify-center rounded-full"
          style={{ bottom: 30, width: 50, height: 50, background: T.fg, left: "50%", marginLeft: -25 }}
          initial={false}
          animate={{ x: paneOpen ? PANE_W / 2 : 0 }}
          transition={instant ? { duration: 0 } : { duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
        >
          <MicIcon />
        </motion.div>

        <AnimatePresence>
          {paneOpen && (
            <motion.div
              key="pane"
              className="absolute inset-0 z-20 pointer-events-none"
              initial={{ x: -PANE_W }}
              animate={{ x: 0 }}
              exit={{ x: -PANE_W }}
              transition={instant ? { duration: 0 } : { duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
            >
              <SettingsPane at={at} beat={beat} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {consent && <Consent key={`consent-${consent}`} name={consent} />}
        {receipt && <Receipt key={`receipt-${receipt}`} which={receipt} />}
      </AnimatePresence>

      <AnimatePresence>{at("gemini_open") && !at("end") && <GeminiWindow key="gemini" at={at} beat={beat} />}</AnimatePresence>

      <Cursor beat={beat} canvasRef={canvasRef} />

      {/* loop seam: fade to black at the end, come back up on the fresh start */}
      <motion.div
        className="absolute inset-0 z-[70] pointer-events-none"
        style={{ background: "#000" }}
        initial={false}
        animate={{ opacity: beat === "end" ? 1 : 0 }}
        transition={beat === "end" ? { duration: 0.5 } : { duration: 0.5, delay: 0.3 }}
      />
    </div>
  );
}
