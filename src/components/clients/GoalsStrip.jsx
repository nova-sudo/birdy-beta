"use client"

// components/clients/GoalsStrip.jsx
// The Client Detail overview's goals card — five equal cells in one card,
// divided by hairlines, each showing a live value against its target and a
// state pill.
//
// The design deliberately has no progress bar: a bar doesn't read sensibly for
// ratio-style metrics like cost per lead or close rate, where lower or
// bounded-at-100% breaks the metaphor.

import { Banknote, Target, Coins, Percent, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatGoal, ON_TRACK, AT_RISK, BEHIND } from "@/lib/client-goals"

const ICONS = {
  revenue: Banknote,
  closes: Target,
  cpl: Coins,
  closeRate: Percent,
  leads: Users,
}

// Icon chip tints, from the handoff's token table.
const CHIP = {
  revenue: { color: "#25A55F", bg: "#EDF8F1" },
  closes: { color: "#6B4EE6", bg: "#F1EEFC" },
  cpl: { color: "#E0920A", bg: "#FDF6EC" },
  closeRate: { color: "#3B7DD6", bg: "#EAF1FD" },
  leads: { color: "#6B4EE6", bg: "#F1EEFC" },
}

const PILL = {
  [ON_TRACK]: { color: "#25A55F", bg: "#EDF8F1" },
  [AT_RISK]: { color: "#E0920A", bg: "#FDF6EC" },
  [BEHIND]: { color: "#E5484D", bg: "#FEF1F1" },
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
        className="flex size-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: chip.bg, color: chip.color }}
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
          <span
            className="min-w-0 flex-1 truncate text-[11px] text-[#8A8A9A]"
            title={goal.implied ? "Implied from monthly spend ÷ cost per lead" : undefined}
          >
            {goal.label}
            {goal.implied && <span className="ml-1 text-pd-faint">*</span>}
          </span>
          {pill && (
            <span
              className="shrink-0 rounded-[5px] px-[7px] py-[2px] text-[10px] font-bold"
              style={{ color: pill.color, background: pill.bg }}
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
      <div className="mb-[14px] flex rounded-2xl border border-pd-border bg-pd-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-1 items-start gap-3 px-[18px] py-4 ${
              i === 4 ? "" : "border-r border-pd-border"
            }`}
          >
            <Skeleton className="size-8 shrink-0 rounded-[9px]" />
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
    <div className="mb-[14px] rounded-2xl border border-pd-border bg-pd-surface">
      {/* Horizontal on wide screens as the design draws it; wrapping to two
          rows below that, since five cells at 18px padding do not fit. */}
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
  )
}
