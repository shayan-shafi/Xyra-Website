// ─── socials content ─────────────────────────────────────────────────────────
// The two rows on the socials section. Edit here, nothing else.
//
// REELS: `url` is the actual post (instagram.com/reel/…, tiktok.com/@…/video/…,
// youtube.com/shorts/…). Cards without a url render as plain cards until one
// is pasted in. `cover` is a still from the clip (9:16 looks best).
//
// FEEDBACK: real quotes only. The entries below are SAMPLES and render with a
// "sample" tag until replaced — delete `sample: true` (or the entry) once a
// real quote is in.

export type Platform = "instagram" | "tiktok" | "youtube";

export type Reel = { id: string; platform: Platform; url: string; cover: string; caption: string };

export const REELS: Reel[] = [
  { id: "sheza", platform: "instagram", url: "", cover: "/assets/sheza-vent-poster.jpg", caption: "the xyra episodes: sheza" },
  { id: "sofia", platform: "tiktok", url: "", cover: "/assets/sofia-cover.jpg", caption: "the xyra episodes: sofia" },
  { id: "day", platform: "instagram", url: "", cover: "/assets/dayinlife-cover.jpg", caption: "a day with xyra" },
  { id: "tracks", platform: "tiktok", url: "", cover: "/assets/tracks-cover.jpg", caption: "it tracks everything" },
  { id: "learn", platform: "instagram", url: "", cover: "/assets/learn-cover.jpg", caption: "learn about urself" },
  { id: "brain", platform: "youtube", url: "", cover: "/assets/brain-cover.jpg", caption: "your second brain" },
];

export type Feedback = { id: string; quote: string; who: string; via?: string; sample?: boolean };

export const FEEDBACK: Feedback[] = [
  { id: "s1", quote: "i just talk at it on the walk home and my week is built by the time i sit down.", who: "alpha tester", via: "imessage", sample: true },
  { id: "s2", quote: "first app where i didn't have to set anything up. it set itself up.", who: "alpha tester", via: "instagram dm", sample: true },
  { id: "s3", quote: "vented about my prof for two minutes. it made the to-do, the reminder, and a block on my calendar.", who: "alpha tester", via: "imessage", sample: true },
  { id: "s4", quote: "the brain thing is genuinely how i think about my week now.", who: "alpha tester", via: "tiktok comment", sample: true },
  { id: "s5", quote: "it noticed i skip the gym on wednesdays before i did.", who: "alpha tester", via: "imessage", sample: true },
];
