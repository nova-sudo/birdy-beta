"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Pause, Plus, RefreshCw, TriangleAlert } from "lucide-react"
import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle, SalesHubShell } from "@/components/saleshub/SalesHubShell"
import { Badge, Button, Frame, Surface } from "@/components/ds"
import { DashboardList } from "@/components/dashboards/DashboardList"
import { StartOverButton } from "@/components/agents/StartOverButton"
import { useAgents } from "@/lib/agents-api"

// ─── BirdyHub ───────────────────────────────────────────────────────────────
// Agents (Birdy teammates you train on your strategy) and dashboards, together.

const SETUP_HREF = "/hub/agents/media-buying/setup"
const AGENT_HREF = "/hub/agents/media-buying"

const MEDIA_BUYING_POINTS = [
  { icon: Pause, text: "Turns ads off when they miss your targets" },
  { icon: TriangleAlert, text: "Flags no spend and declining performance" },
  { icon: RefreshCw, text: "Turns old winners back on after a rest" },
]

function MediaBuyingAgentCard({ agent }) {
  const hasAgent = Boolean(agent)
  const isDraft = hasAgent && agent.status !== "active"
  return (
    <Frame
      title="Media Buying Agent"
      action={<Badge tone="primary">Default</Badge>}
      padded
      contentClassName="flex flex-col gap-4"
    >
      <p className="text-sm leading-normal text-ink-secondary">
        Watches your clients&apos; Meta ads every morning. Drafts a work list, you approve, it learns your strategy.
      </p>
      <ul className="flex flex-col gap-2">
        {MEDIA_BUYING_POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-foreground">
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            {text}
          </li>
        ))}
      </ul>
      {isDraft ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="primary" size="lg" className="flex-1">
            <Link href={SETUP_HREF}>
              Continue setup
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <StartOverButton agent={agent} variant="outline" size="lg" />
        </div>
      ) : (
        <Button asChild variant="primary" size="lg">
          <Link href={hasAgent ? AGENT_HREF : SETUP_HREF}>
            {hasAgent ? "Open agent" : "Set up agent"}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}
    </Frame>
  )
}

function ComingSoonCard() {
  return (
    <Surface className="flex flex-col justify-center gap-2.5 border border-dashed border-border shadow-none">
      <span className="flex size-10 items-center justify-center rounded-control bg-primary-soft text-primary">
        <Plus aria-hidden className="size-5" />
      </span>
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">Create your own agent</h3>
        <Badge>Coming soon</Badge>
      </div>
      <p className="text-sm leading-normal text-muted-foreground">
        Describe the job in plain English. Birdy asks you questions, writes the rules, and shows you what it would have
        done before it starts.
      </p>
    </Surface>
  )
}

export default function HubPage() {
  const { agents } = useAgents()
  const [creating, setCreating] = useState(false)
  const mediaBuying = agents.find((a) => a.type === "media_buying") ?? agents[0] ?? null

  const header = useMemo(
    () => ({
      title: (
        <SalesHubHeaderTitle
          title="BirdyHub"
          subtitle="Agents that work your ad accounts for you, and dashboards that show what you care about"
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
          <p className="-mt-3 text-sm text-muted-foreground">Birdy teammates you train on your strategy</p>
          <div className="grid gap-4 md:grid-cols-2">
            <MediaBuyingAgentCard agent={mediaBuying} />
            <ComingSoonCard />
          </div>
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
        </section>
      </div>
    </SalesHubShell>
  )
}
