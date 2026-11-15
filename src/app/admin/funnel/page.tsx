export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/adminAuth";
import LoginForm from "../analytics/LoginForm";
import AdminNav from "@/components/AdminNav";
import { resolveWindow } from "../analytics/data";
import { fetchFunnelData, type CreativeRow, type Step } from "./data";

// /admin/funnel — ad → xyra.dev → app → paid, in one place (funnel plan stage 2).
// Server-rendered; the range and the internal-accounts toggle are query params.

const MONO = "font-[family-name:var(--font-jetbrains)]";
const SERIF = "font-[family-name:var(--font-playfair)]";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "—");
const ct = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <h2 className={`${SERIF} text-lg text-gray-900`}>{title}</h2>
      {sub && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  const top = steps[0]?.n ?? 0;
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i === 0 ? null : s.ofFirst ? top : steps[i - 1].n;
        const w = top > 0 ? Math.max(2, Math.round((s.n / top) * 100)) : 0;
        return (
          <li key={s.label} className={s.ofFirst ? "pt-2 border-t border-dashed border-gray-200" : undefined}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-gray-800">{s.label}</span>
              <span className={`${MONO} text-xs text-gray-500 whitespace-nowrap`}>
                <span className="text-gray-900 text-sm">{s.n}</span>
                {prev !== null && <span className="ml-2">{pct(s.n, prev)} {s.ofFirst ? "of first" : "of prev"}</span>}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-gray-900" style={{ width: `${w}%` }} />
            </div>
            {s.note && <p className="mt-0.5 text-[11px] text-gray-400">{s.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function CreativeTable({ rows }: { rows: CreativeRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">No traffic in this window.</p>;
  const th = `${MONO} text-[10px] uppercase tracking-wider text-gray-400 font-normal px-2 py-2 text-right whitespace-nowrap`;
  const td = `${MONO} text-xs text-gray-800 px-2 py-2 text-right whitespace-nowrap`;
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className={`${th} text-left`}>creative (utm_content)</th>
            <th className={th}>visitors</th>
            <th className={th}>pressed start</th>
            <th className={th}>emails</th>
            <th className={th}>accounts</th>
            <th className={th}>visit → account</th>
            <th className={th}>activated</th>
            <th className={th}>paid</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-gray-50">
              <td className={`${td} text-left`}>
                {r.key}
                {(r.source || r.campaign) && (
                  <span className="block text-[10px] text-gray-400">{[r.source, r.campaign].filter(Boolean).join(" · ")}</span>
                )}
              </td>
              <td className={td}>{r.visitors}</td>
              <td className={td}>{r.ctaClicks}</td>
              <td className={td}>{r.emails}</td>
              <td className={td}>{r.accounts}</td>
              <td className={td}>{pct(r.accounts, r.visitors)}</td>
              <td className={td}>{r.activated}</td>
              <td className={td}>{r.paid}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: { range?: string | string[]; internal?: string | string[] };
}) {
  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token || !isValidAdminToken(token)) return <LoginForm />;

  const range = first(searchParams.range) ?? "7d";
  const includeInternal = first(searchParams.internal) === "1";
  const w = resolveWindow({ range });
  const data = await fetchFunnelData(w, includeInternal);

  const q = (r: string, i: boolean) => `/admin/funnel?range=${r}${i ? "&internal=1" : ""}`;
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs ${MONO} ${active ? "bg-black text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"}`;

  return (
    <main className="min-h-screen bg-gray-50" style={{ fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <AdminNav current="funnel" />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={`${SERIF} text-3xl text-gray-900`}>Funnel</h1>
            <p className="font-[family-name:var(--font-eb-garamond)] text-base text-gray-500 mt-1">
              Ad → xyra.dev → account → AI connected → paid. Site steps count the window; app steps follow accounts made in it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["7d", "30d", "all"] as const).map((r) => (
              <Link key={r} href={q(r, includeInternal)} className={pill(w.preset === r)}>
                {r === "all" ? "all time" : `last ${r}`}
              </Link>
            ))}
            <span className="mx-1 h-4 w-px bg-gray-200" />
            <Link href={q(w.preset, !includeInternal)} className={pill(includeInternal)}>
              {includeInternal ? "team accounts: shown" : "team accounts: hidden"}
            </Link>
          </div>
        </div>

        {!data ? (
          <Card title="Site database not connected">
            <p className="text-sm text-gray-600">Set SUPABASE_SERVICE_ROLE_KEY for this project.</p>
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ["visitors", data.site.visitors.total],
                ["accounts", data.totals.accounts],
                ["activated", data.totals.activated],
                ["paying", data.totals.paying],
              ].map(([k, v]) => (
                <div key={k} className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
                  <div className={`${MONO} text-[10px] uppercase tracking-wider text-gray-400`}>{k}</div>
                  <div className={`${SERIF} text-2xl text-gray-900 mt-0.5`}>{v}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <Card
                title="Phone path"
                sub={`"send it to my laptop". Phone visitors: ${data.site.visitors.phone}${data.site.visitors.untagged ? ` (+${data.site.visitors.untagged} untagged)` : ""}.`}
              >
                <Steps steps={data.site.phone} />
              </Card>
              <Card title="Laptop path" sub={`Straight to app sign-up. Laptop visitors: ${data.site.visitors.desktop}.`}>
                <Steps steps={data.site.laptop} />
              </Card>
              <Card
                title="In the app"
                sub={`Accounts made in the window, any source: link ${data.bySource.handoff} · site ${data.bySource.site} · invite ${data.bySource.invite} · direct ${data.bySource.direct}.`}
              >
                {data.appConnected ? <Steps steps={data.app} /> : <p className="text-sm text-gray-600">Set APP_SUPABASE_SERVICE_ROLE_KEY to read the app.</p>}
              </Card>
            </div>

            <Card
              title="By creative"
              sub={`Visitors and presses are counted under the first ad tag seen for that visitor in the window. Activated = an AI connected. Site accounts without ad tags: ${data.unattributed.withoutAdTags} of ${data.unattributed.siteAccounts} (${pct(data.unattributed.withoutAdTags, data.unattributed.siteAccounts)}; target under 20% for paid traffic).`}
            >
              <CreativeTable rows={data.creatives} />
            </Card>

            <Card title="Latest accounts" sub="For a hand count against the numbers above. Newest first, up to 25.">
              {data.recent.length === 0 ? (
                <p className="text-sm text-gray-500">No accounts in this window.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full border-collapse">
                    <tbody>
                      {data.recent.map((a) => (
                        <tr key={a.email + a.createdAt} className="border-b border-gray-50">
                          <td className={`${MONO} text-xs text-gray-500 px-2 py-1.5 whitespace-nowrap`}>{ct(a.createdAt)}</td>
                          <td className="text-sm text-gray-800 px-2 py-1.5">
                            {a.email}
                            {a.internal && <span className={`${MONO} ml-2 text-[10px] text-gray-400`}>team</span>}
                          </td>
                          <td className={`${MONO} text-xs text-gray-500 px-2 py-1.5`}>{a.source}</td>
                          <td className={`${MONO} text-xs text-gray-500 px-2 py-1.5`}>{a.creative ?? "—"}</td>
                          <td className={`${MONO} text-xs text-gray-900 px-2 py-1.5 text-right whitespace-nowrap`}>{a.reached}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <p className={`${MONO} text-[11px] text-gray-400 leading-relaxed`}>
              {data.site.ctaUntyped > 0 && `${data.site.ctaUntyped} visitors pressed start before presses were split into phone and laptop (counted in "pressed start" by creative). `}
              Phone/laptop tags on site events start {data.deviceTaggedSince ? ct(data.deviceTaggedSince) : "with the next deploy"}; earlier
              visitors count as untagged. Paywall and checkout events start once migration 20261115000000 is pushed and the app is
              deployed. Spend, cost per account and cost per activated come next (weekly paste-in from X Ads).
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
