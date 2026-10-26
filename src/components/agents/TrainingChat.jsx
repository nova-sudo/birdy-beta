"use client"

import * as React from "react"
import { Check } from "lucide-react"

import ChatConversation from "@/components/chat/ChatConversation"
import { RULE_COPY } from "@/components/agents/PlaybookRule"
import { Badge } from "@/components/ds"
import { useChat } from "@/lib/chat-store"

export const TRAINING_PAGE = "agent_training"

/** The training tools that change the playbook, targets or memory. */
export const AGENT_WRITE_TOOLS = new Set([
  "set_rule_param",
  "set_client_target",
  "set_client_override",
  "add_memory",
  "add_exception",
  "answer_topic",
])

const TOPIC_LABEL = {
  targets: "Client targets",
  pause: "When to pause",
  revive: "When to revive",
  flags: "What to flag",
}

const STARTERS = [{ label: "Start training", prompt: "I'm ready to train you. Ask me your first question." }]

function paramPart(kind, param) {
  return RULE_COPY[kind]?.parts.find((p) => typeof p === "object" && p.key === param) ?? null
}

function formatValue(value, part, currency) {
  if (value == null || value === "") return "none"
  if (part?.money) return `${currency}${value}`
  if (part?.suffix === "×") return `${value}×`
  if (part?.suffix === "%") return `${value}%`
  return part?.suffix ? `${value} ${part.suffix}` : String(value)
}

/**
 * One tool result's `changed` as a short line, or null when it isn't one we know.
 * Accepts `{tool, changed}`, `{changed}` or the bare `changed` object.
 */
export function describeChange(item, currency = "$") {
  const c = item?.changed ?? item?.result?.changed ?? item
  if (!c || typeof c !== "object") return null
  if (c.topic) return `${TOPIC_LABEL[c.topic] ?? c.topic} covered`
  if (c.filter) return `Exception: ${c.text}`
  if (c.text) return `Remembered: ${c.text}`
  if (c.client && c.rule_kind) {
    const part = paramPart(c.rule_kind, c.param)
    const what = part?.label ?? c.param
    return `${c.client}: ${what} ${formatValue(c.before, part, currency)} → ${formatValue(c.after, part, currency)}`
  }
  if (c.client && c.param === "cpl") {
    const fmt = (v) => (v == null ? "none" : `${currency}${v}`)
    return `${c.client} CPL target ${fmt(c.before)} → ${fmt(c.after)}`
  }
  if (c.rule_kind && c.param) {
    const part = paramPart(c.rule_kind, c.param)
    const title = RULE_COPY[c.rule_kind]?.title ?? c.rule_kind
    return `${title}: ${part?.label ?? c.param} ${formatValue(c.before, part, currency)} → ${formatValue(c.after, part, currency)}`
  }
  return null
}

/** The chips under one of Birdy's replies: what its tools changed. */
export function changeChips(message, currency) {
  const lines = (message.agent_changes ?? []).map((item) => describeChange(item, currency)).filter(Boolean)
  if (lines.length) return lines
  // Older replies (or a backend that doesn't echo changes) only name the tools.
  return (message.tools_used ?? []).some((t) => AGENT_WRITE_TOOLS.has(t)) ? ["Playbook updated"] : []
}

/**
 * The training chat: the shared ChatConversation on the agent_training page.
 * Under each of Birdy's replies, what its tools changed shows as "rule updated" chips;
 * `onChanged` fires after any reply whose tools changed something, so the page can
 * refresh the playbook and the confidence score.
 *
 * `ref` gets `{ send(text) }` for messages the page posts itself (practice follow-ups);
 * a message sent while Birdy is still answering waits for that answer.
 */
export function TrainingChat({ agentId, currency = "$", onChanged, ref, className }) {
  const sessionKey = `birdy_agent_training_${agentId}`
  const { loading } = useChat(sessionKey)
  const sendRef = React.useRef(null)
  const queue = React.useRef([])
  const onChangedRef = React.useRef(onChanged)
  React.useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  React.useImperativeHandle(
    ref,
    () => ({
      send(text) {
        if (!loading && sendRef.current) sendRef.current(text)
        else queue.current.push(text)
      },
    }),
    [loading]
  )

  // Child effects run first, so sendRef already holds the idle send here.
  React.useEffect(() => {
    if (loading || !sendRef.current || queue.current.length === 0) return
    sendRef.current(queue.current.shift())
  }, [loading])

  const onToolUsed = React.useCallback((tool) => {
    if (AGENT_WRITE_TOOLS.has(tool)) onChangedRef.current?.(tool)
  }, [])

  const renderAfterMessage = React.useCallback(
    (message) => {
      const chips = changeChips(message, currency)
      if (!chips.length) return null
      return (
        <div data-slot="training-changes" className="flex flex-wrap gap-1.5 pl-9">
          {chips.map((line, i) => (
            <Badge key={i} size="sm" tone="primary" icon={Check}>
              <span className="truncate">{line}</span>
            </Badge>
          ))}
        </div>
      )
    },
    [currency]
  )

  return (
    <div className={className}>
      <ChatConversation
        sessionKey={sessionKey}
        page={TRAINING_PAGE}
        showScopePicker={false}
        showSlowNotice={false}
        composerCompact
        bubbleWidthClass="max-w-[85%]"
        composerPlaceholder="Type your answer…"
        emptyStateTitle="Teach Birdy how you buy"
        emptyStateSubtitle="Answer like you'd brief a new media buyer. Birdy writes the rules as you go."
        quickStarters={STARTERS}
        onToolUsed={onToolUsed}
        renderAfterMessage={renderAfterMessage}
        sendRef={sendRef}
      />
    </div>
  )
}
