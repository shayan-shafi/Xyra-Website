import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { PRIVACY_MD, PRIVACY_UPDATED } from "@/content/legal/privacy";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — Xyra",
  description: "What Xyra collects, what it does with it, and who else ever sees it.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated={PRIVACY_UPDATED} markdown={PRIVACY_MD} />;
}
