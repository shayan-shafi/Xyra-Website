import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { getGrowthTemplate, PER_RECIPIENT_KEYS } from "@/lib/growthEmailTemplates";

// ── AI draft assist ─────────────────────────────────────────────────────────
// Admin-only. Takes a short prompt and returns DRAFT field values for a
// template (subject, section toggles, and global placeholder content). It only
// fills fields — it never sends. The API key stays server-side (never exposed
// to the client). Disabled with a clear setup-needed response unless
// ANTHROPIC_API_KEY is configured.
//
// Calls the Anthropic Messages API directly via fetch (no SDK dependency).
// Model: claude-opus-4-8 (current most-capable Opus; adaptive thinking omitted
// for this short structured-drafting task to keep latency and parsing simple).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-8";

function isPerRecipient(key: string): boolean {
  return (PER_RECIPIENT_KEYS as readonly string[]).includes(key);
}

// Pull the first balanced JSON object out of a string (handles stray prose or
// code fences the model might add despite instructions).
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
      {
        error:
          "AI draft assist needs an Anthropic API key. Set ANTHROPIC_API_KEY in the server environment to enable it. Until then, write drafts manually.",
        setupNeeded: true,
      },
      { status: 501 }
    );
  }

  let body: { templateId?: unknown; prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  const tpl = getGrowthTemplate(templateId);
  if (!tpl) return NextResponse.json({ error: "Unknown templateId" }, { status: 400 });

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Describe what you want the email to say." }, { status: 400 });

  // Fields the model may fill: global placeholders only (per-recipient fields
  // are derived from waitlist data at send time, never drafted here).
  const globalFields = tpl.placeholders
    .filter(p => !isPerRecipient(p.key) && p.type !== "image" && p.type !== "images")
    .map(p => ({ key: p.key, label: p.label, multiline: Boolean(p.multiline), help: p.help ?? "" }));
  const sectionKeys = tpl.sections.map(s => ({ key: s.key, label: s.label }));

  const fieldList = globalFields
    .map(f => `- ${f.key}${f.multiline ? " (multiline: one item per line)" : ""}: ${f.label}${f.help ? ` — ${f.help}` : ""}`)
    .join("\n");
  const sectionList = sectionKeys.map(s => `- ${s.key}: ${s.label}`).join("\n") || "(none)";

  const system = [
    "You draft internal marketing emails for Xyra, an AI-native personal operating system, written by its two founders, Cole and Shayan.",
    "Voice: warm, direct, human, founder-written. Concise. Sounds like a real person, not a marketing department or an AI.",
    "Hard rules:",
    "1. Do NOT use em dashes or en dashes (— or –) as sentence connectors. Use commas, or split into separate sentences. This is important.",
    "2. Do NOT invent product details, launch dates, metrics, links, or claims. Only use what the user's prompt gives you. If a detail isn't provided, keep that part general rather than fabricating specifics.",
    "3. Never fill an access link or any URL with a fake value. If a field is for an access link, leave it as an empty string.",
    "4. Keep per-recipient personalization out of it — do not write a greeting name; that is added automatically.",
    "5. Output ONLY a single JSON object, no prose, no markdown fences.",
    "",
    `You are drafting the "${tpl.name}" template. Return a JSON object with exactly these top-level keys:`,
    `- "subject": a string subject line.`,
    `- "sections": an object mapping each section key to true (include) or false (omit), based on what the user's request needs. Section keys:\n${sectionList}`,
    `- "values": an object filling these content fields (omit any you can't fill from the prompt; never fabricate):\n${fieldList}`,
    "",
    "For multiline fields, separate items with newline characters. Leave any access-link field as an empty string.",
  ].join("\n");

  let aiText: string;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: `Draft this email: ${prompt}` }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("generate-draft anthropic error:", res.status, detail.slice(0, 500));
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

  const parsed = extractJson(aiText);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "AI returned an unparseable draft. Try again or refine your prompt." }, { status: 502 });
  }
  const obj = parsed as Record<string, unknown>;

  // Sanitize: only known keys, correct types; never accept per-recipient keys;
  // force any access-link field to empty (no fabricated links).
  const subject = typeof obj.subject === "string" ? obj.subject : "";

  const allowedValueKeys = new Set(globalFields.map(f => f.key));
  const values: Record<string, string> = {};
  if (obj.values && typeof obj.values === "object") {
    for (const [k, v] of Object.entries(obj.values as Record<string, unknown>)) {
      if (allowedValueKeys.has(k) && typeof v === "string") values[k] = v;
    }
  }
  if ("alpha_access_link" in values) values.alpha_access_link = "";

  const allowedSectionKeys = new Set(sectionKeys.map(s => s.key));
  const sections: Record<string, boolean> = {};
  if (obj.sections && typeof obj.sections === "object") {
    for (const [k, v] of Object.entries(obj.sections as Record<string, unknown>)) {
      if (allowedSectionKeys.has(k) && typeof v === "boolean") sections[k] = v;
    }
  }

  return NextResponse.json({ drafted: true, subject, values, sections });
}
