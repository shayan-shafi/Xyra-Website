import type { Metadata } from "next";
import LegalPage from "@/components/legal/LegalPage";
import { TERMS_MD, TERMS_UPDATED } from "@/content/legal/terms";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service — Xyra",
  description: "The agreement between you and Xyra AI, Inc. for using Xyra.",
  alternates: { canonical: absoluteUrl("/terms") },
};

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated={TERMS_UPDATED} markdown={TERMS_MD} />;
}
