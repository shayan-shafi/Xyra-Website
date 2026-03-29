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

  // State only for child component boolean props
  const [showUser, setShowUser] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showReply, setShowReply] = useState(false);

  // Pure motion values
  const conversationOpacity = useTransform(scrollYProgress, [0.0, 0.02, 0.28, 0.34], [0, 1, 1, 0]);
  const dashboardOpacity = useTransform(scrollYProgress, [0.34, 0.40, 0.72, 0.78], [0, 1, 1, 0]);

  // Staggered card reveals — pure motion values instead of conditional rendering
  const card1Opacity = useTransform(scrollYProgress, [0.44, 0.50], [0, 1]);
  const card1Y = useTransform(scrollYProgress, [0.44, 0.50], [20, 0]);
  const card1Scale = useTransform(scrollYProgress, [0.44, 0.50], [0.9, 1]);
  const card2Opacity = useTransform(scrollYProgress, [0.50, 0.56], [0, 1]);
  const card2Y = useTransform(scrollYProgress, [0.50, 0.56], [20, 0]);
  const card2Scale = useTransform(scrollYProgress, [0.50, 0.56], [0.9, 1]);
  const card3Opacity = useTransform(scrollYProgress, [0.56, 0.62], [0, 1]);
  const card3Y = useTransform(scrollYProgress, [0.56, 0.62], [20, 0]);
  const card3Scale = useTransform(scrollYProgress, [0.56, 0.62], [0.9, 1]);
  const card4Opacity = useTransform(scrollYProgress, [0.62, 0.68], [0, 1]);
  const card4Y = useTransform(scrollYProgress, [0.62, 0.68], [20, 0]);
  const card4Scale = useTransform(scrollYProgress, [0.62, 0.68], [0.9, 1]);

  const handleProgress = useCallback((v: number) => {
    setShowUser(v >= 0.02);
    setShowThinking(v >= 0.12 && v < 0.16);
    setShowReply(v >= 0.16);
  }, []);

  useMotionValueEvent(scrollYProgress, "change", handleProgress);

  return (
    <div ref={ref} className="h-[700vh] relative z-30" style={{ marginTop: "-100vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-white z-30">
        {/* Conversation phase — always rendered */}
        <motion.div
          style={{ opacity: conversationOpacity, willChange: "opacity" }}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          <ConversationBubble
            userMessage="Okay wow, this is pretty cool. I also want to track my work, my startup, my workouts, and my finances."
            showUser={showUser}
            showThinking={showThinking}
            showReply={showReply}
            replyText="Got it, I'll add all of those now."
          />
        </motion.div>

        {/* Dashboard phase — always rendered, staggered cards via motion values */}
        <motion.div
          style={{ opacity: dashboardOpacity, willChange: "opacity" }}
          className="absolute inset-0"
        >
          <DashboardShell commandBarText="" showCursor={false}>
            <PeriodCard />
            <TaskCard />
            <motion.div
              style={{ opacity: card1Opacity, y: card1Y, scale: card1Scale, willChange: "transform, opacity" }}
              className="row-span-2"
            >
              <WorkCard />
            </motion.div>
            <motion.div
              style={{ opacity: card2Opacity, y: card2Y, scale: card2Scale, willChange: "transform, opacity" }}
              className="row-span-2"
            >
              <StartupCard />
            </motion.div>
            <motion.div
              style={{ opacity: card3Opacity, y: card3Y, scale: card3Scale, willChange: "transform, opacity" }}
              className="row-span-2"
            >
              <WorkoutCard />
            </motion.div>
            <motion.div
              style={{ opacity: card4Opacity, y: card4Y, scale: card4Scale, willChange: "transform, opacity" }}
              className="row-span-2"
            >
              <FinanceCard />
            </motion.div>
          </DashboardShell>
        </motion.div>
      </div>
    </div>
  );
}
