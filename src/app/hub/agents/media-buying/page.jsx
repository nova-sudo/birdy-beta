"use client"

import { Suspense, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSWRConfig } from "swr"
import { ArrowRight, Settings2 } from "lucide-react"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/saleshub/SalesHubShell"
import { Badge, Button, EmptyState, ErrorState, Frame, PageHeader, SegmentedTabs, Skeleton } from "@/components/ds"
import { ActivityTable } from "@/components/agents/ActivityTable"
import { StartOverButton } from "@/components/agents/StartOverButton"
import { AgentTraining, scopeCurrency, toClient } from "@/components/agents/AgentTraining"
import { LearningOffers } from "@/components/agents/GraduationOffer"
import { ImpactTabs } from "@/components/agents/ImpactTabs"
import { LearnedList } from "@/components/agents/LearnedList"
import { PlaybookDraft } from "@/components/agents/PlaybookDraft"
import { ProposalList } from "@/components/agents/ProposalDiff"
import { TrustTable } from "@/components/agents/TrustTable"
import { WorkList } from "@/components/agents/WorkList"
import {
  isAgentImpactKey,
  revalidateAgentLearning,
  useAgent,
  useAgentActivity,
  useAgentConfidence,
  useAgents,
  useAgentWork,
} from "@/lib/agents-api"
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

/**
 * "confidence 91%, up from 82% at launch"; the score alone when there is no launch figure or it
 * has not moved.
 */
function confidenceLine(score, atActivation) {
  if (!Number.isFinite(score)) return null
  const now = Math.round(score)
  if (!Number.isFinite(atActivation)) return `confidence ${now}%`
  const then = Math.round(atActivation)
  if (now === then) return `confidence ${now}%`
  return `confidence ${now}%, ${now > then ? "up" : "down"} from ${then}% at launch`
}

/** The line under the title: what it watches, when it runs and how confident it is. */
function summary(agent, score) {
  const n = agent.scope?.client_group_ids?.length ?? 0
  const at = clockTime(agent.scope?.schedule?.time ?? "07:00")
  return [
    `Watching ${n} ${n === 1 ? "client" : "clients"}`,
    at && `daily at ${at}`,
    confidenceLine(score, agent.confidence?.at_activation),
  ]
    .filter(Boolean)
    .join(" · ")
}

/** Impact for a month over every decision, newest first, 50 at a time. */
function ActivityTab({ agentId }) {
  const { mutate } = useSWRConfig()
  const { items, error, moreError, isLoading, hasMore, loadingMore, loadMore, mutate: mutateActivity } =
    useAgentActivity(agentId)

  // An undo changes the log, the month's figures and (through the brake) the rules and work list.
  const onChanged = useCallback(() => {
    mutateActivity()
    mutate(isAgentImpactKey(agentId))
    revalidateAgentLearning(mutate, agentId)
  }, [mutate, mutateActivity, agentId])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ImpactTabs agentId={agentId} />
      <Frame
        title="Activity"
        description="Every action, who decided, and what happened next"
        footer={
          moreError ? (
            <div role="alert" className="flex flex-wrap items-center justify-center gap-3 text-sm text-danger-ink">
              Couldn&apos;t load more activity.
              <Button size="sm" variant="outline" onClick={() => mutateActivity()}>
                Retry
              </Button>
            </div>
          ) : hasMore ? (
            <Button size="sm" variant="outline" loading={loadingMore} onClick={loadMore}>
              Load more
            </Button>
          ) : undefined
        }
      >
        {error && items.length === 0 ? (
          <ErrorState title="Couldn't load the activity" description={error.message} onRetry={() => mutateActivity()} />
        ) : (
          <ActivityTable agentId={agentId} items={items} loading={isLoading} onChanged={onChanged} />
        )}
      </Frame>
    </div>
  )
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
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant="primary">
            <Link href={SETUP_PATH}>
              {agent ? "Continue setup" : "Set up agent"}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          {agent && <StartOverButton agent={agent} variant="outline" />}
        </div>
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
  const { confidence } = useAgentConfidence(active ? agent.id : null)
  const score = confidence?.score ?? agent?.confidence?.score
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
            <div className="flex min-w-0 flex-col gap-6">
              <LearningOffers agentId={agent.id} />
              <ProposalList agentId={agent.id} currency={currency} clients={clients} />
              <WorkList
                agentId={agent.id}
                empty={`Nothing needs you right now. Birdy checks again tomorrow at ${clockTime(agent.scope?.schedule?.time ?? "07:00") ?? "its usual time"}.`}
              />
            </div>
          )}
          {tab === "playbook" && (
            <div className="flex min-w-0 flex-col gap-6">
              <PlaybookDraft
                agentId={agent.id}
                currency={currency}
                title="Playbook"
                description="Click any value to change it"
              />
              <ProposalList
                agentId={agent.id}
                currency={currency}
                clients={clients}
                title="Suggested changes"
                empty="Nothing to suggest yet. When the same denial reason comes up 3 times in 14 days, Birdy suggests a rule change here."
              />
              <TrustTable agentId={agent.id} />
              <LearnedList agentId={agent.id} />
            </div>
          )}
          {tab === "train" && <AgentTraining agent={agent} clients={clients} />}
          {tab === "activity" && <ActivityTab agentId={agent.id} />}
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
        description={active ? summary(agent, score) : undefined}
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
