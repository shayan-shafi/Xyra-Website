import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";

// Validates the admin session for route handlers. These routes live UNDER
// /admin (e.g. /admin/growth/email/send) specifically so the admin auth
// cookie — which is path-scoped to /admin — is sent with the request. A route
// under /api/... would not receive the cookie.
export function isAdminRequest(): boolean {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return Boolean(token && isValidAdminToken(token));
}
