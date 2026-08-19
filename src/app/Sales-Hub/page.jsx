"use client"

import { useMemo, useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { buildSalesInsight, insightPrompt } from "@/lib/saleshub-insight"
import { formatTotal, sumCallStats } from "@/lib/saleshub-totals"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { InsightCard } from "@/components/saleshub/InsightCard"
import { KpiTiles } from "@/components/saleshub/KpiTiles"
import { SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { KPI_PRESENTATION } from "./presentation"

// ─── Sales Hub ──────────────────────────────────────────────────────────────
// Call-centre performance across every Hot Prospector client: is the outreach
// happening, and is it working? Built from the "Sales Hub" design handoff in
// design_handoff_hubs/.
//
// Every figure here is summed from the client groups this page already holds —
// the windowed call stats /api/client-groups returns for the selected preset.
// The screen fetches nothing of its own and derives nothing: no series, no
// period-over-period comparison, no ranking across clients.
//
// That is why the design's trend chart is absent. It plots four series over the
// window, and this app has no call time-series to plot — building one meant
// pulling call logs and bucketing them, which is derived data by definition.

export default function SalesHubPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")

  const totals = useMemo(
    () => sumCallStats(clientGroups, selectedClientGroup),
    [clientGroups, selectedClientGroup]
  )
  const insight = useMemo(() => buildSalesInsight(totals), [totals])

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
      {/* Birdy's read of the period, over the six figures it is drawn from. */}
      <InsightCard className="mb-[14px]" parts={insight} prompt={insightPrompt(insight)} />
      <KpiTiles
        className="mb-[18px]"
        tiles={KPI_PRESENTATION}
        totals={totals}
        loading={groupsLoading}
        format={formatTotal}
      />

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
