// Recipient paste/import parser — shared by the client (live valid/dup/invalid
// counts as you type) and the server (authoritative dedupe/validation before a
// group is saved). Pure + dependency-free so both can import it.
//
// Handles the common formats an admin pastes:
//   - one email per line
//   - comma-separated:      a@x.com, b@y.com
//   - semicolon-separated:  a@x.com; b@y.com
//   - "Name <email>":       Alice Smith <alice@x.com>
//   - CSV-ish "name,email":  Alice Smith, alice@x.com
//   - arbitrary surrounding whitespace
//
// Emails are lowercased + trimmed and de-duplicated (first name seen wins).

import { isValidEmail } from "@/lib/emailValidation";

export type ParsedRecipient = { email: string; name: string | null };

export type ParseResult = {
  valid: ParsedRecipient[];
  invalid: string[];
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
};

function cleanName(raw: string | null): string | null {
  if (!raw) return null;
  const n = raw.trim().replace(/^["']|["']$/g, "").trim();
  return n.length > 0 ? n : null;
}

export function parseRecipientText(text: string): ParseResult {
  const seen = new Set<string>();
  const valid: ParsedRecipient[] = [];
  const invalid: string[] = [];
  let duplicateCount = 0;

  const add = (rawEmail: string, rawName: string | null) => {
    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      const shown = rawEmail.trim();
      if (shown) invalid.push(shown);
      return;
    }
    if (seen.has(email)) {
      duplicateCount += 1;
      return;
    }
    seen.add(email);
    valid.push({ email, name: cleanName(rawName) });
  };

  for (const rawLine of (text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // CSV-ish "Name, email" — exactly one comma, right side is an email, left
    // side is NOT an email, and no angle brackets (those are handled below).
    const csv = line.match(/^([^,]+),\s*(.+)$/);
    if (csv && !line.includes("<") && isValidEmail(csv[2].trim()) && !isValidEmail(csv[1].trim())) {
      add(csv[2], csv[1]);
      continue;
    }

    // Otherwise split the line on commas/semicolons and parse each token.
    for (const token of line.split(/[;,]/)) {
      const t = token.trim();
      if (!t) continue;
      const angle = t.match(/^(.*?)<\s*([^>]+?)\s*>$/); // Name <email>
      if (angle) {
        add(angle[2], angle[1]);
      } else if (isValidEmail(t)) {
        add(t, null);
      } else {
        invalid.push(t);
      }
    }
  }

  return {
    valid,
    invalid,
    validCount: valid.length,
    duplicateCount,
    invalidCount: invalid.length,
  };
}
