"use client"

import { useMemo } from "react"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/hub/HubShell"
import { AgentSetupChat } from "@/components/agents/setup/AgentSetupChat"

/** A new custom agent: nothing exists until the first message to Birdy, which creates the draft. */
export default function NewCustomAgentPage() {
  const topBar = useMemo(() => ({ title: <SalesHubHeaderTitle title="New agent" subtitle="BirdyHub" /> }), [])
  usePageHeader(topBar)
  return <AgentSetupChat />
}
