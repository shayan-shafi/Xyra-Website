import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogHeader from "@/components/blog/BlogHeader";
import Footer from "@/components/Footer";
import PostBody from "@/components/blog/PostBody";
import {
  getPublishedPostBySlug,
  getPublishedPosts,
  metaDescription,
  readingTimeMinutes,
} from "@/lib/blog";
import { SITE_URL, absoluteUrl } from "@/lib/site";

// ISR: render on demand, cache, and refresh every few minutes so edits to a
// published post go live without a redeploy.
export const revalidate = 300;

// Pre-render the known published posts at build; new ones render on first hit.
export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return { title: "Post not found — Xyra", robots: { index: false, follow: false } };

  const title = post.seo_title?.trim() || post.title;
  const description = metaDescription(post);
  const url = absoluteUrl(`/blog/${post.slug}`);
  const images = post.cover_image ? [{ url: post.cover_image }] : undefined;

  return {
    title: `${title} — Xyra`,
    description,
    alternates: { canonical: url },
    keywords: post.tags,
    authors: [{ name: post.author }],
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: post.cover_image ? "summary_large_image" : "summary",
      title,
      description,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) notFound();

  const url = absoluteUrl(`/blog/${post.slug}`);
  const description = metaDescription(post);

  // Article schema (with a BreadcrumbList) — the primary signal for SEO rich
  // results and for generative engines citing the piece.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.seo_title?.trim() || post.title,
        description,
        image: post.cover_image ? [post.cover_image] : undefined,
        datePublished: post.published_at,
        dateModified: post.updated_at,
        author: { "@type": "Organization", name: post.author, url: SITE_URL },
        publisher: {
          "@type": "Organization",
          name: "Xyra",
          url: SITE_URL,
          logo: { "@type": "ImageObject", url: absoluteUrl("/assets/xyra-logo-square.png") },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        keywords: post.tags.join(", "),
        url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-warm-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogHeader />

      <article className="mx-auto max-w-3xl px-6 sm:px-8 pt-14 pb-24">
        <Link
          href="/blog"
          className="inline-block font-[family-name:var(--font-jetbrains)] text-[11px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink transition-colors"
        >
          ← All posts
        </Link>

        {/* Header */}
        <header className="mt-8 mb-10">
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {post.tags.map((t) => (
              <span
                key={t}
                className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.14em] text-accent-dark"
              >
                {t}
              </span>
            ))}
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl text-ink leading-[1.06]">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-5 font-[family-name:var(--font-eb-garamond)] text-xl text-ink-light leading-relaxed">
              {post.excerpt}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-ink-faint tracking-wide">
            <span>{post.author}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.published_at ?? undefined}>{fmtDate(post.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{readingTimeMinutes(post.body_md)} min read</span>
          </div>
        </header>

        {post.cover_image && (
          <div className="mb-10 border border-ink/10 bg-parchment">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image} alt={post.title} className="w-full" />
          </div>
        )}

        <PostBody markdown={post.body_md} />

        {/* Footer CTA */}
        <div className="mt-16 border-t border-ink/10 pt-10 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-2xl text-ink">Speak. Xyra builds.</p>
          <p className="mt-2 font-[family-name:var(--font-eb-garamond)] text-ink-light">
            One conversational interface for your whole life.
          </p>
          <Link
            href="/#waitlist"
            className="mt-6 inline-block font-[family-name:var(--font-jetbrains)] text-xs px-6 py-3 bg-ink text-warm-white hover:bg-accent-dark transition-colors tracking-wide"
          >
            Join the Beta
          </Link>
        </div>
      </article>

      <Footer />
    </div>
  );
}
