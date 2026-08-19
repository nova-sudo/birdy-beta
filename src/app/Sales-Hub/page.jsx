"use client"

import { useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET, DATE_PRESETS } from "@/lib/constants"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { CALL_CHART_LOADING, LoadingPulse, PdCard, TrendChart } from "@/components/portfolio"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { useSalesHubData } from "./useSalesHubData"

// ─── Sales Hub ──────────────────────────────────────────────────────────────
// Call-centre performance across every Hot Prospector client: is the outreach
// happening, and is it working? Built from the "Sales Hub" design handoff in
// design_handoff_hubs/.
//
// This file is composition and the state the page's own controls hold. The
// window and the client scope live here rather than in the table below, because
// the design puts both in the header row — above everything they filter — and
// the table is no longer the only thing that reads them.

const presetLabel = (preset) =>
  DATE_PRESETS.find((p) => p.value === preset)?.label ?? "Selected period"

export default function SalesHubPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const [chartMetric, setChartMetric] = useState("calls")

  const { chartMetrics, metrics, seriesLoading, hasCalls } = useSalesHubData({
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
      {seriesLoading || metric?.pending ? (
        <LoadingPulse className="mb-[18px] h-[340px]" statements={CALL_CHART_LOADING} />
      ) : chart?.values?.length > 0 ? (
        <TrendChart
          className="mb-[18px]"
          chart={chart}
          metrics={metrics}
          activeMetric={chartMetric}
          onMetricChange={setChartMetric}
          // Keying on metric + window remounts the paths, which is what makes
          // the draw and fade animations replay on every switch.
          redrawKey={`${chartMetric}-${datePreset}-${selectedClientGroup}`}
        />
      ) : (
        <PdCard className="mb-[18px]" title="Call trend">
          <p className="py-8 text-center text-[12px] text-pd-faint">
            {hasCalls
              ? "No dated calls in this window yet."
              : "No calls logged in this window yet."}
          </p>
        </PdCard>
      )}

      <CallCentreContent
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        showGroupFilter={true}
        selectedClientGroup={selectedClientGroup}
        onSelectClientGroup={setSelectedClientGroup}
      />
    </SalesHubShell>
  )
}
