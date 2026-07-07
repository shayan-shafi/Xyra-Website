import Link from "next/link";
import Image from "next/image";

// Simple, always-visible top bar for the /blog surface. The homepage Navbar is
// scroll-triggered and bound to the waitlist anchor, so the blog gets its own
// lightweight header that stays put and links back to the site + waitlist.
export default function BlogHeader() {
  return (
    <header className="sticky top-0 z-40 bg-warm-white/85 backdrop-blur-md border-b border-ink/10">
      <div className="mx-auto max-w-3xl px-6 sm:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/assets/xyra-logo-square.png" alt="Xyra" width={28} height={28} className="h-6 w-6" priority />
            <span className="font-[family-name:var(--font-playfair)] text-lg text-ink">Xyra</span>
            <span className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.18em] text-ink-faint mt-0.5">
              Blog
            </span>
          </Link>
          <Link
            href="/#waitlist"
            className="font-[family-name:var(--font-jetbrains)] text-xs px-4 py-2 border border-ink/25 text-ink hover:bg-ink hover:text-warm-white transition-colors tracking-wide"
          >
            Join Beta
          </Link>
        </div>
      </div>
    </header>
  );
}
