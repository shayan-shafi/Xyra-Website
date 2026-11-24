import type { Overview as OverviewData, UseMode } from "./data";

// The "where are we" block at the top of the Users tab: paying, weekly
// actives, how people use Xyra (in the app vs through another AI), and the
// 8-week trend. Pure presentation; every number comes from data.ts and
// excludes team/test accounts.

const LABEL = "font-[family-name:var(--font-jetbrains)] text-[10px] uppercase tracking-[0.12em] text-gray-400";

export const MODE_META: Record<UseMode, { label: string; hint: string; bar: string; text: string }> = {
  app: { label: "App only", hint: "used the Xyra app, no outside AI", bar: "bg-sky-500", text: "text-sky-700" },
  both: { label: "App + AI", hint: "used the app and an outside AI", bar: "bg-violet-400", text: "text-violet-600" },
  ai: { label: "AI only", hint: "only through Claude, ChatGPT … over the brain MCP", bar: "bg-violet-700", text: "text-violet-800" },
  none: { label: "Not used", hint: "nothing in the last 30 days", bar: "bg-gray-200", text: "text-gray-400" },
};
const MODE_ORDER: UseMode[] = ["app", "both", "ai", "none"];

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function Tile({ label, value, sub, foot }: { label: string; value: string | number; sub?: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className={LABEL}>{label}</div>
      <div className="mt-1.5 font-[family-name:var(--font-playfair)] text-4xl text-gray-900 tabular-nums leading-none">{value}</div>
      {sub && <div className="mt-2 text-xs text-gray-600">{sub}</div>}
      {foot && <div className="mt-1 text-[11px] text-gray-400">{foot}</div>}
    </div>
  );
}

function ModeBar({ title, modes }: { title: string; modes: Record<UseMode, number> }) {
  const total = MODE_ORDER.reduce((s, m) => s + modes[m], 0);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-gray-700">{title}</span>
        <span className="text-[11px] text-gray-400 tabular-nums">{total}</span>
      </div>
      <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-gray-100 gap-px">
        {MODE_ORDER.map((m) =>
          modes[m] > 0 ? (
            <div key={m} className={MODE_META[m].bar} style={{ width: `${(modes[m] / total) * 100}%` }} title={`${MODE_META[m].label}: ${modes[m]}`} />
          ) : null,
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
        {MODE_ORDER.map((m) => (
          <span key={m} className={MODE_META[m].text}>
            {MODE_META[m].label} {modes[m]}
            {total > 0 && <span className="text-gray-400"> · {pct(modes[m], total)}%</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeeklyChart({ weekly }: { weekly: OverviewData["weekly"] }) {
  const max = Math.max(1, ...weekly.map((w) => w.app + w.both + w.ai));
  return (
    <div>
      <div className="flex items-end gap-2 h-32">
        {weekly.map((w) => {
          const total = w.app + w.both + w.ai;
          return (
            <div key={w.label} className="flex-1 flex flex-col items-center justify-end h-full" title={`${w.label}: ${total} active · app ${w.app} · app+AI ${w.both} · AI ${w.ai}`}>
              <span className="text-[10px] text-gray-500 tabular-nums mb-0.5">{total}</span>
              <div className="w-full max-w-[28px] flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${(total / max) * 100}%` }}>
                {w.app > 0 && <div className={MODE_META.app.bar} style={{ flexGrow: w.app }} />}
                {w.both > 0 && <div className={MODE_META.both.bar} style={{ flexGrow: w.both }} />}
                {w.ai > 0 && <div className={MODE_META.ai.bar} style={{ flexGrow: w.ai }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5 border-t border-gray-100 pt-1">
        {weekly.map((w) => (
          <span key={w.label} className="flex-1 text-center text-[10px] text-gray-400 whitespace-nowrap">{w.label}</span>
        ))}
      </div>
      <div className="flex gap-2 mt-0.5" title="New accounts created that week">
        {weekly.map((w) => (
          <span key={w.label} className={`flex-1 text-center text-[10px] tabular-nums ${w.signups ? "text-gray-600" : "text-gray-300"}`}>+{w.signups}</span>
        ))}
      </div>
    </div>
  );
}

// Things worth doing something about today; each opens the matching roster segment.
function Attention({ o, onSegment }: { o: OverviewData; onSegment?: (key: string) => void }) {
  const items = [
    { key: "paying-quiet", n: o.payingQuiet, what: "paying, quiet 8+ days", why: "check in before they cancel", tone: "text-red-600" },
    { key: "checkout-unfinished", n: o.checkoutUnfinished, what: "started checkout, never paid", why: "they wanted to pay; ask what stopped them", tone: "text-amber-600" },
    { key: "trial", n: o.trial, what: "on a trial", why: "help them build the habit before it ends", tone: "text-blue-600" },
    { key: "new-stuck", n: o.newStuck, what: "new in 14 days, nothing saved yet", why: "nudge their first memory or AI connection", tone: "text-gray-700" },
  ].filter((i) => i.n > 0);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">Needs attention</h2>
      <p className="text-[11px] text-gray-400 mb-3">Click one to open those people in the roster below</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing urgent.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((i) => (
            <li key={i.key}>
              <button type="button" onClick={() => onSegment?.(i.key)} className="w-full flex items-baseline gap-3 py-2 px-1 text-left rounded-lg hover:bg-gray-50">
                <span className={`w-8 text-right font-[family-name:var(--font-playfair)] text-2xl tabular-nums ${i.tone}`}>{i.n}</span>
                <span className="flex-1">
                  <span className="block text-sm text-gray-900">{i.what}</span>
                  <span className="block text-[11px] text-gray-400">{i.why}</span>
                </span>
                <span aria-hidden="true" className="text-gray-300">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Where accounts drop off. Every bar is a share of real accounts.
function Funnel({ o }: { o: OverviewData }) {
  const steps = [
    { label: "Accounts", n: o.accounts, hint: "signed up" },
    { label: "Activated", n: o.activated, hint: "saved anything to their brain" },
    { label: "Active, 30 days", n: o.active30, hint: "used it this month" },
    { label: "Active, 7 days", n: o.active7, hint: "used it this week" },
    { label: "Paying", n: o.paying, hint: "Stripe subscription active" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">Funnel</h2>
      <p className="text-[11px] text-gray-400 mb-3">Share of all real accounts · {o.newThisWeek} new this week</p>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.label} title={s.hint}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-gray-700">{s.label}</span>
              <span className="tabular-nums text-gray-900 font-medium">
                {s.n}
                {i > 0 && <span className="text-gray-400 font-normal"> · {pct(s.n, o.accounts)}%</span>}
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${s.label === "Paying" ? "bg-green-500" : "bg-gray-800"}`} style={{ width: `${pct(s.n, o.accounts)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Overview({ o, onSegment }: { o: OverviewData; onSegment?: (key: string) => void }) {
  const delta = o.active7 - o.active7Prev;
  const usedViaAi = o.modes.ai + o.modes.both;
  const active30 = o.modes.app + o.modes.both + o.modes.ai;
  const payingViaAi = o.payingModes.ai + o.payingModes.both;
  const wk = o.weekly[o.weekly.length - 1];
  const wkTotal = wk ? wk.app + wk.both + wk.ai : 0;
  const wkViaAi = wk ? wk.both + wk.ai : 0;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          label="Paying"
          value={o.paying}
          sub={<><span className="text-green-700 font-medium">{o.payingActive7} used it this week</span>{o.payingQuiet > 0 && <> · <span className="text-red-600 font-medium">{o.payingQuiet} quiet 8d+</span></>}</>}
          foot={`${o.trial} trial · ${o.comped} comped · ${o.lapsed} canceled`}
        />
        <Tile
          label="Active this week"
          value={o.active7}
          sub={
            <span className={delta > 0 ? "text-green-700" : delta < 0 ? "text-red-600" : "text-gray-500"}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"} {Math.abs(delta)} vs the week before ({o.active7Prev})
            </span>
          }
          foot={`${o.active30} active in 30 days · ${o.accounts} accounts`}
        />
        <Tile
          label="Use Xyra through another AI"
          value={`${pct(wkViaAi, wkTotal)}%`}
          sub={`${wkViaAi} of ${wkTotal} weekly actives · ${usedViaAi} of ${active30} this month (${pct(usedViaAi, active30)}%)`}
          foot={`${payingViaAi} of ${o.paying} paying · ${o.modes.ai} use only an outside AI`}
        />
        <Tile
          label="Activated"
          value={`${pct(o.activated, o.accounts)}%`}
          sub={`${o.activated} of ${o.accounts} accounts put something in their brain`}
          foot="any board, item, chat, dump, memory or note"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Attention o={o} onSegment={onSegment} />
        <Funnel o={o} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">How people use Xyra</h2>
            <p className="text-[11px] text-gray-400">Last 30 days, by account</p>
          </div>
          <ModeBar title="All accounts" modes={o.modes} />
          <ModeBar title="Paying" modes={o.payingModes} />
          <div>
            <div className={`${LABEL} mb-1.5`}>Outside AIs used, last 30 days</div>
            {o.agents.length === 0 ? (
              <p className="text-xs text-gray-400">None yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {o.agents.map((a) => (
                  <span key={a.name} className="px-2.5 py-1 rounded-full text-xs bg-violet-50 text-violet-700 capitalize">
                    {a.name} <span className="tabular-nums opacity-70">{a.users}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="font-[family-name:var(--font-playfair)] text-lg text-gray-900">Weekly actives</h2>
              <p className="text-[11px] text-gray-400">Last 8 rolling weeks, split by how they used it · +N = new accounts</p>
            </div>
            <div className="flex gap-2.5 text-[10px]">
              {(["app", "both", "ai"] as UseMode[]).map((m) => (
                <span key={m} className="inline-flex items-center gap-1 text-gray-500">
                  <span className={`h-2 w-2 rounded-sm ${MODE_META[m].bar}`} />
                  {MODE_META[m].label}
                </span>
              ))}
            </div>
          </div>
          <WeeklyChart weekly={o.weekly} />
          <p className="mt-2 text-[10px] text-gray-400 leading-snug">
            AI reads only stamp the latest call per connection, so older weeks show AI writes but undercount AI reads.
          </p>
        </div>
      </div>
    </section>
  );
}
