import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";

// Who Email Ops may email, and what to fill in for each of them.
//
// Since sign-ups opened, most people never touched the old waitlist: they made
// an account in the app. So a recipient counts when they have a xyra ACCOUNT
// (app project: auth users + public.users for the name + invite_codes for
// their invite link) OR a waitlist row (website project). Anyone else is
// "unknown" and never emailed. Data is always looked up here on the server,
// never taken from the browser.

export type KnownRecipient = {
  email: string;
  name: string | null;
  inviteCode: string | null;
  hasAccount: boolean;
  onWaitlist: boolean;
};

export async function resolveRecipients(emails: string[]): Promise<{ known: Map<string, KnownRecipient>; error?: string }> {
  const want = new Set(emails.map((e) => e.trim().toLowerCase()));
  const known = new Map<string, KnownRecipient>();
  if (want.size === 0) return { known };

  // ── App accounts ───────────────────────────────────────────────────────────
  if (supabaseAppAdmin) {
    const app = supabaseAppAdmin;
    const idByEmail = new Map<string, { id: string; metaName: string | null }>();
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await app.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return { known, error: `Could not read app accounts: ${error.message}` };
      for (const u of data.users) {
        const e = (u.email ?? "").toLowerCase();
        if (want.has(e)) idByEmail.set(e, { id: u.id, metaName: (u.user_metadata?.name as string | undefined) ?? null });
      }
      if (data.users.length < 1000) break;
    }
    const ids = [...idByEmail.values()].map((v) => v.id);
    if (ids.length) {
      const [profiles, codes] = await Promise.all([
        app.from("users").select("auth_id, name").in("auth_id", ids),
        app.from("invite_codes").select("user_id, code").in("user_id", ids),
      ]);
      const nameById = new Map((profiles.data ?? []).map((p) => [p.auth_id as string, (p.name as string | null) ?? null]));
      const codeById = new Map((codes.data ?? []).map((c) => [c.user_id as string, c.code as string]));
      for (const [email, { id, metaName }] of idByEmail) {
        known.set(email, {
          email,
          name: nameById.get(id) || metaName,
          inviteCode: codeById.get(id) ?? null,
          hasAccount: true,
          onWaitlist: false,
        });
      }
    }
  }

  // ── Old waitlist (people who never made an account still count) ────────────
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin.from("waitlist").select("email, name").in("email", [...want]);
    if (error) return { known, error: `Could not read the waitlist: ${error.message}` };
    for (const w of data ?? []) {
      const email = (w.email as string).toLowerCase();
      const cur = known.get(email);
      if (cur) {
        cur.onWaitlist = true;
        cur.name = cur.name || (w.name as string | null);
      } else {
        known.set(email, { email, name: (w.name as string | null) ?? null, inviteCode: null, hasAccount: false, onWaitlist: true });
      }
    }
  }

  return { known };
}
