export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import Link from "next/link";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import {
  fetchDashboardData,
  type DateRange,
  type DashboardData,
  type FunnelStep,
  type TrafficSource,
  type CtaRow,
  type SectionRow,
  type ScrollRow,
  type CardRow,
  type ReferralRow,
  type Insight,
  type ActionCard,
} from "./data";
import LoginForm from "./LoginForm";

// ── Small helper components (server-rendered) ────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">{children}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
      {children}
    </div>
  );
}

function Bar({ pct, color = "bg-gray-800" }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function InsightBadge({ insight }: { insight: Insight }) {
  const styles = {
    warning: "border-l-4 border-amber-400 bg-amber-50 text-amber-900",
    success: "border-l-4 border-green-400 bg-green-50 text-green-900",
    info: "border-l-4 border-blue-400 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`${styles[insight.type]} px-4 py-3 rounded-r-lg text-sm leading-snug`}>
      {insight.message}
    </div>
  );
}

function ActionTag({ tag }: { tag: ActionCard["tag"] }) {
  const styles: Record<ActionCard["tag"], string> = {
    Fix: "bg-red-100 text-red-700",
    Watch: "bg-amber-100 text-amber-700",
    "Double down": "bg-green-100 text-green-700",
    Promising: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-block shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${styles[tag]}`}>
      {tag}
    </span>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`pb-2 text-xs font-medium text-gray-400 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td className={`py-2 text-sm ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} text-gray-700 border-b border-gray-50 last:border-0`}>
      {children}
    </td>
  );
}

function ConvBadge({ rate }: { rate: number }) {
  const color = rate > 15 ? "text-green-600 font-semibold" : rate > 5 ? "text-amber-600" : "text-gray-500";
  return <span className={color}>{rate}%</span>;
}

function Empty() {
  return <p className="text-sm text-gray-400 italic">No data for this period yet.</p>;
}

// ── Funnel section ────────────────────────────────────────────────────────────

function FunnelSection({ funnel }: { funnel: FunnelStep[] }) {
  return (
    <Card className="mb-6">
      <H2>Conversion Funnel</H2>
      <div className="space-y-4">
        {funnel.map((step, i) => (
          <div key={step.step}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium text-gray-700">{step.step}</span>
              <div className="flex items-center gap-4 text-gray-500">
                <span className="font-bold text-gray-900 tabular-nums w-10 text-right">{step.count.toLocaleString()}</span>
                {i > 0 && (
                  <span className="text-xs text-gray-400 w-28 text-right">
                    {step.pctOfPrev}% of prev · −{step.dropoff.toLocaleString()}
                  </span>
                )}
                <span className="w-12 text-right text-xs font-medium text-gray-600">{step.pctOfVisitors}%</span>
              </div>
            </div>
            <Bar pct={step.pctOfVisitors} />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Traffic Sources ───────────────────────────────────────────────────────────

function TrafficTable({ sources }: { sources: TrafficSource[] }) {
  if (sources.length === 0) return <Empty />;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Source</Th>
          <Th right>Visitors</Th>
          <Th right>Signups</Th>
          <Th right>Conv.</Th>
        </tr>
      </thead>
      <tbody>
        {sources.map(s => (
          <tr key={s.source}>
            <Td><span className="font-medium text-gray-800">{s.source}</span></Td>
            <Td right>{s.visitors.toLocaleString()}</Td>
            <Td right>{s.signups.toLocaleString()}</Td>
            <Td right><ConvBadge rate={s.conversionRate} /></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── CTA Performance ───────────────────────────────────────────────────────────

function CtaTable({ rows }: { rows: CtaRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Location</Th>
          <Th>Label</Th>
          <Th right>Clicks</Th>
          <Th right>Uniq.</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <Td><span className="text-xs text-gray-400">{r.location}</span></Td>
            <Td><span className="font-medium text-gray-800">{r.label}</span></Td>
            <Td right>{r.clicks}</Td>
            <Td right>{r.uniqueClickers}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Section Engagement ────────────────────────────────────────────────────────

function SectionBars({ rows }: { rows: SectionRow[] }) {
  if (rows.every(r => r.uniqueSessions === 0)) return <Empty />;
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.section}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium text-gray-700 capitalize">{r.section}</span>
            <div className="flex items-center gap-3 text-gray-500 text-xs">
              <span>{r.uniqueSessions.toLocaleString()} sessions</span>
              <span className="w-9 text-right font-semibold text-gray-800">{r.pctOfSessions}%</span>
            </div>
          </div>
          <Bar pct={r.pctOfSessions} />
        </div>
      ))}
    </div>
  );
}

// ── Scroll Depth ──────────────────────────────────────────────────────────────

function ScrollBars({ rows }: { rows: ScrollRow[] }) {
  if (rows.every(r => r.sessions === 0)) return <Empty />;
  return (
    <div className="space-y-3">
      {rows.map(r => {
        const color = r.pctOfSessions > 60 ? "bg-green-500" : r.pctOfSessions > 30 ? "bg-amber-400" : "bg-red-400";
        return (
          <div key={r.threshold}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">{r.threshold}% scrolled</span>
              <div className="flex items-center gap-3 text-gray-500 text-xs">
                <span>{r.sessions.toLocaleString()} sessions</span>
                <span className="w-9 text-right font-semibold text-gray-800">{r.pctOfSessions}%</span>
              </div>
            </div>
            <Bar pct={r.pctOfSessions} color={color} />
          </div>
        );
      })}
    </div>
  );
}

// ── Feature Cards ─────────────────────────────────────────────────────────────

function CardBars({ rows }: { rows: CardRow[] }) {
  if (rows.length === 0) return <Empty />;
  const maxClicks = rows[0].clicks;
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.card}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-medium capitalize text-gray-700">{r.card}</span>
            <span className="text-xs text-gray-500">{r.uniqueClickers} uniq · {r.clicks} clicks</span>
          </div>
          <Bar pct={maxClicks > 0 ? (r.clicks / maxClicks) * 100 : 0} />
        </div>
      ))}
    </div>
  );
}

// ── Referrals ─────────────────────────────────────────────────────────────────

function ReferralTable({ rows }: { rows: ReferralRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Ref Code</Th>
          <Th right>Visitors</Th>
          <Th right>Signups</Th>
          <Th right>Conv.</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.refCode}>
            <Td mono>{r.refCode}</Td>
            <Td right>{r.visitors}</Td>
            <Td right>{r.signups}</Td>
            <Td right><ConvBadge rate={r.conversionRate} /></Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Date range nav ────────────────────────────────────────────────────────────

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ data, range }: { data: DashboardData; range: DateRange }) {
  const { summary, funnel, trafficSources, ctaPerformance, sectionEngagement, scrollDepth, featureCards, survey, referrals, insights, actions, trackingStartDate } = data;

  const showTrackingNote = summary.legacySignups > 0 || trackingStartDate !== null;
  const trackingDateLabel = trackingStartDate
    ? new Date(trackingStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">Xyra website · first-party only · private</p>
          </div>
          <div className="flex items-center gap-2">
            {DATE_RANGES.map(r => (
              <Link
                key={r.value}
                href={`/admin/analytics?range=${r.value}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  range === r.value
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400 hover:text-gray-900"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Tracking note — only shown when legacy signups exist */}
        {showTrackingNote && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-800">
            <span className="shrink-0 mt-0.5">⚠</span>
            <p className="leading-snug">
              Conversion rates only include visitors and signups tracked after analytics was
              added{trackingDateLabel ? ` (${trackingDateLabel})` : ""}.{" "}
              {summary.legacySignups > 0 && (
                <>
                  <strong>{summary.legacySignups} older waitlist {summary.legacySignups === 1 ? "signup" : "signups"}</strong>{" "}
                  {summary.legacySignups === 1 ? "is" : "are"} shown separately below and excluded from conversion rates.
                </>
              )}
            </p>
          </div>
        )}

        {/* Summary row 1: core KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          <StatCard label="Visitors" value={summary.uniqueVisitors.toLocaleString()} />
          <StatCard label="Sessions" value={summary.totalSessions.toLocaleString()} />
          <StatCard
            label="Tracked signups"
            value={summary.successfulSignups.toLocaleString()}
            sub={summary.legacySignups > 0 ? `+${summary.legacySignups} pre-tracking` : undefined}
          />
          <StatCard label="Conversion" value={`${summary.conversionRate}%`} sub="tracked visitors→signup" />
          <StatCard label="Survey rate" value={`${summary.surveyCompletionRate}%`} sub="tracked signups→survey" />
        </div>

        {/* Summary row 2: funnel counts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard label="CTA clickers" value={summary.ctaClickers.toLocaleString()} />
          <StatCard label="Waitlist views" value={summary.waitlistViewers.toLocaleString()} />
          <StatCard label="Email submits" value={summary.emailSubmitters.toLocaleString()} />
          <StatCard label="Survey submits" value={summary.surveySubmitters.toLocaleString()} />
          <StatCard label="Survey skips" value={summary.surveySkippers.toLocaleString()} />
        </div>

        {/* Funnel */}
        <FunnelSection funnel={funnel} />

        {/* Insights + Actions */}
        {(insights.length > 0 || actions.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {insights.length > 0 && (
              <Card>
                <H2>What This Means</H2>
                <div className="space-y-3">
                  {insights.map((ins, i) => <InsightBadge key={i} insight={ins} />)}
                </div>
              </Card>
            )}
            {actions.length > 0 && (
              <Card>
                <H2>Recommended Actions</H2>
                <div className="space-y-3">
                  {actions.map((act, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                      <ActionTag tag={act.tag} />
                      <p className="text-sm text-gray-700 leading-snug">{act.message}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Traffic Sources + CTA Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <H2>Traffic Sources</H2>
            <TrafficTable sources={trafficSources} />
          </Card>
          <Card>
            <H2>CTA Performance</H2>
            <CtaTable rows={ctaPerformance} />
          </Card>
        </div>

        {/* Section Engagement + Scroll Depth */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <H2>Section Engagement</H2>
            <SectionBars rows={sectionEngagement} />
          </Card>
          <Card>
            <H2>Scroll Depth</H2>
            <ScrollBars rows={scrollDepth} />
          </Card>
        </div>

        {/* Feature Cards + Survey */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <H2>Feature Card Engagement</H2>
            <CardBars rows={featureCards} />
          </Card>
          <Card>
            <H2>Survey Completion</H2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">{survey.signups}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Signups</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-700">{survey.submits}</div>
                  <div className="text-xs text-green-600 mt-0.5">Submitted</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-amber-700">{survey.skips}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Skipped</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">Completion</span>
                  <span className="font-semibold text-gray-900">{survey.completionRate}%</span>
                </div>
                <Bar pct={survey.completionRate} color="bg-green-500" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-gray-600">Skip rate</span>
                  <span className="font-semibold text-gray-900">{survey.skipRate}%</span>
                </div>
                <Bar pct={survey.skipRate} color="bg-amber-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Referrals */}
        {referrals.length > 0 && (
          <Card className="mb-6">
            <H2>Referral Performance</H2>
            <ReferralTable rows={referrals} />
          </Card>
        )}

        <p className="text-center text-xs text-gray-300 py-4">
          First-party analytics · No ad tracking · Xyra internal tool
        </p>
      </div>
    </main>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string | string[] };
}) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const rawRange = Array.isArray(searchParams.range) ? searchParams.range[0] : searchParams.range;
  const range: DateRange =
    rawRange === "7d" ? "7d" : rawRange === "all" ? "all" : "30d";

  const data = await fetchDashboardData(range);

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ fontFamily: "system-ui,sans-serif" }}>
        <div className="text-center p-8 bg-white rounded-xl border border-gray-200 max-w-sm">
          <p className="font-semibold text-gray-900">Dashboard unavailable</p>
          <p className="text-sm text-gray-500 mt-1">Ensure <code className="bg-gray-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> is set in your environment.</p>
        </div>
      </main>
    );
  }

  return <Dashboard data={data} range={range} />;
}
