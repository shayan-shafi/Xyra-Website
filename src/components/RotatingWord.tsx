"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const WORDS = [
  "day",
  "tasks",
  "events",
  "yoga",
  "journal",
  "habits",
  "hikes",
  "goals",
  "runs",
  "trips",
];

export default function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="relative inline-flex overflow-hidden align-bottom pb-[0.18em] -mb-[0.18em]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={WORDS[index]}
          initial={{ y: "100%" }}
          animate={{ y: "0%" }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block whitespace-nowrap"
        >
          {WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
