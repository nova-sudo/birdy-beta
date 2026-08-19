"use client"

import { useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { SalesHubShell } from "@/components/saleshub/SalesHubShell"

// ─── Sales Hub ──────────────────────────────────────────────────────────────
// Call-centre performance across every Hot Prospector client: is the outreach
// happening, and is it working? Built from the "Sales Hub" design handoff in
// design_handoff_hubs/.
//
// This file is composition and the state the page's own controls hold. The
// window and the client scope live here rather than in the table below, because
// the design puts both in the header row — above everything they filter — and
// the table is no longer the only thing that reads them.

export default function SalesHubPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")

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
