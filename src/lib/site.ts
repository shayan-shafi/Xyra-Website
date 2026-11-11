// Canonical, absolute base URL for the marketing site. Used for SEO metadata
// (canonical links, OpenGraph, JSON-LD), the sitemap, and the RSS feed — all of
// which require absolute URLs. Override with NEXT_PUBLIC_SITE_URL in any
// environment that isn't production (e.g. a preview deploy) if you want
// absolute links to point at that origin instead.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://xyra.dev"
).replace(/\/$/, "");

/** Build an absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The alpha application — the in-site form that replaced the Google Form (2026-09-27). */
export const APPLY_PATH = "/apply";

/** The web app. "start your brain" lands on its create-account page (google, github or email);
 *  from there: the brain, a short tour, a first connection, then the $10 a seat ask. */
export const APP_ORIGIN = "https://app.xyra.dev";
/** Where a "start your brain" button on the site lands. `from` names the button, so the app's logs can tell them apart. */
export const signUpUrl = (from: string) => `${APP_ORIGIN}/create-account?src=${encodeURIComponent(`site_${from}`)}`;
export const SIGN_IN_URL = `${APP_ORIGIN}/sign-in`;
