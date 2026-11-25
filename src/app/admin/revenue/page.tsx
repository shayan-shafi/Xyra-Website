export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { StripeAdminError } from "@/lib/stripeAdmin";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchRevenueData, RANGES, type RangeKey } from "./data";
import RevenueDashboard from "./RevenueDashboard";

const CODE = "px-1 py-0.5 bg-gray-100 rounded";

export default async function RevenuePage({ searchParams }: { searchParams: { range?: string } }) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const range = (RANGES.find((r) => r.key === searchParams.range)?.key ?? "30") as RangeKey;
  let data: Awaited<ReturnType<typeof fetchRevenueData>> = null;
  let error: string | null = null;
  try {
    data = await fetchRevenueData(range);
  } catch (e) {
    error = e instanceof StripeAdminError || e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="revenue" />
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Revenue</h1>
          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
            MRR, money in and every transaction, straight from Stripe.
          </p>
        </div>

        {error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-3">Stripe said no</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              <code className={CODE}>{error}</code>
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Usually a missing permission on the restricted key. It needs <strong>Read</strong> on Charges, Balance transactions,
              Customers, Subscriptions, Coupons and Invoices.
            </p>
          </div>
        ) : !data ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-3">Stripe not connected</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Create a <strong>restricted</strong> key in Stripe (Developers → API keys → Create restricted key) with{" "}
              <strong>Read</strong> on Charges, Balance transactions, Customers, Subscriptions, Coupons and Invoices, and nothing
              else. Save it as <code className={CODE}>STRIPE_ADMIN_KEY</code> in Vercel (xyra-website → Production) and redeploy.
            </p>
          </div>
        ) : (
          <RevenueDashboard data={data} />
        )}
      </div>
    </main>
  );
}
