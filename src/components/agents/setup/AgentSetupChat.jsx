"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

import ChatConversation from "@/components/chat/ChatConversation"
import { Badge, Button, ErrorState, PageHeader, toast } from "@/components/ds"
import { ClaimConflicts } from "@/components/agents/ClaimConflicts"
import { StartOverButton } from "@/components/agents/StartOverButton"
import { scopeCurrency, toClient } from "@/components/agents/AgentTraining"
import { changeChips } from "@/components/agents/TrainingChat"
import { apiRequest } from "@/lib/api"
import {
  activateAgent,
  createAgent,
  customAgentPath,
  customSetupPath,
  useAgent,
  useAgentConfidence,
  useAgentRules,
  useAgents,
} from "@/lib/agents-api"
import { getChat, hydrateChat, sendChatMessage, useChat } from "@/lib/chat-store"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { useClientGroups } from "@/lib/useClientGroups"
import { activationMessage, moveClaims } from "./claims"
import { SetupRail } from "./SetupRail"
import { SETUP_STEPS } from "./steps"
import { ClientsBlock } from "./blocks/ClientsBlock"
import { PermissionsBlock } from "./blocks/PermissionsBlock"
import { PlaybookBlock } from "./blocks/PlaybookBlock"
import { PracticeBlock } from "./blocks/PracticeBlock"
import { PreviewBlock } from "./blocks/PreviewBlock"
import { ScheduleBlock } from "./blocks/ScheduleBlock"
import { SlackBlock } from "./blocks/SlackBlock"

export const SETUP_PAGE = "agent_setup"
export const setupSessionKey = (id) => `agent_setup:${id ?? "new"}`

const INTRO = "Let's build this one from scratch. **What should the agent do?**"
// later: from what each team asks Birdy most
export const EXAMPLE_JOBS = ["Pause ads that cost too much", "Turn old winners back on", "Flag ad sets with no spend"]
const NEW_AGENT_NAME = "New agent"

/** The tool results in one of Birdy's replies that ask for an inline block (`ui_block`). */
export function uiBlocksOf(message) {
  return (message?.agent_changes ?? [])
    .map((item) => {
      const block = item?.ui_block ?? item?.result?.ui_block
      return block ? { ...(item.result ?? {}), ...item, ui_block: block } : null
    })
    .filter(Boolean)
}

/** Reads the agent's saved setup chat into the store, once, so a draft opened later (another tab, another day) resumes with its blocks. */
function useResumeTranscript(agentId) {
  useEffect(() => {
    if (!agentId) return
    const key = setupSessionKey(agentId)
    if (getChat(key).messages.length > 0) return
    let live = true
    apiRequest(`/api/agents/${encodeURIComponent(agentId)}/setup/chat`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!live || !data?.session_id || !data?.messages?.length) return
        hydrateChat(key, {
          sessionId: data.session_id,
          messages: data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            tools_used: m.tools_used ?? [],
            ...(m.agent_changes?.length ? { agent_changes: m.agent_changes } : {}),
          })),
        })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [agentId])
}

/**
 * New custom agent setup as one chat with Birdy (page `agent_setup`) and the setup rail beside it.
 *
 * With no `agentId` (the /new route) nothing exists until the first message: it creates a draft
 * agent, moves to that agent's setup route, then sends the message there. With an `agentId` the
 * draft resumes: the rail from `training.steps`, the transcript from the agent's saved setup chat.
 * Birdy's tool results with a `ui_block` render inline pickers that save through the agents API,
 * then send a short confirmation so Birdy moves on.
 */
export function AgentSetupChat({ agentId = null }) {
  const router = useRouter()
  const sessionKey = setupSessionKey(agentId)
  const { agent, error: agentError, mutate: mutateAgent } = useAgent(agentId)
  const { confidence, mutate: mutateConfidence } = useAgentConfidence(agentId)
  const { mutate: mutateRules } = useAgentRules(agentId)
  const { mutate: mutateAgents } = useAgents()
  const { clientGroups, loading: clientsLoading } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const clients = useMemo(() => clientGroups.map(toClient), [clientGroups])
  const currency = scopeCurrency(clients, agent?.scope?.client_group_ids ?? [])
  const { messages, loading } = useChat(sessionKey)
  const sendRef = useRef(null)
  const [turningOn, setTurningOn] = useState(false)
  const [conflicts, setConflicts] = useState(null)
  const [flagOnly, setFlagOnly] = useState([])

  useResumeTranscript(agentId)

  const refresh = useCallback(() => {
    mutateAgent()
    mutateConfidence()
    mutateRules()
  }, [mutateAgent, mutateConfidence, mutateRules])

  // Re-read the agent, score and playbook after each of Birdy's replies that used a tool.
  const seen = useRef(messages.length)
  useEffect(() => {
    if (messages.length === seen.current) return
    seen.current = messages.length
    const last = messages.at(-1)
    if (last && last.role !== "user" && (last.agent_changes?.length || last.tools_used?.length)) refresh()
  }, [messages, refresh])

  const send = useCallback(async (text) => {
    if (!sendRef.current) return false
    try {
      return (await sendRef.current(text)) !== false
    } catch {
      return false
    }
  }, [])

  // The /new route: the first message makes the draft, then goes to it on its own route.
  const createAndSend = useCallback(
    async (text) => {
      let created
      try {
        created = await createAgent({ type: "custom", name: NEW_AGENT_NAME })
      } catch (err) {
        toast.error("Couldn't start your agent", { description: err?.message || "Try again in a moment." })
        return false
      }
      mutateAgents()
      router.replace(customSetupPath(created.id))
      // The store owns the request, so it carries on while this route unmounts.
      sendChatMessage(
        setupSessionKey(created.id),
        { text, page: SETUP_PAGE, agentId: created.id },
        {
          persistSession: true,
          on412: () => toast.error("AI not configured", { description: "Add your AI key in Settings to keep chatting." }),
          on402: () => toast.error("You're out of Birdy Credits", { description: "Top up to keep using Birdy AI." }),
        }
      )
      return true
    },
    [mutateAgents, router]
  )

  const onSaved = useCallback(
    (updated) => {
      if (updated?.id) mutateAgent(updated, { revalidate: false })
      mutateConfidence()
    },
    [mutateAgent, mutateConfidence]
  )

  const lastReply = messages.findLastIndex((m) => m.role !== "user")

  const renderAfterMessage = useCallback(
    (message, index) => {
      const blocks = uiBlocksOf(message)
      const chips = changeChips(message, currency).filter(Boolean)
      if (!blocks.length && !chips.length) return null
      const active = index === lastReply && !loading
      return (
        <div data-slot="setup-blocks" className="flex flex-col gap-3 pl-[34px]">
          {chips.length > 0 && !blocks.some((b) => b.ui_block === "playbook") && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((line, i) => (
                <Badge key={i} size="sm" tone="primary" icon={Check}>
                  <span className="truncate">{line}</span>
                </Badge>
              ))}
            </div>
          )}
          {agent &&
            blocks.map((entry, i) => {
              const key = `${entry.ui_block}-${i}`
              const common = { agent, active, onSend: send, onSaved }
              switch (entry.ui_block) {
                case "playbook":
                  return <PlaybookBlock key={key} {...common} entry={entry} currency={currency} />
                case "clients":
                  return <ClientsBlock key={key} {...common} clients={clients} clientsLoading={clientsLoading} />
                case "permissions":
                  return <PermissionsBlock key={key} {...common} />
                case "schedule":
                  return <ScheduleBlock key={key} {...common} />
                case "slack":
                  return <SlackBlock key={key} {...common} />
                case "practice":
                  return <PracticeBlock key={key} agentId={agent.id} entry={entry} onSend={send} onAnswered={mutateConfidence} />
                case "preview":
                  return <PreviewBlock key={key} agentId={agent.id} entry={entry} currency={currency} />
                default:
                  return null
              }
            })}
        </div>
      )
    },
    [agent, clients, clientsLoading, currency, lastReply, loading, mutateConfidence, onSaved, send]
  )

  const turnOn = async (claims) => {
    setTurningOn(true)
    setConflicts(null)
    try {
      const activated = await activateAgent(agentId, claims)
      const next = activated?.id ? activated : { ...agent, status: "active" }
      await mutateAgent(next, { revalidate: false })
      mutateAgents()
      router.push(customAgentPath(agentId))
    } catch (err) {
      if (err?.status === 409 && err.conflicts?.length) setConflicts(err.conflicts)
      else toast.error(activationMessage(err))
      setTurningOn(false)
    }
  }

  const changeStep = (key) => {
    const step = SETUP_STEPS.find((s) => s.key === key)
    if (step) send(`I want to change ${step.label.toLowerCase()}`)
  }

  const answered = messages.some((m) => m.role === "user") || Boolean(agent?.training?.steps?.purpose)
  const examples = answered ? null : (
    <div role="group" aria-label="Examples of what to build" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {EXAMPLE_JOBS.map((job) => (
        <Button key={job} variant="outline" size="sm" className="h-auto min-h-9 rounded-full py-2 whitespace-normal" disabled={loading} onClick={() => send(job)}>
          {job}
        </Button>
      ))}
    </div>
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 font-sans">
      <PageHeader
        backButton={{ label: "Agency Ops", href: "/dashboard" }}
        title="Set up your new agent"
        actions={agent && agent.status !== "active" ? <StartOverButton agent={agent} /> : undefined}
      />

      {agentId && agentError ? (
        <ErrorState
          title="Couldn't load your agent"
          description={agentError?.message || "The request failed."}
          onRetry={() => mutateAgent()}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <div className="order-2 flex h-[calc(100dvh-14rem)] min-h-[28rem] min-w-0 flex-col lg:order-1">
            <ChatConversation
              key={sessionKey}
              sessionKey={sessionKey}
              page={SETUP_PAGE}
              agentId={agentId}
              showScopePicker={false}
              showSlowNotice={false}
              bubbleWidthClass="max-w-[85%]"
              introMessage={INTRO}
              composerPlaceholder={answered ? "Type your answer…" : "Tell Birdy what the agent should do…"}
              aboveComposer={examples}
              interceptSend={agentId ? null : createAndSend}
              renderAfterMessage={renderAfterMessage}
              sendRef={sendRef}
            />
          </div>
          <div className="order-1 flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:order-2">
            <SetupRail
              agent={agent ?? { training: { steps: {} } }}
              confidence={confidence}
              onChange={changeStep}
              onTurnOn={() => turnOn()}
              turningOn={turningOn}
              busy={loading || !agentId}
            />
            {conflicts && (
              <ClaimConflicts
                conflicts={conflicts}
                clients={clients}
                busy={turningOn}
                onMove={() => turnOn(moveClaims(flagOnly))}
                onOnlyFlag={(gid) => {
                  const all = flagOnly.includes(gid) ? flagOnly : [...flagOnly, gid]
                  setFlagOnly(all)
                  turnOn({ only_flag: all })
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
