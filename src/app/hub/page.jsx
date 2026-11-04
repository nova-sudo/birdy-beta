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
import { customAgentPath, useAgents } from "@/lib/agents-api"
import { STOCK_AGENT_PATH, STOCK_AGENT_TYPE, STOCK_SETUP_PATH, createStockAgent } from "@/lib/stock-agent-api"

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
  const isDraft = Boolean(agent) && agent.status !== "active"

  const setUp = async () => {
    setBusy(true)
    try {
      const created = await createStockAgent()
      await mutate((list) => [...(Array.isArray(list) ? list : []), created], { revalidate: true })
      router.push(STOCK_SETUP_PATH)
    } catch (err) {
      toast.error("Couldn't set up the agent", { description: err?.message })
      setBusy(false)
    }
  }

  return (
    <Frame
      title="Birdy Media Buying Agent"
      action={<Badge tone="primary">Default</Badge>}
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
          <StartOverButton agent={agent} variant="outline" size="lg" className="w-full" redirectTo={null} />
        </div>
      ) : agent ? (
        <Button asChild variant="primary" size="lg">
          <Link href={STOCK_AGENT_PATH}>
            Open agent
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="primary" size="lg" loading={busy} onClick={setUp}>
          Set up agent
          <ArrowRight aria-hidden />
        </Button>
      )}
    </Frame>
  )
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
                  <span className="block text-muted-foreground">{a.status === "active" ? "Live" : "Setting up"}</span>
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
  const [creating, setCreating] = useState(false)
  const stock = agents.find((a) => a.type === STOCK_AGENT_TYPE) ?? null
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
