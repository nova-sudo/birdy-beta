"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { usePageHeader } from "@/components/page-header"
import { pdFontClass } from "@/lib/fonts"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PageTabs } from "@/components/portfolio"
import { Skeleton } from "@/components/ui/skeleton"
import { isPassingThrough } from "@/lib/oauth-handoff"
import { GeneralSection } from "./GeneralSection"
import { IntegrationsSection } from "./IntegrationsSection"
import { TrackingSection } from "./TrackingSection"
import { BillingSection } from "./BillingSection"
import { useBilling } from "./useBilling"
import { useCapabilities } from "./useCapabilities"
import { useIntegrations } from "./useIntegrations"

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // The tabs were general/integrations/capabilities/account and are now
  // general/integrations/billing. A bookmarked ?tab= from before would select
  // a tab that no longer exists and render an empty page, so old names map to
  // where their content went.
  const TAB_ALIASES = { account: "billing", capabilities: "general" }
  const requestedTab = searchParams.get("tab")
  const urlTab =
    TAB_ALIASES[requestedTab] ??
    // Kept in step with SETTINGS_TABS below — they are two separate lists, and a
    // tab missing from this one silently falls back to integrations.
    (["general", "integrations", "tracking", "billing"].includes(requestedTab)
      ? requestedTab
      : "integrations")

  // Radix still swaps the panels; the strip above them is the app's shared
  // page tab bar, so Settings stops carrying its own unstyled TabsList.
  //
  // Controlled rather than defaultValue, for two reasons: PageTabs reports the
  // change rather than a Radix trigger doing it, and links into a tab (the
  // sidebar credits indicator points at ?tab=billing) are client-side
  // navigations that don't remount this page — an uncontrolled default would
  // leave the reader on whichever tab they were already looking at.
  const [tab, setTab] = useState(urlTab)
  useEffect(() => { setTab(urlTab) }, [urlTab])

  const SETTINGS_TABS = [
    { key: "general", label: "General" },
    { key: "integrations", label: "Integrations" },
    { key: "tracking", label: "Tracking" },
    { key: "billing", label: "Billing" },
  ]

  // Keep the URL in step so the tab survives a reload and can be shared.
  const handleTabChange = (value) => {
    setTab(value)
    router.replace(`/settings?tab=${value}`, { scroll: false })
  }

  // Title in the global top bar, in place of the Birdy wordmark — the same
  // place every other redesigned page puts it. No controls: this page's tabs
  // are its own navigation, not a filter over shared data.
  const header = useMemo(
    () => ({
      title: (
        <div className={`${pdFontClass} min-w-0`}>
          <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
            Settings
          </h1>
          <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">
            Your account, your connected sources and your plan
          </p>
        </div>
      ),
    }),
    []
  )
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

  // One hook per tab's data. Called in the order the page's effects used to
  // run in: billing, capabilities, then the integration probe.
  const billing = useBilling()
  const caps = useCapabilities()
  const integrations = useIntegrations({ router, searchParams, setPassingThrough })

  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) } catch { return null }
  })

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
      <div className={`${pdFontClass} flex min-h-dvh items-center justify-center bg-white`} role="status" aria-label="Finishing up">
        <div className="w-full max-w-[600px] space-y-4 px-6">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto h-8 w-2/3" />
          <Skeleton className="mx-auto h-4 w-1/2" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto">
      <div>
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <div className={pdFontClass}>
            <PageTabs
              label="Settings section"
              tabs={SETTINGS_TABS}
              value={tab}
              onChange={handleTabChange}
            />
          </div>

          <TabsContent value="general" className="space-y-6">
            <GeneralSection
              slackStatus={integrations.slackStatus}
              setSlackStatus={integrations.setSlackStatus}
              {...caps}
            />
          </TabsContent>

          <TabsContent value="integrations" className={`${pdFontClass} space-y-6`}>
            <IntegrationsSection {...integrations} />
          </TabsContent>


          <TabsContent value="tracking" className="space-y-6">
            <TrackingSection />
          </TabsContent>

          <TabsContent value="billing" className={pdFontClass}>
            <BillingSection {...billing} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        // Shaped like the page it stands in for: the tab strip, then two
        // cards side by side and a wider one beneath, as the General tab lays
        // them out.
        <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto space-y-6">
          <Skeleton className="h-10 w-80 rounded-full" />
          <div className="grid gap-[18px] lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
          <Skeleton className="h-44 max-w-[900px]" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  )
}