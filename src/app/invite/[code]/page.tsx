import type { Metadata } from "next";
import { APP_ORIGIN, cleanInviteCode, lookupInvite, type InviteInfo } from "@/lib/appInvite";
import { supabaseAppAdmin } from "@/lib/supabaseAppAdmin";

// xyra.dev/invite/<code>: a friend's personal invite (the app's invite_codes),
// or a shared trial code (trial_codes, e.g. the one Email Ops hands people who
// don't have an account yet). Join on the web with the code carried along.
// A friend's code = 150 free memories instead of 100 (2026-11-25, the app's
// redeem_invite); a trial code still waits in the upgrade card as free days.
// Personal codes are good for 10.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "you're invited to xyra",
  description: "a friend invited you to xyra. your free brain holds 150 memories instead of 100.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "you're invited to xyra",
    description: "a friend invited you to xyra. your free brain holds 150 memories instead of 100.",
    type: "website",
  },
};

const serif = "font-[family-name:var(--font-playfair)]";
const body = "font-[family-name:var(--font-eb-garamond)]";
const mono = "font-[family-name:var(--font-jetbrains)]";

export default async function InvitePage({ params }: { params: { code: string } }) {
  const code = cleanInviteCode(params.code);
  const personal: InviteInfo | null = code ? await lookupInvite(code) : null;
  const info: InviteInfo | null = personal ?? (code ? await trialCode(code) : null);
  const who = info?.firstName || "a friend";
  const days = info?.days ?? 7;
  const freeLine = personal
    ? "Your free brain holds 150 memories instead of 100. No card."
    : days === 7 ? "Free up to 100 memories, plus a week of unlimited on us. No card." : `Free up to 100 memories, plus ${days} days of unlimited on us. No card.`;
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
              {personal
                ? "Your 50 extra memories are added when you make your account."
                : <>Your code waits in the upgrade card, so your week of unlimited starts when you want it. If it isn&apos;t there, type {code} under &ldquo;have a code?&rdquo;.</>}
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
