"use client"

// components/clients/GoalsStrip.jsx
// The Client Detail overview's goals — one MetricGroup cell per goal, each
// showing a live value against its target and a state badge.
//
// The design deliberately has no progress bar: a bar doesn't read sensibly for
// ratio-style metrics like cost per lead or close rate, where lower or
// bounded-at-100% breaks the metaphor.

import { Badge, MetricGroup } from "@/components/ds"
import { formatGoal, ON_TRACK, AT_RISK, BEHIND } from "@/lib/client-goals"

// State reads in the status tones: on track is good, at risk is a warning,
// behind is the problem.
const STATE_TONE = {
  [ON_TRACK]: "success",
  [AT_RISK]: "warning",
  [BEHIND]: "danger",
}

// "Leads" means different things depending on where it came from — Meta
// counts form submissions, the CRM counts contact records it created — so
// every figure says which one it is, in the label's info tooltip.
function goalDescription(goal) {
  return [
    `Source: ${goal.source}`,
    goal.note,
    goal.implied ? "Target implied from monthly spend ÷ cost per lead." : null,
  ]
    .filter(Boolean)
    .join("\n")
}

function goalItem(goal, currencySymbol) {
  const tone = goal.state ? STATE_TONE[goal.state] : null
  return {
    key: goal.id,
    label: goal.label,
    description: goalDescription(goal),
    value: formatGoal(goal.value, goal.format, currencySymbol),
    unit: goal.target != null ? `/ ${formatGoal(goal.target, goal.format, currencySymbol)}` : undefined,
    caption: tone ? (
      <Badge tone={tone} className="mt-0.5">
        {goal.state}
      </Badge>
    ) : undefined,
  }
}

// The goals' labels come with the data, so while loading the cells have none
// and MetricGroup draws a label-sized skeleton in its place.
const LOADING_ITEMS = Array.from({ length: 5 }, (_, i) => ({ key: `loading-${i}`, value: "" }))

export function GoalsStrip({ goals = [], currencySymbol = "$", loading = false, className }) {
  const anyTarget = goals.some((g) => g.target != null)

  return (
    <MetricGroup
      data-ds="goals-strip"
      title="Goals"
      description="This month"
      className={className}
      loading={loading}
      items={loading ? LOADING_ITEMS : goals.map((goal) => goalItem(goal, currencySymbol))}
      footer={
        !loading && !anyTarget ? (
          <p>
            No monthly targets set for this client yet — add them in Settings to
            track progress and drive the health band.
          </p>
        ) : undefined
      }
    />
  )
}
