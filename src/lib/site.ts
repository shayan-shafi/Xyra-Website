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
