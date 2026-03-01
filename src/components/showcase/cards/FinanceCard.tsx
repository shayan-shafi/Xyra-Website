"use client";

export default function FinanceCard() {
  const dailySpend = 42;
  const budgetUsed = 1240;
  const budgetTotal = 2000;
  const progressPercent = Math.round((budgetUsed / budgetTotal) * 100);

  return (
    <div className="row-span-2 border border-black p-3 md:p-5 h-full flex flex-col overflow-hidden bg-white text-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="font-serif text-base md:text-xl truncate pr-2">Finances</h3>
        <svg
          className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
          />
        </svg>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Daily spend label */}
        <div className="mb-1 flex-shrink-0">
          <span className="text-[10px] md:text-xs font-medium text-amber-500">
            ${dailySpend} spent today
          </span>
        </div>

        {/* Main stat */}
        <div className="flex-shrink-0">
          <div className="text-2xl md:text-3xl font-bold leading-tight text-amber-500">
            ${budgetUsed.toLocaleString()}
          </div>
          <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-black/30">
            of ${budgetTotal.toLocaleString()} budget
          </div>
        </div>

        <div className="flex-1 min-h-0" />

        {/* Footer */}
        <div className="pt-2 border-t border-black/10 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] md:text-xs text-black/40">
              {progressPercent}% used
            </span>
            <span className="font-mono text-[10px] md:text-xs text-emerald-500">
              +$320 this week
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/5">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
