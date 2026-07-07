import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BlogPost } from "@/lib/blog";

// Data layer for the admin Blog dashboard. Reads/writes go through the SITE's
// service-role client (supabaseAdmin) — same project as analytics/waitlist, a
// different project from the app DB used by the Feedback tab. Returns null when
// the service-role key isn't configured, so the page can show a setup notice
// instead of crashing (mirrors the Feedback dashboard's behavior).

export interface AdminBlogPost extends BlogPost {
  /** Lifetime pageviews for /blog/<slug>, derived from analytics_events. */
  views: number;
}

export interface BlogAdminData {
  counts: {
    total: number;
    published: number;
    drafts: number;
    totalViews: number;
  };
  posts: AdminBlogPost[];
}

// PostgREST caps each response at ~1000 rows; page through so a growing
// analytics_events table doesn't silently truncate the view tallies.
const PAGE = 1000;

/** slug → pageview count, from analytics `pageview` events on /blog/<slug>. */
async function fetchViewsBySlug(): Promise<Map<string, number>> {
  const views = new Map<string, number>();
  if (!supabaseAdmin) return views;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("analytics_events")
      .select("path")
      .eq("event_name", "pageview")
      .like("path", "/blog/%")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("blog views fetch:", error.message);
      break;
    }
    const rows = data ?? [];
    for (const r of rows) {
      const path: string = r.path ?? "";
      // Only exact post paths (/blog/<slug>), not the index or nested junk.
      const m = path.match(/^\/blog\/([^/?#]+)\/?$/);
      if (m) views.set(m[1], (views.get(m[1]) ?? 0) + 1);
    }
    if (rows.length < PAGE) break;
  }
  return views;
}

export async function fetchBlogAdminData(): Promise<BlogAdminData | null> {
  if (!supabaseAdmin) return null;

  const [{ data: postRows, error }, viewsBySlug] = await Promise.all([
    supabaseAdmin
      .from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1000),
    fetchViewsBySlug(),
  ]);

  if (error) {
    console.error("fetchBlogAdminData:", error.message);
    return { counts: { total: 0, published: 0, drafts: 0, totalViews: 0 }, posts: [] };
  }

  const posts: AdminBlogPost[] = (postRows ?? []).map((p) => ({
    ...(p as BlogPost),
    views: viewsBySlug.get(p.slug) ?? 0,
  }));

  return {
    counts: {
      total: posts.length,
      published: posts.filter((p) => p.status === "published").length,
      drafts: posts.filter((p) => p.status === "draft").length,
      totalViews: posts.reduce((sum, p) => sum + p.views, 0),
    },
    posts,
  };
}
