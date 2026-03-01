"use client";

import { motion } from "framer-motion";

interface TaskItem {
  text: string;
  time?: string;
  visible: boolean;
}

interface TaskTemplateProps {
  tasks?: TaskItem[];
}

const BUCKETS = [
  {
    name: "Today",
    active: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    name: "This Week",
    active: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    name: "This Month",
    active: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    ),
  },
  {
    name: "Later",
    active: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Inbox",
    active: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
      </svg>
    ),
  },
];

export default function TaskTemplate({ tasks = [] }: TaskTemplateProps) {
  const visibleTasks = tasks.filter((t) => t.visible);
  const totalTasks = tasks.length;
  const completedCount = 0;

  return (
    <div className="w-full h-full bg-white flex flex-col p-4 md:p-8">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        {/* Header */}
        <h1 className="font-serif text-xl mb-4">Tasks</h1>

        {/* Bucket tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {BUCKETS.map((bucket) => (
            <button
              key={bucket.name}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] md:text-xs whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                bucket.active
                  ? "bg-black text-white"
                  : "bg-black/5 text-black/40"
              }`}
            >
              {bucket.icon}
              <span>{bucket.name}</span>
            </button>
          ))}
        </div>

        {/* Progress indicator */}
        {totalTasks > 0 && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[10px] text-black/40">
                {completedCount} of {visibleTasks.length} complete
              </span>
            </div>
            <div className="w-full h-0.5 bg-black/5">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: visibleTasks.length > 0
                    ? `${(completedCount / visibleTasks.length) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        )}

        {/* Task list */}
        <div className="flex-1 space-y-1">
          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <p className="font-mono text-sm text-black/20">No tasks yet</p>
            </div>
          )}

          {tasks.map((task, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={
                task.visible
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: -20 }
              }
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex items-center gap-3 py-2.5 px-3 border border-black/5 bg-white"
            >
              {/* Square checkbox */}
              <div className="w-4 h-4 border border-black/30 flex-shrink-0" />

              {/* Task text */}
              <span className="font-mono text-sm text-black flex-1">
                {task.text}
              </span>

              {/* Time badge */}
              {task.time && (
                <span className="font-mono text-[10px] md:text-xs text-blue-500 font-medium flex-shrink-0">
                  {task.time}
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center gap-3 pt-4 border-t border-black/10">
          <div className="flex-1 bg-white border border-black/15 px-4 py-3 font-mono text-sm text-black/30">
            Add a task...
          </div>
          <button className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
