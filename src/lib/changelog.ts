import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Changelog: shared types + the two server-side jobs (save a release, write
// its plain-English summary). Server-only — imports the service-role client.

export const SHIP_KINDS = ["web", "website", "functions", "database", "phone"] as const;
export type ShipKind = (typeof SHIP_KINDS)[number];

export type ShipCommit = { sha: string; at: string; subject: string; areas: string[] };
export type SummaryItem = { type: "new" | "fixed" | "under_the_hood"; text: string };
export type ShipSummary = { headline: string; items: SummaryItem[] };

export type ShipEvent = {
  id: number;
  kind: ShipKind;
  status: "live" | "queued" | "failed";
  shipped_at: string;
  sha: string | null;
  prev_sha: string | null;
  branch: string | null;
  ref: string | null;
  source: string;
  commits: ShipCommit[];
  detail: Record<string, unknown>;
  summary: ShipSummary | null;
  summary_edited: boolean;
  note: string | null;
};

export const isShipKind = (k: unknown): k is ShipKind => typeof k === "string" && (SHIP_KINDS as readonly string[]).includes(k);

// ── Ingest ───────────────────────────────────────────────────────────────────

export type IngestInput = {
  kind: ShipKind;
  status?: ShipEvent["status"];
  shipped_at?: string;
  sha?: string | null;
  prev_sha?: string | null;
  branch?: string | null;
  ref?: string | null;
  source?: string;
  commits?: ShipCommit[];
  detail?: Record<string, unknown>;
  note?: string | null;
};

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : null);

/** Normalise an untrusted ingest body. Returns null when it isn't usable. */
export function parseIngest(body: unknown): IngestInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!isShipKind(b.kind)) return null;
  const commits: ShipCommit[] = Array.isArray(b.commits)
    ? b.commits.slice(0, 80).flatMap((c) => {
        if (!c || typeof c !== "object") return [];
        const r = c as Record<string, unknown>;
        const sha = clip(r.sha, 64);
        const subject = clip(r.subject, 400);
        if (!sha || !subject) return [];
        const at = typeof r.at === "string" && !Number.isNaN(Date.parse(r.at)) ? r.at : new Date().toISOString();
        const areas = Array.isArray(r.areas) ? r.areas.filter((a): a is string => typeof a === "string").slice(0, 8) : [];
        return [{ sha, at, subject, areas }];
      })
    : [];
  const status = b.status === "queued" || b.status === "failed" ? b.status : "live";
  return {
    kind: b.kind,
    status,
    shipped_at: typeof b.shipped_at === "string" && !Number.isNaN(Date.parse(b.shipped_at)) ? b.shipped_at : undefined,
    sha: clip(b.sha, 64),
    prev_sha: clip(b.prev_sha, 64),
    branch: clip(b.branch, 120),
    ref: clip(b.ref, 300),
    source: clip(b.source, 40) ?? "script",
    commits,
    detail: b.detail && typeof b.detail === "object" && !Array.isArray(b.detail) ? (b.detail as Record<string, unknown>) : {},
    note: clip(b.note, 1000),
  };
}

/** Insert (or update, on a re-run of the same ship) one release. */
export async function saveShipEvent(input: IngestInput): Promise<ShipEvent | null> {
  if (!supabaseAdmin) return null;
  const dedupe_key = [input.kind, input.sha ?? "nosha", input.ref ?? ""].join(":");
  const row = { ...input, dedupe_key, shipped_at: input.shipped_at ?? new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from("ship_events")
    .upsert(row, { onConflict: "dedupe_key" })
    .select("*")
    .single();
  if (error) {
    console.error("changelog/save:", error.message);
    return null;
  }
  return data as ShipEvent;
}

/** HEAD of the most recent release of a kind — the start of the next commit range. */
export async function lastShippedSha(kind: ShipKind): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("ship_events")
    .select("sha")
    .eq("kind", kind)
    .neq("status", "failed")
    .not("sha", "is", null)
    .order("shipped_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.sha as string | undefined) ?? null;
}

// ── Summary ──────────────────────────────────────────────────────────────────

const KIND_WORDS: Record<ShipKind, string> = {
  web: "the laptop web app (app.xyra.dev)",
  website: "the marketing site (xyra.dev)",
  functions: "the server (Supabase edge functions)",
  database: "the database (migrations)",
  phone: "the iPhone app (TestFlight build)",
};

const SummarySchema = z.object({
  headline: z.string(),
  items: z.array(z.object({ type: z.enum(["new", "fixed", "under_the_hood"]), text: z.string() })),
});

const SYSTEM = [
  "You write Xyra's internal changelog. Xyra is a voice-first personal app: you talk, it files what you said onto boards (to-dos, schedule, workouts, classes…) and keeps a 'brain' of memories that other AIs can read over MCP.",
  "You get one release: which surface shipped and the commit subjects in it. Write what a teammate needs to know about what changed for users.",
  "Rules: headline is one short sentence, lowercase start is fine, no period needed. Each item is one plain sentence about an effect, not the code. Merge commits that are the same change. Drop merge commits and pure chores unless nothing else shipped. 'new' = something a user can now do or see; 'fixed' = something that was broken; 'under_the_hood' = invisible to users. At most 8 items. No em dashes. Never invent anything the commits don't say.",
].join("\n");

export async function writeSummary(ev: Pick<ShipEvent, "kind" | "commits" | "detail" | "ref">): Promise<ShipSummary | null> {
  if (!process.env.ANTHROPIC_API_KEY || ev.commits.length === 0) return null;
  const client = new Anthropic();
  const lines = ev.commits.map((c) => `- ${c.subject}${c.areas.length ? `  [${c.areas.join(", ")}]` : ""}`).join("\n");
  const extra = Object.keys(ev.detail ?? {}).length ? `\nDetails: ${JSON.stringify(ev.detail).slice(0, 600)}` : "";
  try {
    const res = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(SummarySchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Surface: ${KIND_WORDS[ev.kind]}${extra}\nCommits (newest first):\n${lines}` }],
    });
    if (res.stop_reason === "refusal") return null;
    const out = res.parsed_output;
    if (!out) return null;
    return { headline: out.headline.trim(), items: out.items.slice(0, 8).map((i) => ({ type: i.type, text: i.text.trim() })) };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error("changelog/summary:", e.status, e.message);
    else console.error("changelog/summary:", e);
    return null;
  }
}

/** Write and store the summary for a saved release, unless it was edited by hand. */
export async function summarizeAndStore(ev: ShipEvent): Promise<ShipSummary | null> {
  if (ev.summary_edited || !supabaseAdmin) return ev.summary;
  const summary = await writeSummary(ev);
  if (!summary) return null;
  await supabaseAdmin.from("ship_events").update({ summary }).eq("id", ev.id).eq("summary_edited", false);
  return summary;
}
