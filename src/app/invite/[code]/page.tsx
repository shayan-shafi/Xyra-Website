import type { Metadata } from "next";
import Image from "next/image";
import { APP_ORIGIN, cleanInviteCode, lookupInvite } from "@/lib/appInvite";

// xyra.dev/invite/<code>: a friend's personal invite (the app's invite_codes).
// Skips the application: join on the web with the code carried along, and the
// paywall fills it in for a week free, no card. Each code is good for 10.

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
  const info = code ? await lookupInvite(code) : null;
  const who = info?.firstName || "a friend";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="flex items-center justify-center mb-12">
          <Image src="/assets/xyra-logo.png" alt="Xyra" width={280} height={90} className="h-16 w-auto" priority />
        </div>

        {!code || !info ? (
          <>
            <h1 className={`${serif} text-3xl sm:text-4xl font-medium text-black tracking-tight`}>
              That invite link doesn&apos;t look right.
            </h1>
            <p className={`${body} text-lg text-black/50 mt-4 leading-relaxed`}>
              Check the link with whoever sent it, or apply to get in.
            </p>
            <a href="/apply" className={`inline-block mt-8 px-7 py-3 bg-black text-white ${mono} text-xs tracking-widest uppercase`}>
              Apply now
            </a>
          </>
        ) : !info.open ? (
          <>
            <h1 className={`${serif} text-3xl sm:text-4xl font-medium text-black tracking-tight`}>
              {who === "a friend" ? "This invite" : `${cap(who)}’s invites`} {who === "a friend" ? "is" : "are"} all used up.
            </h1>
            <p className={`${body} text-lg text-black/50 mt-4 leading-relaxed`}>
              You can still apply to get in.
            </p>
            <a href="/apply" className={`inline-block mt-8 px-7 py-3 bg-black text-white ${mono} text-xs tracking-widest uppercase`}>
              Apply now
            </a>
          </>
        ) : (
          <>
            <h1 className={`${serif} text-3xl sm:text-4xl font-medium text-black tracking-tight`}>
              {cap(who)} invited you
              <br />
              <span className="italic">to xyra.</span>
            </h1>
            <p className={`${body} text-lg text-black/50 mt-4 leading-relaxed`}>
              One week free, no card. Skip the application and start now.
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
          Xyra is a personal operating system that builds itself from your voice.
        </p>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
