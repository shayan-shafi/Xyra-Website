import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The cover image every link to xyra.dev shows (iMessage, X, Threads, Slack…).
// Built once at build time from the brand fonts in ./_og.
export const alt = "xyra — iCloud storage but for AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(join(process.cwd(), "src/app/_og", file));

export default async function Image() {
  const [playfair, playfairItalic, mono] = await Promise.all([
    font("PlayfairDisplay_600SemiBold.ttf"),
    font("PlayfairDisplay_400Regular_Italic.ttf"),
    font("JetBrainsMono_400Regular.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf8",
          padding: "72px 88px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", fontFamily: "JetBrains Mono", fontSize: 22, letterSpacing: 4, color: "#8c8c8c" }}>
          YOUR BRAIN, IN EVERY AI
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", fontFamily: "Playfair Display", fontWeight: 600, fontSize: 220, lineHeight: 1, letterSpacing: -6, color: "#111111" }}>
            xyra
          </div>
          <div style={{ display: "flex", marginTop: 28, fontFamily: "Playfair Display", fontStyle: "italic", fontWeight: 400, fontSize: 64, color: "#333333" }}>
            iCloud storage but for AI
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "2px solid #ececec", paddingTop: 28 }}>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 26, color: "#111111" }}>xyra.dev</div>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 22, color: "#8c8c8c" }}>claude · chatgpt · gemini</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Playfair Display", data: playfair, weight: 600, style: "normal" },
        { name: "Playfair Display", data: playfairItalic, weight: 400, style: "italic" },
        { name: "JetBrains Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
