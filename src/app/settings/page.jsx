"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { usePageHeader } from "@/components/page-header"
import { PageHeader, Skeleton } from "@/components/ds"
import { SectionHeader } from "@/components/settings/SettingsFrame"
import { isPassingThrough } from "@/lib/oauth-handoff"
import { GeneralSection } from "./GeneralSection"
import { IntegrationsSection } from "./IntegrationsSection"
import { TrackingSection } from "./TrackingSection"
import { BillingSection } from "./BillingSection"
import { SETTINGS_TABS, SettingsRail } from "./SettingsRail"
import { useBilling } from "./useBilling"
import { useCapabilities } from "./useCapabilities"
import { useIntegrations } from "./useIntegrations"

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // The tabs were general/integrations/capabilities/account and are now
  // general/integrations/tracking/billing. A bookmarked ?tab= from before would
  // select a section that no longer exists and render an empty page, so old
  // names map to where their content went.
  const TAB_ALIASES = { account: "billing", capabilities: "general" }
  const requestedTab = searchParams.get("tab")
  const urlTab =
    TAB_ALIASES[requestedTab] ??
    // The rail's own list, so a section can't be added there and be missed
    // here; anything else falls back to integrations.
    (SETTINGS_TABS.some((t) => t.key === requestedTab) ? requestedTab : "integrations")

  // Controlled rather than a default, for two reasons: the rail reports the
  // change rather than a Radix trigger doing it, and links into a section (the
  // sidebar credits indicator points at ?tab=billing) are client-side
  // navigations that don't remount this page — an uncontrolled default would
  // leave the reader on whichever section they were already looking at.
  const [tab, setTab] = useState(urlTab)
  useEffect(() => { setTab(urlTab) }, [urlTab])

  // Keep the URL in step so the section survives a reload and can be shared.
  const handleTabChange = (value) => {
    setTab(value)
    router.replace(`/settings?tab=${value}`, { scroll: false })
  }

  // The page's own title is in the PageHeader below; the top bar only names the page.
  const header = useMemo(() => ({ title: "Settings" }), [])
  usePageHeader(header)

  // This load is an integration callback that already knows it is leaving —
  // the wizard parked a return path before the OAuth hop. Everything below
  // still runs (the callback has tokens to bank before it goes), but none of
  // it gets rendered: the early return further down replaces the whole page
  // with a neutral hand-off screen.
  //
  // Read during the first render rather than in an effect, because an effect
  // fires after React has painted — which is precisely the flash of a settings
  // page the user never asked for that this is here to remove. It is safe to
  // read storage this early for the same reason the caches below are: nothing
  // on this route is server-rendered, so there is no hydration pass to
  // disagree with. RootLayout drops the sidebar and top bar on the same flag.
  const [passingThrough, setPassingThrough] = useState(() => isPassingThrough())

  // One hook per section's data. Called in the order the page's effects used to
  // run in: billing, capabilities, then the integration probe.
  const billing = useBilling()
  const caps = useCapabilities()
  const integrations = useIntegrations({ router, searchParams, setPassingThrough })

  // Passing through on the way back to the wizard. The settings page is not
  // this user's destination and showing it — even for the half-second the
  // redirect takes — reads as the app losing its place. A plain spinner on the
  // wizard's own white ground carries straight into the wizard's boot spinner,
  // so the whole hand-off looks like one continuous wait.
  //
  // This is the last render before the redirect lands, not a state anyone sits
  // in: init() has already read the URL and called router.replace by the time
  // its awaits settle. If the redirect somehow never fires, the effect is a
  // spinner rather than a wrong page, and a reload (no callback params in the
  // URL by then) comes back to the real settings page.
  if (passingThrough) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background font-sans" role="status" aria-label="Finishing up">
        <div className="w-full max-w-xl space-y-4 px-6">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto h-8 w-2/3" />
          <Skeleton className="mx-auto h-4 w-1/2" />
        </div>
      </div>
    )
  }

  // Only where something needs attention: an integration whose token has run out.
  const chips = {}
  if (integrations.ghlStatus.token_expired || integrations.facebookStatus.token_expired) {
    chips.integrations = "Expired"
  }

  const active = SETTINGS_TABS.find((t) => t.key === tab) ?? SETTINGS_TABS[0]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Settings" description="Your account, your connected sources and your plan" />

      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start">
        <SettingsRail value={tab} onChange={handleTabChange} chips={chips} />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SectionHeader title={active.label} description={active.description} />

          <div
            id="settings-panel"
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab}`}
            className="flex min-w-0 flex-col gap-4"
          >
            {tab === "general" && (
              <GeneralSection
                slackStatus={integrations.slackStatus}
                setSlackStatus={integrations.setSlackStatus}
                {...caps}
              />
            )}
            {tab === "integrations" && <IntegrationsSection {...integrations} />}
            {tab === "tracking" && <TrackingSection />}
            {tab === "billing" && <BillingSection {...billing} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        // Shaped like the page it stands in for: the heading, the rail beside
        // the section header, and a Frame of rows.
        <div className="flex min-w-0 flex-col gap-6" aria-busy="true">
          <Skeleton className="h-16 w-72" />
          <div className="flex flex-col gap-4 md:flex-row">
            <Skeleton className="h-12 w-full md:h-72 md:w-62 md:shrink-0" />
            <div className="flex flex-1 flex-col gap-4">
              <Skeleton className="h-12 w-64" />
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  )
}
