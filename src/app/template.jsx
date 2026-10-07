"use client";

import { motion } from "framer-motion";
import { EASE_SPRING } from "@/components/motion";

// A template remounts on every navigation (a layout does not), so each page
// rises in as it opens. The wrapper keeps the flex column the layout gives
// its children, so pages that stretch to fill the frame still do.
export default function Template({ children }) {
  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col gap-4"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE_SPRING }}
    >
      {children}
    </motion.div>
  );
}
