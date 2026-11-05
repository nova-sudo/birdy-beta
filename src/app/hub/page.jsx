"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Pause, Plus, RefreshCw, TriangleAlert } from "lucide-react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/hub/HubShell"
import { Badge, Button, ErrorState, Frame, Skeleton, Surface, toast } from "@/components/ds"
import { DashboardList } from "@/components/dashboards/DashboardList"
import { ReportsSection } from "@/components/reports/ReportsSection"
import { StartOverButton } from "@/components/agents/StartOverButton"
import { TurnOn } from "@/components/agents/stock/TurnOn"
import { customAgentPath, useAgents } from "@/lib/agents-api"
import { STOCK_AGENT_PATH, STOCK_SETUP_PATH, createStockAgent, useStockAgent } from "@/lib/stock-agent-api"

// ─── BirdyHub ───────────────────────────────────────────────────────────────
// Agents (Birdy teammates you train on your strategy) and dashboards, together,
// with the Slack reports under Dashboards.

const NEW_CUSTOM_HREF = "/hub/agents/custom/new"

const STOCK_POINTS = [
  { icon: TriangleAlert, text: "Catches what stops spend first: payment, rejections, zero spend days" },
  { icon: Pause, text: "Zones each client against the targets you set" },
  { icon: RefreshCw, text: "Moves proven winners between matching accounts" },
]

function StockAgentCard({ agent }) {
  const router = useRouter()
  const { mutate } = useAgents()
  const [busy, setBusy] = useState(false)
  // A turned-off agent is a draft with a mark. It has a finished setup, so it gets Turn on and never Start over.
  const turnedOff = Boolean(agent) && agent.status !== "active" && Boolean(agent.turned_off_at)
  const isDraft = Boolean(agent) && agent.status !== "active" && !turnedOff

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

  return (
    <Frame
      title="Birdy Media Buying Agent"
      action={turnedOff ? <Badge tone="neutral">Turned off</Badge> : <Badge tone="primary">Default</Badge>}
      padded
      contentClassName="flex flex-col gap-4"
    >
      <p className="text-sm leading-normal text-ink-secondary">
        Checks your accounts on your schedule, drafts a change card for each one, and learns from what actually worked.
      </p>
      <ul className="flex flex-col gap-2">
        {STOCK_POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-foreground">
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            {text}
          </li>
        ))}
      </ul>
      {isDraft ? (
        <div className="flex flex-col gap-2">
          <Button asChild variant="primary" size="lg">
            <Link href={STOCK_SETUP_PATH}>
              Continue setup
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <StartOverButton
            agent={agent}
            variant="outline"
            size="lg"
            className="w-full"
            redirectTo={null}
            description="This deletes the clients you picked and the settings you chose, including your Slack messages. You can't undo it."
          />
        </div>
      ) : agent ? (
        <div className="flex flex-col gap-2">
          {turnedOff && (
            <>
              <p className="text-sm text-muted-foreground">Birdy isn&apos;t checking your clients. Your settings and reports are kept.</p>
              <TurnOn agent={agent} size="lg" className="w-full" />
            </>
          )}
          <Button asChild variant={turnedOff ? "outline" : "primary"} size="lg">
            <Link href={STOCK_AGENT_PATH}>
              Open agent
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="lg" loading={busy} onClick={setUp}>
          Set up agent
          <ArrowRight aria-hidden />
        </Button>
      )}
    </Frame>
  )
}

// The agent list carries the client count but not the open work, which is a request per agent, so rows
// show the clients and leave the waiting items to the agent's own page and the nav badge.
function customSummary(a) {
  const clients = a.scope?.client_group_ids?.length ?? 0
  const state = a.status === "active" ? "Live" : "Setting up"
  return clients > 0 ? `${state} · ${clients} ${clients === 1 ? "client" : "clients"}` : state
}

function CustomAgentsFrame({ agents }) {
  return (
    <Frame
      title="Custom agents"
      action={agents.length > 0 ? <Badge>{agents.length}</Badge> : undefined}
      contentClassName="flex flex-col"
    >
      {agents.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No custom agents yet</p>
      ) : (
        <ul className="divide-y divide-border">
          {agents.map((a) => (
            <li key={a.id}>
              <Link
                href={customAgentPath(a.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{a.name || "Custom agent"}</span>
                  <span className="block text-muted-foreground">{customSummary(a)}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-primary">
                  Open
                  <ArrowRight aria-hidden className="size-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  )
}

function CreateCustomAgentCard() {
  return (
    <Surface className="flex flex-col justify-center gap-2.5 border border-dashed border-border shadow-none">
      <h3 className="text-base font-semibold text-foreground">Create your own agent</h3>
      <p className="text-sm leading-normal text-muted-foreground">
        Choose its clients, teach it your rules in a chat, practise on real past cases and see what it would have done
        before you switch it on.
      </p>
      <div>
        <Button asChild variant="outline">
          <Link href={NEW_CUSTOM_HREF}>
            <Plus aria-hidden />
            Create custom agent
          </Link>
        </Button>
      </div>
    </Surface>
  )
}

export default function HubPage() {
  const { agents, error, isLoading, mutate } = useAgents()
  const { agent: stock } = useStockAgent()
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
      <div className="flex flex-col gap-10">
        <section aria-labelledby="hub-agents" className="flex flex-col gap-4">
          <h2 id="hub-agents" className="text-lg font-semibold text-foreground">
            Agents
          </h2>
          <p className="-mt-3 text-sm text-muted-foreground">Birdy teammates that work your ad accounts</p>
          {error ? (
            <ErrorState
              title="Couldn't load your agents"
              description="Your agents are still there, they just didn't load. Try again."
              onRetry={() => mutate()}
            />
          ) : isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <StockAgentCard agent={stock} />
              <div className="flex flex-col gap-4">
                <CustomAgentsFrame agents={custom} />
                <CreateCustomAgentCard />
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="hub-dashboards" className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="hub-dashboards" className="text-lg font-semibold text-foreground">
              Dashboards
            </h2>
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              New dashboard
            </Button>
          </div>
          <DashboardList creating={creating} onCreatingChange={setCreating} />
          <div className="mt-4 border-t border-border pt-6">
            <ReportsSection />
          </div>
        </section>
      </div>
    </SalesHubShell>
  )
}
