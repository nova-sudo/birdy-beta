"use client"

import { useMemo, useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import { CallCentreOverview } from "@/components/saleshub/CallCentreOverview"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
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
//   carry no time dimension. Its series is counted from the call logs of every
//   lead in the window, paged through in full, and it reports the total it
//   actually plotted rather than borrowing the tiles'.

export default function SalesHubPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")



  // Title and filters live in the global top bar, where the design puts them —
  // in place of the Birdy wordmark, and beside the bell and profile menu.
  // Memoised because publishing sets state on the provider above: a fresh
  // object every render would republish every render. See usePageHeader.
  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle
          title="Sales Hub"
          subtitle="Call-centre performance across your Hot Prospector clients"
        />
      ),
      controls: (
        <div className="hidden items-center gap-2 md:flex">
          <DateRangeSelect value={datePreset} onChange={setDatePreset} />
          <ClientGroupPicker
            clientGroups={clientGroups}
            value={selectedClientGroup}
            onChange={setSelectedClientGroup}
          />
        </div>
      ),
    }),
    [datePreset, setDatePreset, clientGroups, selectedClientGroup]
  )
  usePageHeader(header)


  return (
    <SalesHubShell>
      <CallCentreOverview
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        selectedClientGroup={selectedClientGroup}
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
