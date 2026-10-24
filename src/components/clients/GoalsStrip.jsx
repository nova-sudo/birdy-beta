"use client"

// components/clients/GoalsStrip.jsx
// The Client Detail overview's goals — one white cell per goal on a Frame,
// each showing a live value against its target and a state badge.
//
// The design deliberately has no progress bar: a bar doesn't read sensibly for
// ratio-style metrics like cost per lead or close rate, where lower or
// bounded-at-100% breaks the metaphor.

import { Info } from "lucide-react"
import {
  Badge,
  Frame,
  Skeleton,
  Surface,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ds"
import { formatGoal, ON_TRACK, AT_RISK, BEHIND } from "@/lib/client-goals"

// State reads in the status tones: on track is good, at risk is a warning,
// behind is the problem.
const STATE_TONE = {
  [ON_TRACK]: "success",
  [AT_RISK]: "warning",
  [BEHIND]: "danger",
}

function GoalCell({ goal, currencySymbol }) {
  const tone = goal.state ? STATE_TONE[goal.state] : null

  return (
    <Surface data-slot="goal" className="flex min-w-0 flex-col gap-1">
      {/* "Leads" means different things depending on where it came from —
          Meta counts form submissions, the CRM counts contact records it
          created — so every figure says which one it is. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 items-center gap-1 self-start rounded-sm text-left outline-none focus-visible:shadow-control-focus"
            aria-label={`${goal.label}: ${goal.note}`}
          >
            <span className="min-w-0 truncate text-sm font-medium text-body">{goal.label}</span>
            <Info className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64">
          <p className="font-semibold">Source: {goal.source}</p>
          <p className="mt-1 font-normal leading-snug">{goal.note}</p>
          {goal.implied && (
            <p className="mt-1 font-normal leading-snug opacity-80">
              Target implied from monthly spend ÷ cost per lead.
            </p>
          )}
        </TooltipContent>
      </Tooltip>

      <div className="flex items-baseline gap-1.5">
        <span className="num text-figure font-medium text-foreground">
          {formatGoal(goal.value, goal.format, currencySymbol)}
        </span>
        {goal.target != null && (
          <span className="num truncate text-sm text-muted-foreground">
            / {formatGoal(goal.target, goal.format, currencySymbol)}
          </span>
        )}
      </div>

      {tone && <Badge tone={tone}>{goal.state}</Badge>}
    </Surface>
  )
}

const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"

export function GoalsStrip({ goals = [], currencySymbol = "$", loading = false, className }) {
  if (loading) {
    return (
      <Frame data-ds="goals-strip" title="Goals" meta="This month" className={className} aria-busy="true">
        <div className={GRID}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Surface key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-5 w-16" />
            </Surface>
          ))}
        </div>
      </Frame>
    )
  }

  const anyTarget = goals.some((g) => g.target != null)

  return (
    <Frame data-ds="goals-strip" title="Goals" meta="This month" className={className}>
      <div className={GRID}>
        {goals.map((goal) => (
          <GoalCell key={goal.id} goal={goal} currencySymbol={currencySymbol} />
        ))}
      </div>

      {!anyTarget && (
        <p className="px-1 text-sm text-muted-foreground">
          No monthly targets set for this client yet — add them in Settings to
          track progress and drive the health band.
        </p>
      )}
    </Frame>
  )
}
