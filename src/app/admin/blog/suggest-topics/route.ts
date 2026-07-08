import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";

// ── AI topic ideation ────────────────────────────────────────────────────────
// Admin-only. Proposes blog post topics for the agentic drafting flow. Optional
// `angle` steers the ideas (e.g. "founder lessons", "voice-first productivity").
// Returns short, specific, SEO/GEO-worthy title-style topics. Never publishes.
// Disabled with a clear setup-needed response unless ANTHROPIC_API_KEY is set.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI topic ideas need an Anthropic API key. Set ANTHROPIC_API_KEY to enable it.", setupNeeded: true },
      { status: 501 }
    );
  }

  let body: { angle?: unknown; count?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const angle = typeof body.angle === "string" ? body.angle.trim() : "";
  const count = Math.min(10, Math.max(3, typeof body.count === "number" ? body.count : 6));

  const system = [
    "You are a content strategist for Xyra, an AI-native personal operating system. You speak, Xyra builds: one conversational, voice-first interface that replaces fragmented productivity apps with dashboards it builds on the fly, connected by a personal knowledge graph.",
    "Propose blog post topics optimized for SEO and GEO (content AI answer engines will cite). Each topic is a specific, compelling title, phrased the way people search or ask. Mix evergreen how-to/explainer angles with point-of-view founder pieces. Concrete over generic. No em dashes.",
    "Output ONLY a JSON object: { \"topics\": string[] }. No prose, no code fences.",
  ].join("\n");

  const user = angle
    ? `Propose ${count} blog post topics. Angle/theme to focus on: ${angle}`
    : `Propose ${count} blog post topics across a healthy mix of angles.`;

  let aiText: string;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("suggest-topics anthropic error:", res.status, detail.slice(0, 500));
      return NextResponse.json({ error: `AI provider error (${res.status}).` }, { status: 502 });
    }
    const json = await res.json();
    aiText = (json.content ?? [])
      .filter((b: { type?: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("");
  } catch (e) {
    return NextResponse.json({ error: `AI request failed: ${String(e)}` }, { status: 502 });
  }

  const parsed = extractJson(aiText) as { topics?: unknown } | null;
  const topics = Array.isArray(parsed?.topics)
    ? (parsed!.topics as unknown[]).map((t) => String(t).trim()).filter(Boolean).slice(0, 10)
    : [];
  if (topics.length === 0) {
    return NextResponse.json({ error: "AI returned no usable topics. Try again or add an angle." }, { status: 502 });
  }

  return NextResponse.json({ topics });
}
