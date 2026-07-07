import { getPublishedPosts, metaDescription } from "@/lib/blog";
import { SITE_URL, absoluteUrl } from "@/lib/site";

// RSS 2.0 feed of published posts at /blog/rss.xml. Handy for syndication and
// for crawlers/aggregators that discover content via feeds. Regenerated
// periodically so new posts appear without a redeploy.
export const revalidate = 900;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getPublishedPosts();
  const updated = posts[0]?.published_at ?? posts[0]?.updated_at ?? null;

  const items = posts
    .map((p) => {
      const link = absoluteUrl(`/blog/${p.slug}`);
      const desc = p.excerpt?.trim() || metaDescription({ seo_description: null, excerpt: p.excerpt, body_md: "" });
      const pubDate = p.published_at ? new Date(p.published_at).toUTCString() : "";
      return [
        "    <item>",
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        `      <description>${escapeXml(desc)}</description>`,
        ...p.tags.map((t) => `      <category>${escapeXml(t)}</category>`),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Xyra Blog</title>
    <link>${absoluteUrl("/blog")}</link>
    <atom:link href="${absoluteUrl("/blog/rss.xml")}" rel="self" type="application/rss+xml" />
    <description>Notes from building an AI-native personal operating system.</description>
    <language>en-us</language>
    ${updated ? `<lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>` : ""}
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
