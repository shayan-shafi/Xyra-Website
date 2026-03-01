"use client";

import { motion } from "framer-motion";

interface DashboardShellProps {
  headerOpacity?: number;
  gridOpacity?: number;
  commandBarOpacity?: number;
  commandBarText?: string;
  showCursor?: boolean;
  children?: React.ReactNode;
}

export default function DashboardShell({
  headerOpacity = 1,
  gridOpacity = 1,
  commandBarOpacity = 1,
  commandBarText = "",
  showCursor = false,
  children,
}: DashboardShellProps) {
  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <motion.div
        style={{ opacity: headerOpacity }}
        className="text-center pt-8 md:pt-12 pb-4 md:pb-8 px-4"
      >
        <h1 className="font-serif text-2xl md:text-6xl text-black mb-2 md:mb-3">
          Your Dashboards
        </h1>
        <p className="hidden md:block font-mono text-sm text-black/30">
          Your personal operating system
        </p>
      </motion.div>

      {/* Grid Area */}
      <motion.div
        style={{ opacity: gridOpacity }}
        className="flex-1 px-4 md:px-8 lg:px-20 overflow-hidden"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 auto-rows-[64px] md:auto-rows-[98px]">
            {children}
          </div>
        </div>
      </motion.div>

      {/* Command Bar */}
      <motion.div
        style={{ opacity: commandBarOpacity }}
        className="px-4 md:px-0 pb-6 md:pb-10 pt-4"
      >
        <div className="max-w-xl mx-auto relative">
          <div className="flex items-center gap-3">
            <div className="w-full bg-white border border-black px-6 py-4 font-mono text-sm md:text-base text-black flex items-center flex-1">
              <span className="flex-1">
                {commandBarText || (
                  <span className="text-black/30">Ask Xyra...</span>
                )}
                {showCursor && (
                  <span className="inline-block w-[2px] h-[1.1em] bg-black ml-0.5 animate-pulse align-middle" />
                )}
              </span>
              {/* Sparkles icon */}
              <svg
                className="w-5 h-5 text-black/40 flex-shrink-0 ml-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </div>
            {/* Mic button */}
            <button className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black flex items-center justify-center flex-shrink-0">
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
      </motion.div>
    </div>
  );
}
