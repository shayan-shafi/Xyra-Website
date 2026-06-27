"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Small admin logout control. Clears the admin cookie via the logout route,
// then refreshes so the current admin page re-renders its server-side auth
// gate (now cookieless) and falls back to the login form.
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* even if the request hiccups, fall through to a refresh */
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors font-[family-name:var(--font-jetbrains)] tracking-wide bg-white text-gray-500 border border-gray-200 hover:border-gray-400 hover:text-gray-900 disabled:opacity-50"
    >
      {busy ? "Logging out…" : "Log out"}
    </button>
  );
}
