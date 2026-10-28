"use client"

import { useState } from "react"
import { UnderlineTabs, toneClass } from "@/components/portfolio"
import { leadTitle, statusPill } from "@/lib/lead-detail"
import { cn } from "@/lib/utils"
import { LeadProfileTab } from "./LeadProfileTab"
import { LeadAdsTab } from "./LeadAdsTab"
import { LeadCallsTab } from "./LeadCallsTab"
import { LeadJourneyTab } from "./LeadJourneyTab"

// ─── Lead detail: left column ───────────────────────────────────────────────
// The lead's name, status pill and client group, then the Profile · Journey ·
// Calls · Ads tabs (mock variant 2a). The page owns the Journey fetch; this
// only says when the tab is opened.

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "journey", label: "Journey" },
  { key: "calls", label: "Calls" },
  { key: "ads", label: "Ads" },
]

// statusPill's tones, said in the kit's tone words.
const PILL_TONE = { won: "success", lost: "danger", open: "amber", neutral: "neutral" }

const PANEL_ID = "lead-profile-panel"

export function LeadProfilePanel({ detail, messageCount = 0, journey = null, journeyStatus = "loading", onJourneyOpen, onJourneyRetry }) {
  const [tab, setTab] = useState("profile")
  const changeTab = (key) => {
    setTab(key)
    if (key === "journey") onJourneyOpen?.()
  }
  const pill = statusPill(detail.opportunities)

  return (
    <section className="overflow-hidden rounded-2xl border border-pd-border bg-pd-surface shadow-sm">
      <header className="px-5 pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-pd-display text-[18px] font-bold leading-tight text-pd-ink">
            {leadTitle(detail.contact)}
          </h1>
          {pill?.label && (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                toneClass(PILL_TONE[pill.tone])
              )}
            >
              {pill.label}
            </span>
          )}
        </div>
        {detail.contact?.group_name && (
          <p className="mt-1 text-[12.5px] text-pd-subtle">{detail.contact.group_name}</p>
        )}
      </header>

      <UnderlineTabs
        tabs={TABS}
        value={tab}
        onChange={changeTab}
        label="Lead details"
        panelId={PANEL_ID}
        className="px-5"
      />

      <div id={PANEL_ID} role="tabpanel" className="px-5 py-5">
        {tab === "profile" && <LeadProfileTab detail={detail} messageCount={messageCount} />}
        {tab === "journey" && <LeadJourneyTab journey={journey} status={journeyStatus} onRetry={onJourneyRetry} />}
        {tab === "ads" && <LeadAdsTab attribution={detail.attribution} />}
        {tab === "calls" && <LeadCallsTab calls={detail.calls} />}
      </div>
    </section>
  )
}
