"use client";

interface PeriodCardProps {
  inverted?: boolean;
}

export default function PeriodCard({ inverted = false }: PeriodCardProps) {
  const dayOfCycle = 14;
  const cycleLength = 28;
  const daysUntilNext = cycleLength - dayOfCycle;
  const progressPercent = (dayOfCycle / cycleLength) * 100;

  return (
    <div
      className={`row-span-2 border p-3 md:p-5 h-full flex flex-col overflow-hidden transition-all duration-300 ${
        inverted
          ? "bg-black border-black text-white"
          : "bg-white border-black text-black"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="font-serif text-base md:text-xl truncate pr-2">
          Period Tracker
        </h3>
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
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Phase */}
        <div className="mb-1 flex-shrink-0">
          <span className={`text-[10px] md:text-xs font-medium ${inverted ? "text-pink-400" : "text-pink-500"}`}>
            Follicular Phase
          </span>
        </div>

        {/* Days */}
        <div className="flex-shrink-0">
          <div className={`text-2xl md:text-3xl font-bold leading-tight ${inverted ? "text-pink-400" : "text-pink-500"}`}>
            {daysUntilNext}
          </div>
          <div className={`text-[9px] md:text-[10px] uppercase tracking-wider ${inverted ? "text-white/40" : "text-black/30"}`}>
            days until next
          </div>
        </div>

        <div className="flex-1 min-h-0" />

        {/* Progress */}
        <div className={`pt-2 border-t flex-shrink-0 ${inverted ? "border-white/20" : "border-black/10"}`}>
          <div className={`text-[10px] md:text-xs mb-1 ${inverted ? "text-white/50" : "text-black/40"}`}>
            Day {dayOfCycle} of {cycleLength}
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${inverted ? "bg-white/10" : "bg-black/5"}`}>
            <div
              className={`h-full rounded-full ${inverted ? "bg-pink-400" : "bg-pink-500"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
