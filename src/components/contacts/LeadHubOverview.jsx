"use client"

// components/contacts/LeadHubOverview.jsx
// The chart + insight + KPI row that sits above the leads table.
//
// Extracted from the Lead Hub page so /clients/[id]'s Leads tab can draw the
// same thing scoped to one client. It was page-only, which is why that tab
// showed a bare table while the Marketing tab — whose equivalent row lives
// inside MarketingContent — looked finished.

import { useEffect, useMemo, useState } from "react"
import { apiRequest } from "@/lib/api"
import { DATE_PRESETS } from "@/lib/constants"
import { presetToDateRange } from "@/lib/date-utils"
import { buildLeadInsight, insightPrompt } from "@/lib/leadhub-insight"
import {
  formatStat,
  mergeDailyLeads,
  previousLeadTotals,
  windowLeadTotals,
} from "@/lib/leadhub-totals"
import { percentDelta } from "@/lib/portfolio-aggregate"
import { CHART_LOADING, LoadingPulse, PdCard, TrendChart } from "@/components/portfolio"
import { InsightCard } from "@/components/saleshub/InsightCard"
import { KpiTiles } from "@/components/saleshub/KpiTiles"
import { KPI_PRESENTATION } from "@/app/contacts/presentation"
import { useLeadHubSeries } from "@/app/contacts/useLeadHubSeries"

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

export function LeadHubOverview({
  clientGroups,
  groupsLoading,
  datePreset,
  selectedClientGroup = "all",
}) {
  const [chartMetric, setChartMetric] = useState("leads")

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

  // The insight card's anomaly clause — the one figure the daily series can't
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
    () => buildLeadInsight(totals, previousTotals, anomaly),
    [totals, previousTotals, anomaly]
  )

  const { chartMetrics, metrics, loading: seriesLoading } = useLeadHubSeries({
    clientGroups,
    groupsLoading,
    datePreset,
    selectedClientGroup,
  })

  const metric = chartMetrics[chartMetric]
  const chart = metric && {
    ...metric,
    subtitle: `${presetLabel(datePreset)} · ${metric.subtitle}`,
  }

  return (
    <div className="mb-[18px] flex flex-col items-stretch gap-[18px] lg:flex-row">
      <div className="flex min-w-0 flex-col lg:flex-[1.65]">
        {seriesLoading || metric?.pending ? (
          <LoadingPulse className="h-[340px] flex-1" statements={CHART_LOADING} />
        ) : chart?.values?.length > 0 ? (
          <TrendChart
            className="flex-1"
            chart={chart}
            metrics={metrics}
            activeMetric={chartMetric}
            onMetricChange={setChartMetric}
            redrawKey={`${chartMetric}-${datePreset}-${selectedClientGroup}`}
          />
        ) : (
          <PdCard className="flex-1" title="Lead trend">
            <p className="py-8 text-center text-[12px] text-pd-faint">
              {totals.lead_count + totals.contact_count > 0
                ? "No dated leads in this window yet."
                : "No leads captured in this window yet."}
            </p>
          </PdCard>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-[14px] lg:flex-[0.85]">
        <InsightCard parts={insight} prompt={insightPrompt(insight)} />
        <KpiTiles
          tiles={KPI_PRESENTATION}
          totals={totals}
          deltas={deltas}
          loading={groupsLoading}
          format={formatStat}
        />
      </div>
    </div>
  )
}
