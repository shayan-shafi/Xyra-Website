import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signUpUrl } from "@/lib/site";
import { TOKEN_RE, appSignupUrl, isPhoneUserAgent, type HandoffRow } from "@/lib/handoff";

// /l/<token>?e=<1|2|3> — the link in the "send it to my laptop" emails.
// Records the open (and whether it was on a laptop), then:
//   laptop → straight to app sign-up, carrying the token and the visit's UTMs
//   phone  → a short "open it on your laptop" page, with a way to go on anyway
// Unknown token → plain app sign-up, so an old or mangled link still works.
//
// Opens are approximate: some mail security scanners fetch links before the
// person does, and those count as opens here.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "xyra", robots: { index: false, follow: false } };

const MONO = "font-[family-name:var(--font-jetbrains)]";

export default async function HandoffLink({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { e?: string };
}) {
  const token = params.token;
  const n = searchParams.e === "1" || searchParams.e === "2" || searchParams.e === "3" ? searchParams.e : null;
  if (!supabaseAdmin || !TOKEN_RE.test(token)) redirect(signUpUrl("handoff_link"));

  const { data } = await supabaseAdmin
    .from("handoff_requests")
    .select("id, token, visitor_id, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, opened_at, laptop_opened_at, claimed_at")
    .eq("token", token)
    .maybeSingle();
  const row = data as (HandoffRow & { id: number }) | null;
  if (!row) redirect(signUpUrl("handoff_link"));

  const ua = headers().get("user-agent");
  const phone = isPhoneUserAgent(ua);
  const now = new Date().toISOString();

  const patch: Record<string, string> = {};
  if (!row.opened_at) patch.opened_at = now;
  if (!phone && !row.laptop_opened_at) patch.laptop_opened_at = now;
  if (Object.keys(patch).length) {
    await supabaseAdmin.from("handoff_requests").update(patch).eq("id", row.id);
  }
  if (row.visitor_id) {
    await supabaseAdmin.from("analytics_events").insert({
      visitor_id: row.visitor_id,
      session_id: randomUUID(),
      event_name: "handoff_link_open",
      path: "/l",
      utm_source: row.first_utm_source,
      utm_medium: row.first_utm_medium,
      utm_campaign: row.first_utm_campaign,
      utm_content: row.first_utm_content,
      metadata: { device: phone ? "phone" : "laptop", email: n ? Number(n) : null, claimed: !!row.claimed_at },
    });
  }

  const target = appSignupUrl(row, n);
  if (!phone) redirect(target);

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-6 py-20">
      <div className="mx-auto max-w-sm">
        <div className="font-[family-name:var(--font-playfair)] text-2xl font-semibold text-black">xyra</div>
        <p className="mt-8 font-[family-name:var(--font-playfair)] text-[30px] font-medium leading-[1.1] tracking-tight text-black">
          open this on your laptop.
        </p>
        <p className="mt-4 font-[family-name:var(--font-eb-garamond)] text-lg leading-snug text-black/60">
          xyra is built for a bigger screen. the same email is in your inbox there, and the link works the same.
        </p>
        <a
          href={target}
          className={`${MONO} mt-10 inline-block text-xs text-black/55 underline underline-offset-4 decoration-black/25`}
        >
          start on this phone anyway
        </a>
      </div>
    </main>
  );
}
