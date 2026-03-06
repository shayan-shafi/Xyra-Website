"use client";

import { useRef, useState, useCallback } from "react";
import { useScroll, useTransform, useMotionValueEvent, motion } from "framer-motion";
import DashboardShell from "./DashboardShell";
import PeriodCard from "./cards/PeriodCard";
import ConversationBubble from "./ConversationBubble";
import PeriodTemplate from "./templates/PeriodTemplate";

export default function PeriodScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // State driven by scroll
  const [commandText, setCommandText] = useState("");
  const [showCursor, setShowCursor] = useState(false);
  const [conversationVisible, setConversationVisible] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [cardInverted, setCardInverted] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(true);
  const [setupPhase, setSetupPhase] = useState(0);
  const [selectedDateIndex, setSelectedDateIndex] = useState(-1);

  const fullText = "Build me a period tracker";

  // Motion values — all clamped with trailing keyframes
  const cardOpacity = useTransform(scrollYProgress, [0.38, 0.48, 1], [0, 1, 1]);
  const cardY = useTransform(scrollYProgress, [0.38, 0.48, 1], [20, 0, 0]);
  const cardScale = useTransform(scrollYProgress, [0.38, 0.48, 1], [0.9, 1, 1]);
  const conversationOpacity = useTransform(scrollYProgress, [0.16, 0.18, 0.38, 0.40], [0, 1, 1, 0]);
  const dashboardOpacity = useTransform(scrollYProgress, [0.56, 0.60, 1], [1, 0, 0]);
  // Template fades IN at 0.58, stays solid, fades OUT before overlap at 0.75
  const templateOpacity = useTransform(scrollYProgress, [0.58, 0.62, 0.68, 0.74], [0, 1, 1, 0]);

  const handleProgress = useCallback((v: number) => {
    // Command text typewriter
    if (v >= 0.02 && v <= 0.18) {
      const t = (v - 0.02) / (0.18 - 0.02);
      const len = Math.floor(t * fullText.length);
      setCommandText(fullText.slice(0, len));
    } else if (v < 0.02) {
      setCommandText("");
    } else if (v > 0.18) {
      setCommandText(fullText);
    }

    setShowCursor(v >= 0.01 && v < 0.18);
    setConversationVisible(v >= 0.18 && v < 0.40);
    setShowUser(v >= 0.20);
    setShowThinking(v >= 0.26 && v < 0.33);
    setShowReply(v >= 0.33);
    setCardVisible(v >= 0.38);
    setCardInverted(v >= 0.52 && v < 0.60);
    setDashboardVisible(v < 0.60);
    setTemplateVisible(v >= 0.58 && v < 0.75);
    setSetupPhase(v >= 0.66 ? 2 : v >= 0.64 ? 1 : 0);
    setSelectedDateIndex(v >= 0.64 ? 10 : -1);
  }, [fullText]);

  useMotionValueEvent(scrollYProgress, "change", handleProgress);

  return (
    <div ref={ref} className="h-[600vh] relative z-0">
<div className="sticky top-0 h-screen overflow-hidden bg-white">
        {/* Dashboard layer */}
        {dashboardVisible && (
          <motion.div style={{ opacity: dashboardOpacity }} className="absolute inset-0">
            <DashboardShell
              commandBarText={commandText}
              showCursor={showCursor}
            >
              {cardVisible && (
                <motion.div style={{ opacity: cardOpacity, y: cardY, scale: cardScale }}>
                  <PeriodCard inverted={cardInverted} />
                </motion.div>
              )}
            </DashboardShell>
          </motion.div>
        )}

        {/* Conversation overlay */}
        {conversationVisible && (
          <motion.div style={{ opacity: conversationOpacity }} className="absolute inset-0 z-30">
            <ConversationBubble
              userMessage="Build me a period tracker"
              showUser={showUser}
              showThinking={showThinking}
              showReply={showReply}
              replyText="Done! I built your Period Tracker."
            />
          </motion.div>
        )}

        {/* Period template — fades out before sticky releases */}
        {templateVisible && (
          <motion.div style={{ opacity: templateOpacity }} className="absolute inset-0 z-20 pointer-events-none">
            <PeriodTemplate
              setupPhase={setupPhase}
              selectedDateIndex={selectedDateIndex}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
