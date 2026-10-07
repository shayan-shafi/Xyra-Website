import { NextResponse } from "next/server";

// ─── GET /.well-known/apple-app-site-association ─────────────────────────────
// (rewritten here in next.config.mjs: the app router skips dot-folders.)
// Links the iOS app (team 4S37BXBQ93, bundle dev.xyra.app) to xyra.dev so iOS
// offers to save sign-up passwords to Apple Passwords and autofills them on
// sign-in. The app side is `associatedDomains: ['webcredentials:xyra.dev']` in
// xyrav2-org/mobile/app.config.js. Apple fetches this from the apex with no
// redirects, and it must be served as application/json.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    webcredentials: { apps: ["4S37BXBQ93.dev.xyra.app"] },
  });
}
