export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../../../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import RecipientGroups from "./RecipientGroups";

export default function RecipientGroupsPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="email" />
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Recipient Groups</h1>
            <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
              Save reusable send lists (Alpha Group 1, Beta Testers, Investors…) and load them into Email Ops later.
            </p>
          </div>
          <Link
            href="/admin/growth/email"
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900"
          >
            ← Back to Email Ops
          </Link>
        </div>
        <RecipientGroups />
      </div>
    </main>
  );
}
