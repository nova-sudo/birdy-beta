"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/hub/HubShell"
import { Button, EmptyState, ErrorState, PageHeader, SegmentedTabs, Skeleton } from "@/components/ds"
import { AgentSettings } from "@/components/agents/stock/AgentSettings"
import { LessonsList } from "@/components/agents/stock/LessonsList"
import { clientProblems } from "@/components/agents/stock/AlertsFrame"
import { ClientSheet } from "@/components/agents/stock/sheet/ClientSheet"
import { ReportPicker } from "@/components/agents/stock/sheet/ReportPicker"
import { SheetSummary } from "@/components/agents/stock/sheet/SheetSummary"
import { latestCards, moves as movesOf, sheetRows, summary as summaryOf, targetsFor } from "@/components/agents/stock/sheet/rows"
import { toClient } from "@/components/agents/AgentTraining"
import { TurnOn } from "@/components/agents/stock/TurnOn"
import { useAgent } from "@/lib/agents-api"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import {
  STOCK_AGENT_PATH,
  STOCK_SETUP_PATH,
  shortDay,
  useLatestRun,
  useMonth,
  useRun,
  useRuns,
  useStockActions,
  useStockAgent,
} from "@/lib/stock-agent-api"
import { useClientGroups } from "@/lib/useClientGroups"

const TABS = [
  { value: "report", label: "Report" },
  { value: "lessons", label: "Lessons" },
  { value: "settings", label: "Settings" },
]
const PANEL = "media-buying-panel"

/** `?tab=` as one of the three tabs. The old Report and Scoreboard values land on Report. */
const tabOf = (param) => (TABS.some((t) => t.value === param) ? param : "report")

/** A run's window as "3 Nov – 9 Nov", from its cards. */
function rangeOf(cards) {
  const w = cards.find((c) => c.window?.start && c.window?.end)?.window
  return w ? `${shortDay(w.start)} – ${shortDay(w.end)}` : null
}

/** What sits in the Report panel when there is no sheet to show: the old page's empty, error and loading states. */
function ReportState({ agent, reportError, latest, runParam, onRetry, onLatest }) {
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
    return agent.turned_off_at && agent.status !== "active" ? (
      <EmptyState
        variant="surface"
        title="This agent is turned off"
        description="It isn't checking your clients, so no report is coming. Turn it on to carry on from where it was."
        action={<TurnOn agent={agent} />}
      />
    ) : agent.status === "draft" ? (
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
  const monthParam = searchParams?.get("month") ?? null
  // ?month= and ?run= never stand together; a month wins.
  const runParam = monthParam ? null : (searchParams?.get("run") ?? null)
  const tab = tabOf(searchParams?.get("tab"))

  const { agent: listed, listUnavailable, error: listError, isLoading: listLoading, mutate: mutateList } = useStockAgent()
  const agentId = listed?.id
  const { agent: full } = useAgent(agentId)
  const agent = full ?? listed
  const actions = useStockActions(agentId)
  const latest = useLatestRun(agentId)
  const runId = monthParam ? null : (runParam ?? latest.run?.id)
  const { report, error: reportError, mutate: mutateReport } = useRun(agentId, runId)
  const month = useMonth(agentId, monthParam)
  const { runs } = useRuns(agentId)
  const { clientGroups, loading: clientsLoading, error: clientsError, refresh: refreshClients } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const batches = agent?.settings?.batches ?? []

  const view = monthParam ? "month" : runParam && runParam !== latest.run?.id ? "past" : "today"

  const section = TABS.find((t) => t.value === tab).label
  const topBar = useMemo(() => ({ title: <SalesHubHeaderTitle title="Birdy Media Buying Agent" subtitle={section} /> }), [section])
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

  const sheet = useMemo(() => {
    const cards = report?.cards ?? []
    const run = report?.run
    const alerts = (run?.alerts ?? []).filter((a) => a && typeof a === "object")
    const nameOf = (gid) => cards.find((c) => c.client_group_id === gid)?.client_name ?? clientGroups.find((c) => c.id === gid)?.name ?? "A client"
    const problems = run ? clientProblems(run, nameOf).map((p) => ({ ...p, name: nameOf(p.gid) })) : []
    const settings = agent?.settings
    const currency = settings?.zones?.currency ?? null
    const targetsOf = (gid, cur) => targetsFor(settings, gid, cur)
    const latestByClient = { ...latestCards(runs), ...Object.fromEntries(cards.map((c) => [c.client_group_id, { card_id: c.id, run_id: c.run_id ?? run?.id }])) }
    const inScope = (agent?.scope?.client_group_ids ?? []).map((id) => ({ id, name: nameOf(id) }))
    const rows =
      view === "month"
        ? sheetRows({ monthRows: month.rows, latestByClient, targetsOf, currency })
        : sheetRows({
            cards,
            alerts,
            problems,
            clientsInScope: view === "today" ? inScope : [],
            latestByClient,
            readOnly: view !== "today" || run?.kind === "preview",
            targetsOf,
            currency,
          })
    return {
      rows,
      alerts,
      summary: summaryOf(cards, alerts, problems),
      moves: view === "month" ? null : movesOf(cards, (c) => targetsOf(c.client_group_id, c.currency)),
      range: view === "month" ? month.range : rangeOf(cards),
    }
  }, [report, month.rows, month.range, runs, clientGroups, agent, view])

  const hasSheet = view === "month" ? Boolean(month.month) || month.rows.length > 0 : Boolean(report)

  // The client whose chat is open, by group id. A past report or month picked closes it.
  const [openGid, setOpenGid] = useState(null)
  useEffect(() => setOpenGid(null), [runId, monthParam])

  // ?client= (a gid, a name or a slug, as Slack links send) opens that client's chat once, then leaves the URL.
  const clientParam = searchParams?.get("client") ?? null
  const handledClient = useRef(null)
  useEffect(() => {
    if (!clientParam || !hasSheet || handledClient.current === clientParam) return
    handledClient.current = clientParam
    const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const hit = sheet.rows.find((r) => r.gid === clientParam || slug(r.name) === slug(clientParam))
    if (hit?.cardId) setOpenGid(hit.gid)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("client")
    const query = params.toString()
    router.replace(query ? `${STOCK_AGENT_PATH}?${query}` : STOCK_AGENT_PATH)
  }, [clientParam, hasSheet, sheet.rows, searchParams, router])

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "BirdyHub", href: "/hub" }}
        title="Birdy Media Buying Agent"
        description="Checks your clients every morning and drafts changes for you"
        actions={
          agentId ? (
            <ReportPicker
              agentId={agentId}
              value={monthParam ? { month: monthParam } : { run: runId ?? undefined }}
              current={report?.run ?? (runParam ? null : latest.run)}
              latestId={latest.run?.id}
              batches={batches}
              onPick={(pick) => goTo({ run: pick.run ?? null, month: pick.month ?? null, tab: null })}
            />
          ) : null
        }
      />
      {!listed ? (
        listError || listUnavailable ? (
          <ErrorState title="Couldn't load your agent" description={listError?.message ?? "Birdy couldn't read your agents. Try again in a moment."} onRetry={() => mutateList()} />
        ) : (
          <Skeleton className="h-96 w-full rounded-frame" />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs ariaLabel="Agent sections" panelId={PANEL} value={tab} onValueChange={(value) => goTo({ tab: value === "report" ? null : value })} items={TABS} />
            {tab === "report" && hasSheet && (
              <SheetSummary view={view} summary={sheet.summary} moves={sheet.moves} range={sheet.range} onToday={() => goTo({ run: null, month: null })} />
            )}
          </div>

          {/* Every panel stays mounted, so an open chat survives a tab switch. */}
          <div id={PANEL} role="tabpanel" aria-labelledby={`${PANEL}-tab-report`} hidden={tab !== "report"}>
            {hasSheet ? (
              <ClientSheet rows={sheet.rows} view={view} onOpen={(row) => setOpenGid(row.gid)} />
            ) : view === "month" ? (
              month.error ? <ErrorState title="Couldn't load this month" description={month.error.message} onRetry={() => month.mutate()} /> : <Skeleton className="h-96 w-full rounded-frame" />
            ) : (
              <ReportState
                agent={agent}
                reportError={reportError}
                latest={latest}
                runParam={runParam}
                onRetry={() => (runId ? mutateReport() : latest.mutate())}
                onLatest={() => goTo({ run: null })}
              />
            )}
          </div>
          <div role="tabpanel" aria-labelledby={`${PANEL}-tab-lessons`} hidden={tab !== "lessons"}>
            <LessonsList agentId={agentId} actions={actions} nameOf={(gid) => clientGroups.find((c) => c.id === gid)?.name ?? "A client"} />
          </div>
          <div role="tabpanel" aria-labelledby={`${PANEL}-tab-settings`} hidden={tab !== "settings"}>
            {clientsError ? (
              <ErrorState title="Couldn't load your clients" description={String(clientsError)} onRetry={() => refreshClients()} />
            ) : full && !clientsLoading ? (
              <AgentSettings key={full.id} agent={full} clients={clientGroups.map(toClient)} actions={actions} />
            ) : (
              <Skeleton className="h-96 w-full max-w-3xl rounded-frame" />
            )}
          </div>
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
