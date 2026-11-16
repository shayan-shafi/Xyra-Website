import type { Metadata } from "next";
import { APP_ORIGIN, cleanInviteCode, lookupInvite, type InviteInfo } from "@/lib/appInvite";
import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";

// xyra.dev/invite/<code>: a friend's personal invite (the app's invite_codes),
// or a shared trial code (trial_codes, e.g. the one Email Ops hands people who
// don't have an account yet). Join on the web with the code carried along and
// the paywall fills it in: a free trial, no card. Personal codes are good for 10.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "you're invited to xyra",
  description: "a friend invited you to xyra. one week free, no card.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "you're invited to xyra",
    description: "a friend invited you to xyra. one week free, no card.",
    type: "website",
  },
};

const serif = "font-[family-name:var(--font-playfair)]";
const body = "font-[family-name:var(--font-eb-garamond)]";
const mono = "font-[family-name:var(--font-jetbrains)]";

export default async function InvitePage({ params }: { params: { code: string } }) {
  const code = cleanInviteCode(params.code);
  const info: InviteInfo | null = code ? (await lookupInvite(code)) ?? (await trialCode(code)) : null;
  const who = info?.firstName || "a friend";
  const days = info?.days ?? 7;
  const freeLine = days === 7 ? "One week free, no card." : `${days} days free, no card.`;
  const startHref = `${APP_ORIGIN}/create-account`;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="flex items-center justify-center mb-12">
          <span className={`${serif} text-4xl font-semibold text-black`}>xyra</span>
        </div>

        {!code || !info ? (
          <>
            <h1 className={`${serif} text-3xl sm:text-4xl font-medium text-black tracking-tight`}>
              That invite link doesn&apos;t look right.
            </h1>
            <p className={`${body} text-lg text-black/50 mt-4 leading-relaxed`}>
              Check the link with whoever sent it, or just start your brain.
            </p>
            <a href={startHref} className={`inline-block mt-8 px-7 py-3 bg-black text-white ${mono} text-xs tracking-widest uppercase`}>
              Start your brain
            </a>
          </>
        ) : !info.open ? (
          <>
            <h1 className={`${serif} text-3xl sm:text-4xl font-medium text-black tracking-tight`}>
              {who === "a friend" ? "This invite" : `${cap(who)}’s invites`} {who === "a friend" ? "is" : "are"} all used up.
            </h1>
            <p className={`${body} text-lg text-black/50 mt-4 leading-relaxed`}>
              You can still start your brain.
            </p>
            <a href={startHref} className={`inline-block mt-8 px-7 py-3 bg-black text-white ${mono} text-xs tracking-widest uppercase`}>
              Start your brain
            </a>
          </>
        ) : (
          <>
            <h1 className={`${serif} text-3xl sm:text-4xl font-medium text-black tracking-tight`}>
              {who === "a friend" ? "You're invited" : `${cap(who)} invited you`}
              <br />
              <span className="italic">to xyra.</span>
            </h1>
            <p className={`${body} text-lg text-black/50 mt-4 leading-relaxed`}>
              {freeLine} Start now.
            </p>
            <div className={`mt-10 inline-block border border-black/15 px-6 py-3 ${mono} text-lg tracking-[0.3em] text-black`}>
              {code}
            </div>
            <div>
              <a
                href={`${APP_ORIGIN}/create-account?invite=${encodeURIComponent(code)}`}
                className={`inline-block mt-8 w-full px-7 py-4 bg-black text-white ${mono} text-sm tracking-widest uppercase hover:bg-black/85 transition-all duration-300`}
              >
                Accept invite
              </a>
            </div>
            <p className={`${body} text-sm text-black/40 mt-6 leading-relaxed`}>
              Your code is filled in when you get to the last step. If it isn&apos;t, type {code} in the free trial code box.
            </p>
          </>
        )}

        <p className={`${body} text-sm text-black/30 mt-10`}>
          xyra, the outlet for your ambitious mind.
        </p>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// A shared trial code (no inviter, no use cap), read with the app's service
// role since trial_codes has no public policy. Shown as an open invite.
async function trialCode(code: string): Promise<InviteInfo | null> {
  if (!supabaseAppAdmin) return null;
  const { data } = await supabaseAppAdmin.from("trial_codes").select("days").eq("code", code).eq("active", true).maybeSingle();
  return data ? { firstName: "", open: true, days: data.days as number } : null;
}
