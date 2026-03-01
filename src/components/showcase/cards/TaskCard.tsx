"use client";

interface TaskCardProps {
  inverted?: boolean;
  empty?: boolean;
}

export default function TaskCard({ inverted = false, empty = false }: TaskCardProps) {
  const completed = empty ? 0 : 2;
  const total = empty ? 0 : 5;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const tasks = [
    { text: "Review project proposal", done: true },
    { text: "Call dentist", done: true },
    { text: "Buy groceries", done: false },
    { text: "Update portfolio", done: false },
    { text: "Evening run", done: false },
  ];

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
          Tasks
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
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {empty ? (
          <>
            {/* Empty state */}
            <div className="flex-1 flex items-center justify-center">
              <p className={`font-mono text-[10px] md:text-xs ${inverted ? "text-white/20" : "text-black/20"}`}>
                No tasks yet
              </p>
            </div>

            {/* Footer */}
            <div className={`pt-1 md:pt-2 border-t flex-shrink-0 ${inverted ? "border-white/20" : "border-black/10"}`}>
              <p className={`font-mono text-[9px] md:text-[10px] ${inverted ? "text-white/40" : "text-black/40"}`}>
                Add tasks by voice
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-2 flex-shrink-0">
              <div className="flex justify-between mb-1">
                <span className={`font-mono text-[9px] md:text-[10px] ${inverted ? "text-emerald-400" : "text-emerald-500"}`}>
                  {completed}/{total}
                </span>
                <span className={`font-mono text-[9px] md:text-[10px] ${inverted ? "text-emerald-400" : "text-emerald-500"}`}>
                  {progressPercent}%
                </span>
              </div>
              <div className={`w-full h-1 md:h-1.5 rounded-full ${inverted ? "bg-white/10" : "bg-black/5"}`}>
                <div
                  className={`h-1 md:h-1.5 rounded-full ${inverted ? "bg-emerald-400" : "bg-emerald-500"}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Task List */}
            <div className="space-y-1 flex-shrink-0">
              {tasks.slice(0, 2).map((task, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div
                    className={`mt-0.5 w-3 h-3 md:w-4 md:h-4 border flex-shrink-0 flex items-center justify-center ${
                      task.done
                        ? inverted
                          ? "bg-emerald-400 border-emerald-400"
                          : "bg-emerald-500 border-emerald-500"
                        : inverted
                          ? "border-white/30"
                          : "border-black/30"
                    }`}
                  >
                    {task.done && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`font-mono text-[10px] md:text-xs truncate ${
                      task.done
                        ? inverted
                          ? "line-through text-white/30"
                          : "line-through text-black/30"
                        : ""
                    }`}
                  >
                    {task.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 min-h-0" />

            {/* Footer */}
            <div className={`pt-1 md:pt-2 border-t flex-shrink-0 ${inverted ? "border-white/20" : "border-black/10"}`}>
              <p className={`font-mono text-[9px] md:text-[10px] ${inverted ? "text-white/40" : "text-black/40"}`}>
                {total - completed} remaining
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
