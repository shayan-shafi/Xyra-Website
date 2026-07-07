import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { slugify } from "@/lib/blog";

// ── AI blog draft assist ─────────────────────────────────────────────────────
// Admin-only. Takes a topic/outline and returns a full DRAFT post (title, slug,
// excerpt, tags, SEO meta, and a Markdown body) for review in the editor. It
// only drafts — it never publishes. The API key stays server-side. Disabled
// with a clear setup-needed response unless ANTHROPIC_API_KEY is configured.
//
// Calls the Anthropic Messages API directly via fetch (no SDK dependency),
// mirroring /admin/growth/email/generate-draft. Model: claude-opus-4-8.

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
      {
        error:
          "AI draft assist needs an Anthropic API key. Set ANTHROPIC_API_KEY in the server environment to enable it. Until then, write posts manually.",
        setupNeeded: true,
      },
      { status: 501 }
    );
  }

  let body: { prompt?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Describe the topic you want the post to cover." }, { status: 400 });

  const system = [
    "You are a senior content writer for Xyra, an AI-native personal operating system. You speak, Xyra builds: one conversational, voice-first interface that replaces fragmented productivity apps with dashboards it builds for you on the fly, all connected by a personal knowledge graph.",
    "You write SEO- and GEO-optimized blog posts (Generative Engine Optimization: content that AI answer engines will happily cite).",
    "Voice: warm, sharp, founder-written. Authoritative but human. Concrete over hypey. Sounds like a real person who has thought hard about the problem, not a marketing department or an AI.",
    "",
    "SEO/GEO craft:",
    "- Lead with a clear, self-contained answer to the post's core question in the first paragraph (answer-first, so engines can extract it).",
    "- Use descriptive H2/H3 headings phrased the way people actually search and ask.",
    "- Prefer short paragraphs, concrete examples, and the occasional list or table where it genuinely helps scannability.",
    "- Naturally weave in the topic's key terms without keyword-stuffing.",
    "- 700-1200 words unless the topic clearly needs more or less.",
    "",
    "Hard rules:",
    "1. Do NOT use em dashes or en dashes (— or –). Use commas, or split into separate sentences. This is important to the brand voice.",
    "2. Do NOT invent product features, launch dates, metrics, pricing, customer names, or quotes. Keep claims general when specifics aren't given. Never fabricate statistics or cite fake sources.",
    "3. The body is Markdown. Do NOT include an H1/title in the body (the title is a separate field). Start the body with the opening paragraph.",
    "4. Output ONLY a single JSON object. No prose, no markdown code fences around the JSON.",
    "",
    "Return a JSON object with exactly these keys:",
    '- "title": a compelling, specific post title (no "Xyra" prefix needed).',
    '- "slug": a url-safe slug (lowercase, hyphens). Keep it short and keyword-relevant.',
    '- "excerpt": a 1-2 sentence summary (max ~160 chars) used on the blog index and as a fallback meta description.',
    '- "tags": an array of 2-5 short lowercase topical tags.',
    '- "seo_title": an SEO title tag, ~55-60 chars, front-loaded with the primary keyword. May differ from the display title.',
    '- "seo_description": a meta description, ~150-155 chars, that entices a click and states what the reader will learn.',
    '- "body_md": the full post body in Markdown (no H1).',
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
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: `Write a blog post about: ${prompt}` }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("blog generate-draft anthropic error:", res.status, detail.slice(0, 500));
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

  const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
  const title = asStr(obj.title).trim();
  const draft = {
    title,
    slug: slugify(asStr(obj.slug).trim() || title),
    excerpt: asStr(obj.excerpt).trim(),
    tags: Array.isArray(obj.tags)
      ? (obj.tags as unknown[]).map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 5)
      : [],
    seo_title: asStr(obj.seo_title).trim(),
    seo_description: asStr(obj.seo_description).trim(),
    body_md: asStr(obj.body_md),
  };

  return NextResponse.json({ drafted: true, draft });
}
