import Link from "next/link";
import { RANGES, type RevenueData, type RevenueSub, type TxnStatus } from "./data";

// Server component: no client JS. Range switching is a ?range= link.

const LABEL = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";
const TH = "pb-2 pr-4 text-left font-[family-name:var(--font-jetbrains)] text-[10px] font-medium text-gray-400 uppercase tracking-[0.1em] whitespace-nowrap";
const TD = "py-2 pr-4 whitespace-nowrap";
const CARD = "bg-white rounded-2xl border border-gray-200 p-5";
const H2 = "font-[family-name:var(--font-playfair)] text-xl text-gray-900";
const BLUE = "#2a78d6";
const BASELINE = "#d1d5db";

function money(cents: number, currency: string, exact = false): string {
  const v = cents / 100;
  const whole = Number.isInteger(v);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole && !exact ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
}

const date = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
const dateTime = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
const shortDay = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const shortMonth = (key: string) =>
  new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={CARD}>
      <p className={LABEL}>{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── charts (pure SVG, scale with their container) ──────────────────────────

function niceTop(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * pow * 0.9) return m * pow;
  return 10 * pow * 2;
}

function MrrChart({ series, currency }: { series: RevenueData["mrrSeries"]; currency: string }) {
  if (series.length < 2) return <p className="text-sm text-gray-400 italic">Not enough history yet.</p>;
  const W = 720, H = 200, L = 52, B = 22, T = 8;
  const top = niceTop(Math.max(...series.map((p) => p.mrr)));
  const x = (i: number) => L + (i / (series.length - 1)) * (W - L - 4);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  // Step line: MRR changes in jumps, not slopes.
  let d = `M ${x(0)} ${y(series[0].mrr)}`;
  for (let i = 1; i < series.length; i++) d += ` H ${x(i)} V ${y(series[i].mrr)}`;
  const area = `${d} V ${y(0)} H ${x(0)} Z`;
  const ticks = [0, top / 2, top];
  const stride = Math.max(1, Math.ceil(series.length / 7));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="MRR over time">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="#f0f0f0" />
          <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{money(v, currency)}</text>
        </g>
      ))}
      <path d={area} fill={BLUE} opacity={0.08} />
      <path d={d} fill="none" stroke={BLUE} strokeWidth={2} />
      {series.map((p, i) =>
        i % stride === 0 || i === series.length - 1 ? (
          <text key={p.date} x={x(i)} y={H - 6} textAnchor={i === series.length - 1 ? "end" : "middle"} fontSize="10" fill="#9ca3af">
            {shortDay(p.date)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function MonthlyBars({ months, currency }: { months: RevenueData["monthly"]; currency: string }) {
  const W = 720, H = 200, L = 52, B = 22, T = 16;
  const top = niceTop(Math.max(...months.map((m) => m.gross)));
  const slot = (W - L) / months.length;
  const bw = Math.min(36, slot * 0.6);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Revenue by month">
      {[0, top / 2, top].map((v) => (
        <g key={v}>
          <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="#f0f0f0" />
          <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="#9ca3af">{money(v, currency)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = L + slot * i + slot / 2;
        const kept = Math.max(0, m.net);
        return (
          <g key={m.month}>
            <title>{`${m.month}: gross ${money(m.gross, currency, true)}, refunds ${money(m.refunds, currency, true)}, net ${money(m.net, currency, true)}`}</title>
            {/* gray = gross (fees + refunds show as the gray cap), blue = net kept */}
            <rect x={cx - bw / 2} y={y(m.gross)} width={bw} height={y(0) - y(m.gross)} fill={BASELINE} rx={2} />
            <rect x={cx - bw / 2} y={y(kept)} width={bw} height={y(0) - y(kept)} fill={BLUE} rx={2} />
            {m.gross > 0 && (
              <text x={cx} y={y(m.gross) - 4} textAnchor="middle" fontSize="10" fill="#374151">{money(m.net, currency)}</text>
            )}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">{shortMonth(m.month)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── tables ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<TxnStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  refunded: "bg-gray-100 text-gray-600",
  partial: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  disputed: "bg-red-50 text-red-700",
  pending: "bg-blue-50 text-blue-700",
};

function subState(s: RevenueSub): { label: string; cls: string } {
  if (s.status === "active" && s.cancelAtPeriodEnd) return { label: "canceling", cls: "bg-amber-50 text-amber-700" };
  if (s.status === "active" && s.monthly === 0) return { label: "free (coupon)", cls: "bg-violet-50 text-violet-700" };
  if (s.status === "active") return { label: "paying", cls: "bg-emerald-50 text-emerald-700" };
  if (s.status === "trialing") return { label: "trial", cls: "bg-blue-50 text-blue-700" };
  if (s.status === "past_due" || s.status === "unpaid") return { label: s.status.replace("_", " "), cls: "bg-red-50 text-red-700" };
  return { label: s.status, cls: "bg-gray-100 text-gray-500" };
}

const Pill = ({ label, cls }: { label: string; cls: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>{label}</span>
);

export default function RevenueDashboard({ data }: { data: RevenueData }) {
  const c = data.currency;
  const w = data.window;
  const rangeLabel = RANGES.find((r) => r.key === data.range)?.label ?? "";
  const liveSubs = data.subs.filter((s) => s.status !== "canceled");
  const endedSubs = data.subs.filter((s) => s.status === "canceled");

  return (
    <div className="space-y-6">
      {/* Range */}
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/revenue?range=${r.key}`}
            className={`px-3 py-1 rounded-full text-xs font-medium font-[family-name:var(--font-jetbrains)] ${
              r.key === data.range ? "bg-black text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
            }`}
          >
            {r.label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-gray-400">Live from Stripe · {dateTime(data.generatedAt)} CT</span>
      </div>

      {data.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {data.warnings.map((m) => <p key={m}>{m}</p>)}
        </div>
      )}

      {/* Headline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="MRR" value={money(data.mrr, c)} sub={`${money(data.arr, c)} ARR · ${money(data.arpu, c, true)} per payer`} />
        <Tile
          label="Paying subscribers"
          value={String(data.counts.paying)}
          sub={[
            data.counts.free ? `${data.counts.free} free via coupon` : null,
            data.counts.trialing ? `${data.counts.trialing} trialing` : null,
            data.counts.canceling ? `${data.counts.canceling} canceling` : null,
            data.counts.pastDue ? `${data.counts.pastDue} past due` : null,
          ].filter(Boolean).join(" · ") || "no trials or cancellations pending"}
        />
        <Tile
          label={`Revenue · ${rangeLabel}`}
          value={money(w.net, c)}
          sub={`net of ${money(w.fees, c, true)} fees${w.refunds ? ` and ${money(w.refunds, c, true)} refunds` : ""} · ${money(w.gross, c)} gross`}
        />
        <Tile
          label={`Transactions · ${rangeLabel}`}
          value={String(w.paidCount)}
          sub={`${w.failedCount} failed · all-time ${money(data.allTime.net, c)} net from ${data.allTime.paidCount}`}
        />
      </div>

      {/* Movement */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label={`New MRR · ${rangeLabel}`} value={`+${money(w.newMrr, c)}`} sub={`${w.newSubs} new paying subscription${w.newSubs === 1 ? "" : "s"}`} />
        <Tile label={`Churned MRR · ${rangeLabel}`} value={`−${money(w.churnedMrr, c)}`} sub={`${w.churned} ended`} />
        <Tile label={`Net new MRR · ${rangeLabel}`} value={money(w.newMrr - w.churnedMrr, c)} />
        <Tile label="All-time gross" value={money(data.allTime.gross, c)} sub={`${money(data.allTime.fees, c, true)} Stripe fees · ${money(data.allTime.refunds, c, true)} refunded`} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={CARD}>
          <h2 className={H2}>MRR</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">Rebuilt from subscription start, trial end and end dates at today&apos;s prices and coupons.</p>
          <MrrChart series={data.mrrSeries} currency={c} />
        </div>
        <div className={CARD}>
          <h2 className={H2}>Revenue by month</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">Last 12 months. Blue is net kept; the gray cap is fees and refunds.</p>
          <MonthlyBars months={data.monthly} currency={c} />
        </div>
      </div>

      {/* Transactions */}
      <div className={CARD}>
        <h2 className={H2}>Transactions</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          Every charge in the last {rangeLabel.toLowerCase()}, newest first. $0 coupon invoices make no charge, so they don&apos;t appear here.
        </p>
        {data.txns.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No charges in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={TH}>When</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={`${TH} text-right`}>Fee</th>
                  <th className={`${TH} text-right`}>Net</th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.txns.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className={`${TD} text-gray-500`}>
                      <a href={t.url} target="_blank" rel="noreferrer" className="hover:underline">{dateTime(t.created)}</a>
                    </td>
                    <td className={`${TD} text-gray-900`}>{t.email ?? "—"}</td>
                    <td className={TD}><Pill label={t.status} cls={STATUS_STYLE[t.status]} /></td>
                    <td className={`${TD} text-right tabular-nums`}>{money(t.amount, t.currency, true)}</td>
                    <td className={`${TD} text-right tabular-nums text-gray-500`}>{t.fee ? money(t.fee, t.currency, true) : "—"}</td>
                    <td className={`${TD} text-right tabular-nums font-medium`}>{money(t.net, t.currency, true)}</td>
                    <td className={`${TD} text-gray-500 max-w-[280px] truncate`}>
                      {t.status === "failed" ? t.failure : t.refunded ? `${money(t.refunded, t.currency, true)} refunded` : t.description ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscriptions */}
      <div className={CARD}>
        <h2 className={H2}>Subscriptions</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">
          {liveSubs.length} open · {endedSubs.length} ended. MRR column is what each one adds after coupons.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className={TH}>Customer</th>
                <th className={TH}>State</th>
                <th className={`${TH} text-right`}>MRR</th>
                <th className={TH}>Coupon</th>
                <th className={TH}>Started</th>
                <th className={TH}>Renews / ended</th>
              </tr>
            </thead>
            <tbody>
              {[...liveSubs, ...endedSubs].map((s) => {
                const st = subState(s);
                return (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 ${s.status === "canceled" ? "opacity-60" : ""}`}>
                    <td className={`${TD} text-gray-900`}>
                      <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.email ?? s.id}</a>
                    </td>
                    <td className={TD}><Pill label={st.label} cls={st.cls} /></td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {money(s.monthly, c, true)}
                      {s.monthly !== s.listMonthly && <span className="ml-1 text-xs text-gray-400 line-through">{money(s.listMonthly, c)}</span>}
                    </td>
                    <td className={`${TD} text-gray-500`}>{s.coupon ?? "—"}</td>
                    <td className={`${TD} text-gray-500`}>{date(s.started)}</td>
                    <td className={`${TD} text-gray-500`}>
                      {s.endedAt ? `ended ${date(s.endedAt)}` : s.status === "trialing" && s.trialEnd ? `trial ends ${date(s.trialEnd)}` : s.renewsAt ? `${s.cancelAtPeriodEnd ? "ends" : "renews"} ${date(s.renewsAt)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
