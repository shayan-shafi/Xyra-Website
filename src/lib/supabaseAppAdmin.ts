import { createClient } from "@supabase/supabase-js";

// Server-only admin client for the XYRA APP's Supabase project (where in-app
// feedback + the connector/reminder wishlists live) — a DIFFERENT project from
// the marketing site's own Supabase (see supabaseAdmin.ts). Used by the admin
// feedback dashboard to read tester feedback and demand signals.
//
// Requires two env vars (set in .env.local + Vercel):
//   APP_SUPABASE_URL                – defaults to the known app project URL
//   APP_SUPABASE_SERVICE_ROLE_KEY   – the app project's service-role key (secret)
//
// Never import this in a client component or expose the key to the browser.

const appUrl = process.env.APP_SUPABASE_URL || "https://naklqxesofjyhnehgizl.supabase.co";
const appServiceRoleKey = process.env.APP_SUPABASE_SERVICE_ROLE_KEY || "";

export const supabaseAppAdmin =
  appUrl && appServiceRoleKey
    ? createClient(appUrl, appServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/** True when the app-project credentials are configured. */
export const isAppAdminConfigured = supabaseAppAdmin !== null;
