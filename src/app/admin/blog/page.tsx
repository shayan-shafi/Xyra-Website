export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchBlogAdminData } from "./data";
import BlogDashboard from "./BlogDashboard";

export default async function BlogAdminPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const data = await fetchBlogAdminData();

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        <AdminNav current="blog" />

        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-gray-900">Blog</h1>
            <p className="text-sm text-gray-500 mt-1">
              Write, publish, and monitor SEO/GEO content. Posts go live at{" "}
              <a href="/blog" target="_blank" className="underline hover:text-gray-700">
                xyra.dev/blog
              </a>
              .
            </p>
          </div>
        </div>

        <BlogDashboard initialData={data} />
      </div>
    </div>
  );
}
