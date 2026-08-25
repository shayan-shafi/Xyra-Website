export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchUsersData } from "./data";
import UsersDashboard from "./UsersDashboard";

export default async function UsersPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const data = await fetchUsersData();

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="users" />
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Alpha Users</h1>
          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
            {data
              ? `${data.funnel.accounts} accounts · ${data.funnel.activated} activated · ${data.funnel.active7} active this week`
              : "Who has an account, who is using it, and who has gone quiet."}
          </p>
        </div>

        {!data ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-3">App database not connected</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              This page reads accounts and activity from the Xyra <strong>app</strong> Supabase project (a different project
              from the site&apos;s own DB). Add these to <code className="px-1 py-0.5 bg-gray-100 rounded">.env.local</code> and to
              Vercel (Production), then redeploy:
            </p>
            <pre className="mt-4 text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">{`APP_SUPABASE_URL=https://naklqxesofjyhnehgizl.supabase.co
APP_SUPABASE_SERVICE_ROLE_KEY=<app project service-role key>`}</pre>
            <p className="text-xs text-gray-400 mt-3">
              Supabase → app project → Settings → API → service_role. Server-only — never expose it to the browser.
            </p>
          </div>
        ) : (
          <UsersDashboard data={data} />
        )}
      </div>
    </main>
  );
}
