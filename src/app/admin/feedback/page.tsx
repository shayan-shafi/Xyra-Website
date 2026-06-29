export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { fetchFeedbackData, type FeedbackTicket, type DemandRow } from "./data";

// ── helpers ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.12em]">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900 mb-4">{children}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-200 p-6 ${className}`}>{children}</div>;
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className="bg-gray-800 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Empty({ label = "Nothing here yet." }: { label?: string }) {
  return <p className="text-sm text-gray-400 italic">{label}</p>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TYPE_STYLES: Record<FeedbackTicket["type"], string> = {
  bug: "bg-red-100 text-red-700",
  idea: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-600",
};

const STATUS_STYLES: Record<FeedbackTicket["status"], string> = {
  open: "bg-amber-100 text-amber-700",
  triaged: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  wontfix: "bg-gray-100 text-gray-500",
};

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-block shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${className}`}>
      {children}
    </span>
  );
}

function DemandList({ rows, accent }: { rows: DemandRow[]; accent: string }) {
  if (rows.length === 0) return <Empty label="No votes yet." />;
  const max = Math.max(...rows.map((r) => r.wants), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-700">{r.label}</span>
            <span className={`text-sm font-semibold tabular-nums ${accent}`}>{r.wants}</span>
          </div>
          <Bar pct={(r.wants / max) * 100} />
        </div>
      ))}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function FeedbackPage() {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const data = await fetchFeedbackData();

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        <AdminNav current="feedback" />

        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl text-gray-900">Feedback &amp; Wishlist</h1>
          <p className="text-sm text-gray-500 mt-1">Everything testers are telling us — bug reports, ideas, and what they want built next.</p>
        </div>

        {!data ? (
          <Card>
            <H2>App database not connected</H2>
            <p className="text-sm text-gray-600 leading-relaxed">
              This page reads from the Xyra <strong>app</strong> Supabase project (a different project from
              the site&apos;s own analytics DB). Add these to <code className="px-1 py-0.5 bg-gray-100 rounded">.env.local</code> and Vercel, then redeploy:
            </p>
            <pre className="mt-4 text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">{`APP_SUPABASE_URL=https://naklqxesofjyhnehgizl.supabase.co
APP_SUPABASE_SERVICE_ROLE_KEY=<app project service-role key>`}</pre>
            <p className="text-xs text-gray-400 mt-3">The service-role key is in Supabase → app project → Settings → API. Server-only — never expose it to the browser.</p>
          </Card>
        ) : (
          <>
            {/* Stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
              <StatCard label="Open tickets" value={data.counts.openTickets} sub={`${data.counts.totalTickets} total`} />
              <StatCard label="Feedback" value={data.counts.totalTickets} />
              <StatCard label="Connector hearts" value={data.counts.connectorHearts} />
              <StatCard label="Reminder votes" value={data.counts.reminderVotes} />
              <StatCard label="Ideas & requests" value={data.counts.ideas} />
            </div>

            {/* User feedback */}
            <div className="mb-10">
              <H2>User Feedback</H2>
              <Card className="overflow-x-auto">
                {data.tickets.length === 0 ? (
                  <Empty label="No feedback submitted yet." />
                ) : (
                  <table className="w-full min-w-[680px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">Type</th>
                        <th className="pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">Message</th>
                        <th className="pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">From</th>
                        <th className="pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">Context</th>
                        <th className="pb-2 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">Status</th>
                        <th className="pb-2 text-right font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">Replies</th>
                        <th className="pb-2 text-right font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em]">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tickets.map((t) => (
                        <tr key={t.id} className="border-b border-gray-50 last:border-0 align-top">
                          <td className="py-3 pr-3"><Pill className={TYPE_STYLES[t.type]}>{t.type}</Pill></td>
                          <td className="py-3 pr-3 text-sm text-gray-800 max-w-md">{t.message}</td>
                          <td className="py-3 pr-3 text-xs text-gray-500 font-mono whitespace-nowrap">{t.email ?? "—"}</td>
                          <td className="py-3 pr-3 text-xs text-gray-500">{t.dashboardTitle ?? "—"}</td>
                          <td className="py-3 pr-3"><Pill className={STATUS_STYLES[t.status]}>{t.status}</Pill></td>
                          <td className="py-3 pr-3 text-sm text-gray-600 text-right tabular-nums">
                            {t.replyCount}
                            {t.lastSender === "user" && t.replyCount > 0 && <span className="ml-1 text-amber-500" title="Last reply from the tester">●</span>}
                          </td>
                          <td className="py-3 text-xs text-gray-400 text-right whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>

            {/* Connector wishlist */}
            <div className="mb-10">
              <H2>Connector Wishlist</H2>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Most wanted</h3>
                  <DemandList rows={data.connectorDemand} accent="text-rose-600" />
                </Card>
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Requested (not listed)</h3>
                  {data.connectorRequests.length === 0 ? (
                    <Empty label="No custom requests yet." />
                  ) : (
                    <div className="space-y-3">
                      {data.connectorRequests.map((r, i) => (
                        <div key={`${r.label}-${i}`} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-800">{r.label}</span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.createdAt)}</span>
                          </div>
                          {r.reason && <p className="text-xs text-gray-500 mt-1 leading-snug">{r.reason}</p>}
                          {r.email && <p className="text-[11px] text-gray-400 font-mono mt-1">{r.email}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>

            {/* Reminder wishlist */}
            <div className="mb-10">
              <H2>Reminder Wishlist</H2>
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Types they&apos;d use</h3>
                  <DemandList rows={data.reminderDemand} accent="text-indigo-600" />
                </Card>
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">How they want to be reminded</h3>
                  {data.reminderIdeas.length === 0 ? (
                    <Empty label="No ideas yet." />
                  ) : (
                    <div className="space-y-3">
                      {data.reminderIdeas.map((r, i) => (
                        <div key={`${r.label}-${i}`} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                          <p className="text-sm text-gray-800 leading-snug">{r.label}</p>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            {r.email && <span className="text-[11px] text-gray-400 font-mono">{r.email}</span>}
                            <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">{fmtDate(r.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
