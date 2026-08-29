"use client"

import { useEffect, useMemo, useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants"
import { apiRequest } from "@/lib/api"
import { presetToDateRange } from "@/lib/date-utils"
import { buildLeadInsight, insightPrompt } from "@/lib/leadhub-insight"
import {
  formatStat,
  mergeDailyLeads,
  previousLeadTotals,
  windowLeadTotals,
} from "@/lib/leadhub-totals"
import { LeadsContent } from "@/components/contacts/LeadsContent"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { GranularitySelect } from "@/components/GranularitySelect"
import { useGranularity } from "@/lib/useGranularity"
import { CHART_LOADING, LoadingPulse, PdCard, TrendChart } from "@/components/portfolio"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { InsightCard } from "@/components/saleshub/InsightCard"
import { KpiTiles } from "@/components/saleshub/KpiTiles"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { usePageHeader } from "@/components/page-header"
import { percentDelta } from "@/lib/portfolio-aggregate"
import { KPI_PRESENTATION } from "./presentation"
import { useLeadHubSeries } from "./useLeadHubSeries"

// ─── Lead Hub ───────────────────────────────────────────────────────────────
// Every lead and contact across every client group: is lead quality holding
// up? Built from the "Lead Hub" design handoff in design_handoff_lead_hub/,
// on the shell/chart/insight/tile components Sales-Hub introduced (see
// SalesHubShell.jsx — generic despite the name, per its own file header).
//
// Chart, insight card and KPI tiles are all summed from the same client-side
// daily lead series (leadhub-totals.js/leadhub-series.js) rather than a live
// fetch — see that file's header for why, and how that also buys real KPI
// deltas with no second request.
//
// The one thing that series can't give: the insight card's anomaly clause
// (which client group has the most contacts with no email captured) is a
// cross-client comparison the backend computes live in get_unified_leads —
// this page makes one lightweight call for it (limit=1, stats only) below.

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

export default function ContactPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [chartMetric, setChartMetric] = useState("leads")
  const { granularity, setGranularity } = useGranularity(datePreset)

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
  // give, so it's the one thing on this page still fetched live. Scoped to
  // the same window/group filter as everything else; re-fetched whenever
  // either changes.
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
      .catch(() => {
        if (!cancelled) setAnomaly(null)
      })
    return () => {
      cancelled = true
    }
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
    granularity,
  })

  // Title and filters live in the global top bar, where the design puts them
  // — see Sales-Hub/page.jsx for the full reasoning and usePageHeader.
  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle
          title="Lead Hub"
          subtitle="Every lead and contact across all client groups"
        />
      ),
      controls: (
        <div className="hidden items-center gap-2 md:flex">
          <GranularitySelect value={granularity} onChange={setGranularity} />
          <DateRangeSelect value={datePreset} onChange={setDatePreset} />
          <ClientGroupPicker
            clientGroups={ghlClientGroups}
            value={selectedClientGroup}
            onChange={setSelectedClientGroup}
          />
        </div>
      ),
    }),
    [granularity, setGranularity, datePreset, setDatePreset, ghlClientGroups, selectedClientGroup]
  )
  usePageHeader(header)

  const metric = chartMetrics[chartMetric]
  const chart = metric && {
    ...metric,
    subtitle: `${presetLabel(datePreset)} · ${metric.subtitle}`,
  }

  return (
    <SalesHubShell>
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
              redrawKey={`${chartMetric}-${datePreset}-${granularity}-${selectedClientGroup}`}
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

      <LeadsContent
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        showStatCards={false}
        selectedClientGroup={selectedClientGroup}
        onSelectClientGroup={setSelectedClientGroup}
      />
    </SalesHubShell>
  )
}
