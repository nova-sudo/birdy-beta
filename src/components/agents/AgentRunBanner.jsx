"use client"

import Link from "next/link"
import { PlugZap } from "lucide-react"

import { SystemBanner } from "@/components/ds"
import { useAgents } from "@/lib/agents-api"

const SETTINGS_HREF = "/settings?tab=integrations"

/**
 * The shell's strip for an agent that couldn't run: its last run was skipped
 * because the Meta token is gone. Shares the agents SWR entry with the nav badge.
 */
export function AgentRunBanner() {
  const { agents } = useAgents()
  const stuck = agents.some((a) => a.status === "active" && a.last_run?.status === "skipped_token")
  if (!stuck) return null

  return (
    <SystemBanner
      tone="warning"
      action={
        <Link href={SETTINGS_HREF} className="underline-offset-2 hover:underline">
          Go to Settings
        </Link>
      }
    >
      <PlugZap aria-hidden className="mr-2 inline size-4 align-text-bottom" />
      Reconnect Meta so your agent can run
    </SystemBanner>
  )
}
