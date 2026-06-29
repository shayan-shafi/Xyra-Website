// Shared, dependency-free email validity check used by the Email Ops send and
// test-send routes to exclude malformed recipients BEFORE calling Resend.
//
// Deliberately stricter than `email.includes("@")`: it requires a non-empty
// local part, an "@", and a domain with a dot and a TLD of >= 2 chars. This is
// what catches the known bad legacy waitlist addresses (e.g. "x@gmail",
// "y@k12" — no dot in the domain) so they are never sent to. It is intentionally
// conservative (no exotic-but-valid addresses) because these are marketing
// sends where a deliverable, ordinary address is the only thing worth sending.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string | null | undefined): boolean {
  const s = (email ?? "").trim();
  if (!s || s.length > 254) return false;
  if (s.includes("..")) return false;
  return EMAIL_RE.test(s);
}
