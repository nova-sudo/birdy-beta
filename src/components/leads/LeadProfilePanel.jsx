"use client"

import { useState } from "react"
import { PdSegmented } from "@/components/portfolio"
import { LeadProfileTab } from "./LeadProfileTab"
import { LeadAdsTab } from "./LeadAdsTab"
import { LeadCallsTab } from "./LeadCallsTab"
import { LeadJourneyTab } from "./LeadJourneyTab"

// ─── Lead detail: left column ───────────────────────────────────────────────
// The Profile · Journey · Calls · Ads tabs as a pill segment (redesign option
// A). The name and status live in LeadHeader above. The page owns the Journey
// fetch; this only says when the tab is opened.

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "journey", label: "Journey" },
  { key: "calls", label: "Calls" },
  { key: "ads", label: "Ads" },
]

const PANEL_ID = "lead-profile-panel"

export function LeadProfilePanel({ detail, messageCount = 0, summary = null, journey = null, journeyStatus = "loading", onJourneyOpen, onJourneyRetry }) {
  const [tab, setTab] = useState("profile")
  const changeTab = (key) => {
    setTab(key)
    if (key === "journey") onJourneyOpen?.()
  }

  return (
    <section
      aria-label="Lead details"
      className="border-b border-pd-divider bg-pd-surface px-5 py-5 lg:border-b-0 lg:border-r md:px-6"
    >
      <PdSegmented
        options={TABS}
        value={tab}
        onChange={changeTab}
        label="Lead details"
        role="tablist"
        panelId={PANEL_ID}
        className="isolate bg-pd-canvas"
        itemClassName="flex-1 py-[7px]"
      />

      <div id={PANEL_ID} role="tabpanel" className="pt-5">
        {tab === "profile" && <LeadProfileTab detail={detail} messageCount={messageCount} summary={summary} />}
        {tab === "journey" && <LeadJourneyTab journey={journey} status={journeyStatus} onRetry={onJourneyRetry} />}
        {tab === "ads" && <LeadAdsTab attribution={detail.attribution} />}
        {tab === "calls" && <LeadCallsTab calls={detail.calls} />}
      </div>
    </section>
  )
}
