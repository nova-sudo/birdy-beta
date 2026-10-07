"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { EASE_SPRING } from "@/components/motion"

// The backend answers in one response rather than streaming its tool calls,
// so these name the steps an answer usually goes through rather than the one
// in flight. They advance on a timer and hold on the last.
const STEPS = [
  "Reading your question…",
  "Pulling your client data…",
  "Crunching the numbers…",
  "Writing it up…",
]

export default function TypingIndicator() {
  const [step, setStep] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (step >= STEPS.length - 1) return
    const t = setTimeout(() => setStep((s) => s + 1), 2400)
    return () => clearTimeout(t)
  }, [step])

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_SPRING }}
      role="status"
      aria-live="polite"
    >
      <BirdyAvatar size={30} state="loading" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={step}
          className="chat-shimmer text-[13px] font-semibold"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
        >
          {STEPS[step]}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
}
