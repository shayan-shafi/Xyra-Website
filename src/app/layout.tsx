import type { Metadata } from "next";
import { Playfair_Display, EB_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const garamond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Xyra — The AI-Native Personal Operating System",
  description:
    "You speak, Xyra builds. Replace fragmented productivity tools with a single conversational interface. Join the beta waitlist.",
  keywords: [
    "AI dashboard",
    "productivity",
    "personal operating system",
    "knowledge graph",
    "AI assistant",
  ],
  openGraph: {
    title: "Xyra — You speak, Xyra builds.",
    description:
      "The AI-native personal operating system that replaces fragmented tools with a single conversational interface.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${playfair.variable} ${garamond.variable} ${jetbrains.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
