import type { Metadata } from "next";
import AlphaApply from "@/components/apply/AlphaApply";

// /apply — the alpha application, on the site instead of a Google Form.
// Same five questions, asked as a conversation on the canvas (AlphaApply).

const DESCRIPTION =
  "ready to help us build the future? apply here to snag an early spot and test out xyra before anyone else.";

export const metadata: Metadata = {
  title: "apply to test xyra",
  description: DESCRIPTION,
  alternates: { canonical: "/apply" },
  openGraph: {
    title: "join the xyra alpha squad",
    description: DESCRIPTION,
    type: "website",
  },
};

export default function ApplyPage() {
  return <AlphaApply />;
}
