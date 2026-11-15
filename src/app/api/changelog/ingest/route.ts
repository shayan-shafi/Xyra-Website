import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { isShipKind, lastShippedSha, parseIngest, saveShipEvent, summarizeAndStore } from "@/lib/changelog";

// Release ingest for the admin Changelog tab.
//
//   GET  ?kind=web      → { sha }  the HEAD of the last release of that kind
//   POST {kind, sha, commits, …} → saves the release, writes its summary
//
// Called by scripts/log-ship.mjs (ship scripts + the xyra.dev build), never by
// a browser. Auth = `Authorization: Bearer $CHANGELOG_INGEST_SECRET`. Lives
// under /api (not /admin) because it uses that secret, not the admin cookie.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the summary call

function authorized(req: Request): boolean {
  const secret = process.env.CHANGELOG_INGEST_SECRET;
  if (!secret) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isShipKind(kind)) return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  return NextResponse.json({ sha: await lastShippedSha(kind) });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const input = parseIngest(body);
  if (!input) return NextResponse.json({ error: "Need a known kind" }, { status: 400 });

  const saved = await saveShipEvent(input);
  if (!saved) return NextResponse.json({ error: "Could not save (is ship_events created?)" }, { status: 500 });

  const summary = await summarizeAndStore(saved);
  return NextResponse.json({ id: saved.id, commits: saved.commits.length, summary: summary?.headline ?? null });
}
