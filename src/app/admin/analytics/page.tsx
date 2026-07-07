export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import {
  fetchDashboardData,
  resolveWindow,
  type DashboardData,
  type ResolvedWindow,
  type FunnelStep,
  type TrafficSource,
  type CtaRow,
  type SectionRow,
  type ScrollRow,
  type CardRow,
  type ReferralRow,
  type MarketingSourceTotal,
  type MarketingRow,
  type UnmatchedSignupRow,
  type MarketingRowDebug,
  type CampaignRow,
  type CampaignPerfRow,
  type ContentRow,
  type ImportRow,
  type Insight,
  type ActionCard,
} from "./data";
import { getSourceColor, sourceLabel } from "@/lib/analyticsSource";
import LoginForm from "./LoginForm";
import RangeControls from "./RangeControls";
import { SignupsPerDayChart, VisitorsPerDayChart, SourceSignupsChart, SourceConversionChart } from "./Charts";
import AdminNav from "@/components/AdminNav";

// ── Small helper components (server-rendered) ────────────────────────────────

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
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-6 ${className}`}>
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
    <th className={`pb-2 font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em] ${right ? "text-right" : "text-left"}`}>
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

function dash(val: string | null): string {
  return val && val.length > 0 ? val : "—";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
        {sources.map(s => {
          const otherRaw = s.rawSources.filter(r => r !== s.source);
          return (
            <tr key={s.source}>
              <Td>
                <span className="font-medium text-gray-800">{s.source}</span>
                {otherRaw.length > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">{otherRaw.join(", ")}</div>
                )}
              </Td>
              <Td right>{s.visitors.toLocaleString()}</Td>
              <Td right>{s.signups.toLocaleString()}</Td>
              <Td right><ConvBadge rate={s.conversionRate} /></Td>
            </tr>
          );
        })}
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

function RefConvBadge({ row }: { row: ReferralRow }) {
  if (row.conversionRate === null) {
    return (
      <span
        className="text-amber-600 font-medium"
        title="Attributed signups exceed tracked visitors, or there were no tracked visitors at all — see helper text above."
      >
        {row.conversionLabel}
      </span>
    );
  }
  return <ConvBadge rate={row.conversionRate} />;
}

function ReferralTable({ rows }: { rows: ReferralRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead>
          <tr>
            <Th>Ref Code</Th>
            <Th right>Visitors</Th>
            <Th right>Sessions</Th>
            <Th right>Referral-attributed Signups</Th>
            <Th right>Matched</Th>
            <Th>First Visit</Th>
            <Th>Last Visit</Th>
            <Th>First Signup</Th>
            <Th>Last Signup</Th>
            <Th right>Conv.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.refCode}>
              <Td mono>{r.refCode}</Td>
              <Td right>{r.visitors}</Td>
              <Td right>{r.sessions}</Td>
              <Td right>{r.attributedSignups}</Td>
              <Td right>{r.matchedSignups}</Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.firstVisit)}</span></Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.lastVisit)}</span></Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.firstSignupAt)}</span></Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.lastSignupAt)}</span></Td>
              <Td right><RefConvBadge row={r} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Marketing Performance ───────────────────────────────────────────────────────

function SourceTotalsTable({ rows }: { rows: MarketingSourceTotal[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr>
            <Th>Source</Th>
            <Th right>Visitors</Th>
            <Th right>Sessions</Th>
            <Th right>Signups</Th>
            <Th right>Conv.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isDirect = r.source === "direct";
            return (
              <tr key={i}>
                <Td>
                  <span className={isDirect ? "text-gray-400 italic" : "font-semibold text-gray-800 capitalize"}>
                    {isDirect ? "Direct / unknown" : r.source}
                  </span>
                </Td>
                <Td right>{r.visitors.toLocaleString()}</Td>
                <Td right>{r.sessions.toLocaleString()}</Td>
                <Td right>
                  {r.signups.toLocaleString()}
                  {r.approxSignups > 0 && (
                    <span
                      className="text-amber-500 ml-0.5"
                      title={`${r.approxSignups} of these had no matching tracked session — see Unmatched / Approximate Signups below`}
                    >
                      *
                    </span>
                  )}
                </Td>
                <Td right><ConvBadge rate={r.conversionRate} /></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnmatchedSignupsTable({ rows }: { rows: UnmatchedSignupRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-4">
      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
        Unmatched / Approximate Signups
      </div>
      <p className="text-xs text-amber-700/80 mb-3 leading-snug">
        These {rows.reduce((s, r) => s + r.signups, 0)} signup(s) are already counted in the
        source totals above, but their converting session (or fallback first-touch tuple) never
        matched a tracked visit in this window — usually an ad blocker, private browsing, or a
        first touch outside the selected date range, not a campaign that converted with 0
        visitors.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <Th>Source</Th>
              <Th>Medium</Th>
              <Th>Campaign</Th>
              <Th>Content</Th>
              <Th right>Signups</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <Td><span className="font-medium text-gray-700 capitalize">{r.source}</span></Td>
                <Td>{dash(r.medium)}</Td>
                <Td>{dash(r.campaign)}</Td>
                <Td>{dash(r.content)}</Td>
                <Td right>{r.signups.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketingDebugTable({ rows }: { rows: MarketingRowDebug[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px]">
        <thead>
          <tr>
            <Th>Source</Th>
            <Th>Medium</Th>
            <Th>Campaign</Th>
            <Th>Content</Th>
            <Th>Ref Code</Th>
            <Th right>Visitors</Th>
            <Th right>Signups</Th>
            <Th>First seen</Th>
            <Th>Last seen</Th>
            <Th>First signup</Th>
            <Th>Last signup</Th>
            <Th>Raw utm_source</Th>
            <Th>Sample landing path</Th>
            <Th>Sample referrer</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td><span className="font-medium text-gray-700 capitalize">{r.source}</span></Td>
              <Td>{dash(r.medium)}</Td>
              <Td>{dash(r.campaign)}</Td>
              <Td><span className="break-words">{dash(r.content)}</span></Td>
              <Td mono>{dash(r.refCode)}</Td>
              <Td right>{r.visitors.toLocaleString()}</Td>
              <Td right>
                {r.signups.toLocaleString()}
                {r.approxSignups > 0 && <span className="text-amber-500 ml-0.5">*</span>}
              </Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.firstSeen)}</span></Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.lastSeen)}</span></Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.firstSignupAt)}</span></Td>
              <Td><span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.lastSignupAt)}</span></Td>
              <Td><span className="text-xs text-gray-400">{r.rawSources.join(", ") || "—"}</span></Td>
              <Td><span className="text-xs text-gray-400 break-words">{dash(r.sampleLandingPath)}</span></Td>
              <Td><span className="text-xs text-gray-400">{dash(r.sampleReferrerDomain)}</span></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Referral-code traffic with no stronger UTM source shouldn't read as plain
// "Direct" in the decision-facing table — it's a known acquisition channel,
// just not a UTM-tagged one.
function marketingSourceLabel(source: string, refCode: string | null): string {
  return source === "direct" && refCode ? "referral" : source;
}

function MarketingTable({ rows }: { rows: MarketingRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <Th>Source</Th>
            <Th>Medium</Th>
            <Th>Campaign</Th>
            <Th>Content / Post / Ad</Th>
            <Th>Ref Code</Th>
            <Th right>Visitors</Th>
            <Th right>Sessions</Th>
            <Th right>Signups</Th>
            <Th right>Conv.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isDirect = r.source === "direct" && !r.medium && !r.campaign && !r.content && !r.refCode;
            const sourceLabel = marketingSourceLabel(r.source, r.refCode);
            return (
              <tr key={i}>
                <Td>
                  <span className={isDirect ? "text-gray-400 italic" : "font-medium text-gray-800 capitalize"}>
                    {isDirect ? "Direct / unknown" : sourceLabel}
                  </span>
                </Td>
                <Td><span className="break-words">{dash(r.medium)}</span></Td>
                <Td><span className="break-words">{dash(r.campaign)}</span></Td>
                <Td><span className="break-words">{dash(r.content)}</span></Td>
                <Td mono>{dash(r.refCode)}</Td>
                <Td right>{r.visitors.toLocaleString()}</Td>
                <Td right>{r.sessions.toLocaleString()}</Td>
                <Td right>
                  {r.signups.toLocaleString()}
                  {r.approxSignups > 0 && (
                    <span
                      className="text-amber-500 ml-0.5"
                      title={`${r.approxSignups} of these had no matching conversion event and used first-touch as a fallback`}
                    >
                      *
                    </span>
                  )}
                </Td>
                <Td right><ConvBadge rate={r.conversionRate} /></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Raw Session Details (debug) ─────────────────────────────────────────────────

function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px]">
        <thead>
          <tr>
            <Th>Source</Th>
            <Th>Medium</Th>
            <Th>Campaign</Th>
            <Th>Content</Th>
            <Th>Ref Code</Th>
            <Th>Landing Path</Th>
            <Th>Referrer</Th>
            <Th right>Visitors</Th>
            <Th right>Sessions</Th>
            <Th right>Signups</Th>
            <Th right>Conv.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td><span className="font-medium text-gray-800">{dash(r.utmSource)}</span></Td>
              <Td>{dash(r.utmMedium)}</Td>
              <Td>{dash(r.utmCampaign)}</Td>
              <Td>{dash(r.utmContent)}</Td>
              <Td mono>{dash(r.refCode)}</Td>
              <Td><span className="text-xs text-gray-400">{dash(r.landingPath)}</span></Td>
              <Td><span className="text-xs text-gray-400">{dash(r.referrerDomain)}</span></Td>
              <Td right>{r.visitors.toLocaleString()}</Td>
              <Td right>{r.sessions.toLocaleString()}</Td>
              <Td right>
                {r.signups.toLocaleString()}
                {r.approxSignups > 0 && (
                  <span
                    className="text-amber-500 ml-0.5"
                    title={`${r.approxSignups} of these had no matching conversion event and used first-touch as a fallback`}
                  >
                    *
                  </span>
                )}
              </Td>
              <Td right><ConvBadge rate={r.conversionRate} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Source label chip (consistent color dot) ───────────────────────────────────

function SourceChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getSourceColor(source) }} />
      <span className="font-medium text-gray-800">{sourceLabel(source)}</span>
    </span>
  );
}

// ── Campaign performance (utm_campaign) ─────────────────────────────────────────

function CampaignPerfTable({ rows }: { rows: CampaignPerfRow[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <Th>Campaign</Th>
            <Th>Source</Th>
            <Th right>Visitors</Th>
            <Th right>Signups</Th>
            <Th right>% of signups</Th>
            <Th right>Conv.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td><span className="font-medium text-gray-800 break-words">{r.campaign}</span></Td>
              <Td><SourceChip source={r.source} /></Td>
              <Td right>{r.visitors.toLocaleString()}</Td>
              <Td right>{r.signups.toLocaleString()}</Td>
              <Td right>{r.pctOfSignups}%</Td>
              <Td right><ConvBadge rate={r.conversionRate} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Content / creative performance (utm_content) ────────────────────────────────

function ContentTable({ rows }: { rows: ContentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic leading-snug">
        No <span className="font-mono not-italic">utm_content</span> tags in this range yet. Give each
        ad/creative a unique <span className="font-mono not-italic">utm_content</span> (e.g.{" "}
        <span className="font-mono not-italic">graveyard_v2</span>) to compare them here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <Th>Content / Creative</Th>
            <Th>Source</Th>
            <Th>Campaign</Th>
            <Th right>Visitors</Th>
            <Th right>Signups</Th>
            <Th right>Conv.</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td><span className="font-medium text-gray-800 break-words">{r.content}</span></Td>
              <Td><SourceChip source={r.source} /></Td>
              <Td>{dash(r.campaign)}</Td>
              <Td right>{r.visitors.toLocaleString()}</Td>
              <Td right>{r.signups.toLocaleString()}</Td>
              <Td right><ConvBadge rate={r.conversionRate} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Imported-contacts note (kept out of attribution) ────────────────────────────

function ImportNote({ imports, total }: { imports: ImportRow[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 text-sm text-slate-700">
      <span className="shrink-0 mt-0.5">📥</span>
      <div className="leading-snug">
        <strong>{total.toLocaleString()} imported {total === 1 ? "contact" : "contacts"}</strong> in this
        range {total === 1 ? "is" : "are"} <strong>excluded</strong> from all conversion and source
        attribution — these are backfilled contacts, not organic signups.
        {imports.length > 0 && (
          <span className="text-slate-500">
            {" "}Breakdown:{" "}
            {imports.map((im, i) => (
              <span key={im.source}>
                {i > 0 && ", "}
                <span className="font-mono">{im.source}</span> {im.signups}
              </span>
            ))}
            .
          </span>
        )}
      </div>
    </div>
  );
}

// ── Data caveats (founder-readable) ─────────────────────────────────────────────

function CaveatsCard() {
  const items = [
    "“Direct / unknown” may include people who saw an Instagram ad and later typed the site in manually, tapped an untagged link-in-bio, or came from an in-person demo — it is not a clean channel.",
    "Source attribution now recognizes more referrers such as TikTok, Reddit, Google, Facebook, X/Twitter, and LinkedIn. Some traffic that previously appeared as Direct/Unknown may now appear under its actual source.",
    "Imported contacts (survey_import / notion_import) are excluded from conversion and source attribution, and shown only in the note above.",
    "Conversion rates depend on available visitor/session data — a signup whose visit wasn’t tracked (ad blocker, private browsing) can’t be tied to a source.",
    "Each visitor’s source uses their true first-ever touch across all history, so it doesn’t change with the selected date range. Campaign/session rows below instead credit the link that actually converted.",
    "Custom ranges use America/Chicago dates with an inclusive start and exclusive end.",
  ];
  return (
    <Card className="mb-6">
      <H2>How to read this</H2>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600 leading-snug">
            <span className="text-gray-300 mt-0.5">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ data, window }: { data: DashboardData; window: ResolvedWindow }) {
  const {
    summary,
    funnel,
    trafficSources,
    ctaPerformance,
    sectionEngagement,
    scrollDepth,
    featureCards,
    survey,
    referrals,
    marketingSourceTotals,
    marketing,
    unmatchedSignups,
    marketingDebug,
    campaigns,
    signupsOverTime,
    sourceChart,
    campaignPerformance,
    contentPerformance,
    imports,
    insights,
    actions,
    trackingStartDate,
  } = data;

  const showTrackingNote = summary.legacySignups > 0 || trackingStartDate !== null;
  const trackingDateLabel = trackingStartDate
    ? new Date(trackingStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        <AdminNav current="analytics" />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-[family-name:var(--font-playfair)] text-3xl text-gray-900">Analytics</h1>
            <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">Xyra website · first-party only · private</p>
          </div>
          <RangeControls
            preset={window.preset}
            startDateCT={window.startDateCT}
            endDateCT={window.endDateCT}
            windowLabel={window.label}
            error={window.error}
          />
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

        {/* Imported-contacts note — only when imports fall in this range */}
        <ImportNote imports={imports} total={summary.importSignups} />

        {/* Summary row 1: core KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
          <StatCard label="Visitors" value={summary.uniqueVisitors.toLocaleString()} sub="unique people" />
          <StatCard
            label="Real signups"
            value={summary.realSignups.toLocaleString()}
            sub={summary.importSignups > 0 ? `imports excluded (+${summary.importSignups})` : "imports excluded"}
          />
          <StatCard
            label="Tracked signups"
            value={summary.successfulSignups.toLocaleString()}
            sub={summary.legacySignups > 0 ? `+${summary.legacySignups} pre-tracking` : "used for conv. rates"}
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

        {/* Signups over time */}
        <Card className="mb-6">
          <H2>Real Signups Per Day</H2>
          <p className="text-xs text-gray-400 mb-5 leading-snug">
            Real signups per day (imports excluded), grouped by America/Chicago date, across the
            selected range.
          </p>
          <SignupsPerDayChart data={signupsOverTime} />

          {/* Visitors — secondary, supporting context, own scale */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <VisitorsPerDayChart data={signupsOverTime} />
          </div>
        </Card>

        {/* Attribution charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <H2>Signups by Source</H2>
            <p className="text-xs text-gray-400 mb-4 leading-snug">
              Which source drove the most signups in this range. Colors are consistent across every
              chart and table.
            </p>
            <SourceSignupsChart data={sourceChart} />
          </Card>
          <Card>
            <H2>Conversion by Source</H2>
            <p className="text-xs text-gray-400 mb-4 leading-snug">
              Signup rate per source (sources with at least 3 tracked visitors, to avoid
              low-volume noise). Answers &quot;which source converts best&quot;.
            </p>
            <SourceConversionChart data={sourceChart} />
          </Card>
        </div>

        {/* Campaign + Content performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <H2>Campaign Performance</H2>
            <p className="text-xs text-gray-400 mb-4 leading-snug">
              By <span className="font-mono">utm_campaign</span> — rolled up across creatives.
              Signups credited to the session that converted; imports excluded.
            </p>
            <CampaignPerfTable rows={campaignPerformance} />
          </Card>
          <Card>
            <H2>Content / Creative Performance</H2>
            <p className="text-xs text-gray-400 mb-4 leading-snug">
              By <span className="font-mono">utm_content</span> — one row per ad/post/creative. This
              is where future paid ads (e.g. <span className="font-mono">graveyard_v2</span>,{" "}
              <span className="font-mono">prof_promo_v2</span>) show up individually.
            </p>
            <ContentTable rows={contentPerformance} />
          </Card>
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
            <p className="text-xs text-gray-400 mb-3 leading-snug">
              Broad first-touch acquisition only — one row per visitor&apos;s true first-ever
              channel. For which specific post, ad, or link drove signups, see Marketing
              Performance below.
            </p>
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
            <p className="text-xs text-gray-400 mb-1 leading-snug">
              Marketing attribution, not the app&apos;s referral reward logic — &quot;Referral-attributed
              Signups&quot; credits whichever ref code was active in the session that converted (matching
              Campaign / Content Breakdown above), falling back to the visitor&apos;s first-ever touch
              only when that session wasn&apos;t tracked. The actual referral reward / leaderboard
              credit (<span className="font-mono">referral_count</span>) is keyed primarily off the
              visitor&apos;s first-ever-touch ref code instead, so the two can disagree for a visitor
              who clicks a different referral link on a later visit before signing up. Don&apos;t treat
              this table as a leaderboard of record.
            </p>
            <p className="text-xs text-gray-400 mb-3 leading-snug">
              If a signup is attributed to a ref code but the matching visit/session is missing,
              conversion may be approximate or unavailable.
            </p>
            <ReferralTable rows={referrals} />
          </Card>
        )}

        {/* Marketing Performance — the decision-friendly campaign table */}
        <Card className="mb-6">
          <H2>Marketing Performance</H2>
          <p className="text-xs text-gray-400 mb-4 leading-snug">
            Session/campaign-level attribution — the same visitor can appear under multiple rows
            or sources if they arrived through more than one link or session in this window, so
            totals here won&apos;t always match Traffic Sources above (which counts each visitor
            once, under their true first-ever channel, across all history). Signups are credited
            to the link/session that actually converted, not the visitor&apos;s original
            first-touch.
          </p>

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Source Totals
          </div>
          <SourceTotalsTable rows={marketingSourceTotals} />
          <p className="text-xs text-gray-400 mt-2 mb-2 leading-snug italic">
            &quot;Direct / unknown&quot; is a fallback bucket, not a clean digital channel — it can
            include offline founder-driven signups (in-person demos, presentations, texted links),
            untagged shared links, or visitors who typed the URL directly. Don&apos;t read it as a
            single attributable source.
          </p>

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-6">
            Campaign / Content Breakdown
          </div>
          <p className="text-xs text-gray-400 mb-2 leading-snug">
            One row per marketing identity (source + medium + campaign + content + ref code),
            grouped by source above. A <span className="text-amber-500">*</span> means some
            signups in that row had no matching conversion event and fell back to first-touch
            instead.
          </p>
          <p className="text-xs text-gray-400 mb-2 leading-snug italic">
            Campaign rows with a ref code are displayed as Referral instead of Direct when no UTM
            source exists.
          </p>
          <p className="text-xs text-gray-400 mb-4 leading-snug italic">
            Exact post-level attribution only works when that post/ad/link used a unique UTM or
            referral code. E.g. if every Instagram post points to the same link-in-bio URL, all
            of them collapse into one <span className="not-italic font-medium">instagram / link_in_bio / general</span> row
            — we can&apos;t tell which specific post drove a click. Give each important
            post/ad/QR/DM its own <span className="not-italic font-medium">utm_content</span> or{" "}
            <span className="not-italic font-medium">utm_campaign</span> going forward to
            separate them.
          </p>
          <MarketingTable rows={marketing} />

          <UnmatchedSignupsTable rows={unmatchedSignups} />
        </Card>

        {/* Campaign Row Details — per-row debug context, collapsed by default */}
        <details className="mb-6 bg-white rounded-xl border border-gray-200 p-6 group">
          <summary className="text-sm font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none list-none group-open:mb-4">
            Campaign Row Details (debug)
          </summary>
          <p className="text-xs text-gray-400 mb-4 leading-snug">
            Trace a confusing row above back to its raw origin: when this exact source/medium/
            campaign/content combination was first and last seen, when signups attributed to it
            happened, which raw <span className="font-mono">utm_source</span> values normalized
            into it (e.g. both &quot;ig&quot; and &quot;instagram&quot;), and a sample landing
            path/referrer. Internal/admin-only — not for sharing externally.
          </p>
          <MarketingDebugTable rows={marketingDebug} />
          <p className="text-xs text-gray-400 mt-4 leading-snug">
            <span className="font-medium text-gray-500">For clean attribution going forward</span>,
            use consistent UTM naming per post/ad/link: <span className="font-mono">utm_source=instagram</span>,{" "}
            <span className="font-mono">utm_medium=link_in_bio</span> /{" "}
            <span className="font-mono">organic_social</span> /{" "}
            <span className="font-mono">paid_social</span> / <span className="font-mono">dm</span>,{" "}
            <span className="font-mono">utm_campaign=&lt;campaign_name&gt;</span>, and{" "}
            <span className="font-mono">utm_content=&lt;specific_post_or_ad_name&gt;</span>.
            Rows with inconsistent historical naming or raw ad-platform IDs in{" "}
            <span className="font-mono">utm_content</span> (e.g. a long numeric value) are most
            likely old links or Meta-generated dynamic ad parameters, not deliberate tags.
          </p>
        </details>

        {/* Raw Session Details — debug view, collapsed by default */}
        <details className="mb-6 bg-white rounded-xl border border-gray-200 p-6 group">
          <summary className="text-sm font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none list-none group-open:mb-4">
            Raw Session Details (debug)
          </summary>
          <p className="text-xs text-gray-400 mb-4 leading-snug">
            One row per distinct link including referrer domain and landing path — useful for
            debugging attribution, not for marketing decisions. The same visitor/session can
            appear here multiple times split across rows that Marketing Performance above
            would otherwise merge (e.g. same campaign, different referrer domain).
          </p>
          <CampaignTable rows={campaigns} />
        </details>

        {/* Data caveats */}
        <CaveatsCard />

        <p className="text-center text-xs text-gray-300 py-4">
          First-party analytics · No ad tracking · Xyra internal tool
        </p>
      </div>
    </main>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { range?: string | string[]; start?: string | string[]; end?: string | string[] };
}) {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!token || !isValidAdminToken(token)) {
    return <LoginForm />;
  }

  const window = resolveWindow({
    range: first(searchParams.range),
    start: first(searchParams.start),
    end: first(searchParams.end),
  });

  const data = await fetchDashboardData(window);

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

  return <Dashboard data={data} window={window} />;
}
