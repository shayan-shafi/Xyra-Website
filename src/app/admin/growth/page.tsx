export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchGrowthData } from "./data";
import GrowthDashboard from "./GrowthDashboard";

export default async function GrowthPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const data = await fetchGrowthData();

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "system-ui,sans-serif" }}>
        <div className="text-center p-8 bg-white rounded-xl border border-gray-200 max-w-sm">
          <p className="font-semibold text-gray-900">Growth dashboard unavailable</p>
          <p className="text-sm text-gray-500 mt-1">
            Ensure <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is set in your environment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="growth" />
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Growth &amp; Referrals</h1>
          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
            {data.total.toLocaleString()} waitlist signups · internal &amp; private
          </p>
        </div>
        <GrowthDashboard data={data} />
      </div>
    </main>
  );
}
