"use client"

import { Suspense, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, History, Settings2 } from "lucide-react"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/saleshub/SalesHubShell"
import { Badge, Button, EmptyState, ErrorState, PageHeader, SegmentedTabs, Skeleton } from "@/components/ds"
import { AgentTraining, scopeCurrency, toClient } from "@/components/agents/AgentTraining"
import { PlaybookDraft } from "@/components/agents/PlaybookDraft"
import { WorkList } from "@/components/agents/WorkList"
import { useAgent, useAgents, useAgentWork } from "@/lib/agents-api"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { useClientGroups } from "@/lib/useClientGroups"

const AGENT_PATH = "/hub/agents/media-buying"
const SETUP_PATH = "/hub/agents/media-buying/setup"
const PANEL_ID = "agent-tab-panel"

const TABS = ["work", "playbook", "train", "activity"]
const tabOf = (raw) => (TABS.includes(raw) ? raw : "work")

const pickAgent = (list) => (list ?? []).find((a) => a.type === "media_buying") ?? list?.[0] ?? null

/** "7:00 AM" from "07:00". */
function clockTime(hhmm) {
  const [h, m] = String(hhmm ?? "").split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase()
}

/** The line under the title: what it watches and when it runs. */
function summary(agent) {
  const n = agent.scope?.client_group_ids?.length ?? 0
  const at = clockTime(agent.scope?.schedule?.time ?? "07:00")
  return [`Watching ${n} ${n === 1 ? "client" : "clients"}`, at && `daily at ${at}`].filter(Boolean).join(" · ")
}

function NotReady({ agent }) {
  return (
    <EmptyState
      variant="surface"
      icon={Settings2}
      title={agent ? "Finish setting up your agent" : "Set up your Media Buying Agent"}
      description={
        agent
          ? "It isn't switched on yet. Teach it your strategy and check the dry run, then turn it on."
          : "Choose what it watches, teach it how you buy, then turn it on."
      }
      action={
        <Button asChild variant="primary">
          <Link href={SETUP_PATH}>
            {agent ? "Continue setup" : "Set up agent"}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
    />
  )
}

function AgentHome() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = tabOf(searchParams?.get("tab"))
  const setTab = useCallback(
    (value) => router.replace(value === "work" ? AGENT_PATH : `${AGENT_PATH}?tab=${value}`, { scroll: false }),
    [router]
  )

  const { agents, error: listError, isLoading, mutate: mutateAgents } = useAgents()
  const listed = pickAgent(agents)
  const { agent: fetched } = useAgent(listed?.id)
  const agent = fetched ?? listed
  const active = agent?.status === "active"

  const { work } = useAgentWork(active ? agent.id : null)
  const openCount = work.open?.length ?? 0

  const { clientGroups } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const clients = useMemo(() => clientGroups.map(toClient), [clientGroups])
  const currency = agent ? scopeCurrency(clients, agent.scope?.client_group_ids ?? []) : undefined

  const topBar = useMemo(() => ({ title: <SalesHubHeaderTitle title="Media Buying Agent" subtitle="BirdyHub" /> }), [])
  usePageHeader(topBar)

  const tabs = useMemo(
    () => [
      { value: "work", label: "Work list", count: openCount > 0 ? openCount : undefined },
      { value: "playbook", label: "Playbook" },
      { value: "train", label: "Train" },
      { value: "activity", label: "Activity" },
    ],
    [openCount]
  )

  let body
  if (listError) {
    body = <ErrorState title="Couldn't load your agent" description={listError.message} onRetry={() => mutateAgents()} />
  } else if (isLoading) {
    body = <Skeleton className="h-96 w-full rounded-frame" />
  } else if (!active) {
    body = <NotReady agent={agent} />
  } else {
    body = (
      <>
        <SegmentedTabs value={tab} onValueChange={setTab} items={tabs} ariaLabel="Agent" panelId={PANEL_ID} />
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`} className="min-w-0">
          {tab === "work" && (
            <WorkList
              agentId={agent.id}
              empty={`Nothing needs you right now. Birdy checks again tomorrow at ${clockTime(agent.scope?.schedule?.time ?? "07:00") ?? "its usual time"}.`}
            />
          )}
          {tab === "playbook" && (
            <PlaybookDraft
              agentId={agent.id}
              currency={currency}
              title="Playbook"
              description="Click any value to change it"
            />
          )}
          {tab === "train" && <AgentTraining agent={agent} clients={clients} />}
          {tab === "activity" && (
            <EmptyState
              variant="surface"
              icon={History}
              title="Activity arrives soon"
              description="Everything the agent did and what came of it will show here."
            />
          )}
        </div>
      </>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "BirdyHub", href: "/hub" }}
        title="Media Buying Agent"
        titleExtra={
          active ? (
            <Badge tone="success" variant="dot">
              Running
            </Badge>
          ) : undefined
        }
        description={active ? summary(agent) : undefined}
      />
      {body}
    </div>
  )
}

export default function MediaBuyingAgentPage() {
  return (
    <Suspense fallback={null}>
      <AgentHome />
    </Suspense>
  )
}
