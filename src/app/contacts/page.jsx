"use client"

import { useMemo, useState } from "react"

import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { GRANULARITIES } from "@/lib/portfolio-series"
import { useGranularity } from "@/lib/useGranularity"
import { LeadsContent } from "@/components/contacts/LeadsContent"
import { LeadHubOverview } from "@/components/contacts/LeadHubOverview"
import { ClientGroupSelect } from "@/components/contacts/ClientGroupSelect"
import { PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds"
import { PeriodControl } from "@/app/dashboard/PeriodControl"
import { usePageHeader } from "@/components/page-header"

// ─── Lead Hub ───────────────────────────────────────────────────────────────
// Every lead and contact across every client group: is lead quality holding
// up? Built from the "Lead Hub" design handoff in design_handoff_lead_hub/.
//
// Chart, briefing and hero figures are all summed from the same client-side
// daily lead series (leadhub-totals.js/leadhub-series.js) rather than a live
// fetch — see that file's header for why, and how that also buys real KPI
// deltas with no second request.
//
// The one thing that series can't give: the insight card's anomaly clause
// (which client group has the most contacts with no email captured) is a
// cross-client comparison the backend computes live in get_unified_leads —
// LeadHubOverview makes one lightweight call for it (limit=1, stats only).

export default function ContactPage() {
  const {
    clientGroups, loading: groupsLoading, error: groupsError, refresh,
    datePreset, setDatePreset,
  } = useClientGroupsWithSeries(DEFAULT_DATE_PRESET)
  const [selectedClientGroup, setSelectedClientGroup] = useState("all")
  const { granularity, setGranularity } = useGranularity(datePreset)

  // Only GHL-backed groups can appear in the picker — the rest have no leads
  // to scope to. LeadHubOverview filters the same way for its own fetch.
  const ghlClientGroups = useMemo(
    () => (clientGroups || []).filter((g) => g.ghl_location_id),
    [clientGroups]
  )

  // The page's own title is in the PageHeader below; the top bar only names the page.
  const topBar = useMemo(() => ({ title: "Lead Hub" }), [])
  usePageHeader(topBar)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Lead Hub"
        description="Every lead and contact across all client groups"
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
              clientGroups={ghlClientGroups}
              value={selectedClientGroup}
              onChange={setSelectedClientGroup}
            />
          </>
        }
      />

      <LeadHubOverview
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        selectedClientGroup={selectedClientGroup}
        granularity={granularity}
        groupsError={groupsError}
        onRetry={refresh}
      />

      <LeadsContent
        clientGroups={clientGroups}
        groupsLoading={groupsLoading}
        datePreset={datePreset}
        showStatCards={false}
        selectedClientGroup={selectedClientGroup}
        onSelectClientGroup={setSelectedClientGroup}
      />
    </div>
  )
}
