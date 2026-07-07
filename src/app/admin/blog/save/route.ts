import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminApiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { slugify } from "@/lib/blog";

// Admin-only. Create or update a blog post. Lives under /admin so the
// path-scoped admin cookie is sent. Writes via the service-role client.

export async function POST(request: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Site database not connected (missing service-role key)." }, { status: 501 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const strOrNull = (v: unknown): string | null => {
    const s = str(v);
    return s.length ? s : null;
  };

  const title = str(body.title);
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const slug = slugify(str(body.slug) || title);
  if (!slug) return NextResponse.json({ error: "Could not derive a valid slug from the title." }, { status: 400 });

  const status = str(body.status) === "published" ? "published" : "draft";
  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : [];

  const id = typeof body.id === "number" ? body.id : null;

  // Preserve the original publish date; only stamp it the first time a post
  // goes live (never reset it on later edits).
  let published_at: string | null = null;
  if (id) {
    const { data: existing } = await supabaseAdmin
      .from("blog_posts")
      .select("published_at, status")
      .eq("id", id)
      .maybeSingle();
    published_at = existing?.published_at ?? null;
  }
  if (status === "published" && !published_at) {
    published_at = new Date().toISOString();
  }

  const record = {
    slug,
    title,
    excerpt: strOrNull(body.excerpt),
    body_md: typeof body.body_md === "string" ? body.body_md : "",
    cover_image: strOrNull(body.cover_image),
    tags,
    author: str(body.author) || "Xyra",
    status,
    seo_title: strOrNull(body.seo_title),
    seo_description: strOrNull(body.seo_description),
    published_at,
  };

  const query = id
    ? supabaseAdmin.from("blog_posts").update(record).eq("id", id).select("*").maybeSingle()
    : supabaseAdmin.from("blog_posts").insert(record).select("*").maybeSingle();

  const { data, error } = await query;
  if (error) {
    // Unique-violation on slug → friendly message.
    if (error.code === "23505") {
      return NextResponse.json({ error: `A post with the slug "${slug}" already exists. Choose a different slug.` }, { status: 409 });
    }
    console.error("blog save:", error.message);
    return NextResponse.json({ error: `Save failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ saved: true, post: data });
}
