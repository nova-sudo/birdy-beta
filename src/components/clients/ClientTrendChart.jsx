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
import { coverageNote } from "@/lib/marketing-aggregate"
import {
  buildClientSeries,
  granularityForRange,
  hasData,
  CLIENT_CHART_METRICS,
} from "@/lib/client-series"

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// A series with gaps still has to draw a continuous line. Holding the last
// known value across a gap is honest here because the tooltip for that bucket
// reads "—" rather than repeating the carried figure.
const carryForward = (values) => {
  let last = 0
  return values.map((v) => {
    if (v == null) return last
    last = v
    return v
  })
}

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

    // Meta's account-level figures for the selected preset — the same numbers
    // the goals strip above this chart and the Marketing Hub both read.
    //
    // The spend headline used to be the sum of the line beneath it, and the
    // two are not the same number: `meta_daily_spend` is a rolling 400-day
    // cache, while the account insight is the whole period. On BBL Body
    // Confidence at All Time the chart summed £3,999 of cached days directly
    // under a goals strip reading £7,814.90 — a page contradicting itself by
    // nearly half. The account figure is the accurate one, so it becomes the
    // headline and the shortfall is stated rather than silently absorbed.
    const insights = group.facebook?.metrics?.insights ?? {}
    const accountSpend = num(insights.spend)
    const accountLeads = num(insights.results) || num(insights.total_leads)

    return CLIENT_CHART_METRICS.reduce((acc, metric) => {
      const s = series[metric.key]
      const plotted = s.values.filter((v) => v != null)
      const plottedTotal = plotted.reduce((sum, v) => sum + v, 0)

      let headline = plottedTotal
      let coverage = null

      if (metric.key === "spend" && accountSpend > 0) {
        headline = accountSpend
        // Only says anything when the line really does cover less than the
        // headline; a preset whose cache spans the whole window renders no
        // note at all.
        coverage = coverageNote(windowed.facebook.daily_spend, plottedTotal, accountSpend)
      } else if (metric.key === "cpl") {
        // CPL is a rate, so its headline is the blended figure over the
        // window, not the sum of per-bucket rates — adding costs per lead
        // together would produce a number that means nothing.
        //
        // Blended from Meta's own spend and results where both exist, which is
        // what makes it agree with the CPL cell in the goals strip. Deriving
        // it from the series instead mixed Meta spend with GHL lead rows and
        // printed £2.01 under a tile reading £2.81.
        headline =
          accountSpend > 0 && accountLeads > 0
            ? accountSpend / accountLeads
            : (() => {
                const spend = series.spend.values.reduce((sum, v) => sum + (v ?? 0), 0)
                const leads = series.leads.values.reduce((sum, v) => sum + (v ?? 0), 0)
                return leads > 0 ? spend / leads : null
              })()
      }

      acc[metric.key] = {
        ...metric,
        ...s,
        // buildChartGeometry does arithmetic on every value, and a gap read as
        // null lands at the bottom of the axis — which draws a dip the client
        // never had. Carry the gaps separately for the tooltip and plot the
        // last known value instead.
        values: carryForward(s.values),
        total: formatValue(metric.key, headline, currencySymbol),
        // Required by TrendChart's tooltips and its screen-reader summary,
        // which indexes into it directly.
        pointValues: s.values.map((v) =>
          v == null ? "—" : formatValue(metric.key, v, currencySymbol)
        ),
        coverage,
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
