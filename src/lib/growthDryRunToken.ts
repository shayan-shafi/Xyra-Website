import { createHash, createHmac, timingSafeEqual } from "crypto";

// ── Signed dry-run token ─────────────────────────────────────────────────────
// Server-side proof that a dry run was performed for an exact send payload. The
// dry-run path issues a token; the real send requires it and recomputes the
// fingerprint, rejecting the send if anything that affects the email changed,
// or if the token expired, was tampered with, or is missing.
//
// The token is opaque and HMAC-signed with a SERVER-ONLY secret. It is never a
// secret itself (it only encodes a content hash + expiry + signature), so it is
// safe to hand to the browser and receive back. No new env var is required: the
// secret falls back to SUPABASE_SERVICE_ROLE_KEY, which the send route already
// requires to do anything. An optional GROWTH_DRYRUN_SECRET overrides it.

const TTL_MS = 20 * 60 * 1000; // 20 minutes

function signingSecret(): string {
  return (
    process.env.GROWTH_DRYRUN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ANALYTICS_ADMIN_PASSWORD ||
    ""
  );
}

// Everything that determines what the real send will email. Per-recipient keys
// (first_name, referral_link) are derived from waitlist data at send time and
// are intentionally NOT part of the fingerprint — only the admin-controlled,
// shared inputs are bound.
export type DryRunFingerprintInput = {
  templateId: string;
  campaignKey: string;
  subject: string;
  values: Record<string, string>; // global values only (per-recipient stripped)
  sections: Record<string, boolean>;
  recipients: string[]; // requested recipient list (any order/casing)
};

function sortObject<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

// Stable, order-independent canonical form so the same logical payload always
// hashes identically in both routes.
function canonical(input: DryRunFingerprintInput): string {
  return JSON.stringify({
    t: input.templateId,
    c: input.campaignKey,
    s: input.subject,
    v: sortObject(input.values),
    sec: sortObject(input.sections),
    r: Array.from(new Set(input.recipients.map(e => e.trim().toLowerCase()))).sort(),
  });
}

export function fingerprint(input: DryRunFingerprintInput): string {
  return createHash("sha256").update(canonical(input)).digest("hex");
}

export function issueDryRunToken(input: DryRunFingerprintInput, now: number = Date.now()): string {
  const exp = now + TTL_MS;
  const payload = `${fingerprint(input)}.${exp}`;
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export type DryRunTokenCheck = { ok: true } | { ok: false; reason: string };

function hexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length > 0 && ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyDryRunToken(
  token: string,
  input: DryRunFingerprintInput,
  now: number = Date.now()
): DryRunTokenCheck {
  const secret = signingSecret();
  if (!secret) return { ok: false, reason: "Server signing secret is unavailable." };
  if (!token) return { ok: false, reason: "A fresh dry run is required before sending. Run the dry run, then send." };

  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "Malformed dry-run token. Run the dry run again." };
  }

  const parts = decoded.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Malformed dry-run token. Run the dry run again." };
  const [fp, expStr, sig] = parts;

  const expectedSig = createHmac("sha256", secret).update(`${fp}.${expStr}`).digest("hex");
  if (!hexEqual(sig, expectedSig)) return { ok: false, reason: "Dry-run token signature is invalid. Run the dry run again." };

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp) || now > exp) {
    return { ok: false, reason: "Dry-run token expired. Run the dry run again before sending." };
  }

  if (!hexEqual(fp, fingerprint(input))) {
    return { ok: false, reason: "The send payload changed since the dry run. Run the dry run again." };
  }

  return { ok: true };
}
