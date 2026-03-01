"use client";

export default function WorkCard() {
  const activeProjects = 2;
  const tasksDue = 3;
  const progressPercent = 60;

  return (
    <div className="row-span-2 border border-black p-3 md:p-5 h-full flex flex-col overflow-hidden bg-white text-black">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="font-serif text-base md:text-xl truncate pr-2">Work</h3>
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
            d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Accent label */}
        <div className="mb-1 flex-shrink-0">
          <span className="text-[10px] md:text-xs font-medium text-blue-500">
            {activeProjects} Active Projects
          </span>
        </div>

        {/* Main stat */}
        <div className="flex-shrink-0">
          <div className="text-2xl md:text-3xl font-bold leading-tight text-blue-500">
            {tasksDue}
          </div>
          <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-black/30">
            tasks due this week
          </div>
        </div>

        <div className="flex-1 min-h-0" />

        {/* Footer */}
        <div className="pt-2 border-t border-black/10 flex-shrink-0">
          <div className="font-mono text-[10px] md:text-xs mb-1 text-black/40">
            Sprint progress
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/5">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
