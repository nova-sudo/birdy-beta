"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bot, Plus } from "lucide-react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/hub/HubShell"
import { HubCard, HubSectionHeader } from "@/components/hub/HubCard"
import { Button, ErrorState, Skeleton, toast } from "@/components/ds"
import { DashboardList } from "@/components/dashboards/DashboardList"
import { useDashboards } from "@/components/dashboards/useDashboards"
import { ReportsSection } from "@/components/reports/ReportsSection"
import { customAgentPath, useAgentWork, useAgents } from "@/lib/agents-api"
import {
  STOCK_AGENT_PATH,
  STOCK_SETUP_PATH,
  createStockAgent,
  useLatestRun,
  useStockAgent,
} from "@/lib/stock-agent-api"

// ─── BirdyHub ───────────────────────────────────────────────────────────────
// Agents, Dashboards and Reports, in that order. Each section's "New …" button
// sits on the right of its header row; every item is one compact HubCard.

const NEW_CUSTOM_HREF = "/hub/agents/custom/new"
const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
const SECTION = "flex flex-col gap-3"
// Each section after the first is ruled off from the one above.
const DIVIDED = "border-t border-border pt-6"

const decide = (n) => (n > 0 ? (
  <>
    {" · "}
    <span className="font-semibold text-foreground">{n} to decide</span>
  </>
) : null)

/**
 * The Birdy Media Buying Agent's card. Missing: the card creates the agent and
 * opens setup (a 409 means the list was stale, so it reloads). Draft: opens
 * setup. Live or turned off: opens the agent page.
 */
function StockAgentCard({ agent }) {
  const router = useRouter()
  const { mutate } = useAgents()
  const [busy, setBusy] = useState(false)
  // A turned-off agent is a draft with a mark: it has a finished setup and opens its own page.
  const turnedOff = Boolean(agent) && agent.status !== "active" && Boolean(agent.turned_off_at)
  const live = agent?.status === "active"
  const { openCards } = useLatestRun(live ? agent.id : null)

  const setUp = async () => {
    setBusy(true)
    try {
      const created = await createStockAgent()
      await mutate((list) => [...(Array.isArray(list) ? list : []), created], { revalidate: true })
      router.push(STOCK_SETUP_PATH)
    } catch (err) {
      toast.error("Couldn't set up the agent", { description: err?.message })
      // 409: the agent already exists and this list was stale.
      if (err?.status === 409) await mutate()
      setBusy(false)
    }
  }

  const common = {
    icon: Bot,
    title: "Birdy Media Buying Agent",
    tag: "Default",
    line: "Checks your accounts and drafts a change card",
  }
  if (!agent) return <HubCard {...common} onClick={setUp} busy={busy} cue="Set up" />
  if (live) return <HubCard {...common} href={STOCK_AGENT_PATH} status={<>Live{decide(openCards)}</>} />
  if (turnedOff) return <HubCard {...common} href={STOCK_AGENT_PATH} status="Turned off" statusTone="off" />
  return <HubCard {...common} href={STOCK_SETUP_PATH} status="Setting up" statusTone="setting" />
}

/** The agent list has no description, so the line says what the agent watches. */
function customLine(a) {
  if (a.description) return a.description
  const clients = a.scope?.client_group_ids?.length ?? 0
  return clients > 0 ? `Watches ${clients} ${clients === 1 ? "client" : "clients"}` : "Your own rules, on the clients you pick"
}

/** A custom agent's card. Its open work shares `useAgentWork`'s SWR entry with the agent page. */
function CustomAgentCard({ agent }) {
  const live = agent.status === "active"
  const { work } = useAgentWork(live ? agent.id : null)
  const open = Array.isArray(work?.open) ? work.open.length : 0
  return (
    <HubCard
      href={customAgentPath(agent.id)}
      icon={Bot}
      title={agent.name || "Custom agent"}
      line={customLine(agent)}
      status={live ? <>Live{decide(open)}</> : "Setting up"}
      statusTone={live ? "ok" : "setting"}
    />
  )
}

export default function HubPage() {
  const { agents, error, isLoading, mutate } = useAgents()
  const { agent: stock } = useStockAgent()
  const { items: dashboards, isLoading: dashboardsLoading } = useDashboards()
  const [creating, setCreating] = useState(false)
  const custom = agents.filter((a) => a.type === "custom")

  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle
          title="BirdyHub"
          subtitle="Agents that work your ad accounts for you, and dashboards and reports that show what you care about"
        />
      ),
    }),
    [],
  )
  usePageHeader(header)

  return (
    <SalesHubShell>
      <div className="flex flex-col gap-6">
        <section aria-labelledby="hub-agents" className={SECTION}>
          <HubSectionHeader
            id="hub-agents"
            title="Agents"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={NEW_CUSTOM_HREF}>
                  <Plus aria-hidden="true" />
                  New agent
                </Link>
              </Button>
            }
          />
          {error ? (
            <ErrorState
              title="Couldn't load your agents"
              description="Your agents are still there, they just didn't load. Try again."
              onRetry={() => mutate()}
            />
          ) : isLoading ? (
            <div className={GRID} aria-busy="true" aria-label="Loading agents">
              <Skeleton className="h-24 rounded-frame" />
            </div>
          ) : (
            <div className={GRID}>
              <StockAgentCard agent={stock} />
              {custom.map((a) => (
                <CustomAgentCard key={a.id} agent={a} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="hub-dashboards" className={`${SECTION} ${DIVIDED}`}>
          <HubSectionHeader
            id="hub-dashboards"
            title="Dashboards"
            action={
              // With no dashboards the empty card carries the button instead.
              dashboardsLoading || dashboards?.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                  <Plus aria-hidden="true" />
                  New dashboard
                </Button>
              ) : null
            }
          />
          <DashboardList creating={creating} onCreatingChange={setCreating} />
        </section>

        <div className={DIVIDED}>
          <ReportsSection />
        </div>
      </div>
    </SalesHubShell>
  )
}
