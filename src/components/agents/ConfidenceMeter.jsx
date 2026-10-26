"use client"

import * as React from "react"
import { Check, Ellipsis } from "lucide-react"

import { cn } from "@/lib/utils"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { Badge, ProgressBar, Surface } from "@/components/ds"

/** The minimum practice answers before practice counts towards the score. */
const MIN_PRACTICE = 6

function Part({ done, mark, children }) {
  return (
    <span data-slot="confidence-part" data-done={String(done)} className="inline-flex items-center gap-1.5">
      <Badge size="sm" tone={done ? "success" : "warning"} className="min-w-6 justify-center px-1.5">
        {mark ?? (done ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <Ellipsis aria-hidden className="size-3" />)}
        <span className="sr-only">{done ? "done" : "not yet"}</span>
      </Badge>
      <span>{children}</span>
    </span>
  )
}

/**
 * The agent's confidence: score, a bar with a marker at the switch-on threshold
 * (amber below it, green at or above), and what the score is made of.
 *
 * @param {object} props
 * @param {number} props.score 0-100
 * @param {object} props.parts `{targets, pause, revive, flags, practice_agreed, practice_answered}` from /confidence
 * @param {number} [props.threshold=80]
 * @param {{set: number, total: number}} [props.targets] Watched clients with a CPL target, out of all watched
 * @param {string[]} [props.missing] What the server says is still needed
 * @param {boolean} [props.ready] The server's verdict; when given it decides the badge and tone, so the
 *   meter never says "Ready" while something else (a missing CPL target) still blocks switching on
 */
export function ConfidenceMeter({ score, parts, threshold = 80, targets, missing, ready: readyProp, className }) {
  const value = Math.max(0, Math.min(100, Math.round(Number(score) || 0)))
  const ready = typeof readyProp === "boolean" ? readyProp : value >= threshold
  const p = parts ?? {}
  const agreed = Number(p.practice_agreed) || 0
  const answered = Number(p.practice_answered) || 0
  const targetsDone = targets ? targets.total > 0 && targets.set >= targets.total : Boolean(p.targets)
  const targetsLabel = targets ? `Client targets ${targets.set}/${targets.total}` : "Client targets"
  // Practice counts once there are enough answers and most of them agree.
  const practiceDone = answered >= MIN_PRACTICE && agreed * 3 >= answered * 2

  return (
    <Surface
      data-slot="confidence-meter"
      data-tone={ready ? "success" : "warning"}
      className={cn("grid grid-cols-1 items-center gap-x-8 gap-y-5 p-5 md:grid-cols-[minmax(0,15rem)_1fr]", className)}
    >
      <div className="flex items-center gap-4">
        <BirdyAvatar size={44} />
        <div className="flex min-w-0 flex-col">
          <span className="text-sm text-muted-foreground">Agent confidence</span>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-medium tracking-[-0.02em] text-foreground tabular-nums">{value}%</span>
            <Badge size="sm" tone={ready ? "success" : "warning"}>
              {ready ? "Ready to switch on" : "Keep training"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="relative pt-5">
          <ProgressBar
            value={value}
            tone={ready ? "success" : "warning"}
            label="Agent confidence"
            className="h-2.5"
          />
          <span
            data-slot="confidence-threshold"
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${threshold}%` }}
          >
            <span className="font-mono text-[11px] leading-4 whitespace-nowrap text-muted-foreground">
              {threshold}% to switch on
            </span>
            <span className="-mt-0.5 w-0.5 flex-1 rounded-full bg-foreground" />
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-secondary">
          <Part done={targetsDone}>{targetsLabel}</Part>
          <Part done={Boolean(p.pause)}>When to pause</Part>
          <Part done={Boolean(p.revive)}>When to revive</Part>
          <Part done={Boolean(p.flags)}>What to flag</Part>
          <Part done={practiceDone} mark={<span className="tabular-nums">{agreed}/{answered || MIN_PRACTICE}</span>}>
            Practice cases agreed
          </Part>
        </div>

        {missing?.length > 0 && (
          <p className="text-xs text-muted-foreground">Still needed: {missing.join(" · ")}</p>
        )}
      </div>
    </Surface>
  )
}
