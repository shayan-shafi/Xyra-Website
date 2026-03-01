"use client";

import { useRef, useState, useCallback } from "react";
import { useScroll, useTransform, useMotionValueEvent, motion } from "framer-motion";
import DashboardShell from "./DashboardShell";
import PeriodCard from "./cards/PeriodCard";
import TaskCard from "./cards/TaskCard";
import ConversationBubble from "./ConversationBubble";
import VoiceIndicator from "./VoiceIndicator";
import TaskTemplate from "./templates/TaskTemplate";

export default function TaskScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const [conversationVisible, setConversationVisible] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [taskCardVisible, setTaskCardVisible] = useState(false);
  const [cardInverted, setCardInverted] = useState(false);
  const [templateVisible, setTemplateVisible] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [showExtract, setShowExtract] = useState(false);
  const [visibleTasks, setVisibleTasks] = useState<boolean[]>([false, false, false]);

  const fullTranscript =
    "I have a coffee meet at 8am, then I have to go to the gym at 3pm, and then I have a dinner at 6pm";

  // Motion values
  const taskCardOpacity = useTransform(scrollYProgress, [0.22, 0.30], [0, 1]);
  const taskCardY = useTransform(scrollYProgress, [0.22, 0.30], [20, 0]);
  const taskCardScale = useTransform(scrollYProgress, [0.22, 0.30], [0.9, 1]);
  const conversationOpacity = useTransform(scrollYProgress, [0.0, 0.02, 0.18, 0.22], [0, 1, 1, 0]);
  const dashboardOpacity = useTransform(scrollYProgress, [0.20, 0.26, 0.50, 0.54], [0, 1, 1, 0]);
  const templateOpacity = useTransform(scrollYProgress, [0.52, 0.58, 0.86, 0.92], [0, 1, 1, 0]);
  const templateScale = useTransform(scrollYProgress, [0.52, 0.58, 1], [0.95, 1, 1]);
  const voiceOpacity = useTransform(scrollYProgress, [0.58, 0.62, 0.72, 0.76], [0, 1, 1, 0]);

  const handleProgress = useCallback(
    (v: number) => {
      // Conversation starts immediately
      setConversationVisible(v < 0.22);
      setShowUser(v >= 0.02);
      setShowThinking(v >= 0.08 && v < 0.12);
      setShowReply(v >= 0.12);

      // Dashboard appears after conversation fades
      setDashboardVisible(v >= 0.20 && v < 0.54);
      setTaskCardVisible(v >= 0.22);

      // Card inverts simulating click
      setCardInverted(v >= 0.44 && v < 0.54);

      // Template
      setTemplateVisible(v >= 0.52 && v < 0.93);
      setVoiceVisible(v >= 0.58 && v < 0.76);

      // Transcript typewriter
      if (v >= 0.62 && v <= 0.72) {
        const t = (v - 0.62) / (0.72 - 0.62);
        const len = Math.floor(t * fullTranscript.length);
        setTranscriptText(fullTranscript.slice(0, len));
      } else if (v < 0.62) {
        setTranscriptText("");
      } else {
        setTranscriptText(fullTranscript);
      }

      setShowExtract(v >= 0.76);

      // Scroll-driven task stagger
      setVisibleTasks([v >= 0.78, v >= 0.80, v >= 0.82]);
    },
    [fullTranscript]
  );

  useMotionValueEvent(scrollYProgress, "change", handleProgress);

  const tasks = [
    { text: "Coffee", time: "8 AM", visible: visibleTasks[0] },
    { text: "Gym", time: "3 PM", visible: visibleTasks[1] },
    { text: "Dinner", time: "6 PM", visible: visibleTasks[2] },
  ];

  return (
    <div ref={ref} className="h-[500vh] relative z-20" style={{ marginTop: "-100vh" }}>
<div className="sticky top-0 h-screen overflow-hidden bg-white z-20">
        {/* Conversation overlay — starts immediately */}
        {conversationVisible && (
          <motion.div style={{ opacity: conversationOpacity }} className="absolute inset-0 z-30">
            <ConversationBubble
              userMessage="thats pretty neat, can you track my to-do's too?"
              showUser={showUser}
              showThinking={showThinking}
              showReply={showReply}
              replyText="Yup. To-do list built"
            />
          </motion.div>
        )}

        {/* Dashboard layer — appears after conversation fades */}
        {dashboardVisible && (
          <motion.div style={{ opacity: dashboardOpacity }} className="absolute inset-0">
            <DashboardShell
              commandBarText=""
              showCursor={false}
            >
              {/* Period card always visible in dashboard */}
              <PeriodCard />
              {/* Task card appears */}
              {taskCardVisible && (
                <motion.div style={{ opacity: taskCardOpacity, y: taskCardY, scale: taskCardScale }}>
                  <TaskCard inverted={cardInverted} empty />
                </motion.div>
              )}
            </DashboardShell>
          </motion.div>
        )}

        {/* Task template */}
        {templateVisible && (
          <motion.div style={{ opacity: templateOpacity, scale: templateScale }} className="absolute inset-0 z-20">
            <TaskTemplate tasks={showExtract ? tasks : []} />

            {/* Voice indicator overlay on template */}
            {voiceVisible && (
              <motion.div style={{ opacity: voiceOpacity }} className="absolute inset-0 z-25">
                <VoiceIndicator
                  showTranscript={transcriptText.length > 0}
                  transcriptText={transcriptText}
                />
              </motion.div>
            )}

            {/* Extracting text */}
            {showExtract && !visibleTasks[0] && (
              <div className="absolute inset-0 z-25 flex items-center justify-center">
                <span className="font-mono text-sm text-black/40">
                  Extracting tasks...
                </span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
