import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import BlogHeader from "@/components/blog/BlogHeader";
import Footer from "@/components/Footer";
import { getPublishedPosts, type BlogPostSummary } from "@/lib/blog";
import { SITE_URL, absoluteUrl } from "@/lib/site";

// Revalidate the index every few minutes so newly published posts appear
// without a redeploy, while still serving a cached (fast, SEO-friendly) page.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Blog — Xyra",
  description:
    "Field notes on building an AI-native personal operating system: voice-first productivity, knowledge graphs, and the future of doing.",
  alternates: { canonical: absoluteUrl("/blog") },
  openGraph: {
    title: "The Xyra Blog",
    description:
      "Field notes on building an AI-native personal operating system: voice-first productivity, knowledge graphs, and the future of doing.",
    type: "website",
    url: absoluteUrl("/blog"),
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PostCard({ post, featured = false }: { post: BlogPostSummary; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block border border-ink/10 bg-warm-white hover:border-ink/40 transition-colors"
    >
      {post.cover_image && (
        <div className={`relative w-full overflow-hidden bg-parchment ${featured ? "aspect-[2/1]" : "aspect-[16/9]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.cover_image}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {post.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.14em] text-accent-dark"
            >
              {t}
            </span>
          ))}
        </div>
        <h2
          className={`font-[family-name:var(--font-playfair)] text-ink leading-tight ${
            featured ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}
        >
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-3 font-[family-name:var(--font-eb-garamond)] text-ink-light text-base sm:text-lg leading-relaxed line-clamp-3">
            {post.excerpt}
          </p>
        )}
        <div className="mt-5 flex items-center gap-3 font-[family-name:var(--font-jetbrains)] text-[11px] text-ink-faint tracking-wide">
          <span>{post.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.published_at ?? undefined}>{fmtDate(post.published_at)}</time>
        </div>
      </div>
    </Link>
  );
}

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();
  const [featured, ...rest] = posts;

  // JSON-LD: a Blog with an ItemList of its posts. Helps search + generative
  // engines understand this is a content hub and enumerate the articles.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "The Xyra Blog",
    url: absoluteUrl("/blog"),
    publisher: {
      "@type": "Organization",
      name: "Xyra",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: absoluteUrl("/assets/xyra-logo-square.png") },
    },
    blogPost: posts.slice(0, 25).map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: absoluteUrl(`/blog/${p.slug}`),
      datePublished: p.published_at,
      author: { "@type": "Organization", name: p.author },
    })),
  };

  return (
    <div className="min-h-screen bg-warm-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogHeader />

      <main className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 pb-24">
        {/* Masthead */}
        <div className="mb-14">
          <p className="font-[family-name:var(--font-jetbrains)] text-[11px] uppercase tracking-[0.22em] text-accent-dark mb-4">
            The Xyra Blog
          </p>
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl text-ink leading-[1.05]">
            Notes from building an AI-native OS.
          </h1>
          <p className="mt-5 font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-ink-light leading-relaxed max-w-2xl">
            Voice-first productivity, knowledge graphs, and how we think a personal operating system should feel. Written
            by the people building it.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="border border-dashed border-ink/15 py-24 text-center">
            <Image
              src="/assets/xyra-logo-square.png"
              alt=""
              width={40}
              height={40}
              className="mx-auto h-9 w-9 opacity-30"
            />
            <p className="mt-5 font-[family-name:var(--font-playfair)] text-xl text-ink-light">Nothing published yet.</p>
            <p className="mt-1 font-[family-name:var(--font-eb-garamond)] text-ink-faint">
              The first field notes are on the way.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {featured && <PostCard post={featured} featured />}
            {rest.length > 0 && (
              <div className="grid gap-8 sm:grid-cols-2">
                {rest.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
