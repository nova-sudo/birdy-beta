"use client"

import { useMemo, useState } from "react"

import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { GRANULARITIES } from "@/lib/portfolio-series"
import { useGranularity } from "@/lib/useGranularity"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import { CallCentreOverview } from "@/components/saleshub/CallCentreOverview"
import { ClientGroupSelect } from "@/components/contacts/ClientGroupSelect"
import { PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds"
import { PeriodControl } from "@/app/dashboard/PeriodControl"
import { usePageHeader } from "@/components/page-header"

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
//   carry no time dimension. Its series is counted from the client groups'
//   precomputed daily call series (see useSalesHubSeries).

export default function SalesHubPage() {
  const {
    clientGroups, loading: groupsLoading, error: groupsError, refresh,
    datePreset, setDatePreset,
  } = useClientGroupsWithSeries(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const { granularity, setGranularity } = useGranularity(datePreset)

  // The page's own title is in the PageHeader below; the top bar only names the page.
  const topBar = useMemo(() => ({ title: "Sales Hub" }), [])
  usePageHeader(topBar)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Sales Hub"
        description="Call-centre performance across your Hot Prospector clients"
        period={<PeriodControl value={datePreset} onChange={setDatePreset} />}
        actions={
          <>
            <Select value={granularity} onValueChange={setGranularity}>
              <SelectTrigger size="sm" aria-label="Chart granularity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {GRANULARITIES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ClientGroupSelect
              clientGroups={clientGroups}
              value={selectedClientGroup}
              onChange={setSelectedClientGroup}
            />
          </>
        }
      />

      <CallCentreOverview
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        selectedClientGroup={selectedClientGroup}
        granularity={granularity}
        groupsError={groupsError}
        onRetry={refresh}
      />

      <CallCentreContent
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        showGroupFilter={true}
        showStatCards={false}
        selectedClientGroup={selectedClientGroup}
        onSelectClientGroup={setSelectedClientGroup}
        onCallCentreChanged={refresh}
      />
    </div>
  )
}
