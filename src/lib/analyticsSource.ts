// Shared source normalization + color mapping for the admin analytics
// dashboard. Pure module (no server-only imports) so it can be used by both
// the server data layer (src/app/admin/analytics/data.ts) and the
// server/client chart + table components that render colored source labels.
//
// SINGLE SOURCE OF TRUTH: normalizeSource and the color map live here only.
// Do not re-declare source aliases or hard-code source colors in components.

// Known raw values (utm_source values and referrer hostnames) that should roll
// up under one canonical display source. Hostname-shaped keys (e.g.
// "l.instagram.com") double as referrer-hostname aliases — see normalizeSource's
// fallback below. The raw value is always preserved separately (rawSources) for
// debugging, since this normalization is lossy by design.
export const SOURCE_ALIASES: Record<string, string> = {
  // Instagram
  instagram: "instagram",
  ig: "instagram",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "l.instagram.com": "instagram",
  // Android in-app browsers report document.referrer as the app's package name
  // (e.g. "android-app://com.instagram.android/"), not a normal URL.
  "com.instagram.android": "instagram",

  // Facebook / Meta
  facebook: "facebook",
  fb: "facebook",
  meta: "facebook",
  "facebook.com": "facebook",
  "www.facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "l.facebook.com": "facebook",
  "com.facebook.katana": "facebook",

  // LinkedIn
  linkedin: "linkedin",
  "linkedin.com": "linkedin",
  "www.linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "com.linkedin.android": "linkedin",

  // X / Twitter
  x: "twitter",
  twitter: "twitter",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "t.co": "twitter",
  "com.twitter.android": "twitter",

  // TikTok
  tiktok: "tiktok",
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "com.zhiliaoapp.musically": "tiktok",

  // Reddit
  reddit: "reddit",
  "reddit.com": "reddit",
  "www.reddit.com": "reddit",
  "com.reddit.frontpage": "reddit",

  // YouTube
  youtube: "youtube",
  "youtu.be": "youtube",
  "youtube.com": "youtube",
  "www.youtube.com": "youtube",
  "com.google.android.youtube": "youtube",

  // Google (search / referral)
  google: "google",
  "google.com": "google",
  "www.google.com": "google",
  "com.google.android.googlequicksearchbox": "google",

  // ChatGPT
  "chatgpt.com": "chatgpt",
  chatgpt: "chatgpt",
};

// Resolves a display source from utm_source, falling back to the referrer's
// hostname when there's no UTM tag at all (e.g. an untagged click from
// l.instagram.com should still show up as "instagram", not "direct"). Strips
// common subdomain prefixes (l., m., www.) so hostname variants still match the
// same alias. "localhost" (dev-only artifact) is never treated as a real source.
export function normalizeSource(
  utmSource: string | null,
  referrerHost: string | null = null,
): string {
  const raw = utmSource?.toLowerCase().trim();
  if (raw) return SOURCE_ALIASES[raw] ?? raw;

  const host = referrerHost?.toLowerCase().trim();
  if (!host || host === "localhost") return "direct";
  const stripped = host.replace(/^(l|m|www)\./, "");
  return SOURCE_ALIASES[host] ?? SOURCE_ALIASES[stripped] ?? "direct";
}

// ── Source colors ─────────────────────────────────────────────────────────────
// Loosely brand-matched so a founder can read a chart at a glance and know which
// source is which. Not strict brand compliance — just fast recognition. Keys are
// the NORMALIZED source (post-normalizeSource), lower-case.
export const SOURCE_COLORS: Record<string, string> = {
  instagram: "#E1306C", // IG pink/magenta
  facebook: "#1877F2", // Meta blue
  linkedin: "#0A66C2", // LinkedIn blue
  twitter: "#111827", // X / Twitter near-black
  tiktok: "#EE1D52", // TikTok red accent (readable vs. its black)
  reddit: "#FF4500", // Reddit orange
  youtube: "#FF0000", // YouTube red
  google: "#4285F4", // Google blue
  chatgpt: "#10A37F", // OpenAI green
  email: "#16A34A", // green
  sms: "#22C55E", // green
  event: "#8B5CF6", // violet (in-person / QR)
  referral: "#F59E0B", // amber (ref-code traffic)
  // Imports — backfilled contacts, not an acquisition channel. Muted gray.
  survey_import: "#D1D5DB",
  notion_import: "#D1D5DB",
  import: "#D1D5DB",
  // Fallback buckets.
  direct: "#9CA3AF", // gray — direct / unknown
  other: "#6B7280", // neutral gray
};

const DEFAULT_SOURCE_COLOR = "#6B7280"; // neutral gray for anything unmapped

// Returns a stable hex color for a (normalized or raw) source string. Unknown
// sources fall back to a neutral gray so charts never break on new values.
export function getSourceColor(source: string | null | undefined): string {
  if (!source) return SOURCE_COLORS.direct;
  const key = source.toLowerCase().trim();
  return SOURCE_COLORS[key] ?? DEFAULT_SOURCE_COLOR;
}

// Human-friendly label for a normalized source. Keeps "Direct / unknown"
// consistent everywhere and title-cases the rest.
export function sourceLabel(source: string): string {
  if (source === "direct") return "Direct / unknown";
  if (source === "survey_import" || source === "notion_import" || source === "import") {
    return "Imported contacts";
  }
  if (source === "chatgpt") return "ChatGPT";
  if (source === "sms") return "SMS";
  // Title-case single-word sources (instagram -> Instagram).
  return source.charAt(0).toUpperCase() + source.slice(1);
}
