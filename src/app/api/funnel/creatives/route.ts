import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { resolveWindow } from "@/app/admin/analytics/data";
import { fetchFunnelData } from "@/app/admin/funnel/data";

// Per-ad funnel numbers for the content factory's analyst run (factory/ANALYST.md
// in ~/my-video): the "By creative" table of /admin/funnel as JSON, keyed by
// utm_content (= the factory's ad name, <slug>-h<N>).
//
//   GET ?range=7d|30d|all            → { window, creatives, totals, unattributed }
//   GET ?start=YYYY-MM-DD&end=…      → same, custom range (Central time)
//
// Counts only, never emails. Team accounts are left out. Auth = the same machine
// secret as the changelog logger: `Authorization: Bearer $CHANGELOG_INGEST_SECRET`
// (on Shayan's Mac in ~/.xyra-changelog-secret).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const q = new URL(req.url).searchParams;
  const w = resolveWindow({ range: q.get("range") ?? "7d", start: q.get("start"), end: q.get("end") });
  if (w.error) return NextResponse.json({ error: w.error }, { status: 400 });

  const data = await fetchFunnelData(w, false);
  if (!data) return NextResponse.json({ error: "Site database not connected" }, { status: 503 });

  return NextResponse.json({
    window: { preset: w.preset, label: w.label, startIso: w.startIso, endIso: w.endIso },
    appConnected: data.appConnected,
    totals: { visitors: data.site.visitors.total, ...data.totals },
    unattributed: data.unattributed,
    creatives: data.creatives,
  });
}
