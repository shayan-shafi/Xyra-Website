import Link from "next/link";
import Image from "next/image";

// Branded admin header + section nav. Server-rendered, reused by
// /admin/analytics, /admin/growth, and /admin/growth/email. The admin auth
// cookie is path-scoped to /admin, so all three sit behind the same gate.
type AdminSection = "analytics" | "growth" | "email" | "feedback";

const LINKS: { key: AdminSection; label: string; href: string }[] = [
  { key: "analytics", label: "Analytics", href: "/admin/analytics" },
  { key: "growth", label: "Growth", href: "/admin/growth" },
  { key: "email", label: "Email Ops", href: "/admin/growth/email" },
  { key: "feedback", label: "Feedback", href: "/admin/feedback" },
];

export default function AdminNav({ current }: { current: AdminSection }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-4 border-b border-gray-200">
      {/* Wordmark */}
      <Link href="/admin/analytics" className="flex items-center gap-2.5 group">
        <Image src="/assets/xyra-logo-square.png" alt="Xyra" width={28} height={28} className="h-6 w-6" />
        <span className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 leading-none">Xyra</span>
        <span className="font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.18em] text-gray-400 mt-0.5">Admin</span>
      </Link>

      {/* Section pills */}
      <nav className="flex items-center gap-1.5">
        {LINKS.map(l => (
          <Link
            key={l.key}
            href={l.href}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors font-[family-name:var(--font-jetbrains)] tracking-wide ${
              current === l.key
                ? "bg-black text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
