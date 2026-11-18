import type { Metadata } from "next";
import XLanding from "./XLanding";

// The landing page for X ads. Paid X traffic is mostly phones inside X's
// in-app browser, so this is one screen of what xyra is, the email form
// inline (no sheet, no second button), then how it starts. Live ads point at
// "/?utm_source=x…"; src/middleware.ts rewrites those here, so no ad needs editing.
export const metadata: Metadata = {
  title: "xyra — one memory every AI you use can read",
  description: "Tell ChatGPT once. Claude, Gemini and whatever comes out next already know you.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
};

export default function XPage() {
  return <XLanding />;
}
