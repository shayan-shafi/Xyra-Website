// ───────────────────────────────────────────────────────────────────────────
// Growth / Email Ops email templates
// ───────────────────────────────────────────────────────────────────────────
// Pure, dependency-free string builders — usable by both the client preview
// (EmailOps.tsx) and the server send routes.
//
// Visual language mirrors Xyra's branded user-facing pages (the /ref/[code]
// page and the site footer): white card, centered Xyra logo, serif typography
// (Georgia stands in for Playfair/EB Garamond, which email clients can't
// reliably load), a thin gold accent rule, generous spacing, a black pill CTA,
// and a muted founder footer — a personal note from Cole and Shayan, not a CRM
// blast — while staying email-client-safe (tables, inline styles, web-safe
// fonts, absolute image URLs).
//
// Editable surface: subject, preheader, eyebrow (kicker), headline, body
// content, optional CTA, optional image, optional referral block, and the
// sign-off (closing line + signature). Everything has a sensible default and
// persists with saved templates.
//
// Writing style: default copy deliberately avoids em/en dashes used as sentence
// connectors (they read as AI-written) — commas or separate sentences instead.
//
// Placeholders use {{snake_case}} tokens. Two scopes:
//   - "global"       : one admin-entered value reused for every recipient.
//   - "perRecipient" : filled per recipient by the SEND route from waitlist
//                      data (first_name, referral_link).
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
  type?: "image" | "images";
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
const LOGO_URL = `${XYRA_ORIGIN}/assets/xyra-logo.png`;

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

const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const INK = "#1a1a1a";
const BODY_INK = "#3d3d3d";
const FAINT = "#8a8a7a";
const HAIRLINE = "#e7e0d4";
const GOLD = "#c4a87c";

function paragraph(html: string): string {
  return `<p style="margin:0 0 18px;font-family:${SERIF};font-size:16px;line-height:1.7;color:${BODY_INK};">${html}</p>`;
}

function headlineBlock(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:26px;line-height:1.25;color:${INK};font-weight:400;">${esc(text)}</h1>`;
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
  return `<p style="margin:26px 0 10px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${FAINT};">${esc(text)}</p>`;
}

function pillButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr>
    <td style="border-radius:999px;background:#000000;">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${esc(label)}</a>
    </td></tr></table>`;
}

function referralBlock(introHtml: string, link: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;background:#faf8f3;border:1px solid ${HAIRLINE};border-radius:12px;">
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

function emailShell(opts: { kicker: string; preheader?: string; bodyHtml: string }): string {
  const { kicker, preheader, bodyHtml } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Xyra</title>
</head>
<body style="margin:0;padding:0;background:#f2eee6;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2eee6;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${HAIRLINE};border-radius:16px;overflow:hidden;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:40px 40px 0;">
              <img src="${LOGO_URL}" alt="Xyra" width="150" height="50" style="display:block;width:150px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <!-- Gold accent rule + eyebrow -->
          <tr>
            <td align="center" style="padding:20px 40px 0;">
              <div style="width:36px;height:2px;background:${GOLD};margin:0 auto 16px;"></div>
              <p style="margin:0;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${FAINT};">${esc(kicker)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 40px 36px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 40px 30px;border-top:1px solid ${HAIRLINE};">
              <p style="margin:0;font-family:${SERIF};font-size:13px;line-height:1.6;color:${FAINT};text-align:center;">
                Xyra, the AI-native personal operating system.<br>
                You're receiving this because you joined the Xyra waitlist.
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
    `Xyra, the AI-native personal operating system.`,
    `You're receiving this because you joined the Xyra waitlist.`,
  ];
}

function makeOn(sections?: Record<string, boolean>) {
  return (key: string) => sections?.[key] !== false;
}

function preheaderOf(v: Record<string, string>, fallback: string): string {
  return has(v, "preheader") ? raw(v, "preheader") : fallback;
}

// Shared editable header/sign-off fields appended to every template.
function headerFields(eyebrowExample: string, headlineExample: string): PlaceholderDef[] {
  return [
    { key: "preheader", label: "Preheader (inbox preview text)", example: "", scope: "global", help: "Optional. The grey text shown after the subject in most inboxes." },
    { key: "eyebrow", label: "Eyebrow (small label under the logo)", example: eyebrowExample, scope: "global", required: true },
    { key: "headline", label: "Headline (optional, large title in the body)", example: headlineExample, scope: "global" },
  ];
}
function signoffFields(): PlaceholderDef[] {
  return [
    { key: "signoff_closing", label: "Sign-off closing", example: "Thanks,", scope: "global" },
    { key: "signoff_name", label: "Sign-off signature", example: "Cole and Shayan", scope: "global", required: true },
  ];
}

// ── Template 1: Alpha invite ────────────────────────────────────────────────

const alphaInvite: GrowthTemplate = {
  id: "alpha-invite",
  name: "Alpha Invite",
  description: "Tells a selected user they're in the Xyra Alpha, sets expectations, and links access plus their referral link.",
  confirmPhrase: "SEND ALPHA",
  sections: [
    { key: "expectations", label: "What we're hoping for", defaultEnabled: true },
    { key: "closing", label: "Closing line", defaultEnabled: true },
    { key: "referral", label: "Referral nudge", defaultEnabled: true },
  ],
  placeholders: [
    { key: "first_name", label: "First name", example: "Alex", scope: "perRecipient", required: true, help: "Auto-filled per recipient from their waitlist name on a real send." },
    ...headerFields("Alpha is almost here", "You're in."),
    { key: "intro", label: "Opening line", example: "We've been reading every signup, and we'd like you in the Xyra Alpha.", scope: "global", required: true, multiline: true },
    { key: "context", label: "Why them / context", example: "We're opening access this Monday. We're keeping this first group small on purpose: we want real feedback from real people who'll actually use it, not a launch-day crowd. You're one of them.", scope: "global", required: true, multiline: true },
    { key: "expectations", label: "What we're hoping for (one per line)", example: "Give it an honest go. Actually use Xyra for the things you're juggling in your head.\nWhen something breaks or feels off, tell us. Rough edges are expected.\nUse the in-app feedback option when it's there, or just reach us directly.\nBe open to a short, casual call with us at some point.", scope: "global", multiline: true, section: "expectations" },
    { key: "alpha_access_link", label: "Alpha access link", example: "", scope: "global", required: true, help: "The real setup/access URL. Left blank shows the {{token}} so you never send a fake link." },
    { key: "feedback_contact", label: "Feedback contact", example: "hello@xyra.dev", scope: "global", required: true, help: "Where users can reach you directly." },
    { key: "closing", label: "Closing line", example: "Genuinely excited to put this in your hands.", scope: "global", multiline: true, section: "closing" },
    ...signoffFields(),
    { key: "referral_link", label: "Referral link", example: "https://xyra.dev/ref/abc123", scope: "perRecipient", required: true, section: "referral", help: "Auto-filled per recipient from their ref_code on a real send." },
  ],
  buildSubject: () => "You're in. Xyra Alpha starts Monday.",
  buildHtml: (v, sections) => {
    const on = makeOn(sections);
    const accessBlock = has(v, "alpha_access_link")
      ? pillButton("Get set up for Alpha", raw(v, "alpha_access_link"))
      : `<p style="margin:6px 0 18px;padding:12px 14px;background:#fffaf0;border:1px solid #f0e2c0;border-radius:10px;font-family:${SANS};font-size:13px;color:#8a6d3b;">Add the Alpha access link before sending. The field is currently empty.</p>`;
    const expectations = on("expectations") ? htmlList(lines(v.expectations)) : "";
    const body = [
      ...(has(v, "headline") ? [headlineBlock(raw(v, "headline"))] : []),
      paragraph(`Hi ${esc(raw(v, "first_name"))},`),
      paragraph(esc(raw(v, "intro"))),
      paragraph(esc(raw(v, "context"))),
      ...(expectations ? [eyebrowHeader("What we're hoping for"), expectations] : []),
      eyebrowHeader("Your access"),
      paragraph(`We've included setup instructions at the link below so you can get started Monday.`),
      accessBlock,
      paragraph(`You can reach us anytime at <a href="mailto:${esc(raw(v, "feedback_contact"))}" style="color:${INK};font-weight:600;">${esc(raw(v, "feedback_contact"))}</a>.`),
      ...(on("referral") ? [eyebrowHeader("Bring a friend"), referralBlock("Your referral link still works, and every friend who joins moves you up:", raw(v, "referral_link"))] : []),
      ...(on("closing") && has(v, "closing") ? [paragraph(esc(raw(v, "closing")))] : []),
      signoffHtml(v),
    ].join("");
    return emailShell({ kicker: raw(v, "eyebrow"), preheader: preheaderOf(v, "You've been selected for the Xyra Alpha."), bodyHtml: body });
  },
  buildText: (v, sections) => {
    const on = makeOn(sections);
    const access = has(v, "alpha_access_link") ? raw(v, "alpha_access_link") : "(add the access link before sending)";
    const exp = on("expectations") ? lines(v.expectations) : [];
    return [
      ...(has(v, "headline") ? [raw(v, "headline"), ``] : []),
      `Hi ${raw(v, "first_name")},`,
      ``,
      raw(v, "intro"),
      ``,
      raw(v, "context"),
      ...(exp.length ? [``, `What we're hoping for:`, ...exp.map(e => `- ${e}`)] : []),
      ``,
      `Your access (setup instructions included): ${access}`,
      `Reach us anytime: ${raw(v, "feedback_contact")}`,
      ...(on("referral") ? [``, `Your referral link still works, and every friend who joins moves you up:`, raw(v, "referral_link")] : []),
      ...(on("closing") && has(v, "closing") ? [``, raw(v, "closing")] : []),
      ...signoffText(v),
      ...textFooter(),
    ].join("\n");
  },
};

// ── Template 2: Weekly newsletter / update ──────────────────────────────────

const newsletter: GrowthTemplate = {
  id: "newsletter",
  name: "Weekly Update",
  description: "Recurring waitlist update. Toggle the sections you want for this send.",
  confirmPhrase: "SEND NEWSLETTER",
  sections: [
    { key: "quick_update", label: "Quick update", defaultEnabled: true },
    { key: "shipped", label: "What we shipped", defaultEnabled: true },
    { key: "working_on", label: "What we're working on", defaultEnabled: true },
    { key: "fixed", label: "What we fixed", defaultEnabled: true },
    { key: "behind_scenes", label: "Behind the scenes", defaultEnabled: true },
    { key: "ask", label: "What we need from you", defaultEnabled: true },
    { key: "referral", label: "Referral reminder", defaultEnabled: true },
  ],
  placeholders: [
    { key: "first_name", label: "First name", example: "Alex", scope: "perRecipient", required: true, help: "Auto-filled per recipient on a real send." },
    ...headerFields("Xyra update", "The latest from Xyra"),
    { key: "opening", label: "Opening line", example: "Here's what we have been working on this week.", scope: "global", required: true, multiline: true },
    { key: "quick_update", label: "Quick update", example: "We're heads-down getting the Alpha ready for Monday.", scope: "global", required: true, multiline: true, section: "quick_update" },
    { key: "shipped", label: "What we shipped (one per line)", example: "Faster braindump capture\nReferral leaderboard in the dashboard", scope: "global", multiline: true, section: "shipped" },
    { key: "working_on", label: "What we're working on (one per line)", example: "Mobile polish\nAlpha onboarding flow", scope: "global", multiline: true, section: "working_on" },
    { key: "fixed", label: "What we fixed (one per line)", example: "Login edge cases\nEmail rendering on Gmail", scope: "global", multiline: true, section: "fixed" },
    { key: "behind_scenes_note", label: "Behind the scenes note", example: "Late nights, lots of coffee, and a wall full of sticky notes.", scope: "global", multiline: true, section: "behind_scenes" },
    { key: "behind_scenes_images", label: "Behind the scenes images", example: "", scope: "global", section: "behind_scenes", type: "images", help: "Upload one or more images, one at a time (e.g. one of Cole and one of Shayan). Add optional alt text and a caption for each. Two images sit side by side and stack on mobile. If none are added, no image block is shown." },
    { key: "ask", label: "What we need from you", example: "Reply and tell us the one thing you want Xyra to handle first.", scope: "global", multiline: true, section: "ask" },
    ...signoffFields(),
    { key: "referral_link", label: "Referral link", example: "https://xyra.dev/ref/abc123", scope: "perRecipient", required: true, section: "referral", help: "Auto-filled per recipient on a real send." },
  ],
  buildSubject: () => "Xyra update",
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
      paragraph(`Hi ${esc(raw(v, "first_name"))},`),
      paragraph(esc(raw(v, "opening"))),
      ...(on("quick_update") ? [eyebrowHeader("Quick update"), paragraph(esc(raw(v, "quick_update")))] : []),
      ...(shipped ? [eyebrowHeader("What we shipped"), shipped] : []),
      ...(working ? [eyebrowHeader("What we're working on"), working] : []),
      ...(fixed ? [eyebrowHeader("What we fixed"), fixed] : []),
      ...behindScenes,
      ...(on("ask") ? [eyebrowHeader("What we need from you"), paragraph(esc(raw(v, "ask")))] : []),
      ...(on("referral") ? [referralBlock("Know someone who'd love this? Your referral link moves you up the list:", raw(v, "referral_link"))] : []),
      signoffHtml(v),
    ].join("");
    return emailShell({ kicker: raw(v, "eyebrow"), preheader: preheaderOf(v, raw(v, "opening").slice(0, 120)), bodyHtml: body });
  },
  buildText: (v, sections) => {
    const on = makeOn(sections);
    const block = (title: string, items: string[]) => (items.length ? [``, `${title}:`, ...items.map(i => `- ${i}`)] : []);
    return [
      ...(has(v, "headline") ? [raw(v, "headline"), ``] : []),
      `Hi ${raw(v, "first_name")},`,
      ``,
      raw(v, "opening"),
      ...(on("quick_update") ? [``, `Quick update:`, raw(v, "quick_update")] : []),
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
      ...(on("referral") ? [``, `Know someone who'd love this? Your referral link moves you up:`, raw(v, "referral_link")] : []),
      ...signoffText(v),
      ...textFooter(),
    ].join("\n");
  },
};

// ── Template 3: General waitlist message ────────────────────────────────────

const generalMessage: GrowthTemplate = {
  id: "general-message",
  name: "General Message",
  description: "A flexible one-off message to selected waitlist users: updates, announcements, reminders, follow-ups.",
  confirmPhrase: "SEND MESSAGE",
  sections: [
    { key: "images", label: "Photos", defaultEnabled: false },
    { key: "cta", label: "Call-to-action button", defaultEnabled: false },
    { key: "referral", label: "Referral block", defaultEnabled: false },
  ],
  placeholders: [
    { key: "first_name", label: "First name", example: "Alex", scope: "perRecipient", required: true, help: "Auto-filled per recipient on a real send." },
    ...headerFields("A note from Xyra", ""),
    { key: "message_body", label: "Message body (paragraphs separated by blank lines)", example: "Thanks for being on the Xyra waitlist. We wanted to share a quick update.\n\nWe're getting close to opening things up, and we'll be in touch soon with next steps.", scope: "global", required: true, multiline: true },
    { key: "message_images", label: "Photos", example: "", scope: "global", section: "images", type: "images", help: "Optional. Upload one or more images, one at a time, each with optional alt text and a caption. Two images sit side by side and stack on mobile." },
    { key: "cta_label", label: "Button label", example: "Read more", scope: "global", section: "cta", help: "Shown only if both button label and link are filled." },
    { key: "cta_link", label: "Button link", example: "", scope: "global", section: "cta", help: "Public HTTPS URL." },
    { key: "referral_intro", label: "Referral block intro", example: "Know someone who'd love Xyra? Your referral link moves you up the list:", scope: "global", section: "referral", multiline: true },
    ...signoffFields(),
    { key: "referral_link", label: "Referral link", example: "https://xyra.dev/ref/abc123", scope: "perRecipient", section: "referral", help: "Auto-filled per recipient on a real send." },
  ],
  buildSubject: () => "A quick note from Xyra",
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
    const referral = on("referral") && has(v, "referral_intro") ? referralBlock(esc(raw(v, "referral_intro")), raw(v, "referral_link")) : "";
    const body = [
      ...(has(v, "headline") ? [headlineBlock(raw(v, "headline"))] : []),
      paragraph(`Hi ${esc(raw(v, "first_name"))},`),
      ...(paras.length ? paras : [paragraph(esc(raw(v, "message_body")))]),
      imagesHtml,
      cta,
      referral,
      signoffHtml(v),
    ].join("");
    return emailShell({ kicker: raw(v, "eyebrow"), preheader: preheaderOf(v, (v.message_body ?? "").slice(0, 120)), bodyHtml: body });
  },
  buildText: (v, sections) => {
    const on = makeOn(sections);
    const images = on("images") ? parseGallery(v.message_images) : [];
    const imageLines = images.length ? [``, ...galleryTextLines(images)] : [];
    const cta = on("cta") && has(v, "cta_label") && has(v, "cta_link") ? [``, `${raw(v, "cta_label")}: ${raw(v, "cta_link")}`] : [];
    const referral = on("referral") && has(v, "referral_intro") ? [``, raw(v, "referral_intro"), raw(v, "referral_link")] : [];
    return [
      ...(has(v, "headline") ? [raw(v, "headline"), ``] : []),
      `Hi ${raw(v, "first_name")},`,
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

// ── Registry ─────────────────────────────────────────────────────────────────

export const GROWTH_TEMPLATES: GrowthTemplate[] = [alphaInvite, newsletter, generalMessage];

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

export function buildRecipientValues(
  globalValues: Record<string, string>,
  recipient: { name: string | null; refCode: string | null },
  siteBaseUrl: string
): Record<string, string> {
  const firstName = (recipient.name ?? "").trim().split(/\s+/)[0] || "there";
  const referralLink = recipient.refCode ? `${siteBaseUrl.replace(/\/$/, "")}/ref/${recipient.refCode}` : "";
  return { ...globalValues, first_name: firstName, referral_link: referralLink };
}
