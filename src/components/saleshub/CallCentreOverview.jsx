"use client"

// components/saleshub/CallCentreOverview.jsx
// The chart + insight + KPI row that sits above the call-centre table.
//
// Extracted from the Sales Hub page so /clients/[id]'s Call Centre tab can
// draw the same thing scoped to one client. It was page-only, which is why
// that tab showed a bare table while the Marketing tab — whose equivalent row
// lives inside MarketingContent — looked finished.

import { useMemo, useState } from "react"
import { CALL_CHART_LOADING, LoadingPulse, PdCard, TrendChart } from "@/components/portfolio"
import { InsightCard } from "@/components/saleshub/InsightCard"
import { KpiTiles } from "@/components/saleshub/KpiTiles"
import { buildSalesInsight, insightPrompt } from "@/lib/saleshub-insight"
import { formatTotal, sumCallStats } from "@/lib/saleshub-totals"
import { DATE_PRESETS } from "@/lib/constants"
import { KPI_PRESENTATION } from "@/app/Sales-Hub/presentation"
import { useSalesHubSeries } from "@/app/Sales-Hub/useSalesHubSeries"

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

export function CallCentreOverview({
  clientGroups,
  groupsLoading,
  datePreset,
  selectedClientGroup = "all",
}) {
  const [chartMetric, setChartMetric] = useState("calls")

  const totals = useMemo(
    () => sumCallStats(clientGroups, selectedClientGroup, datePreset),
    [clientGroups, selectedClientGroup, datePreset]
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
  )
}
