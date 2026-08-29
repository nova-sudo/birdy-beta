"use client"

import { useMemo, useState } from "react"

import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { LeadsContent } from "@/components/contacts/LeadsContent"
import { LeadHubOverview } from "@/components/contacts/LeadHubOverview"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ClientGroupPicker } from "@/components/saleshub/ClientGroupPicker"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { usePageHeader } from "@/components/page-header"

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

export default function ContactPage() {
  const { clientGroups, loading: groupsLoading, datePreset, setDatePreset } =
    useClientGroups(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")

  const ghlClientGroups = useMemo(
    () => (clientGroups || []).filter((g) => g.ghl_location_id),
    [clientGroups]
  )





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
          <DateRangeSelect value={datePreset} onChange={setDatePreset} />
          <ClientGroupPicker
            clientGroups={ghlClientGroups}
            value={selectedClientGroup}
            onChange={setSelectedClientGroup}
          />
        </div>
      ),
    }),
    [datePreset, setDatePreset, ghlClientGroups, selectedClientGroup]
  )
  usePageHeader(header)


  return (
    <SalesHubShell>
      <LeadHubOverview
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        selectedClientGroup={selectedClientGroup}
      />

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
