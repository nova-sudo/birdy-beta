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
import { DATE_PRESETS } from "@/lib/constants"
import { presetToDateRange } from "@/lib/date-utils"
import { buildLeadFindings, buildLeadInsight, insightPrompt } from "@/lib/leadhub-insight"
import {
  formatStat,
  mergeDailyLeads,
  previousLeadTotals,
  windowLeadTotals,
} from "@/lib/leadhub-totals"
import { percentDelta } from "@/lib/portfolio-aggregate"
import { BirdyBriefing, CHART_LOADING, LoadError, MetricTabsChart } from "@/components/portfolio"
import { KPI_PRESENTATION } from "@/app/contacts/presentation"
import { useLeadHubSeries } from "@/app/contacts/useLeadHubSeries"

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

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

  const tabs = useMemo(
    () =>
      KPI_PRESENTATION.map((tile) => ({
        key: tile.key,
        label: tile.label,
        value: formatStat(tile.key, totals[tile.key]),
        tone: tile.tone,
        polarity: tile.polarity,
        plottable: Boolean(tile.chartKey),
        ...(deltas?.[tile.key] ?? {}),
      })),
    [totals, deltas]
  )

  const activeTile = KPI_PRESENTATION.find((tile) => tile.key === activeKey)
  const metric = activeTile?.chartKey ? chartMetrics[activeTile.chartKey] : null
  const chart = metric && {
    ...metric,
    subtitle: `${presetLabel(datePreset)} · ${metric.subtitle}`,
  }

  // See CallCentreOverview: zeroes from an empty list are indistinguishable
  // from a genuinely quiet window unless the failure is stated.
  if (groupsError) {
    return <LoadError className="mb-[18px]" error={groupsError} onRetry={onRetry} />
  }

  return (
    <div className="mb-[18px] grid min-w-0 gap-[14px] lg:grid-cols-[minmax(0,1fr)_320px]">
      <MetricTabsChart
        tabs={tabs}
        activeKey={activeKey}
        onChange={setActiveKey}
        chart={chart}
        loading={groupsLoading}
        plotLoading={seriesLoading || Boolean(metric?.pending)}
        loadingStatements={CHART_LOADING}
        emptyMessage={
          totals.lead_count + totals.contact_count > 0
            ? "No dated leads in this window yet."
            : "No leads captured in this window yet."
        }
        redrawKey={`${activeKey}-${datePreset}-${granularity}-${selectedClientGroup}`}
        layoutId="lead-hub-hero"
      />
      <BirdyBriefing parts={insight} findings={findings} prompt={insightPrompt(insight)} />
    </div>
  )
}
