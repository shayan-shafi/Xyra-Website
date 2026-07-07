import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders a post's Markdown body into styled, semantic HTML. Used by the public
// post page and (in a lighter frame) the admin editor's live preview. No raw
// HTML is rendered — react-markdown escapes it by default, so pasted Markdown is
// safe. Styling leans on the site's editorial system (Playfair headings, EB
// Garamond body, gold accents) rather than the Tailwind typography plugin.

export default function PostBody({ markdown }: { markdown: string }) {
  return (
    <div className="font-[family-name:var(--font-eb-garamond)] text-ink text-lg sm:text-xl leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl text-ink mt-12 mb-5 leading-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl text-ink mt-11 mb-4 leading-snug">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl text-ink mt-9 mb-3">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="my-5 text-ink-light">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-accent-dark underline decoration-accent/40 underline-offset-4 hover:decoration-accent-dark transition-colors"
              {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-5 pl-6 space-y-2 list-disc marker:text-accent">{children}</ul>,
          ol: ({ children }) => <ol className="my-5 pl-6 space-y-2 list-decimal marker:text-ink-faint">{children}</ol>,
          li: ({ children }) => <li className="text-ink-light pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-7 border-l-2 border-accent pl-5 italic text-ink-light font-[family-name:var(--font-playfair)] text-xl">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="text-ink font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-10 border-0 border-t border-ink/10" />,
          code: ({ children }) => (
            <code className="font-[family-name:var(--font-jetbrains)] text-[0.85em] bg-parchment text-ink px-1.5 py-0.5">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-7 overflow-x-auto bg-ink text-warm-white p-5 font-[family-name:var(--font-jetbrains)] text-sm leading-relaxed">
              {children}
            </pre>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} className="my-8 w-full border border-ink/10" />
          ),
          table: ({ children }) => (
            <div className="my-7 overflow-x-auto">
              <table className="w-full border-collapse text-base">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-ink/15 bg-parchment px-3 py-2 text-left font-[family-name:var(--font-jetbrains)] text-xs uppercase tracking-wide">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-ink/10 px-3 py-2 text-ink-light">{children}</td>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
