"use client"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check } from "lucide-react"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { EASE_SPRING } from "@/components/motion"

// The backend answers in one response rather than streaming its tool calls,
// so this is a checklist of the steps an answer usually goes through, not the
// one in flight: each ticks on a timer and the last one holds. It is labelled
// as what it is — "usual steps" — so a reader never takes the ticks for a
// report from the model.
const STEPS = [
  "Reading your question",
  "Pulling your client data",
  "Comparing the figures",
  "Writing it up",
]
const STEP_MS = 2400

export default function TypingIndicator() {
  const [step, setStep] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (step >= STEPS.length - 1) return
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [step])

  return (
    <motion.div
      data-ds="typing-indicator"
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_SPRING }}
      role="status"
      aria-live="polite"
      aria-label={`Birdy is working: ${STEPS[step]}`}
    >
      <div className="flex items-center gap-2">
        <BirdyAvatar size={28} state="loading" />
        <span className="text-sm font-semibold text-foreground">Birdy</span>
        <span className="text-xs text-muted-foreground">usual steps</span>
      </div>

      <ol className="flex flex-col gap-[5px] pl-9" aria-hidden="true">
        {STEPS.map((label, i) => {
          const done = i < step
          const running = i === step
          return (
            <motion.li
              key={label}
              layout={!reduce}
              className="flex items-center gap-2 text-xs"
              initial={false}
              animate={{ opacity: done || running ? 1 : 0.5 }}
            >
              <span
                className={`flex size-[15px] shrink-0 items-center justify-center rounded-full ${
                  done
                    ? "bg-success text-primary-foreground"
                    : running
                      ? "bg-primary motion-safe:animate-pulse"
                      : "border border-border"
                }`}
              >
                {done && <Check className="size-[9px]" strokeWidth={3} />}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${label}-${running}`}
                  className={running ? "chat-shimmer font-semibold" : done ? "text-body" : "text-muted-foreground"}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {label}{running ? "…" : ""}
                </motion.span>
              </AnimatePresence>
            </motion.li>
          )
        })}
      </ol>
    </motion.div>
  )
}
