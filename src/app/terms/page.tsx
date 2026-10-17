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
  return (
    <LegalPage
      doc="terms"
      title="terms of service"
      blurb="the deal between you and xyra, in plain words."
      updated={TERMS_UPDATED}
      markdown={TERMS_MD}
    />
  );
}
