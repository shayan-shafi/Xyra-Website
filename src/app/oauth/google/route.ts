import { NextResponse } from "next/server";

// /oauth/google — where Google sends the browser back after the Calendar
// consent screen. Google's app review wants that address on a domain we own
// and verified (xyra.dev), so this just forwards the whole query (code, state,
// or error) to the app's google-oauth-callback edge fn, which does the token
// exchange and deep-links back into the app. Nothing is read or stored here.
//
// The callback repeats this exact URI at token exchange, so it must stay
// https://xyra.dev/oauth/google (listed in Google Cloud → Clients →
// Authorized redirect URIs, and GOOGLE_OAUTH_REDIRECT_URI on the edge fns).

const APP_SUPABASE_URL = process.env.APP_SUPABASE_URL || "https://naklqxesofjyhnehgizl.supabase.co";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const { search } = new URL(request.url);
  const target = `${APP_SUPABASE_URL}/functions/v1/google-oauth-callback${search}`;
  const res = NextResponse.redirect(target, 302);
  // The query carries a one-time auth code: never cache it, never leak it onward.
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
