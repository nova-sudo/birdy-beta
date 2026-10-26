"use client"

// components/contacts/LeadHubOverview.jsx
// The hero above the leads table: the six figures as tabs over the trend of
// whichever is selected, with Birdy's briefing beside it.
//
// Extracted from the Lead Hub page so /clients/[id]'s Leads tab can draw the
// same thing scoped to one client. It was page-only, which is why that tab
// showed a bare table while the Marketing tab — whose equivalent row lives
// inside MarketingContent — looked finished.

import { useEffect, useMemo, useState } from "react"
import { apiRequest } from "@/lib/api"
import { presetToDateRange } from "@/lib/date-utils"
import { buildLeadFindings, buildLeadInsight, insightPrompt } from "@/lib/leadhub-insight"
import {
  formatStat,
  mergeDailyLeads,
  previousLeadTotals,
  windowLeadTotals,
} from "@/lib/leadhub-totals"
import { percentDelta } from "@/lib/portfolio-aggregate"
import { BirdyRead, ErrorState, MetricTabsChart, fromPortfolioTabs } from "@/components/ds"
import { KPI_PRESENTATION, toLeadFindings, toTrendSeries } from "@/app/contacts/presentation"
import { useLeadHubSeries } from "@/app/contacts/useLeadHubSeries"

/**
 * @param {string} [granularity] Daily | Weekly | Monthly, from the hub's
 *   granularity chip. Omitted — as it is on /clients/[id], which carries no
 *   chip — the date window picks for itself. See useLeadHubSeries.
 */
export function LeadHubOverview({
  clientGroups,
  groupsLoading,
  datePreset,
  selectedClientGroup = "all",
  granularity,
  groupsError,
  onRetry,
}) {
  // The selected tab is a figure key (KPI_PRESENTATION), not a series key —
  // the figure is what the user clicked; which series it plots is its business.
  const [activeKey, setActiveKey] = useState(KPI_PRESENTATION[0].key)

  const ghlClientGroups = useMemo(
    () => (clientGroups || []).filter((g) => g.ghl_location_id),
    [clientGroups]
  )

  const dailyRows = useMemo(
    () => mergeDailyLeads(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  )
  const totals = useMemo(
    () => windowLeadTotals(dailyRows, datePreset),
    [dailyRows, datePreset]
  )
  const previousTotals = useMemo(
    () => previousLeadTotals(dailyRows, datePreset),
    [dailyRows, datePreset]
  )
  const deltas = useMemo(() => {
    if (!previousTotals) return undefined
    return KPI_PRESENTATION.reduce((acc, tile) => {
      const d = percentDelta(totals[tile.key], previousTotals[tile.key], tile.polarity)
      if (d) acc[tile.key] = d
      return acc
    }, {})
  }, [totals, previousTotals])

  // The briefing's no-email finding — the one figure the daily series can't
  // give, so it stays a live fetch, scoped to the same window and group.
  const [anomaly, setAnomaly] = useState(null)
  useEffect(() => {
    if (ghlClientGroups.length === 0) {
      setAnomaly(null)
      return
    }
    let cancelled = false
    const groupsParam = selectedClientGroup !== "all" ? selectedClientGroup : ""
    const { start_date, end_date } = presetToDateRange(datePreset)
    const qs = new URLSearchParams({ groups: groupsParam, page: "1", limit: "1" })
    if (start_date) qs.set("start_date", start_date)
    if (end_date) qs.set("end_date", end_date)

    apiRequest(`/api/leads/unified?${qs.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setAnomaly(data?.meta?.stats?.top_missing_email_group ?? null)
      })
      .catch(() => { if (!cancelled) setAnomaly(null) })

    return () => { cancelled = true }
  }, [ghlClientGroups.length, selectedClientGroup, datePreset])

  const insight = useMemo(
    () => buildLeadInsight(totals, previousTotals),
    [totals, previousTotals]
  )
  const findings = useMemo(
    () => buildLeadFindings({ clientGroups, selectedClientGroup, datePreset, anomaly }),
    [clientGroups, selectedClientGroup, datePreset, anomaly]
  )

  const { chartMetrics, loading: seriesLoading } = useLeadHubSeries({
    clientGroups,
    groupsLoading,
    datePreset,
    selectedClientGroup,
    granularity,
  })

  // Every figure carries its own series, so switching tabs needs no refetch.
  // Too short to draw is withheld, but counted, so the empty message can say
  // "too short" rather than "nothing".
  const metrics = useMemo(() => {
    const tabs = KPI_PRESENTATION.map((tile) => ({
      key: tile.key,
      label: tile.label,
      value: formatStat(tile.key, totals[tile.key]),
      polarity: tile.polarity,
      plottable: Boolean(tile.chartKey),
      ...(deltas?.[tile.key] ?? {}),
    }))
    return fromPortfolioTabs({ tabs, activeKey, chart: null, comparison: "vs previous period" }).map((m) => {
      const source = chartMetrics[KPI_PRESENTATION.find((t) => t.key === m.key)?.chartKey]
      return {
        ...m,
        series: toTrendSeries(source),
        points: source?.values?.length ?? 0,
      }
    })
  }, [totals, deltas, chartMetrics, activeKey])

  const activeMetric = metrics.find((m) => m.key === activeKey)
  const activeSource = chartMetrics[KPI_PRESENTATION.find((t) => t.key === activeKey)?.chartKey]
  const hasCaptures = totals.lead_count + totals.contact_count > 0
  const insightText = insight.map((p) => p.text).join("")
  const readRows = useMemo(
    () => toLeadFindings(insight, findings, { empty: !hasCaptures }),
    [insight, findings, hasCaptures]
  )

  // See CallCentreOverview: zeroes from an empty list are indistinguishable
  // from a genuinely quiet window unless the failure is stated.
  if (groupsError) {
    return (
      <ErrorState
        title="Couldn't load your client data"
        description={`${String(groupsError).replace(/\.+$/, "")}. The figures here are missing, not zero.`}
        onRetry={onRetry}
      />
    )
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <MetricTabsChart
        metrics={metrics}
        value={activeKey}
        onValueChange={setActiveKey}
        xLabel={`${activeMetric?.label ?? "Metric"} over the period`}
        loading={groupsLoading}
        plotLoading={seriesLoading || Boolean(activeSource?.pending)}
        emptyMessage={
          activeMetric?.points === 1
            ? "Pick 7 days or longer to see a trend."
            : hasCaptures
              ? "No dated leads in this window yet."
              : "No leads captured in this window yet."
        }
      />
      <BirdyRead findings={readRows} empty={insightText} prompt={insightPrompt(insight)} />
    </div>
  )
}
