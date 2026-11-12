"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Info, MessageSquareText, Plus } from "lucide-react"
import { Button, EmptyState, ErrorState, Skeleton, Tooltip, TooltipContent, TooltipTrigger, toast } from "@/components/ds"
import { HubEmptyCard, HubSectionHeader } from "@/components/hub/HubCard"
import BirdyAvatar from "@/components/birdy/BirdyAvatar"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"
import { ReportCard } from "./ReportCard"
import { ReportPanel } from "./ReportPanel"
import { useSlackReports } from "./useSlackReports"

const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"

/**
 * Hub → Reports: the account's Slack reports as compact cards, the brief first.
 * A card (or "New report", on the right of the header) opens the report form
 * in a side sheet. With no reports, one empty card carries the button instead.
 */
export function ReportsSection() {
  const { data: slack, error: slackError, isLoading: slackLoading } = useSWR(queryKeys.slackStatus(), fetcher)
  const connected = Boolean(slack?.installed)
  const api = useSlackReports()
  const { data: alertData } = useSWR(connected ? queryKeys.alerts() : null, fetcher)
  const { data: profile } = useSWR(connected ? "/api/user/profile" : null, fetcher)
  const alerts = alertData?.alerts ?? []

  const [panel, setPanel] = useState({ open: false, report: null })
  const openReport = (report) => setPanel({ open: true, report })
  const full = api.reports.length >= api.max

  async function toggle(report, enabled) {
    try {
      await api.setEnabled(report.id, enabled)
    } catch (e) {
      toast.error(e.message || "Couldn't change that report")
    }
  }

  const newReport = (
    <Button variant="outline" size="sm" onClick={() => openReport(null)} disabled={full}>
      <Plus aria-hidden="true" />
      New report
    </Button>
  )

  let body
  if (slackLoading || (connected && api.isLoading)) {
    body = (
      <div className={GRID}>
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-frame" />)}
      </div>
    )
  } else if (slackError || api.error) {
    body = <ErrorState title="Couldn't load your reports" onRetry={api.retry} />
  } else if (!connected) {
    body = (
      <EmptyState
        variant="surface"
        icon={<BirdyAvatar size={56} />}
        title="Connect Slack to get reports"
        description="Birdy posts your daily brief, weekly wrap-ups and alert follow-ups straight into Slack."
        action={<Button asChild variant="primary"><Link href="/settings?tab=integrations">Connect Slack</Link></Button>}
      />
    )
  } else if (api.reports.length === 0) {
    body = (
      <HubEmptyCard
        icon={MessageSquareText}
        title="No reports yet."
        text="Send your live numbers to Slack on a schedule."
        action={newReport}
      />
    )
  } else {
    body = (
      <div className={GRID}>
        {api.reports.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            alerts={alerts}
            defaultChannel={slack?.notify_channel_name ? `${slack.notify_channel_name}` : null}
            onOpen={openReport}
            onToggle={toggle}
          />
        ))}
      </div>
    )
  }

  const hasReports = connected && api.reports.length > 0
  return (
    <section aria-labelledby="hub-reports" className="flex flex-col gap-3">
      <HubSectionHeader
        id="hub-reports"
        title="Reports"
        hint={
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About reports"
                className="inline-flex rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-control-focus"
              >
                <Info aria-hidden className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Slack messages built from your live numbers, on a schedule or when something happens in Birdy</TooltipContent>
          </Tooltip>
        }
        action={hasReports ? newReport : null}
      />
      {body}
      {connected && (
        <ReportPanel
          open={panel.open}
          onOpenChange={(open) => setPanel((p) => ({ ...p, open }))}
          report={panel.report}
          alerts={alerts}
          slack={slack}
          api={api}
          accountTimezone={profile?.timezone}
        />
      )}
    </section>
  )
}
