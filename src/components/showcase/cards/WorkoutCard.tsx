"use client";

export default function WorkoutCard() {
  const streak = 12;
  const weeklyWorkouts = 3;
  const weeklyGoal = 4;
  const progressPercent = Math.round((weeklyWorkouts / weeklyGoal) * 100);

  return (
    <div className="row-span-2 border border-black p-3 md:p-5 h-full flex flex-col overflow-hidden bg-white text-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="font-serif text-base md:text-xl truncate pr-2">Workouts</h3>
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
            d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z"
          />
        </svg>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Streak label */}
        <div className="mb-1 flex-shrink-0">
          <span className="text-[10px] md:text-xs font-medium text-orange-500">
            {streak} Day Streak
          </span>
        </div>

        {/* Main stat */}
        <div className="flex-shrink-0">
          <div className="text-2xl md:text-3xl font-bold leading-tight text-orange-500">
            {weeklyWorkouts}
          </div>
          <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-black/30">
            of {weeklyGoal} weekly goal
          </div>
        </div>

        <div className="flex-1 min-h-0" />

        {/* Footer */}
        <div className="pt-2 border-t border-black/10 flex-shrink-0">
          <div className="font-mono text-[10px] md:text-xs mb-1 text-black/40">
            Next: Upper Body
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/5">
            <div
              className="h-full rounded-full bg-orange-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
