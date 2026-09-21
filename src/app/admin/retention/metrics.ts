// Pure retention math — no server imports, so the client dashboard can re-run
// every aggregate when a filter changes (team accounts on/off, signup window).
//
// Clock: everything is measured from each user's OWN signup instant, in rolling
// 24h windows — "day 1" is hours 0–24 of that user's life, not a calendar day.
// That makes "the first 72 hours" exact and timezone-free.

export type RetentionUser = {
  id: string;
  email: string;
  name: string | null;
  internal: boolean; // team / test account — excluded from rates by default
  signedUpAt: string;
  ageHours: number; // hours since signup at snapshot time
  hours72: number[]; // distinct hour-of-life offsets (0–71) with activity
  activeDays: number[]; // distinct day-of-life offsets with activity (0 = first 24h)
  lastActiveAt: string | null;
  firstDumpMin: number | null; // minutes from signup to the first brain dump / message
  // Hour-of-life each milestone was first reached (null = never).
  ms: {
    dump: number | null; // first brain dump or message to Xyra
    secondSession: number | null; // came back after a 30-min+ gap
    secondBoard: number | null; // built a 2nd dashboard
    reminder: number | null; // set a reminder or recurring check-in
    reminder2: number | null; // set a SECOND one — onboarding walks everyone through the first
    nudgeReply: number | null; // answered a Xyra-initiated nudge within 3h
    facts3: number | null; // Xyra had learned 3 facts about them
  };
  counts: {
    dashboards: number;
    items: number;
    messages: number; // user chat messages + brain dumps
    reminders: number; // reminders + recurring triggers
    nudgesSent: number;
    nudgesAnswered: number;
    facts: number; // active user_facts
    memoryMessages: number; // chat rows folded into the long-memory summary
  };
  factDays: number[]; // day-of-life offset of every fact learned (sorted)
  pushEnabled: boolean;
};

export type RetentionData = { users: RetentionUser[]; generatedAt: string };

export const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);

export function median(vals: number[]): number | null {
  if (vals.length === 0) return null;
  const s = [...vals].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const within72 = (h: number | null) => h !== null && h < 72;
const activeInHours = (u: RetentionUser, from: number, to: number) => u.hours72.some((h) => h >= from && h < to);
const activeInDays = (u: RetentionUser, from: number, to: number) => u.activeDays.some((d) => d >= from && d < to);
/** How many of the first three 24h windows the user showed up in. */
export const days72 = (u: RetentionUser) =>
  Number(activeInHours(u, 0, 24)) + Number(activeInHours(u, 24, 48)) + Number(activeInHours(u, 48, 72));

// ── First 72 hours ───────────────────────────────────────────────────────────

/**
 * Where a user landed in their first 72h:
 *   inflight – still inside the window (quiet = past hour 24 and not back yet)
 *   kept     – showed up on 2+ of the 3 days
 *   oneday   – used it on one day and never returned inside the window
 *   never    – did nothing at all in 72h
 */
export type Outcome72 = "inflight" | "inflight-quiet" | "kept" | "oneday" | "never";

export function outcome72(u: RetentionUser): Outcome72 {
  if (u.ageHours < 72) {
    if (days72(u) >= 2) return "kept";
    return u.ageHours >= 24 && !activeInHours(u, 24, 72) ? "inflight-quiet" : "inflight";
  }
  const d = days72(u);
  return d >= 2 ? "kept" : d === 1 ? "oneday" : "never";
}

export type Checkpoint = { key: string; label: string; hint: string; n: number };

export function first72(users: RetentionUser[]) {
  const matured = users.filter((u) => u.ageHours >= 72);
  const count = (f: (u: RetentionUser) => boolean) => matured.filter(f).length;

  // Independent checkpoints, all over the SAME denominator (signups whose 72h
  // window has closed) — not a strict funnel, so no step implies the one above.
  const checkpoints: Checkpoint[] = [
    { key: "started", label: "Did anything", hint: "created a board, item, message or dump in 72h", n: count((u) => u.hours72.length > 0) },
    { key: "dump", label: "Brain-dumped", hint: "sent Xyra a dump or message in 72h", n: count((u) => within72(u.ms.dump)) },
    { key: "second", label: "Second session", hint: "came back after a 30-min+ break, inside 72h", n: count((u) => within72(u.ms.secondSession)) },
    { key: "day2", label: "Back on day 2", hint: "active between hour 24 and 48", n: count((u) => activeInHours(u, 24, 48)) },
    { key: "day3", label: "Back on day 3", hint: "active between hour 48 and 72", n: count((u) => activeInHours(u, 48, 72)) },
    { key: "all3", label: "All three days", hint: "active in each of the three 24h windows", n: count((u) => days72(u) === 3) },
  ];

  // Share of matured signups active in each 6-hour slice of their first 72h.
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    from: i * 6,
    n: count((u) => activeInHours(u, i * 6, i * 6 + 6)),
  }));

  return {
    maturedN: matured.length,
    inflightN: users.length - matured.length,
    inflightQuietN: users.filter((u) => outcome72(u) === "inflight-quiet").length,
    keptN: count((u) => days72(u) >= 2),
    medianFirstDumpMin: median(matured.filter((u) => within72(u.ms.dump) && u.firstDumpMin !== null).map((u) => u.firstDumpMin!)),
    checkpoints,
    buckets,
  };
}

// ── What predicts staying ────────────────────────────────────────────────────

/** Retained = active at some point in week 2 (days 7–13 of their life). */
export const retainedWeek2 = (u: RetentionUser) => activeInDays(u, 7, 14);

export type Layer = 1 | 2 | 3;
export type PredictorRow = {
  key: string;
  label: string;
  layer: Layer;
  didN: number;
  didRetained: number;
  notN: number;
  notRetained: number;
};

const BEHAVIORS: { key: string; label: string; layer: Layer; test: (u: RetentionUser) => boolean }[] = [
  { key: "dump", label: "Brain-dumped to Xyra", layer: 1, test: (u) => within72(u.ms.dump) },
  { key: "second", label: "Came back for a 2nd session", layer: 1, test: (u) => within72(u.ms.secondSession) },
  { key: "twodays", label: "Used it on 2+ of the 3 days", layer: 1, test: (u) => days72(u) >= 2 },
  { key: "board2", label: "Built a 2nd dashboard", layer: 1, test: (u) => within72(u.ms.secondBoard) },
  { key: "reminder", label: "Set a reminder or check-in", layer: 2, test: (u) => within72(u.ms.reminder) },
  { key: "reminder2", label: "Set a 2nd reminder (past onboarding's)", layer: 2, test: (u) => within72(u.ms.reminder2) },
  { key: "nudge", label: "Answered a nudge from Xyra", layer: 2, test: (u) => within72(u.ms.nudgeReply) },
  { key: "facts", label: "Xyra learned 3+ facts about them", layer: 3, test: (u) => within72(u.ms.facts3) },
];

/** First-72h behaviors vs week-2 retention, over users old enough to judge (14d+). */
export function predictors(users: RetentionUser[]) {
  const eligible = users.filter((u) => u.ageHours >= 14 * 24);
  const rows: PredictorRow[] = BEHAVIORS.map((b) => {
    const did = eligible.filter(b.test);
    const not = eligible.filter((u) => !b.test(u));
    return {
      key: b.key,
      label: b.label,
      layer: b.layer,
      didN: did.length,
      didRetained: did.filter(retainedWeek2).length,
      notN: not.length,
      notRetained: not.filter(retainedWeek2).length,
    };
  });
  return { eligibleN: eligible.length, baselineRetained: eligible.filter(retainedWeek2).length, rows };
}

// ── Cohorts ──────────────────────────────────────────────────────────────────

export const COHORT_WINDOWS = [
  { key: "d2", label: "Day 2", from: 1, to: 2 },
  { key: "d3", label: "Day 3", from: 2, to: 3 },
  { key: "d4_7", label: "Days 4–7", from: 3, to: 7 },
  { key: "w2", label: "Week 2", from: 7, to: 14 },
  { key: "w3", label: "Week 3", from: 14, to: 21 },
  { key: "w4", label: "Week 4", from: 21, to: 28 },
  { key: "w5_8", label: "Weeks 5–8", from: 28, to: 56 },
] as const;

export type CohortCell = { eligible: number; active: number };
export type CohortRow = { key: string; label: string; size: number; cells: CohortCell[] };

function cohortKey(iso: string, grain: "week" | "month"): { key: string; label: string } {
  const d = new Date(iso);
  if (grain === "month") {
    return { key: iso.slice(0, 7), label: d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) };
  }
  // Monday of the signup week (UTC).
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return { key: monday.toISOString().slice(0, 10), label: monday.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) };
}

/**
 * Bracketed retention: a cell is the share of the cohort active INSIDE that
 * window. Only users whose window has fully closed are counted (eligible), so
 * a user three days in is never scored as "churned in week 2".
 */
export function cohorts(users: RetentionUser[], grain: "week" | "month"): CohortRow[] {
  const groups = new Map<string, { label: string; members: RetentionUser[] }>();
  for (const u of users) {
    const { key, label } = cohortKey(u.signedUpAt, grain);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { label, members: [] }));
    g.members.push(u);
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, g]) => ({
      key,
      label: g.label,
      size: g.members.length,
      cells: COHORT_WINDOWS.map((w) => {
        const eligible = g.members.filter((u) => u.ageHours >= w.to * 24);
        return { eligible: eligible.length, active: eligible.filter((u) => activeInDays(u, w.from, w.to)).length };
      }),
    }));
}

// ── Value ladder ─────────────────────────────────────────────────────────────

export type TenureWeek = {
  week: number; // 1-based week of life
  reachedN: number; // users who have lived through this whole week
  activeN: number; // …of whom this many used Xyra during it
  avgActiveDays: number | null; // days used that week, among those who used it
  avgFacts: number | null; // facts Xyra knew by the end of that week, same group
};

export function ladder(users: RetentionUser[]) {
  const matured = users.filter((u) => u.ageHours >= 72);
  const m = matured.length;
  const count = (f: (u: RetentionUser) => boolean) => matured.filter(f).length;
  const sum = (f: (u: RetentionUser) => number) => users.reduce((a, u) => a + f(u), 0);
  const accountsN = users.length;
  const withFacts = users.filter((u) => u.counts.facts > 0);

  // The compounding test: among users still around in week N of their life, is
  // usage getting DEEPER (days used per week) as Xyra knows more about them?
  const tenure: TenureWeek[] = [];
  for (let w = 0; w < 8; w++) {
    const reached = users.filter((u) => u.ageHours >= (w + 1) * 7 * 24);
    const active = reached.filter((u) => activeInDays(u, w * 7, w * 7 + 7));
    const avg = (f: (u: RetentionUser) => number) => (active.length ? active.reduce((a, u) => a + f(u), 0) / active.length : null);
    tenure.push({
      week: w + 1,
      reachedN: reached.length,
      activeN: active.length,
      avgActiveDays: avg((u) => u.activeDays.filter((d) => d >= w * 7 && d < w * 7 + 7).length),
      avgFacts: avg((u) => u.factDays.filter((d) => d < w * 7 + 7).length),
    });
  }

  return {
    maturedN: m,
    l1: {
      dumped72: count((u) => within72(u.ms.dump)),
      second72: count((u) => within72(u.ms.secondSession)),
      medianFirstDumpMin: median(matured.filter((u) => within72(u.ms.dump) && u.firstDumpMin !== null).map((u) => u.firstDumpMin!)),
    },
    l2: {
      reminder72: count((u) => within72(u.ms.reminder)),
      reminderAgain72: count((u) => within72(u.ms.reminder2)),
      pushOn: users.filter((u) => u.pushEnabled).length,
      accountsN,
      nudgesSent: sum((u) => u.counts.nudgesSent),
      nudgesAnswered: sum((u) => u.counts.nudgesAnswered),
    },
    l3: {
      usersWithFacts: withFacts.length,
      accountsN,
      medianFacts: median(withFacts.map((u) => u.counts.facts)),
      deepMemoryN: users.filter((u) => u.counts.facts >= 10).length,
      tenure,
    },
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function fmtDuration(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "<1 min";
  if (min < 90) return `${Math.round(min)} min`;
  if (min < 48 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}
