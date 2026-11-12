"use client"

import { use, useMemo } from "react"

import { usePageHeader } from "@/components/page-header"
import { SalesHubHeaderTitle } from "@/components/hub/HubShell"
import { AgentSetupChat } from "@/components/agents/setup/AgentSetupChat"
import { useAgent } from "@/lib/agents-api"

/** A draft custom agent's setup: the chat with Birdy picks up where it stopped. */
export default function CustomAgentSetupPage({ params }) {
  const { id } = use(params)
  const { agent } = useAgent(id)
  const topBar = useMemo(
    () => ({ title: <SalesHubHeaderTitle title={agent?.name ?? "Agent"} subtitle="Set up" /> }),
    [agent?.name]
  )
  usePageHeader(topBar)
  return <AgentSetupChat agentId={id} />
}
