import { createHash } from "crypto";

export const ADMIN_COOKIE = "xyra_admin_auth";
const SALT = "xyra_admin_v1";

export function computeToken(password: string): string {
  return createHash("sha256").update(password + SALT).digest("hex");
}

export function isValidAdminToken(token: string): boolean {
  const password = process.env.ANALYTICS_ADMIN_PASSWORD;
  if (!password) return false;
  return token === computeToken(password);
}
