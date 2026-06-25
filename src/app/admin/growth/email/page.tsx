export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LoginForm from "../../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import EmailOps from "./EmailOps";

// Is the image-upload storage bucket present and public? Drives whether the
// drag-and-drop uploader is active or shows a "setup needed" state.
async function checkImageUploadReady(): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const bucket = process.env.GROWTH_IMAGE_BUCKET || "email-assets";
  try {
    const { data, error } = await supabaseAdmin.storage.getBucket(bucket);
    return !error && Boolean(data?.public);
  } catch {
    return false;
  }
}

export default async function EmailOpsPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const sendsEnabled = process.env.ENABLE_GROWTH_EMAIL_SENDS === "true";
  const imageUploadReady = await checkImageUploadReady();
  const aiDraftReady = Boolean(process.env.ANTHROPIC_API_KEY);
  // Growth emails should send from GROWTH_EMAIL_FROM, not the analytics sender.
  const growthFromEmail = process.env.GROWTH_EMAIL_FROM || process.env.ANALYTICS_REPORT_FROM_EMAIL || "shayan@xyra.dev";
  const usingFallbackSender = !process.env.GROWTH_EMAIL_FROM;
  // The internal/admin addresses test sends go to. Safe to show the authed
  // admin which of their own addresses will receive a test.
  const internalRecipients = (
    process.env.GROWTH_EMAIL_TEST_RECIPIENTS ||
    process.env.ANALYTICS_REPORT_RECIPIENTS ||
    process.env.DAILY_SIGNUPS_RECIPIENTS ||
    ""
  )
    .split(",")
    .map(e => e.trim())
    .filter(e => e.includes("@"));
  const hasInternalRecipients = internalRecipients.length > 0;

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="email" />
        <div className="mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Email Ops</h1>
          <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
            Edit &amp; preview branded Xyra emails · test-send to yourself · export recipients
            {sendsEnabled ? " · guarded real sends enabled" : " · real sends disabled"}
          </p>
        </div>
        <EmailOps sendsEnabled={sendsEnabled} hasInternalRecipients={hasInternalRecipients} internalRecipients={internalRecipients} imageUploadReady={imageUploadReady} aiDraftReady={aiDraftReady} growthFromEmail={growthFromEmail} usingFallbackSender={usingFallbackSender} />
      </div>
    </main>
  );
}
