"use client"

import { useMemo, useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DATE_PRESETS, DEFAULT_DATE_PRESET } from "@/lib/constants"
import { buildSalesInsight, insightPrompt } from "@/lib/saleshub-insight"
import { formatTotal, sumCallStats } from "@/lib/saleshub-totals"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { CALL_CHART_LOADING, LoadingPulse, PdCard, TrendChart } from "@/components/portfolio"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { InsightCard } from "@/components/saleshub/InsightCard"
import { KpiTiles } from "@/components/saleshub/KpiTiles"
import { SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { KPI_PRESENTATION } from "./presentation"
import { useSalesHubSeries } from "./useSalesHubSeries"

// ─── Sales Hub ──────────────────────────────────────────────────────────────
// Call-centre performance across every Hot Prospector client: is the outreach
// happening, and is it working? Built from the "Sales Hub" design handoff in
// design_handoff_hubs/.
//
// Two sources, and the difference between them is worth holding onto:
//
//   Tiles and insight card — summed from the client groups this page already
//   holds, shown exactly as /api/client-groups returned them. Nothing derived.
//
//   Trend chart — the one thing those aggregates cannot give, because they
//   carry no time dimension. Its series is counted from the call logs of every
//   lead in the window, paged through in full, and it reports the total it
//   actually plotted rather than borrowing the tiles'.

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

export default function SalesHubPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [chartMetric, setChartMetric] = useState("calls")

  const totals = useMemo(
    () => sumCallStats(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  )
  const insight = useMemo(() => buildSalesInsight(totals), [totals])

  const { chartMetrics, metrics, loading: seriesLoading } = useSalesHubSeries({
    clientGroups,
    groupsLoading,
    datePreset,
    selectedClientGroup,
  })

  const metric = chartMetrics[chartMetric]
  // The design's subtitle reads "<Date range> · <metric sub>", so the chart
  // always says which window it is drawing.
  const chart = metric && {
    ...metric,
    subtitle: `${presetLabel(datePreset)} · ${metric.subtitle}`,
  }

  return (
    <SalesHubShell
      title="Sales Hub"
      subtitle="Call-centre performance across your Hot Prospector clients"
      action={
        <div className="flex items-center gap-2.5">
          <DateRangeSelect value={datePreset} onChange={setDatePreset} />
          <ClientGroupPicker
            clientGroups={clientGroups}
            value={selectedClientGroup}
            onChange={setSelectedClientGroup}
          />
        </div>
      }
    >
      {/* Chart left, Birdy's read of the period right — the design's 1.65 /
          0.85 split. Stretch, so the right column ends level with the chart. */}
      <div className="mb-[18px] flex flex-col items-stretch gap-[18px] lg:flex-row">
        <div className="flex min-w-0 flex-col lg:flex-[1.65]">
          {seriesLoading || metric?.pending ? (
            <LoadingPulse className="h-[340px] flex-1" statements={CALL_CHART_LOADING} />
          ) : chart?.values?.length > 0 ? (
            <TrendChart
              className="flex-1"
              chart={chart}
              metrics={metrics}
              activeMetric={chartMetric}
              onMetricChange={setChartMetric}
              // Keying on metric + window remounts the paths, which is what
              // makes the draw and fade animations replay on every switch.
              redrawKey={`${chartMetric}-${datePreset}-${selectedClientGroup}`}
            />
          ) : (
            <PdCard className="flex-1" title="Call trend">
              <p className="py-8 text-center text-[12px] text-pd-faint">
                {totals.calls > 0
                  ? "No dated calls in this window yet."
                  : "No calls logged in this window yet."}
              </p>
            </PdCard>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-[14px] lg:flex-[0.85]">
          <InsightCard parts={insight} prompt={insightPrompt(insight)} />
          <KpiTiles
            tiles={KPI_PRESENTATION}
            totals={totals}
            loading={groupsLoading}
            format={formatTotal}
          />
        </div>
      </div>

      <CallCentreContent
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        showGroupFilter={true}
        showStatCards={false}
        selectedClientGroup={selectedClientGroup}
        onSelectClientGroup={setSelectedClientGroup}
      />
    </SalesHubShell>
  )
}
