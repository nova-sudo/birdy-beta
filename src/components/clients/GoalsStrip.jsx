"use client"

// components/clients/GoalsStrip.jsx
// The Client Detail overview's goals card — one equal cell per goal in a
// single card, divided by hairlines, each showing a live value against its
// target and a state pill.
//
// The design deliberately has no progress bar: a bar doesn't read sensibly for
// ratio-style metrics like cost per lead or close rate, where lower or
// bounded-at-100% breaks the metaphor.

import { Banknote, Target, Coins, HandCoins, Percent, Users, Info } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatGoal, ON_TRACK, AT_RISK, BEHIND } from "@/lib/client-goals"

const ICONS = {
  revenue: Banknote,
  closes: Target,
  cpl: Coins,
  cpa: HandCoins,
  closeRate: Percent,
  leads: Users,
}

// Icon chip tints, on the shared semantic scale.
const CHIP = {
  revenue: "bg-pd-success-bg text-pd-success",
  closes: "bg-pd-primary-tint text-pd-primary",
  cpl: "bg-pd-warning-bg text-pd-warning",
  closeRate: "bg-pd-info-bg text-pd-info",
  leads: "bg-pd-primary-tint text-pd-primary",
}

// Solid state badges: coloured fill, white text.
const PILL = {
  [ON_TRACK]: "bg-pd-success-bg text-pd-success",
  [AT_RISK]: "bg-pd-warning-bg text-pd-amber",
  [BEHIND]: "bg-pd-danger-bg text-pd-danger",
}

function GoalCell({ goal, currencySymbol, last }) {
  const Icon = ICONS[goal.id] ?? Target
  const chip = CHIP[goal.id] ?? CHIP.closes
  const pill = goal.state ? PILL[goal.state] : null

  return (
    <div
      className={`flex min-w-0 flex-1 items-start gap-3 px-[18px] py-4 ${
        last ? "" : "border-r border-pd-border"
      }`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${chip}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="font-pd-display text-[18px] font-bold leading-none text-pd-ink">
            {formatGoal(goal.value, goal.format, currencySymbol)}
          </span>
          {goal.target != null && (
            <span className="truncate text-[10.5px] text-pd-faint">
              / {formatGoal(goal.target, goal.format, currencySymbol)}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          {/* "Leads" means different things depending on where it came from —
              Meta counts form submissions, the CRM counts contact records it
              created — so every figure says which one it is. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1 text-left"
                aria-label={`${goal.label}: ${goal.note}`}
              >
                <span className="min-w-0 truncate text-[11px] text-pd-subtle">
                  {goal.label}
                </span>
                <Info className="size-3 shrink-0 text-pd-faint/70" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px]">
              <p className="text-[11px] font-semibold">
                Source: {goal.source}
              </p>
              <p className="mt-1 text-[11px] leading-snug">{goal.note}</p>
              {goal.implied && (
                <p className="mt-1 text-[11px] leading-snug opacity-80">
                  Target implied from monthly spend ÷ cost per lead.
                </p>
              )}
            </TooltipContent>
          </Tooltip>
          {pill && (
            <span
              className={`shrink-0 rounded-full px-[7px] py-[2px] text-[10px] font-bold ${pill}`}
            >
              {goal.state}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function GoalsStrip({ goals = [], currencySymbol = "$", loading = false }) {
  if (loading) {
    return (
      <div className="mb-[14px] flex rounded-xl border border-pd-border bg-pd-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-1 items-start gap-3 px-[18px] py-4 ${
              i === 4 ? "" : "border-r border-pd-border"
            }`}
          >
            <Skeleton className="size-8 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const anyTarget = goals.some((g) => g.target != null)

  return (
    <TooltipProvider delayDuration={200}>
    <div className="mb-[14px] rounded-xl border border-pd-border bg-pd-surface">
      {/* Horizontal on wide screens as the design draws it; wrapping to two
          rows below that, since the cells at 18px padding do not all fit. */}
      <div className="flex flex-wrap items-stretch lg:flex-nowrap">
        {goals.map((goal, i) => (
          <GoalCell
            key={goal.id}
            goal={goal}
            currencySymbol={currencySymbol}
            last={i === goals.length - 1}
          />
        ))}
      </div>

      {!anyTarget && (
        <p className="border-t border-pd-border px-[18px] py-2.5 text-[11px] text-pd-faint">
          No monthly targets set for this client yet — add them in Settings to
          track progress and drive the health band.
        </p>
      )}
    </div>
    </TooltipProvider>
  )
}
