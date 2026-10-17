import Link from "next/link";
import BlogHeader from "@/components/blog/BlogHeader";
import Footer from "@/components/Footer";
import PostBody from "@/components/blog/PostBody";

// Shared frame for /privacy and /terms: the blog's editorial reading column,
// with the markdown body rendered by the same PostBody the posts use.

export default function LegalPage({
  title,
  updated,
  markdown,
}: {
  title: string;
  updated: string;
  markdown: string;
}) {
  return (
    <div className="min-h-screen bg-warm-white">
      <BlogHeader />

      <article className="mx-auto max-w-3xl px-6 sm:px-8 pt-14 pb-24">
        <Link
          href="/"
          className="inline-block font-[family-name:var(--font-jetbrains)] text-[11px] uppercase tracking-[0.14em] text-ink-faint hover:text-ink transition-colors"
        >
          ← Xyra
        </Link>

        <header className="mt-8 mb-6">
          <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl text-ink leading-[1.06]">
            {title}
          </h1>
          <p className="mt-5 font-[family-name:var(--font-jetbrains)] text-[11px] text-ink-faint tracking-wide">
            Last updated {updated}
          </p>
        </header>

        <PostBody markdown={markdown} />
      </article>

      <Footer />
    </div>
  );
}
