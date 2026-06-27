import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

// ── Admin logout ─────────────────────────────────────────────────────────────
// Clears the admin auth cookie. The cookie is path-scoped to /admin, so the
// clearing Set-Cookie must use the same path (and matching attributes) for the
// browser to drop it. This is convenience/logout hygiene only — it removes the
// cookie from this browser but does not revoke the token value server-side
// (the token is derived from the password). Password rotation remains the
// revoke-all-sessions mechanism.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
