import type { ReactNode } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Footer from "@/components/Footer";

// ─── LegalPage ───────────────────────────────────────────────────────────────
// /privacy and /terms in the site's own language (the /apply page's frame):
// the warm "+" canvas, the lowercase xyra / ← back bar, a Playfair title, and
// a pair of mono chips to flip between the two documents. Prose stays sentence
// case so the legal text reads straight; only the headings go lowercase.
// Headings keep anchor ids (/privacy#limited-use-style links). No gold.

type Doc = "privacy" | "terms";

const DOCS: { key: Doc; label: string; href: string }[] = [
  { key: "privacy", label: "privacy", href: "/privacy" },
  { key: "terms", label: "terms", href: "/terms" },
];

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

const slug = (s: string) =>
  s.toLowerCase().replace(/^\d+\.\s*/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const chip =
  "font-[family-name:var(--font-jetbrains)] text-[10px] leading-none whitespace-nowrap rounded-full px-2 py-1 border transition-colors";

export default function LegalPage({
  doc,
  title,
  blurb,
  updated,
  markdown,
}: {
  doc: Doc;
  title: string;
  blurb: string;
  updated: string;
  markdown: string;
}) {
  return (
    <div className="xyra-canvas min-h-screen">
      {/* nav — the /apply page's */}
      <div className="relative z-10 flex items-center justify-between px-5 sm:px-8 h-12">
        <Link href="/" className="font-[family-name:var(--font-playfair)] text-lg font-semibold text-black">
          xyra
        </Link>
        <Link
          href="/"
          className="font-[family-name:var(--font-jetbrains)] text-xs text-black underline underline-offset-4 decoration-black/30 hover:decoration-black transition-all lowercase"
        >
          ← back
        </Link>
      </div>

      <main className="max-w-[640px] mx-auto px-6 sm:px-8 pt-10 sm:pt-16 pb-28">
        <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl font-medium text-black leading-[1.05] tracking-tight">
          {title}
        </h1>
        <p className="font-[family-name:var(--font-eb-garamond)] text-lg sm:text-xl text-black/60 mt-3 max-w-md">{blurb}</p>
        <p className="font-[family-name:var(--font-jetbrains)] text-[10px] text-black/35 mt-4 lowercase">
          last updated {updated}
        </p>

        {/* the two documents */}
        <nav aria-label="legal documents" className="flex gap-1.5 mt-6">
          {DOCS.map((d) => (
            <Link
              key={d.key}
              href={d.href}
              aria-current={d.key === doc ? "page" : undefined}
              className={`${chip} ${
                d.key === doc
                  ? "bg-black text-white border-black"
                  : "bg-white/60 text-black/60 border-black/20 hover:border-black hover:text-black"
              }`}
            >
              {d.label}
            </Link>
          ))}
        </nav>

        <div className="mt-12 font-[family-name:var(--font-eb-garamond)] text-black text-lg leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2
                  id={slug(textOf(children))}
                  className="scroll-mt-8 font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl font-medium text-black tracking-tight lowercase mt-14 mb-4"
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="font-[family-name:var(--font-jetbrains)] text-[11px] uppercase tracking-[0.14em] text-black/50 mt-9 mb-2">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="my-4 text-black/70">{children}</p>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-black underline underline-offset-4 decoration-black/30 hover:decoration-black transition-colors"
                  {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => <ul className="my-4 pl-5 space-y-2 list-disc marker:text-black/30">{children}</ul>,
              ol: ({ children }) => <ol className="my-4 pl-5 space-y-2 list-decimal marker:text-black/30">{children}</ol>,
              li: ({ children }) => <li className="text-black/70 pl-1">{children}</li>,
              strong: ({ children }) => <strong className="text-black font-semibold">{children}</strong>,
              hr: () => <hr className="hidden" />,
              code: ({ children }) => (
                <code className="font-[family-name:var(--font-jetbrains)] text-[0.75em] bg-white border border-black/10 rounded-md text-black px-1.5 py-0.5">
                  {children}
                </code>
              ),
              table: ({ children }) => (
                <div className="my-6 overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-[0_4px_14px_rgba(0,0,0,0.05)]">
                  <table className="w-full border-collapse text-base">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border-b border-black/10 px-4 py-2.5 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-normal uppercase tracking-[0.12em] text-black/50">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-t border-black/5 px-4 py-2.5 align-top text-black/70">{children}</td>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </main>

      <Footer />
    </div>
  );
}
