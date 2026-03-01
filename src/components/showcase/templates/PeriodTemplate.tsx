"use client";

interface PeriodTemplateProps {
  /** 0 = setup screen, 1 = date selected, 2 = dashboard loaded */
  setupPhase?: number;
  /** Which date index (0-27) to highlight as selected */
  selectedDateIndex?: number;
}

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export default function PeriodTemplate({
  setupPhase = 0,
  selectedDateIndex = -1,
}: PeriodTemplateProps) {
  const cycleDay = 14;
  const cycleLength = 28;
  const periodLength = 5;
  const daysUntilPeriod = cycleLength - cycleDay;
  const nextPeriodDate = addDays(new Date(), daysUntilPeriod);

  // Setup dates
  const today = new Date();
  const setupDates = Array.from({ length: 28 }, (_, i) => {
    const date = addDays(today, -27 + i);
    return { label: `${date.getDate()}`, isToday: i === 27, date };
  });

  /* ══════════════════ SETUP SCREEN ══════════════════ */
  if (setupPhase < 2) {
    return (
      <div className="w-full h-full bg-white flex flex-col items-center justify-center p-4 md:p-6 pointer-events-none">
        <div className="w-full max-w-sm mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="font-serif text-2xl text-black mb-1">
              Cycle Tracker
            </h1>
            <p className="font-mono text-[10px] text-black/30">
              Let&apos;s personalize your experience
            </p>
          </div>

          {/* Cycle Length */}
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
              Average Cycle Length
            </div>
            <div className="flex items-center justify-center gap-3">
              <button className="w-8 h-8 border border-black/20 flex items-center justify-center font-mono text-lg text-black/30">
                −
              </button>
              <div className="w-16 text-center">
                <span className="font-mono text-3xl font-extralight text-black">
                  28
                </span>
                <p className="font-mono text-[9px] text-black/30 mt-0.5">days</p>
              </div>
              <button className="w-8 h-8 border border-black/20 flex items-center justify-center font-mono text-lg text-black/30">
                +
              </button>
            </div>
          </div>

          {/* Period Length */}
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
              Average Period Length
            </div>
            <div className="flex items-center justify-center gap-3">
              <button className="w-8 h-8 border border-black/20 flex items-center justify-center font-mono text-lg text-black/30">
                −
              </button>
              <div className="w-16 text-center">
                <span className="font-mono text-3xl font-extralight text-black">
                  5
                </span>
                <p className="font-mono text-[9px] text-black/30 mt-0.5">days</p>
              </div>
              <button className="w-8 h-8 border border-black/20 flex items-center justify-center font-mono text-lg text-black/30">
                +
              </button>
            </div>
          </div>

          {/* Last Period Date Picker */}
          <div className="mb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40 mb-3">
              When did your last period start?
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {setupDates.map((d, i) => {
                const isSelected = i === selectedDateIndex;
                return (
                  <div
                    key={i}
                    className={`aspect-square flex items-center justify-center font-mono text-xs font-medium transition-all duration-300 ${
                      isSelected
                        ? "bg-pink-500 text-white"
                        : d.isToday
                        ? "bg-black/5 text-black"
                        : "text-black/40"
                    }`}
                  >
                    {d.label}
                  </div>
                );
              })}
            </div>
            {selectedDateIndex >= 0 && (
              <p className="font-mono text-[10px] text-pink-500 text-center mt-2">
                {setupDates[selectedDateIndex].date.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>

          {/* Start Button */}
          <button
            className={`w-full py-3 font-mono text-sm transition-all duration-300 ${
              selectedDateIndex >= 0
                ? "bg-black text-white"
                : "bg-black/5 text-black/20 cursor-not-allowed"
            }`}
          >
            Start Tracking
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════ MAIN TRACKER ══════════════════ */
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden pointer-events-none">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between">
        <h1 className="font-serif text-lg text-black">Cycle</h1>
        <svg className="w-4 h-4 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 flex border-b border-black/10 mx-5">
        {["Today", "Calendar", "Insights"].map((tab, i) => (
          <button
            key={tab}
            className={`flex-1 py-2 font-mono text-[10px] md:text-xs text-center transition-colors ${
              i === 0
                ? "border-b-2 border-black text-black"
                : "text-black/30"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-5 pt-3 pb-4">
        <div className="max-w-sm mx-auto space-y-4">
          {/* Cycle Wheel */}
          <div className="relative flex items-center justify-center py-3">
            <div className="relative w-36 h-36 md:w-44 md:h-44">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background ring */}
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f5f5f5" strokeWidth="8" />
                {/* Period phase (pink) */}
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="#ec4899" strokeWidth="8"
                  strokeDasharray={`${(periodLength / cycleLength) * 283} 283`}
                />
                {/* Fertile window */}
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="#fbcfe8" strokeWidth="8"
                  strokeDasharray={`${(7 / cycleLength) * 283} 283`}
                  strokeDashoffset={`${-((cycleLength - 14 - 5) / cycleLength) * 283}`}
                />
                {/* Current day indicator */}
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="#000" strokeWidth="10"
                  strokeDasharray={`${(1 / cycleLength) * 283} 283`}
                  strokeDashoffset={`${-((cycleDay - 1) / cycleLength) * 283}`}
                  strokeLinecap="round"
                />
              </svg>

              {/* Center Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-4xl md:text-5xl font-extralight text-black">
                  {cycleDay}
                </span>
                <span className="font-mono text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-black/30 mt-0.5">
                  Day of Cycle
                </span>
              </div>
            </div>
          </div>

          {/* Phase Badge */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-black/10 text-pink-500">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-mono text-[10px] md:text-xs font-medium">
                Ovulation Phase
              </span>
            </div>
          </div>

          {/* Prediction Cards */}
          <div className="grid grid-cols-2 gap-2">
            {/* Next Period */}
            <div className="border border-black/10 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/40">
                  Next Period
                </span>
              </div>
              <p className="font-mono text-lg font-extralight text-black">
                {daysUntilPeriod} days
              </p>
              <p className="font-mono text-[9px] text-black/30 mt-0.5">
                {nextPeriodDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>

            {/* Fertility */}
            <div className="border border-black/10 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg className="w-3.5 h-3.5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/40">
                  Fertility
                </span>
              </div>
              <p className="font-mono text-lg font-extralight text-black">
                High
              </p>
              <p className="font-mono text-[9px] text-black/30 mt-0.5">
                Peak fertility window
              </p>
            </div>
          </div>

          {/* Today */}
          <div className="border border-black/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-medium text-black">Today</span>
              <span className="font-mono text-[9px] text-pink-500 font-medium">Log</span>
            </div>
            <p className="font-mono text-[10px] text-black/30">
              No log for today. Tap to add.
            </p>
          </div>

          {/* Cycle Stats */}
          <div className="border border-black/10 p-3">
            <div className="flex items-center gap-1.5 mb-3">
              <svg className="w-3.5 h-3.5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span className="font-mono text-xs font-medium text-black">
                Cycle Statistics
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-xl font-extralight text-black">{cycleLength}</p>
                <p className="font-mono text-[9px] text-black/30">Avg. Cycle Length</p>
              </div>
              <div>
                <p className="font-mono text-xl font-extralight text-black">{periodLength}</p>
                <p className="font-mono text-[9px] text-black/30">Avg. Period Length</p>
              </div>
            </div>
          </div>

          {/* Phase Tips */}
          <div className="border border-pink-200 bg-pink-50/30 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="font-mono text-xs font-medium text-black">Phase Tips</span>
            </div>
            <p className="font-mono text-[10px] text-black/40 leading-relaxed">
              You&apos;re at your most social and creative. Communication skills
              are enhanced during the ovulation phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
