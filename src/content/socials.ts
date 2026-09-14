// ─── socials content ─────────────────────────────────────────────────────────
// The reels on the socials section, in carousel order. `url` is the actual
// post; `cover` is the platform's own thumbnail (pulled 2026-09-14 — TikTok via
// oEmbed, Instagram via /media/?size=l); `video` is a self-hosted web cut of the
// clip (muted, ≤960p) — the active card plays it, cards without one show the cover.

export type Platform = "instagram" | "tiktok" | "youtube";

export type Reel = { id: string; platform: Platform; url: string; cover: string; video?: string };

export const REELS: Reel[] = [
  { id: "ig-Dcj3CRRPzh6", platform: "instagram", url: "https://www.instagram.com/p/Dcj3CRRPzh6/?hl=en", cover: "/assets/reel-ig-Dcj3CRRPzh6.jpg" },
  { id: "tt-7665116527091387661", platform: "tiktok", url: "https://www.tiktok.com/@use.xyra.dev/video/7665116527091387661", cover: "/assets/reel-tt-7665116527091387661.jpg", video: "/assets/reel-tt-7665116527091387661.mp4" },
  { id: "ig-DaofZhGPJTx", platform: "instagram", url: "https://www.instagram.com/p/DaofZhGPJTx/?hl=en", cover: "/assets/reel-ig-DaofZhGPJTx.jpg" },
  { id: "tt-7654768086301543693", platform: "tiktok", url: "https://www.tiktok.com/@use.xyra.dev/video/7654768086301543693", cover: "/assets/reel-tt-7654768086301543693.jpg", video: "/assets/reel-tt-7654768086301543693.mp4" },
  { id: "ig-DXxhk31vIgG", platform: "instagram", url: "https://www.instagram.com/p/DXxhk31vIgG/?hl=en", cover: "/assets/reel-ig-DXxhk31vIgG.jpg" },
  { id: "tt-7657347197335309581", platform: "tiktok", url: "https://www.tiktok.com/@use.xyra.dev/video/7657347197335309581", cover: "/assets/reel-tt-7657347197335309581.jpg", video: "/assets/reel-tt-7657347197335309581.mp4" },
  { id: "ig-DYdUgIJP-nT", platform: "instagram", url: "https://www.instagram.com/p/DYdUgIJP-nT/?hl=en", cover: "/assets/reel-ig-DYdUgIJP-nT.jpg" },
  { id: "tt-7678466467771206926", platform: "tiktok", url: "https://www.tiktok.com/@use.xyra.dev/video/7678466467771206926", cover: "/assets/reel-tt-7678466467771206926.jpg", video: "/assets/reel-tt-7678466467771206926.mp4" },
  { id: "ig-DXaOqDSj0UO", platform: "instagram", url: "https://www.instagram.com/p/DXaOqDSj0UO/?hl=en", cover: "/assets/reel-ig-DXaOqDSj0UO.jpg" },
];
