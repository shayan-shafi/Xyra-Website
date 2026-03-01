"use client";

import { useRef, useState, useCallback } from "react";
import { useScroll, useTransform, useMotionValueEvent, motion } from "framer-motion";
import ConversationBubble from "./ConversationBubble";
import DashboardShell from "./DashboardShell";
import PeriodCard from "./cards/PeriodCard";
import TaskCard from "./cards/TaskCard";
import WorkCard from "./cards/WorkCard";
import StartupCard from "./cards/StartupCard";
import WorkoutCard from "./cards/WorkoutCard";
import FinanceCard from "./cards/FinanceCard";

export default function ExpandScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Conversation state
  const [conversationVisible, setConversationVisible] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showReply, setShowReply] = useState(false);

  // Dashboard state
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [visibleCards, setVisibleCards] = useState<boolean[]>([false, false, false, false]);

  // Motion values
  const conversationOpacity = useTransform(
    scrollYProgress,
    [0.0, 0.02, 0.28, 0.34],
    [0, 1, 1, 0]
  );
  const dashboardOpacity = useTransform(
    scrollYProgress,
    [0.34, 0.40, 0.72, 0.78],
    [0, 1, 1, 0]
  );

  const handleProgress = useCallback((v: number) => {
    setConversationVisible(v < 0.34);
    setShowUser(v >= 0.02);
    setShowThinking(v >= 0.12 && v < 0.16);
    setShowReply(v >= 0.16);

    setDashboardVisible(v >= 0.34 && v < 0.79);

    // Scroll-driven card stagger
    setVisibleCards([v >= 0.48, v >= 0.52, v >= 0.56, v >= 0.60]);
  }, []);

  useMotionValueEvent(scrollYProgress, "change", handleProgress);

  return (
    <div ref={ref} className="h-[500vh] relative z-30" style={{ marginTop: "-100vh" }}>
<div className="sticky top-0 h-screen overflow-hidden bg-white z-30">
        {/* Conversation phase */}
        {conversationVisible && (
          <motion.div style={{ opacity: conversationOpacity }} className="absolute inset-0 z-10">
            <ConversationBubble
              userMessage="Okay wow, this is pretty cool. I also want to track my work, my startup, my workouts, and my finances."
              showUser={showUser}
              showThinking={showThinking}
              showReply={showReply}
              replyText="Got it, I'll add all of those now."
            />
          </motion.div>
        )}

        {/* Dashboard phase — all 6 cards */}
        {dashboardVisible && (
          <motion.div style={{ opacity: dashboardOpacity }} className="absolute inset-0">
            <DashboardShell commandBarText="" showCursor={false}>
              <PeriodCard />
              <TaskCard />
              {visibleCards[0] && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="row-span-2"
                >
                  <WorkCard />
                </motion.div>
              )}
              {visibleCards[1] && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="row-span-2"
                >
                  <StartupCard />
                </motion.div>
              )}
              {visibleCards[2] && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="row-span-2"
                >
                  <WorkoutCard />
                </motion.div>
              )}
              {visibleCards[3] && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="row-span-2"
                >
                  <FinanceCard />
                </motion.div>
              )}
            </DashboardShell>
          </motion.div>
        )}
      </div>
    </div>
  );
}
