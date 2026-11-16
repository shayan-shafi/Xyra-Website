// ───────────────────────────────────────────────────────────────────────────
// Growth / Email Ops email templates
// ───────────────────────────────────────────────────────────────────────────
// Pure, dependency-free string builders — usable by both the client preview
// (EmailOps.tsx) and the server send routes.
//
// Visual language mirrors xyra.dev since the 2026-11 refresh: the logo is just
// the word "xyra" (Playfair Display, lowercase, black), white card on a near-
// white page, EB Garamond body, small mono labels, a black pill CTA, and a
// short footer with the tagline. Fonts load in Apple Mail / iOS; everywhere
// else they fall back to Georgia. Still email-client-safe (tables, inline
// styles, absolute image URLs).
//
// Editable surface: subject, preheader, eyebrow (kicker), headline, body
// content, optional CTA, optional image, optional invite block, and the
// sign-off (closing line + signature). Everything has a sensible default and
// persists with saved templates.
//
// Writing style: default copy deliberately avoids em/en dashes used as sentence
// connectors (they read as AI-written) — commas or separate sentences instead.
//
// Placeholders use {{snake_case}} tokens. Two scopes:
//   - "global"       : one admin-entered value reused for every recipient.
//   - "perRecipient" : filled per recipient by the SEND route from the
//                      person's account or waitlist row (first_name, and
//                      referral_link = their xyra.dev/invite/<CODE> link).
// A missing value renders as the literal {{token}} (never a fabricated link).
//
// Sections: templates may declare optional sections toggled in the editor. A
// placeholder tied to a disabled section is neither rendered nor required.

export type PlaceholderScope = "global" | "perRecipient";

export type PlaceholderDef = {
  key: string;
  label: string;
  example: string;
  scope: PlaceholderScope;
  required?: boolean;
  multiline?: boolean;
  help?: string;
  section?: string;
  type?: "image" | "images" | "select";
  options?: { value: string; label: string }[];
};

// A single image in a multi-image gallery field. Persisted as a JSON string in
// the regular values map (so it rides through values_json / localStorage / the
// send route with no schema change). url is always a public http(s) URL.
export type GalleryImage = { url: string; alt: string; caption: string };

export type SectionDef = { key: string; label: string; defaultEnabled: boolean };

export type GrowthTemplate = {
  id: string;
  name: string;
  description: string;
  confirmPhrase: string;
  placeholders: PlaceholderDef[];
  sections: SectionDef[];
  buildSubject: (v: Record<string, string>) => string;
  buildHtml: (v: Record<string, string>, sections?: Record<string, boolean>) => string;
  buildText: (v: Record<string, string>, sections?: Record<string, boolean>) => string;
};

const XYRA_ORIGIN = "https://xyra.dev";

// ── Shared helpers ───────────────────────────────────────────────────────────

function esc(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function raw(values: Record<string, string>, key: string): string {
  const v = values[key];
  return v && v.trim() ? v.trim() : `{{${key}}}`;
}

function has(values: Record<string, string>, key: string): boolean {
  return Boolean(values[key] && values[key].trim());
}

function lines(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}

// Brand (2026-11): the logo is just the word "xyra", lowercase, in Playfair
// Display, black on white. Apple Mail / iOS load the web fonts from the <link>
// in the head; Gmail and Outlook fall back to Georgia, which reads the same.
const WORDMARK = "'Playfair Display',Georgia,'Times New Roman',serif";
const SERIF = "'EB Garamond',Georgia,'Times New Roman',Times,serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
const INK = "#111111";
const BODY_INK = "#333333";
const FAINT = "#8c8c8c";
const HAIRLINE = "#ececec";
const TINT = "#f7f7f5";
const TAGLINE = "the outlet for your ambitious mind";

function paragraph(html: string): string {
  return `<p style="margin:0 0 18px;font-family:${SERIF};font-size:16px;line-height:1.7;color:${BODY_INK};">${html}</p>`;
}

function headlineBlock(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${WORDMARK};font-size:28px;line-height:1.2;color:${INK};font-weight:400;">${esc(text)}</h1>`;
}

function htmlList(items: string[]): string {
  if (items.length === 0) return "";
  return `<ul style="margin:0 0 18px;padding-left:20px;">${items
    .map(i => `<li style="font-family:${SERIF};font-size:16px;line-height:1.65;color:${BODY_INK};margin:0 0 8px;">${esc(i)}</li>`)
    .join("")}</ul>`;
}

// ── Image gallery (multi-image) ──────────────────────────────────────────────
// Stored as a JSON string in a single values key. Only entries with a valid
// http(s) URL survive parsing, so an empty/placeholder field never renders an
// image block in the actual email.

const HTTP_RE = /^https?:\/\//i;

export function parseGallery(value: string | undefined): GalleryImage[] {
  if (!value || !value.trim()) return [];
  let arr: unknown;
  try { arr = JSON.parse(value); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: GalleryImage[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!HTTP_RE.test(url)) continue;
    out.push({
      url,
      alt: typeof o.alt === "string" ? o.alt.trim() : "",
      caption: typeof o.caption === "string" ? o.caption.trim() : "",
    });
  }
  return out;
}

export function serializeGallery(images: GalleryImage[]): string {
  const clean = images
    .filter(i => HTTP_RE.test((i.url || "").trim()))
    .map(i => ({ url: i.url.trim(), alt: (i.alt || "").trim(), caption: (i.caption || "").trim() }));
  return clean.length ? JSON.stringify(clean) : "";
}

function galleryImg(img: GalleryImage, maxWidth: number): string {
  return `<img src="${esc(img.url)}" alt="${esc(img.alt)}" style="display:block;width:100%;max-width:${maxWidth}px;height:auto;border-radius:12px;border:1px solid ${HAIRLINE};margin:0 auto;" />`;
}

function galleryCaption(caption: string): string {
  return caption
    ? `<p style="margin:6px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${FAINT};text-align:center;">${esc(caption)}</p>`
    : "";
}

// A single image, full content width, caption centered beneath.
function singleImageRow(img: GalleryImage, maxWidth: number): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;"><tr><td align="center">${galleryImg(img, maxWidth)}${galleryCaption(img.caption)}</td></tr></table>`;
}

// Two images side by side on wide screens, stacking on narrow ones. Uses the
// "fluid hybrid" technique: inline-block columns with a max-width wrap on their
// own when the viewport is narrower than two columns (no media queries, which
// Gmail strips), plus MSO conditional tables so desktop Outlook holds the row.
// The parent cell uses font-size:0 to remove inline-block whitespace, and the
// two columns are concatenated with no whitespace between them.
function twoUpRow(a: GalleryImage, b: GalleryImage): string {
  const col = (img: GalleryImage) =>
    `<div style="display:inline-block;width:100%;max-width:228px;vertical-align:top;text-align:center;font-size:14px;"><div style="padding:0 6px 4px;"><img src="${esc(img.url)}" alt="${esc(img.alt)}" style="display:block;width:100%;height:auto;border-radius:12px;border:1px solid ${HAIRLINE};" />${galleryCaption(img.caption)}</div></div>`;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 14px;"><tr><td align="center" style="font-size:0;">` +
    `<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="50%" valign="top" align="center"><![endif]-->` +
    col(a) +
    `<!--[if mso]></td><td width="50%" valign="top" align="center"><![endif]-->` +
    col(b) +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table>`
  );
}

// 0 images → nothing. 1 → full width. 2 → side-by-side (stacks on mobile).
// 3+ → stacked full-width rows (always email-safe).
function galleryHtml(images: GalleryImage[]): string {
  if (images.length === 0) return "";
  if (images.length === 1) return singleImageRow(images[0], 480);
  if (images.length === 2) return twoUpRow(images[0], images[1]);
  return images.map(img => singleImageRow(img, 480)).join("");
}

// Plain-text: one line per image — "caption: url" when a caption exists, else
// just the url. Returns [] for no images so the block is omitted entirely.
function galleryTextLines(images: GalleryImage[]): string[] {
  return images.map(img => (img.caption ? `${img.caption}: ${img.url}` : img.url));
}

// Newsletter "behind the scenes" images, with backward-compatibility for the
// earlier single-image field (behind_scenes_image_url) so older saved drafts
// keep rendering their image.
function behindScenesImages(v: Record<string, string>): GalleryImage[] {
  const gallery = parseGallery(v.behind_scenes_images);
  if (gallery.length) return gallery;
  const legacy = (v.behind_scenes_image_url ?? "").trim();
  return HTTP_RE.test(legacy) ? [{ url: legacy, alt: "", caption: "" }] : [];
}

function eyebrowHeader(text: string): string {
  return `<p style="margin:28px 0 10px;font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${FAINT};">${esc(text)}</p>`;
}

function pillButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr>
    <td style="border-radius:999px;background:${INK};">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-family:${SANS};font-size:14px;font-weight:600;">${esc(label)}</a>
    </td></tr></table>`;
}

// The invite link (xyra.dev/invite/<CODE>) gives a friend a free week. It is
// filled per recipient: their own invite code, or for people without an
// account the shared fallback code (a trial code). Neither → no block, never
// a {{token}}.
function inviteBlock(v: Record<string, string>, introHtml: string): string {
  return has(v, "referral_link") ? referralBlock(introHtml, raw(v, "referral_link")) : "";
}
function inviteText(v: Record<string, string>, intro: string): string[] {
  return has(v, "referral_link") ? [``, intro, raw(v, "referral_link")] : [];
}

function referralBlock(introHtml: string, link: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:${TINT};border:1px solid ${HAIRLINE};border-radius:12px;">
    <tr><td style="padding:16px 18px;">
      <p style="margin:0 0 6px;font-family:${SERIF};font-size:15px;line-height:1.6;color:${BODY_INK};">${introHtml}</p>
      <a href="${esc(link)}" style="font-family:${SANS};font-size:13px;color:${INK};font-weight:600;word-break:break-all;">${esc(link)}</a>
    </td></tr></table>`;
}

// Editable sign-off: closing line (optional) + signature.
function signoffHtml(v: Record<string, string>): string {
  const closing = (v.signoff_closing ?? "").trim();
  const name = (v.signoff_name ?? "").trim() || "Cole and Shayan";
  const closingLine = closing ? `${esc(closing)}<br>` : "";
  return `<p style="margin:24px 0 0;font-family:${SERIF};font-size:16px;line-height:1.7;color:${INK};">${closingLine}${esc(name)}</p>`;
}

function signoffText(v: Record<string, string>): string[] {
  const closing = (v.signoff_closing ?? "").trim();
  const name = (v.signoff_name ?? "").trim() || "Cole and Shayan";
  return closing ? [``, closing, name] : [``, name];
}

// ── Personalized greeting ────────────────────────────────────────────────────
// The import placeholder name (used for waitlist rows that have no real name)
// must never appear in a greeting like "Hi Xyra waitlist member,". A name is
// only usable for personalization when it's non-empty and not that placeholder;
// otherwise we fall back to a neutral, name-less greeting.
export const NAME_PLACEHOLDER = "Xyra waitlist member";

export function usableFirstName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  if (n.toLowerCase() === NAME_PLACEHOLDER.toLowerCase()) return "";
  return n.split(/\s+/)[0] || "";
}

// HTML/text greeting line. `first_name` in `values` is already the usable first
// name (set by buildRecipientValues on a real send, or the admin's preview
// value). Empty/placeholder -> neutral "Hey," with no name.
function greetingLine(v: Record<string, string>): string {
  const fn = (v.first_name ?? "").trim();
  return fn && fn.toLowerCase() !== NAME_PLACEHOLDER.toLowerCase() ? `Hi ${fn},` : `Hey,`;
}
function greetingHtml(v: Record<string, string>): string {
  return paragraph(esc(greetingLine(v)));
}
function greetingText(v: Record<string, string>): string {
  return greetingLine(v);
}

function emailShell(opts: { kicker: string; preheader?: string; bodyHtml: string }): string {
  const { kicker, preheader, bodyHtml } = opts;
  const kickerText = kicker.trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>xyra</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=EB+Garamond:wght@400;500&family=JetBrains+Mono&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${TINT};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${TINT};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;overflow:hidden;">

          <!-- Wordmark: the logo is the word, nothing else -->
          <tr>
            <td style="padding:32px 40px 0;">
              <a href="${XYRA_ORIGIN}" style="font-family:${WORDMARK};font-size:26px;font-weight:600;line-height:1;color:${INK};text-decoration:none;">xyra</a>
            </td>
          </tr>
          ${kickerText ? `<!-- Eyebrow -->
          <tr>
            <td style="padding:22px 40px 0;">
              <p style="margin:0;font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${FAINT};">${esc(kickerText)}</p>
            </td>
          </tr>` : ""}

          <!-- Body -->
          <tr>
            <td style="padding:${kickerText ? "18px" : "26px"} 40px 34px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 26px;border-top:1px solid ${HAIRLINE};">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${FAINT};">
                <a href="${XYRA_ORIGIN}" style="font-family:${WORDMARK};font-size:14px;font-weight:600;color:${INK};text-decoration:none;">xyra</a>&nbsp; ${TAGLINE}<br>
                You're getting this because you signed up for xyra. Just reply if you'd rather not hear from us.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textFooter(): string[] {
  return [
    ``,
    `--`,
    `xyra, ${TAGLINE}`,
    XYRA_ORIGIN,
    `You're getting this because you signed up for xyra. Just reply if you'd rather not hear from us.`,
  ];
}

function makeOn(sections?: Record<string, boolean>) {
  return (key: string) => sections?.[key] !== false;
}

function preheaderOf(v: Record<string, string>, fallback: string): string {
  return has(v, "preheader") ? raw(v, "preheader") : fallback;
}

// Optional editable display name used in the email's From header
// ("Cole from Xyra" <address>). Blank = fall back to the send route's default.
function senderFields(defaultDisplay: string): PlaceholderDef[] {
  return [
    { key: "from_display_name", label: "From display name", example: defaultDisplay, scope: "global", help: "Shown as the sender name in the recipient's inbox. Blank uses the default." },
  ];
}

// Shared editable header/sign-off fields appended to every template.
function headerFields(eyebrowExample: string, headlineExample: string): PlaceholderDef[] {
  return [
    { key: "preheader", label: "Preheader (inbox preview text)", example: "", scope: "global", help: "Optional. The grey text shown after the subject in most inboxes." },
    { key: "eyebrow", label: "Small label above the message (optional)", example: eyebrowExample, scope: "global" },
    { key: "headline", label: "Headline (optional, large title in the body)", example: headlineExample, scope: "global" },
  ];
}
function signoffFields(): PlaceholderDef[] {
  return [
    { key: "signoff_closing", label: "Sign-off closing", example: "Thanks,", scope: "global" },
    { key: "signoff_name", label: "Sign-off signature", example: "Cole and Shayan", scope: "global", required: true },
  ];
}

// ── Video block ──────────────────────────────────────────────────────────────
// Email can't play video, so a video is a clickable thumbnail plus a "Watch"
// button that opens the link. YouTube and Loom links get their thumbnail for
// free; anything else (X, Drive, a raw .mp4) uses an uploaded thumbnail, or
// just the button when there is none.

export function videoThumbnail(link: string): string | null {
  const u = link.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  const loom = u.match(/loom\.com\/(?:share|embed)\/([0-9a-f]{32})/i);
  if (loom) return `https://cdn.loom.com/sessions/thumbnails/${loom[1]}-with-play.gif`;
  return null;
}

function videoHtml(v: Record<string, string>): string {
  if (!has(v, "video_link")) return "";
  const link = raw(v, "video_link");
  const thumb = has(v, "video_thumbnail") && HTTP_RE.test(v.video_thumbnail.trim()) ? v.video_thumbnail.trim() : videoThumbnail(link);
  const title = has(v, "video_title") ? raw(v, "video_title") : "";
  const label = has(v, "video_button") ? raw(v, "video_button") : "▶  Watch the video";
  return [
    eyebrowHeader("Watch"),
    ...(title ? [paragraph(esc(title))] : []),
    thumb
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td align="center"><a href="${esc(link)}" style="text-decoration:none;"><img src="${esc(thumb)}" alt="${esc(title || "Watch the video")}" style="display:block;width:100%;max-width:480px;height:auto;border-radius:12px;border:1px solid ${HAIRLINE};" /></a></td></tr></table>`
      : "",
    pillButton(label, link),
  ].join("");
}

function videoText(v: Record<string, string>): string[] {
  if (!has(v, "video_link")) return [];
  return [``, `Watch${has(v, "video_title") ? `: ${raw(v, "video_title")}` : ""}`, raw(v, "video_link")];
}

// ── Template 2: Weekly newsletter / update ──────────────────────────────────

const newsletter: GrowthTemplate = {
  id: "newsletter",
  name: "Weekly Update",
  description: "The regular update: what shipped, what's next, what we need. Turn sections on and off for each send.",
  confirmPhrase: "SEND NEWSLETTER",
  sections: [
    { key: "quick_update", label: "Quick update", defaultEnabled: true },
    { key: "video", label: "Video", defaultEnabled: false },
    { key: "shipped", label: "What we shipped", defaultEnabled: true },
    { key: "working_on", label: "What we're working on", defaultEnabled: true },
    { key: "fixed", label: "What we fixed", defaultEnabled: true },
    { key: "behind_scenes", label: "Behind the scenes", defaultEnabled: true },
    { key: "ask", label: "What we need from you", defaultEnabled: true },
    { key: "referral", label: "Invite a friend", defaultEnabled: true },
  ],
  placeholders: [
    { key: "first_name", label: "First name", example: "Alex", scope: "perRecipient", required: true, help: "Auto-filled per recipient on a real send." },
    ...senderFields("Cole and Shayan from xyra"),
    ...headerFields("this week in xyra", ""),
    { key: "opening", label: "Opening line", example: "Here's what changed in xyra this week.", scope: "global", required: true, multiline: true },
    { key: "quick_update", label: "Quick update", example: "The big one: xyra now works on your laptop at app.xyra.dev, synced with your phone.", scope: "global", required: true, multiline: true, section: "quick_update" },
    { key: "video_link", label: "Video link", example: "", scope: "global", section: "video", help: "YouTube, Loom, X, Google Drive, anything with a public link. YouTube and Loom show their thumbnail on their own." },
    { key: "video_title", label: "Line above the video (optional)", example: "Two minutes of how I actually use xyra this week.", scope: "global", section: "video" },
    { key: "video_thumbnail", label: "Thumbnail (optional)", example: "", scope: "global", section: "video", type: "image", help: "Only needed for links that aren't YouTube or Loom. Without one, the email shows just the Watch button." },
    { key: "video_button", label: "Button label", example: "▶  Watch the video", scope: "global", section: "video" },
    { key: "shipped", label: "What we shipped (one per line)", example: "Send it to your laptop from the website\nWidgets for your to-dos, schedule and classes", scope: "global", multiline: true, section: "shipped" },
    { key: "working_on", label: "What we're working on (one per line)", example: "Faster replies when you talk to xyra\nMore of your apps feeding your brain", scope: "global", multiline: true, section: "working_on" },
    { key: "fixed", label: "What we fixed (one per line)", example: "Reminders landing on the wrong day\nThe app hanging on the splash screen", scope: "global", multiline: true, section: "fixed" },
    { key: "behind_scenes_note", label: "Behind the scenes note", example: "Late nights, lots of coffee, and every piece of feedback you send us read twice.", scope: "global", multiline: true, section: "behind_scenes" },
    { key: "behind_scenes_images", label: "Behind the scenes images", example: "", scope: "global", section: "behind_scenes", type: "images", help: "Upload one or more images, one at a time (e.g. one of Cole and one of Shayan). Add optional alt text and a caption for each. Two images sit side by side and stack on mobile. If none are added, no image block is shown." },
    { key: "ask", label: "What we need from you", example: "Reply and tell us the one thing you wish xyra did for you.", scope: "global", multiline: true, section: "ask" },
    ...signoffFields(),
    { key: "fallback_invite_code", label: "Code for people without an account", example: "FRIENDWEEK", scope: "global", section: "referral", help: "People with an account get their own invite link. Everyone else gets xyra.dev/invite/ this code (a shared free-week code). Blank = they get no invite block." },
    { key: "referral_link", label: "Invite link", example: "https://xyra.dev/invite/ABC234", scope: "perRecipient", section: "referral", help: "Each person's own invite link, or the shared code above for people without an account." },
  ],
  buildSubject: () => "this week in xyra",
  buildHtml: (v, sections) => {
    const on = makeOn(sections);
    const shipped = on("shipped") ? htmlList(lines(v.shipped)) : "";
    const working = on("working_on") ? htmlList(lines(v.working_on)) : "";
    const fixed = on("fixed") ? htmlList(lines(v.fixed)) : "";
    const bsImages = behindScenesImages(v);
    const hasImg = bsImages.length > 0;
    const hasNote = has(v, "behind_scenes_note");
    const behindScenes =
      on("behind_scenes") && (hasImg || hasNote)
        ? [
            eyebrowHeader("Behind the scenes"),
            ...(hasImg ? [galleryHtml(bsImages)] : []),
            ...(hasNote ? [paragraph(esc(raw(v, "behind_scenes_note")))] : []),
          ]
        : [];
    const body = [
      ...(has(v, "headline") ? [headlineBlock(raw(v, "headline"))] : []),
      greetingHtml(v),
      paragraph(esc(raw(v, "opening"))),
      ...(on("quick_update") ? [eyebrowHeader("Quick update"), paragraph(esc(raw(v, "quick_update")))] : []),
      ...(on("video") ? [videoHtml(v)] : []),
      ...(shipped ? [eyebrowHeader("What we shipped"), shipped] : []),
      ...(working ? [eyebrowHeader("What we're working on"), working] : []),
      ...(fixed ? [eyebrowHeader("What we fixed"), fixed] : []),
      ...behindScenes,
      ...(on("ask") ? [eyebrowHeader("What we need from you"), paragraph(esc(raw(v, "ask")))] : []),
      ...(on("referral") ? [inviteBlock(v, "Know someone who'd love this? your invite link gives a friend a free week of xyra:")] : []),
      signoffHtml(v),
    ].join("");
    return emailShell({ kicker: v.eyebrow ?? "", preheader: preheaderOf(v, raw(v, "opening").slice(0, 120)), bodyHtml: body });
  },
  buildText: (v, sections) => {
    const on = makeOn(sections);
    const block = (title: string, items: string[]) => (items.length ? [``, `${title}:`, ...items.map(i => `- ${i}`)] : []);
    return [
      ...(has(v, "headline") ? [raw(v, "headline"), ``] : []),
      greetingText(v),
      ``,
      raw(v, "opening"),
      ...(on("quick_update") ? [``, `Quick update:`, raw(v, "quick_update")] : []),
      ...(on("video") ? videoText(v) : []),
      ...(on("shipped") ? block("What we shipped", lines(v.shipped)) : []),
      ...(on("working_on") ? block("What we're working on", lines(v.working_on)) : []),
      ...(on("fixed") ? block("What we fixed", lines(v.fixed)) : []),
      ...(on("behind_scenes") ? (() => {
        const imgs = behindScenesImages(v);
        const noteOn = has(v, "behind_scenes_note");
        if (!imgs.length && !noteOn) return [];
        return [``, `Behind the scenes:`, ...(noteOn ? [raw(v, "behind_scenes_note")] : []), ...galleryTextLines(imgs)];
      })() : []),
      ...(on("ask") ? [``, `What we need from you:`, raw(v, "ask")] : []),
      ...(on("referral") ? inviteText(v, "Know someone who'd love this? your invite link gives a friend a free week of xyra:") : []),
      ...signoffText(v),
      ...textFooter(),
    ].join("\n");
  },
};

// ── Template 3: General message ────────────────────────────────────

const generalMessage: GrowthTemplate = {
  id: "general-message",
  name: "General Message",
  description: "A one-off branded message: an announcement, a reminder, a follow-up.",
  confirmPhrase: "SEND MESSAGE",
  sections: [
    { key: "images", label: "Photos", defaultEnabled: false },
    { key: "cta", label: "Call-to-action button", defaultEnabled: false },
    { key: "referral", label: "Invite a friend", defaultEnabled: false },
  ],
  placeholders: [
    { key: "first_name", label: "First name", example: "Alex", scope: "perRecipient", required: true, help: "Auto-filled per recipient on a real send." },
    ...senderFields("Cole and Shayan from xyra"),
    ...headerFields("", ""),
    { key: "message_body", label: "Message (paragraphs separated by blank lines)", example: "Thanks for using xyra. We wanted to share something quick.\n\nMore soon.", scope: "global", required: true, multiline: true },
    { key: "message_images", label: "Photos", example: "", scope: "global", section: "images", type: "images", help: "Optional. Upload one or more images, one at a time, each with optional alt text and a caption. Two images sit side by side and stack on mobile." },
    { key: "cta_label", label: "Button label", example: "Read more", scope: "global", section: "cta", help: "Shown only if both button label and link are filled." },
    { key: "cta_link", label: "Button link", example: "", scope: "global", section: "cta", help: "Public HTTPS URL." },
    { key: "referral_intro", label: "Invite line", example: "Your invite link gives a friend a free week of xyra:", scope: "global", section: "referral", multiline: true },
    ...signoffFields(),
    { key: "fallback_invite_code", label: "Code for people without an account", example: "FRIENDWEEK", scope: "global", section: "referral", help: "People with an account get their own invite link. Everyone else gets xyra.dev/invite/ this code (a shared free-week code). Blank = they get no invite block." },
    { key: "referral_link", label: "Invite link", example: "https://xyra.dev/invite/ABC234", scope: "perRecipient", section: "referral", help: "Each person's own invite link, or the shared code above for people without an account." },
  ],
  buildSubject: () => "a quick note from xyra",
  buildHtml: (v, sections) => {
    const on = makeOn(sections);
    const paras = (v.message_body ?? "")
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => paragraph(esc(p).replace(/\n/g, "<br>")));
    const images = on("images") ? parseGallery(v.message_images) : [];
    const imagesHtml = images.length ? galleryHtml(images) : "";
    const cta = on("cta") && has(v, "cta_label") && has(v, "cta_link") ? pillButton(raw(v, "cta_label"), raw(v, "cta_link")) : "";
    const referral = on("referral") && has(v, "referral_intro") ? inviteBlock(v, esc(raw(v, "referral_intro"))) : "";
    const body = [
      ...(has(v, "headline") ? [headlineBlock(raw(v, "headline"))] : []),
      greetingHtml(v),
      ...(paras.length ? paras : [paragraph(esc(raw(v, "message_body")))]),
      imagesHtml,
      cta,
      referral,
      signoffHtml(v),
    ].join("");
    return emailShell({ kicker: v.eyebrow ?? "", preheader: preheaderOf(v, (v.message_body ?? "").slice(0, 120)), bodyHtml: body });
  },
  buildText: (v, sections) => {
    const on = makeOn(sections);
    const images = on("images") ? parseGallery(v.message_images) : [];
    const imageLines = images.length ? [``, ...galleryTextLines(images)] : [];
    const cta = on("cta") && has(v, "cta_label") && has(v, "cta_link") ? [``, `${raw(v, "cta_label")}: ${raw(v, "cta_link")}`] : [];
    const referral = on("referral") && has(v, "referral_intro") ? inviteText(v, raw(v, "referral_intro")) : [];
    return [
      ...(has(v, "headline") ? [raw(v, "headline"), ``] : []),
      greetingText(v),
      ``,
      raw(v, "message_body"),
      ...imageLines,
      ...cta,
      ...referral,
      ...signoffText(v),
      ...textFooter(),
    ].join("\n");
  },
};

// ── Template 4: Plain personal message ──────────────────────────────────────
// No branded shell, no logo, no gold rule, no footer boilerplate. Reads like a
// real one-to-one email. Sends from a whitelisted address (server-enforced).

export const PLAIN_FROM_WHITELIST = ["team@xyra.dev", "cole@xyra.dev", "shayan@xyra.dev"] as const;

// Resolves the Resend `from` header for a send. Plain-message uses one of the
// whitelisted bare addresses (with an optional display name); other templates
// use the configured GROWTH_EMAIL_FROM address, with the display name coming
// from `from_display_name` when set, else a template-specific default.
// Returns { from } on success or { error } when a plain-message from_address is
// missing/not whitelisted (real send only — test-send falls back silently).
export function resolveSenderFrom(opts: {
  templateId: string;
  values: Record<string, string>;
  fallbackAddress: string;
  requireWhitelistedPlainAddress: boolean;
}): { from: string; error?: undefined } | { from?: undefined; error: string } {
  const { templateId, values, fallbackAddress, requireWhitelistedPlainAddress } = opts;
  const displayName = (values.from_display_name ?? "").trim();

  if (templateId === "plain-message") {
    const requested = (values.from_address ?? "").trim().toLowerCase();
    const allowed = (PLAIN_FROM_WHITELIST as readonly string[]).includes(requested);
    if (!allowed) {
      if (requireWhitelistedPlainAddress) {
        return { error: `from_address must be one of: ${PLAIN_FROM_WHITELIST.join(", ")}.` };
      }
      const bare = fallbackAddress.replace(/^.*<([^>]+)>.*$/, "$1");
      return { from: displayName ? `${displayName} <${bare}>` : bare };
    }
    return { from: displayName ? `${displayName} <${requested}>` : requested };
  }

  if (fallbackAddress.includes("<")) {
    const bare = fallbackAddress.replace(/^.*<([^>]+)>.*$/, "$1");
    return { from: displayName ? `${displayName} <${bare}>` : fallbackAddress };
  }
  return { from: `${displayName || "xyra"} <${fallbackAddress}>` };
}

const plainMessage: GrowthTemplate = {
  id: "plain-message",
  name: "Plain Message",
  description: "A no-frills message with no branded shell. Reads like a real personal email.",
  confirmPhrase: "SEND PLAIN",
  sections: [],
  placeholders: [
    { key: "first_name", label: "First name", example: "Alex", scope: "perRecipient", required: true, help: "Auto-filled per recipient on a real send." },
    { key: "from_address", label: "From address", example: "team@xyra.dev", scope: "global", required: true, type: "select", options: PLAIN_FROM_WHITELIST.map(e => ({ value: e, label: e })), help: "Which address this sends from. Only these three are allowed." },
    { key: "from_display_name", label: "From display name", example: "Cole from xyra", scope: "global", help: "Shown as the sender name in the recipient's inbox. Blank sends as the bare address." },
    { key: "message_body", label: "Message (paragraphs separated by blank lines)", example: "I wanted to reach out directly. You've been using xyra for a bit and I'd love to hear what's working and what isn't.\n\nAny chance you have 15 minutes this week?", scope: "global", required: true, multiline: true },
    { key: "cta_label", label: "Button label (optional)", example: "", scope: "global", help: "Optional. Shown only when both label and link are filled." },
    { key: "cta_link", label: "Button link (optional)", example: "", scope: "global", help: "Public HTTPS URL. Renders as a simple underlined link between the body and the sign-off." },
    { key: "signoff_closing", label: "Sign-off closing", example: "Thanks,", scope: "global" },
    { key: "signoff_name", label: "Sign-off name", example: "Cole", scope: "global", required: true },
    { key: "postscript", label: "Postscript (after sign-off, optional)", example: "", scope: "global", multiline: true, help: "Shown as a separate paragraph below your sign-off. Any https:// URL becomes a clickable link." },
  ],
  buildSubject: () => "",
  buildHtml: (v) => {
    const first = (v.first_name ?? "").trim();
    const greeting = first && first.toLowerCase() !== NAME_PLACEHOLDER.toLowerCase() ? `Hi ${first},` : `Hey,`;
    const paras = (v.message_body ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const bodyParas = paras.length ? paras : [(v.message_body ?? "").trim()];
    const paraHtml = bodyParas
      .map(p => `<p style="margin:0 0 14px;">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    const ctaLabel = (v.cta_label ?? "").trim();
    const ctaLink = (v.cta_link ?? "").trim();
    const ctaHtml = ctaLabel && ctaLink
      ? `<p style="margin:0 0 14px;"><a href="${esc(ctaLink)}" style="color:#111;">${esc(ctaLabel)}</a></p>`
      : "";
    const closing = (v.signoff_closing ?? "").trim();
    const name = (v.signoff_name ?? "").trim() || "Cole";
    const closingLine = closing ? `${esc(closing)}<br>` : "";
    const postscript = (v.postscript ?? "").trim();
    const linkify = (s: string) => esc(s).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#111;">${u}</a>`);
    const psParas = postscript.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const psHtml = psParas
      .map(p => `<p style="margin:18px 0 0;color:#555;">${linkify(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:16px;font-family:${SANS};font-size:15px;line-height:1.6;color:#111;">
<p style="margin:0 0 14px;">${esc(greeting)}</p>
${paraHtml}${ctaHtml}<p style="margin:14px 0 0;">${closingLine}${esc(name)}</p>${psHtml}
</body></html>`;
  },
  buildText: (v) => {
    const first = (v.first_name ?? "").trim();
    const greeting = first && first.toLowerCase() !== NAME_PLACEHOLDER.toLowerCase() ? `Hi ${first},` : `Hey,`;
    const paras = (v.message_body ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const bodyParas = paras.length ? paras : [(v.message_body ?? "").trim()];
    const ctaLabel = (v.cta_label ?? "").trim();
    const ctaLink = (v.cta_link ?? "").trim();
    const ctaLines = ctaLabel && ctaLink ? [``, `${ctaLabel}: ${ctaLink}`] : [];
    const closing = (v.signoff_closing ?? "").trim();
    const name = (v.signoff_name ?? "").trim() || "Cole";
    const signoffLines = closing ? [``, closing, name] : [``, name];
    const postscript = (v.postscript ?? "").trim();
    const psLines = postscript ? [``, postscript] : [];
    return [greeting, ``, ...bodyParas.flatMap(p => [p, ``]), ...ctaLines, ...signoffLines, ...psLines].join("\n");
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const GROWTH_TEMPLATES: GrowthTemplate[] = [newsletter, generalMessage, plainMessage];

export function getGrowthTemplate(id: string): GrowthTemplate | null {
  return GROWTH_TEMPLATES.find(t => t.id === id) ?? null;
}

export const PER_RECIPIENT_KEYS = ["first_name", "referral_link"] as const;

export function defaultValues(tpl: GrowthTemplate): Record<string, string> {
  return Object.fromEntries(tpl.placeholders.map(p => [p.key, p.example]));
}

export function defaultSubject(tpl: GrowthTemplate): string {
  return tpl.buildSubject(defaultValues(tpl));
}

export function defaultSections(tpl: GrowthTemplate): Record<string, boolean> {
  return Object.fromEntries(tpl.sections.map(s => [s.key, s.defaultEnabled]));
}

export function resolveSections(tpl: GrowthTemplate, saved?: Record<string, boolean>): Record<string, boolean> {
  const out = defaultSections(tpl);
  if (saved) for (const s of tpl.sections) if (typeof saved[s.key] === "boolean") out[s.key] = saved[s.key];
  return out;
}

function placeholderActive(p: PlaceholderDef, resolved: Record<string, boolean>): boolean {
  return !p.section || resolved[p.section] !== false;
}

export function missingPlaceholders(tpl: GrowthTemplate, values: Record<string, string>, sections?: Record<string, boolean>): string[] {
  const resolved = resolveSections(tpl, sections);
  return tpl.placeholders
    .filter(p => p.required && placeholderActive(p, resolved) && !(values[p.key] && values[p.key].trim()))
    .map(p => p.key);
}

export function missingRequiredGlobals(tpl: GrowthTemplate, values: Record<string, string>, sections?: Record<string, boolean>): string[] {
  const resolved = resolveSections(tpl, sections);
  return tpl.placeholders
    .filter(p => p.required && p.scope === "global" && placeholderActive(p, resolved) && !(values[p.key] && values[p.key].trim()))
    .map(p => p.key);
}

/** Invite / trial codes are 4–16 letters or digits, stored upper case. */
export function cleanCode(raw: string | null | undefined): string | null {
  const c = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{4,16}$/.test(c) ? c : null;
}

export function buildRecipientValues(
  globalValues: Record<string, string>,
  recipient: { name: string | null; inviteCode: string | null },
  siteBaseUrl: string
): Record<string, string> {
  // Empty when the name is blank or the import placeholder — the greeting then
  // falls back to a neutral "Hey," instead of "Hi Xyra waitlist member,".
  const firstName = usableFirstName(recipient.name);
  // Their own invite link (a friend gets a free week); people without an
  // account get the shared fallback code instead. The old waitlist /ref/
  // links only moved people up a list that no longer exists, so they're gone.
  const code = recipient.inviteCode || cleanCode(globalValues.fallback_invite_code);
  const referralLink = code ? `${siteBaseUrl.replace(/\/$/, "")}/invite/${encodeURIComponent(code)}` : "";
  return { ...globalValues, first_name: firstName, referral_link: referralLink };
}
