"use client"

import { Suspense, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/hub/HubShell"
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ds"
import { MorningReport } from "@/components/agents/stock/MorningReport"
import { ScoreboardTab } from "@/components/agents/stock/Scoreboard"
import { AgentSettings } from "@/components/agents/stock/AgentSettings"
import { LessonsList } from "@/components/agents/stock/LessonsList"
import { toClient } from "@/components/agents/AgentTraining"
import { useAgent } from "@/lib/agents-api"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { STOCK_AGENT_PATH, STOCK_SETUP_PATH, runLabel, useLatestRun, useRun, useRuns, useStockActions, useStockAgent } from "@/lib/stock-agent-api"
import { useClientGroups } from "@/lib/useClientGroups"

const TABS = [
  { value: "report", label: "Report" },
  { value: "scoreboard", label: "Scoreboard" },
  { value: "lessons", label: "Lessons" },
  { value: "settings", label: "Settings" },
]

/** Past reports by date. The open report is always listed, so a Slack link to an old one still reads right. */
function ReportPicker({ agentId, current, batches, onPick }) {
  const { runs, hasOlder, loadOlder, error, mutate } = useRuns(agentId)
  const options = current && !runs.some((r) => r.id === current.id) ? [current, ...runs] : runs
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {options.length > 0 && (
        <Select value={current?.id ?? ""} onValueChange={onPick}>
          <SelectTrigger aria-label="Report date" className="w-56 max-w-full">
            <SelectValue placeholder="Pick a date">{current ? runLabel(current, batches) : undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((r) => (
              <SelectItem key={r.id} value={r.id}>{runLabel(r, batches)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {hasOlder && <Button size="sm" variant="ghost" onClick={loadOlder}>Older reports</Button>}
      {error && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          Couldn&apos;t load past reports.
          <Button size="sm" variant="ghost" onClick={() => mutate()}>Retry</Button>
        </span>
      )}
    </div>
  )
}

function ReportTab({ agent, report, reportError, latest, runParam, clients, batches, actions, onRetry, onLatest, onSeeScoreboard }) {
  // Data first: a failed background refetch must not cover a good report with an error screen.
  if (report) {
    return (
      <MorningReport
        key={report.run.id}
        report={report}
        clients={clients}
        batches={batches}
        actions={actions}
        slackChannel={agent.settings?.slack?.channel_id}
        preview={report.run.kind === "preview"}
        onSeeScoreboard={onSeeScoreboard}
      />
    )
  }
  const error = reportError ?? (runParam ? null : latest.error)
  if (error && runParam && error.status === 404) {
    // Trying the same address again can't help, so the way out is the latest report.
    return (
      <div className="flex flex-col items-center gap-3">
        <ErrorState title="Couldn't load this report" description={error.message} />
        <Button onClick={onLatest}>Open the latest report</Button>
      </div>
    )
  }
  if (error) return <ErrorState title="Couldn't load this report" description={error.message} onRetry={onRetry} />
  if (!runParam && !latest.run && !latest.isLoading) {
    return agent.status === "draft" ? (
      <EmptyState
        variant="surface"
        title="Finish setting up your agent"
        description="Your first report comes once the agent is on."
        action={
          <Button asChild variant="primary">
            <Link href={STOCK_SETUP_PATH}>Finish setup</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState variant="surface" title="No report yet" description="Your first one appears after the next scheduled check." />
    )
  }
  return <Skeleton className="h-96 w-full rounded-frame" />
}

function StockAgentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const runParam = searchParams?.get("run") ?? null
  const tabParam = searchParams?.get("tab")
  const tab = TABS.some((t) => t.value === tabParam) ? tabParam : "report"

  const { agent: listed, listUnavailable, error: listError, isLoading: listLoading, mutate: mutateList } = useStockAgent()
  const agentId = listed?.id
  const { agent: full } = useAgent(agentId)
  const actions = useStockActions(agentId)
  const latest = useLatestRun(agentId)
  const runId = runParam ?? latest.run?.id
  const { report, error: reportError, mutate: mutateReport } = useRun(agentId, runId)
  const { clientGroups, loading: clientsLoading, error: clientsError, refresh: refreshClients } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const batches = (full ?? listed)?.settings?.batches ?? []

  const topBar = useMemo(() => ({ title: <SalesHubHeaderTitle title="Birdy Media Buying Agent" subtitle="Morning report" /> }), [])
  usePageHeader(topBar)

  // Only a list that really came back empty means no agent: a misrouted API must not send a live agent to setup.
  const noAgent = !listed && !listLoading && !listError && !listUnavailable
  useEffect(() => {
    if (noAgent) router.replace(STOCK_SETUP_PATH)
  }, [noAgent, router])

  const goTo = (changes) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const query = params.toString()
    router.push(query ? `${STOCK_AGENT_PATH}?${query}` : STOCK_AGENT_PATH)
  }
  const nameOf = (gid) => clientGroups.find((c) => c.id === gid)?.name ?? "A client"

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader backButton={{ label: "BirdyHub", href: "/hub" }} title="Birdy Media Buying Agent" />
      {!listed ? (
        listError || listUnavailable ? (
          <ErrorState title="Couldn't load your agent" description={listError?.message ?? "Birdy couldn't read your agents. Try again in a moment."} onRetry={() => mutateList()} />
        ) : (
          <Skeleton className="h-96 w-full rounded-frame" />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs ariaLabel="Agent sections" value={tab} onValueChange={(value) => goTo({ tab: value === "report" ? null : value })} items={TABS} />
            {tab === "report" && (
              <ReportPicker agentId={agentId} current={report?.run ?? (runParam ? null : latest.run)} batches={batches} onPick={(id) => goTo({ run: id })} />
            )}
          </div>
          {tab === "report" && (
            <ReportTab
              agent={full ?? listed}
              report={report}
              reportError={reportError}
              latest={latest}
              runParam={runParam}
              clients={clientGroups}
              batches={batches}
              actions={actions}
              onRetry={() => (runId ? mutateReport() : latest.mutate())}
              onLatest={() => goTo({ run: null })}
              onSeeScoreboard={() => goTo({ tab: "scoreboard" })}
            />
          )}
          {tab === "scoreboard" && <ScoreboardTab agentId={agentId} actions={actions} nameOf={nameOf} />}
          {tab === "lessons" && <LessonsList agentId={agentId} actions={actions} nameOf={nameOf} />}
          {tab === "settings" &&
            (clientsError ? (
              <ErrorState title="Couldn't load your clients" description={String(clientsError)} onRetry={() => refreshClients()} />
            ) : full && !clientsLoading ? (
              <AgentSettings key={full.id} agent={full} clients={clientGroups.map(toClient)} actions={actions} />
            ) : (
              <Skeleton className="h-96 w-full max-w-3xl rounded-frame" />
            ))}
        </>
      )}
    </div>
  )
}

export default function StockAgentReportPage() {
  return (
    <Suspense fallback={null}>
      <StockAgentPage />
    </Suspense>
  )
}
