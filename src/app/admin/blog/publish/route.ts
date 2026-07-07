import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Admin-only. One-click publish / unpublish toggle from the post list.
// Stamps published_at the first time a post goes live; preserves it thereafter.

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Site database not connected (missing service-role key)." }, { status: 501 });
  }

  let body: { id?: unknown; publish?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "number" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Missing post id." }, { status: 400 });
  const publish = body.publish !== false; // default: publish

  const { data: existing, error: readErr } = await supabaseAdmin
    .from("blog_posts")
    .select("published_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const update = {
    status: publish ? "published" : "draft",
    published_at: publish ? existing?.published_at ?? new Date().toISOString() : existing?.published_at ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, post: data });
}
