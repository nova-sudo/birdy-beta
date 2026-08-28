"use client"

// components/clients/ClientTrendChart.jsx
// The Client Detail overview's trend chart — the same card Sales, Marketing
// and Lead Hub draw, scoped to one client.
//
// Metrics are Leads · Spend · CPL · Closes, per the handoff. CPL declares
// itself a cost metric so the chart colours a rise red: TrendChart tones by
// meaning rather than direction, and without that a climbing cost per lead
// would render as good news in green.

import { useMemo, useState } from "react"
import { CHART_LOADING, LoadingPulse, PdCard, TrendChart } from "@/components/portfolio"
import { presetToDateRange } from "@/lib/date-utils"
import {
  buildClientSeries,
  granularityForRange,
  hasData,
  CLIENT_CHART_METRICS,
} from "@/lib/client-series"

const formatValue = (key, value, currencySymbol) => {
  if (value == null || !Number.isFinite(value)) return "—"
  if (key === "spend") {
    return `${currencySymbol}${Math.round(value).toLocaleString()}`
  }
  if (key === "cpl") {
    return `${currencySymbol}${value.toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`
  }
  return Math.round(value).toLocaleString()
}

export function ClientTrendChart({
  group,
  datePreset,
  currencySymbol = "$",
  loading = false,
}) {
  const [activeMetric, setActiveMetric] = useState("leads")

  const chartMetrics = useMemo(() => {
    if (!group) return {}
    const { start_date, end_date } = presetToDateRange(datePreset)

    // The caches retain far more than the chosen window, so trim before
    // bucketing — otherwise the chart draws 400 days whatever the picker says.
    const inWindow = (rows) =>
      (rows ?? []).filter(
        (d) => (!start_date || d.date >= start_date) && (!end_date || d.date <= end_date)
      )

    const windowed = {
      ...group,
      gohighlevel: {
        ...group.gohighlevel,
        daily_leads: inWindow(group.gohighlevel?.daily_leads),
      },
      facebook: {
        ...group.facebook,
        daily_spend: inWindow(group.facebook?.daily_spend),
      },
    }

    const series = buildClientSeries(windowed, granularityForRange(start_date, end_date))

    return CLIENT_CHART_METRICS.reduce((acc, metric) => {
      const s = series[metric.key]
      const plotted = s.values.filter((v) => v != null)

      // CPL is a rate, so its headline is the blended figure over the window,
      // not the sum of per-bucket rates — adding costs per lead together would
      // produce a number that means nothing.
      const headline =
        metric.key === "cpl"
          ? (() => {
              const spend = series.spend.values.reduce((sum, v) => sum + (v ?? 0), 0)
              const leads = series.leads.values.reduce((sum, v) => sum + (v ?? 0), 0)
              return leads > 0 ? spend / leads : null
            })()
          : plotted.reduce((sum, v) => sum + v, 0)

      acc[metric.key] = {
        ...metric,
        ...s,
        total: formatValue(metric.key, headline, currencySymbol),
        // Rising cost is bad news; TrendChart colours by meaning.
        polarity: metric.key === "cpl" ? "lower" : "higher",
      }
      return acc
    }, {})
  }, [group, datePreset, currencySymbol])

  const chart = chartMetrics[activeMetric]

  if (loading) {
    return <LoadingPulse className="h-[340px]" statements={CHART_LOADING} />
  }

  if (!chart || !hasData(chart)) {
    return (
      <PdCard title="Trend">
        <p className="py-8 text-center text-[12px] text-pd-faint">
          No daily data for this client in this window yet.
        </p>
      </PdCard>
    )
  }

  return (
    <TrendChart
      chart={chart}
      metrics={CLIENT_CHART_METRICS}
      activeMetric={activeMetric}
      onMetricChange={setActiveMetric}
      // Remounting on metric or window replays the draw animation, the same
      // way Sales Hub keys its chart.
      redrawKey={`${activeMetric}-${datePreset}-${group?.id}`}
    />
  )
}
