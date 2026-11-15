// "send it to my laptop" — server side.
//
// A phone visitor leaves an email on xyra.dev (/api/handoff). We email them a
// link that opens app sign-up on a laptop, then remind them twice at most
// (/api/cron/handoff-reminders): day 1 and day 3, stopping the moment the
// account exists (/api/handoff/claim, called by app.xyra.dev) or they tap
// "stop these" (/api/handoff/stop). Table: handoff_requests (supabase/2026-11-14-handoff.sql).
//
// The link goes through xyra.dev/l/<token>, which records the open and the
// device, then forwards to app.xyra.dev/create-account with the token and the
// visit's UTM tags. The token is random and carries no personal data.
//
// Email copy lives here. Shayan approves any change to it before it ships.

import { randomBytes } from "crypto";
import { resend } from "@/lib/resend";
import { APP_ORIGIN, SITE_URL } from "@/lib/site";

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function newToken(): string {
  return randomBytes(24).toString("base64url"); // 32 chars
}

export type HandoffRow = {
  id: number;
  email: string | null;
  token: string;
  visitor_id: string | null;
  first_utm_source: string | null;
  first_utm_medium: string | null;
  first_utm_campaign: string | null;
  first_utm_content: string | null;
  emails_sent: number;
  first_sent_at: string | null;
  last_email_at: string | null;
  opened_at: string | null;
  laptop_opened_at: string | null;
  claimed_at: string | null;
  unsubscribed_at: string | null;
};

/** Which email in the sequence: 1 = the link, 2 = day-1 reminder, 3 = day-3 last one. */
export type EmailNumber = 1 | 2 | 3;

/** Phones and small tablets in portrait. iPads report as Macs; those count as laptops. */
export function isPhoneUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  return /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile.+Firefox|BlackBerry|Opera Mini/i.test(ua);
}

/** The link in every email: through xyra.dev so the open is counted. */
export function linkFor(token: string, n: EmailNumber): string {
  return `${SITE_URL}/l/${token}?e=${n}`;
}

export function stopLinkFor(token: string): string {
  return `${SITE_URL}/api/handoff/stop?t=${token}`;
}

/** Where /l/<token> sends a laptop: app sign-up, carrying the token and the visit's UTM tags. */
export function appSignupUrl(row: Pick<HandoffRow, "token" | "first_utm_source" | "first_utm_medium" | "first_utm_campaign" | "first_utm_content">, n: string | null): string {
  const p = new URLSearchParams({ src: "site_handoff", h: row.token });
  if (n) p.set("he", n);
  const utm: [string, string | null][] = [
    ["utm_source", row.first_utm_source],
    ["utm_medium", row.first_utm_medium],
    ["utm_campaign", row.first_utm_campaign],
    ["utm_content", row.first_utm_content],
  ];
  for (const [k, v] of utm) if (v) p.set(k, v);
  return `${APP_ORIGIN}/create-account?${p.toString()}`;
}

// ── copy ────────────────────────────────────────────────────────────────

type Copy = { subject: string; preview: string; lines: string[]; button: string };

const COPY: Record<EmailNumber, Copy> = {
  1: {
    subject: "your xyra link (open it on your laptop)",
    preview: "start your brain in about two minutes.",
    lines: [
      "hey, here's your link to start your brain.",
      "xyra is built for a laptop, so open this email there. it takes about two minutes: make an account, connect claude or chatgpt, and what they already know about you comes over.",
      "no card until you've seen it.",
    ],
    button: "start your brain",
  },
  2: {
    subject: "your brain's still waiting",
    preview: "open this one on your laptop.",
    lines: [
      "quick nudge: your xyra link is below.",
      "open it on your laptop and connect claude or chatgpt. what they know about you comes over in about a minute, and every ai you use after that starts with it.",
    ],
    button: "start your brain",
  },
  3: {
    subject: "last one from me",
    preview: "the link still works whenever you want it.",
    lines: [
      "this is the last email about it, promise.",
      "if you want xyra later, the link below still works. open it on a laptop and you're in.",
    ],
    button: "start your brain",
  },
};

const SIGN_OFF = "shayan, xyra";
const WHY = "you asked for this link on xyra.dev.";

export function buildEmail(n: EmailNumber, token: string): { subject: string; text: string; html: string } {
  const c = COPY[n];
  const link = linkFor(token, n);
  const stop = stopLinkFor(token);
  const showStop = n < 3; // the last email has nothing left to stop

  const text = [
    ...c.lines.flatMap((l) => [l, ""]),
    `${c.button}: ${link}`,
    "",
    `- ${SIGN_OFF}`,
    "",
    showStop ? `${WHY} don't want reminders? ${stop}` : WHY,
  ].join("\n");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const p = (s: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#111;">${esc(s)}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fbfaf8;">
<span style="display:none;max-height:0;overflow:hidden;">${esc(c.preview)}</span>
<div style="max-width:520px;margin:0 auto;padding:40px 24px;font-family:Georgia,'Times New Roman',serif;">
<div style="font-size:24px;font-weight:600;color:#000;margin:0 0 28px;">xyra</div>
${c.lines.map(p).join("\n")}
<p style="margin:28px 0;"><a href="${link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-family:Menlo,Consolas,monospace;font-size:13px;letter-spacing:0.02em;">${esc(c.button)}</a></p>
<p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#111;">- ${esc(SIGN_OFF)}</p>
<p style="margin:0;font-family:Menlo,Consolas,monospace;font-size:11px;line-height:1.6;color:#888;">${esc(WHY)}${showStop ? ` <a href="${stop}" style="color:#888;">stop the reminders</a>.` : ""}</p>
</div></body></html>`;

  return { subject: c.subject, text, html };
}

/** Sends one email of the sequence. Returns Resend's message id, or null (and logs)
 *  if Resend refuses or isn't configured. */
export async function sendHandoffEmail(n: EmailNumber, to: string, token: string): Promise<string | null> {
  if (!resend) {
    console.error("handoff: RESEND_API_KEY not set");
    return null;
  }
  // Not ANALYTICS_REPORT_FROM_EMAIL: that is analytics@xyra.dev in production, and the
  // sheet tells people to look for shayan@xyra.dev.
  const from = process.env.HANDOFF_FROM_EMAIL ?? "shayan@xyra.dev";
  const { subject, text, html } = buildEmail(n, token);
  try {
    const { data, error } = await resend.emails.send({
      from: `shayan from xyra <${from}>`,
      to: [to],
      subject,
      text,
      html,
      headers: n < 3 ? { "List-Unsubscribe": `<${stopLinkFor(token)}>` } : undefined,
    });
    if (error || !data?.id) {
      console.error(`handoff email ${n} failed:`, JSON.stringify(error));
      return null;
    }
    return data.id;
  } catch (err) {
    console.error(`handoff email ${n} error:`, err);
    return null;
  }
}

/** Did the last email to this address bounce or get marked as spam? (Resend's delivery status.)
 *  Unknown (no id, Resend unreachable) counts as no, so a hiccup never blocks a reminder. */
export async function lastEmailFailed(emailId: string | null | undefined): Promise<boolean> {
  if (!resend || !emailId) return false;
  try {
    const { data } = await resend.emails.get(emailId);
    const ev = (data as { last_event?: string } | null)?.last_event;
    return ev === "bounced" || ev === "complained";
  } catch {
    return false;
  }
}

/** Saves the Resend id of the email just sent. Its own write, so a database without the
 *  last_email_id column yet (supabase/2026-11-15-handoff-bounces.sql) loses nothing else. */
export async function rememberEmailId(
  db: { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (c: string, v: unknown) => PromiseLike<{ error: unknown }> } } },
  rowId: number,
  emailId: string,
): Promise<void> {
  try {
    const { error } = await db.from("handoff_requests").update({ last_email_id: emailId }).eq("id", rowId);
    if (error) console.error("handoff: couldn't save last_email_id (column missing?)", JSON.stringify(error));
  } catch {
    /* never in the way */
  }
}
