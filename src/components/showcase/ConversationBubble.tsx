"use client";

import { motion } from "framer-motion";

interface ConversationBubbleProps {
  userMessage: string;
  showUser: boolean;
  showThinking: boolean;
  showReply: boolean;
  replyText: string;
}

export default function ConversationBubble({
  userMessage,
  showUser,
  showThinking,
  showReply,
  replyText,
}: ConversationBubbleProps) {
  return (
    <div className="w-full h-full bg-white flex items-center justify-center p-8">

      <div className="max-w-2xl w-full space-y-6">
        {/* User message */}
        {showUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-end"
          >
            <div className="bg-black text-white px-6 py-4 font-mono text-sm md:text-base max-w-lg">
              {userMessage}
            </div>
          </motion.div>
        )}

        {/* Thinking */}
        {showThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-black px-6 py-4 font-mono text-sm text-black">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="inline-block w-1.5 h-1.5 bg-black rounded-full animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </motion.div>
        )}

        {/* Reply */}
        {showReply && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-start"
          >
            <div className="bg-white border border-black px-6 py-4 font-mono text-sm md:text-base text-black max-w-lg">
              {replyText}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
