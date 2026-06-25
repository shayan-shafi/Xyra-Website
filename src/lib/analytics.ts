// First-party anonymous analytics utility.
//
// - All identifiers are random UUIDs generated locally; we never collect email,
//   name, IP, user-agent, or any free-form input.
// - Visitor identity lives in localStorage; session rotates after 30 min idle.
// - Tracking is gated by an opt-out flag and by navigator.doNotTrack.
// - Events are sent via sendBeacon when available, with a keepalive fetch
//   fallback so they survive page-unload.

const VISITOR_KEY = "xyra_visitor_id";
const SESSION_ID_KEY = "xyra_session_id";
const SESSION_LAST_KEY = "xyra_session_last";
const FIRST_TOUCH_KEY = "xyra_first_touch";
const OPT_OUT_KEY = "xyra_analytics_opt_out";
const CONSENT_SEEN_KEY = "xyra_consent_seen";
const ONCE_SESSION_KEY = "xyra_session_once";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ENDPOINT = "/api/analytics";

export type FirstTouch = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  landing_page: string | null;
  ref_code: string | null;
};

export type CurrentTouch = {
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

export type TrackMetadata = Record<string, string | number | boolean | null>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be disabled (private mode, quota). Tracking degrades to no-op.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (older browsers): RFC4122 v4-ish from Math.random.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getVisitorId(): string {
  if (!isBrowser()) return "";
  const existing = safeGet(VISITOR_KEY);
  if (existing) return existing;
  const id = randomUUID();
  safeSet(VISITOR_KEY, id);
  return id;
}

export function getSessionId(): string {
  if (!isBrowser()) return "";
  const now = Date.now();
  const lastRaw = safeGet(SESSION_LAST_KEY);
  const last = lastRaw ? parseInt(lastRaw, 10) : 0;
  const existing = safeGet(SESSION_ID_KEY);
  if (existing && last && now - last < SESSION_TIMEOUT_MS) {
    safeSet(SESSION_LAST_KEY, String(now));
    return existing;
  }
  const id = randomUUID();
  safeSet(SESSION_ID_KEY, id);
  safeSet(SESSION_LAST_KEY, String(now));
  return id;
}

function readUtmsFromLocation(): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => {
    const v = params.get(k);
    return v && v.length > 0 ? v.slice(0, 128) : null;
  };
  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_content: get("utm_content"),
  };
}

function extractRefCodeFromPath(): string | null {
  const match = window.location.pathname.match(/^\/ref\/([a-z0-9_-]{1,32})\/?$/i);
  return match ? match[1] : null;
}

// Backfills ref_code into an already-stored first-touch record when that
// field is currently null. Called every time a visitor hits /ref/[code],
// even on later visits — so a creator's link gets reward credit for
// homepage signups, not only for signups that happen directly on the
// /ref/[code] page. First-referral-wins semantics are preserved: if
// ref_code is already set this is a no-op.
export function backfillFirstTouchRefCode(code: string): void {
  if (!isBrowser()) return;
  const existing = safeGet(FIRST_TOUCH_KEY);
  if (!existing) return; // first-touch not captured yet — getFirstTouch() handles it
  try {
    const parsed = JSON.parse(existing) as FirstTouch;
    if (!parsed.ref_code) {
      parsed.ref_code = code;
      safeSet(FIRST_TOUCH_KEY, JSON.stringify(parsed));
    }
  } catch {
    // analytics must never throw or break the page
  }
}

export function getFirstTouch(): FirstTouch {
  if (!isBrowser()) {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      referrer: null,
      landing_page: null,
      ref_code: null,
    };
  }
  const existing = safeGet(FIRST_TOUCH_KEY);
  if (existing) {
    try {
      return JSON.parse(existing) as FirstTouch;
    } catch {
      // fall through and re-capture
    }
  }
  const utms = readUtmsFromLocation();
  const referrer = document.referrer ? document.referrer.slice(0, 512) : null;
  const landing_page = window.location.pathname.slice(0, 512);
  const captured: FirstTouch = {
    ...utms,
    referrer,
    landing_page,
    ref_code: extractRefCodeFromPath(),
  };
  safeSet(FIRST_TOUCH_KEY, JSON.stringify(captured));
  return captured;
}

export function getCurrentTouch(): CurrentTouch {
  if (!isBrowser()) {
    return {
      path: "",
      referrer: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
    };
  }
  return {
    path: window.location.pathname.slice(0, 512),
    referrer: document.referrer ? document.referrer.slice(0, 512) : null,
    ...readUtmsFromLocation(),
  };
}

export function isOptedOut(): boolean {
  if (!isBrowser()) return true;
  // Respect explicit user choice first.
  if (safeGet(OPT_OUT_KEY) === "1") return true;
  // Respect Do Not Track signals (1 = on across vendor variants).
  const dnt =
    navigator.doNotTrack ||
    (window as unknown as { doNotTrack?: string }).doNotTrack ||
    (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack;
  if (dnt === "1" || dnt === "yes") return true;
  return false;
}

export function optOut(): void {
  if (!isBrowser()) return;
  safeSet(OPT_OUT_KEY, "1");
}

export function optIn(): void {
  if (!isBrowser()) return;
  safeRemove(OPT_OUT_KEY);
}

export function hasSeenConsent(): boolean {
  if (!isBrowser()) return true;
  return safeGet(CONSENT_SEEN_KEY) === "1";
}

export function markConsentSeen(): void {
  if (!isBrowser()) return;
  safeSet(CONSENT_SEEN_KEY, "1");
}

export function track(eventName: string, metadata?: TrackMetadata): void {
  if (!isBrowser()) return;
  if (isOptedOut()) return;

  // Touch the session timestamp so activity keeps the session alive.
  const visitor_id = getVisitorId();
  const session_id = getSessionId();
  const current = getCurrentTouch();

  const payload = {
    visitor_id,
    session_id,
    event_name: eventName,
    path: current.path,
    referrer: current.referrer,
    utm_source: current.utm_source,
    utm_medium: current.utm_medium,
    utm_campaign: current.utm_campaign,
    utm_content: current.utm_content,
    metadata: metadata ?? null,
  };

  const body = JSON.stringify(payload);

  // sendBeacon first — survives unload, doesn't block.
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    // fall through to fetch
  }

  // Fallback: keepalive fetch.
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // swallow — analytics must never break the page
  }
}

// Fire an event at most once per current session, keyed by a dedup string.
// The dedup state is scoped to the current session_id; when the session rotates
// (after 30 min idle), the slate is wiped so the next session can fire again.
export function trackOncePerSession(
  dedupKey: string,
  eventName: string,
  metadata?: TrackMetadata,
): void {
  if (!isBrowser()) return;
  if (isOptedOut()) return;

  const sid = getSessionId();
  let firedKeys: string[] = [];
  try {
    const raw = safeGet(ONCE_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sid?: string; keys?: unknown };
      if (parsed && parsed.sid === sid && Array.isArray(parsed.keys)) {
        firedKeys = parsed.keys.filter((k): k is string => typeof k === "string");
      }
    }
  } catch {
    firedKeys = [];
  }

  if (firedKeys.includes(dedupKey)) return;
  firedKeys.push(dedupKey);
  safeSet(ONCE_SESSION_KEY, JSON.stringify({ sid, keys: firedKeys }));

  track(eventName, metadata);
}

// Visible to debugging / tests in the browser console.
export const __analyticsStorageKeys = {
  VISITOR_KEY,
  SESSION_ID_KEY,
  SESSION_LAST_KEY,
  FIRST_TOUCH_KEY,
  OPT_OUT_KEY,
  CONSENT_SEEN_KEY,
  ONCE_SESSION_KEY,
};
