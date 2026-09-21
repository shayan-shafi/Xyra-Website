export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchRetentionData } from "./data";
import RetentionDashboard from "./RetentionDashboard";

export default async function RetentionPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const data = await fetchRetentionData();

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="retention" />
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Retention</h1>
          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
            Who comes back, what they did in their first 72 hours, and whether the value ladder is holding.
          </p>
        </div>

        {!data ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-3">App database not connected</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Retention is computed from accounts and activity in the Xyra <strong>app</strong> Supabase project. Set{" "}
              <code className="px-1 py-0.5 bg-gray-100 rounded">APP_SUPABASE_SERVICE_ROLE_KEY</code> (the same key the Users tab uses) in{" "}
              <code className="px-1 py-0.5 bg-gray-100 rounded">.env.local</code> and Vercel, then redeploy.
            </p>
          </div>
        ) : (
          <RetentionDashboard data={data} />
        )}
      </div>
    </main>
  );
}
