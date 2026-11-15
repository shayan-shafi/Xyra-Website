export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchChangelogData } from "./data";
import ChangelogDashboard from "./ChangelogDashboard";

export default async function ChangelogPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const data = await fetchChangelogData();

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="changelog" />
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Changelog</h1>
          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
            Everything that shipped, in plain words, laid against who showed up.
          </p>
        </div>

        {data.tableMissing ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-3">Changelog table not created yet</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Run <code className="px-1 py-0.5 bg-gray-100 rounded">supabase/2026-11-14-ship-events.sql</code> once in the website
              project&apos;s Supabase SQL editor, then set <code className="px-1 py-0.5 bg-gray-100 rounded">CHANGELOG_INGEST_SECRET</code>{" "}
              in Vercel and in <code className="px-1 py-0.5 bg-gray-100 rounded">~/.xyra-changelog-secret</code>.
            </p>
          </div>
        ) : (
          <ChangelogDashboard data={data} />
        )}
      </div>
    </main>
  );
}
