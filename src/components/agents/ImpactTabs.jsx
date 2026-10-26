"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button, ErrorState, MetricTabsChart, Surface } from "@/components/ds"
import { useAgentImpact } from "@/lib/agents-api"
import { prettyLabel } from "@/lib/chat-viz"
import { money } from "./ActivityTable"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** This month in the viewer's time, as YYYY-MM. */
export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-10" moved by `by` months. */
export function shiftMonth(month, by) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return currentMonth(d)
}

const monthName = (month, short = false) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month ?? ""))
  if (!m) return ""
  const name = MONTHS[Number(m[2]) - 1] ?? ""
  return short ? name.slice(0, 3) : `${name} ${m[1]}`
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// The activity log keeps 13 months, so there is nothing to show before that.
const OLDEST_BACK = 12

/**
 * One month of the agent's impact as metric tabs: actions (against last month), how many ran on
 * auto, wasted spend stopped (per currency when the clients bill in more than one) and the
 * approval rate. The first three chart the month day by day (wasted spend in the majority currency
 * when there are several); the rate is a figure only. Defaults to this month; the arrows step back
 * through earlier months.
 *
 * @param {object} props
 * @param {string} props.agentId
 */
export function ImpactTabs({ agentId, className }) {
  const [month, setMonth] = React.useState(null) // null: this month, in the agent's timezone
  const [tab, setTab] = React.useState("actions")
  const { impact, error, isLoading, mutate } = useAgentImpact(agentId, month)

  const now = currentMonth()
  const shown = month ?? impact?.month ?? now
  const isCurrent = month === null
  const oldest = shiftMonth(now, -OLDEST_BACK)
  const step = (by) => {
    const next = shiftMonth(shown, by)
    setMonth(next >= now ? null : next)
  }

  if (error && !impact) {
    return (
      <Surface className={className}>
        <ErrorState title="Couldn't load the impact figures" description={error.message} onRetry={() => mutate()} />
      </Surface>
    )
  }

  const loading = isLoading || !impact
  const i = impact ?? {}
  const prev = i.prev
  const byCurrency = i.byCurrency ?? []
  const multi = byCurrency.length > 1
  const wastedValue = multi
    ? byCurrency.map((c) => money(c.amount, c.code)).join(" · ")
    : money(i.wasted ?? 0, i.currency ?? byCurrency[0]?.code)
  const counts = i.counts ?? { approved: 0, denied: 0, undone: 0 }

  // The wasted-spend chart plots one currency: the majority one, when the month has several.
  const chartCurrency = i.currency ?? byCurrency[0]?.code ?? null
  const days = i.series ?? []
  const plot = (pick, show) =>
    days.map((d) => {
      const v = pick(d)
      const label = prettyLabel(d.date)
      return { x: label, current: v, tooltipLabel: label, display: show(v) }
    })
  const count = (n) => n.toLocaleString("en-GB")
  const wastedOf = (d) => (multi ? (d.wastedByCurrency?.[chartCurrency] ?? 0) : d.wasted)
  const series = {
    actions: plot((d) => d.actions, count),
    auto: plot((d) => d.auto, count),
    wasted: plot(wastedOf, (v) => money(v, chartCurrency)),
  }

  const metrics = [
    {
      key: "actions",
      label: isCurrent ? "Actions this month" : `Actions in ${monthName(shown, true)}`,
      value: loading ? "" : String(i.actions),
      delta:
        !loading && prev?.actions != null
          ? { change: i.actions - prev.actions, format: "count", comparison: `vs ${monthName(prev.month, true)}` }
          : undefined,
      goodWhen: "neither",
      caption: "changes made in Meta",
      plottable: true,
      series: series.actions,
    },
    {
      key: "auto",
      label: "Done on auto",
      value: loading ? "" : String(i.auto),
      caption: i.actions > 0 ? `${Math.round((i.auto / i.actions) * 100)}% of all actions` : "None yet",
      plottable: true,
      series: series.auto,
    },
    {
      key: "wasted",
      label: "Wasted spend stopped",
      value: loading ? "" : wastedValue,
      caption: multi
        ? `in ${byCurrency.length} currencies; chart shows ${chartCurrency}`
        : "on ads Birdy paused",
      plottable: true,
      series: series.wasted,
    },
    {
      key: "approval",
      label: "Your approval rate",
      value: loading ? "" : i.approvalRate == null ? "—" : `${Math.round(i.approvalRate * 100)}%`,
      caption:
        counts.approved + counts.denied + counts.undone > 0
          ? `${plural(counts.denied, "denial", "denials")}, ${plural(counts.undone, "undo", "undos")}`
          : "Nothing decided yet",
      // A rate has no daily series; the tab carries the figure alone.
      plottable: false,
    },
  ]

  return (
    <MetricTabsChart
      className={className}
      title="Impact"
      action={
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous month"
            disabled={shown <= oldest}
            onClick={() => step(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="min-w-28 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {monthName(shown)}
          </span>
          <Button size="icon-sm" variant="ghost" aria-label="Next month" disabled={isCurrent} onClick={() => step(1)}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      }
      metrics={metrics}
      value={tab}
      onValueChange={setTab}
      loading={loading}
      xLabel="Day of the month"
      redrawKey={shown}
      emptyMessage="Nothing to chart for this month yet."
    />
  )
}
