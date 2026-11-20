// Chat state that survives the Birdy modal being closed.
//
// ChatConversation used to own its messages and the in-flight /api/chat fetch
// as component state, so closing the modal mid-answer silently discarded the
// reply (Radix unmounts DialogContent; the resolved fetch set state on a dead
// component). For long call analyses that made "close this and carry on" a
// data-loss action.
//
// This module owns that state per sessionKey instead: the fetch keeps running
// after unmount, the transcript is still there on reopen, and if nobody is
// looking when the reply lands we raise a toast so the user knows to come
// back. Only UNCONTROLLED chat surfaces (the modal, inline widgets) use this —
// /ask-birdy passes a controlled sessionId and keeps its own server-backed
// history flow.
//
// Sidebar visibility: a request that outlives SLOW_AFTER_MS registers in
// lib/jobs-store.js so the sidebar shows Birdy is still working.

import { useSyncExternalStore } from "react"
import { toast } from "sonner"
import { announceViewOps, readViewCatalogues } from "@/lib/view-catalogues"
import { apiRequest } from "@/lib/api"
import { startJob, finishJob } from "@/lib/jobs-store"
import { openBirdyChat } from "@/lib/ask-birdy"
import { postChat } from "@/lib/chat-stream"

const SLOW_AFTER_MS = 6000

// `route` is the agents' route of the reply in flight (see lib/agent-route.js), while it streams.
const EMPTY = { messages: [], loading: false, sessionId: null, submittedUIs: [], route: null }
const chats = new Map() // sessionKey -> { messages, loading, sessionId, submittedUIs, route }
const listeners = new Map() // sessionKey -> Set<fn>
const generations = new Map() // sessionKey -> bumped by resetChat, so a reply in flight can't land in the new chat

function entry(sessionKey) {
  if (!chats.has(sessionKey)) chats.set(sessionKey, { ...EMPTY })
  return chats.get(sessionKey)
}

function emit(sessionKey) {
  chats.set(sessionKey, { ...entry(sessionKey) }) // new identity for useSyncExternalStore
  listeners.get(sessionKey)?.forEach((fn) => fn())
}

function hasWatchers(sessionKey) {
  return (listeners.get(sessionKey)?.size ?? 0) > 0
}

export function getChat(sessionKey) {
  return chats.get(sessionKey) ?? EMPTY
}

export function subscribeChat(sessionKey, fn) {
  if (!listeners.has(sessionKey)) listeners.set(sessionKey, new Set())
  listeners.get(sessionKey).add(fn)
  return () => listeners.get(sessionKey)?.delete(fn)
}

/** Reactive chat state for one sessionKey. */
export function useChat(sessionKey) {
  return useSyncExternalStore(
    (fn) => subscribeChat(sessionKey, fn),
    () => getChat(sessionKey),
    () => getChat(sessionKey),
  )
}

/** Adopt a session id restored from sessionStorage (no re-render needed). */
export function seedSessionId(sessionKey, sessionId) {
  const chat = entry(sessionKey)
  if (!chat.sessionId) chat.sessionId = sessionId
}

/**
 * Fill a chat with a saved transcript (a reload of the agent setup chat). Only an empty, idle
 * chat is filled, so a transcript already on screen or a reply in flight is never overwritten.
 */
export function hydrateChat(sessionKey, { sessionId, messages }) {
  const chat = entry(sessionKey)
  if (chat.loading || chat.messages.length > 0 || !messages?.length) return
  chat.messages = messages
  if (sessionId) chat.sessionId = sessionId
  emit(sessionKey)
}

/**
 * Fill an empty chat with a saved transcript (the Media Buying card chat, read back from the server).
 * Same rules as hydrateChat, with no session id to restore.
 */
export function seedMessages(sessionKey, messages) {
  hydrateChat(sessionKey, { messages: messages ? [...messages] : messages })
}

/** Add a message the page wrote itself, with no AI call (the card chat's "Yes to all" result). */
export function appendMessage(sessionKey, message) {
  const chat = entry(sessionKey)
  chat.messages = [...chat.messages, message]
  emit(sessionKey)
}

/** "New chat": drop transcript + session. */
export function resetChat(sessionKey) {
  generations.set(sessionKey, (generations.get(sessionKey) ?? 0) + 1)
  chats.set(sessionKey, { ...EMPTY })
  emit(sessionKey)
}

/**
 * Change one proposal kept on a reply (its status once the owner decides, what came back), so the
 * thread shows the decision for as long as the conversation stays open.
 */
export function updateProposal(sessionKey, proposalId, patch) {
  const chat = entry(sessionKey)
  let found = false
  chat.messages = chat.messages.map((m) => {
    if (!m.proposals?.some((p) => p.id === proposalId)) return m
    found = true
    return { ...m, proposals: m.proposals.map((p) => (p.id === proposalId ? { ...p, ...patch } : p)) }
  })
  if (found) emit(sessionKey)
}

export function markUISubmitted(sessionKey, uiKey) {
  const chat = entry(sessionKey)
  chat.submittedUIs = [...chat.submittedUIs, uiKey]
  emit(sessionKey)
}

/**
 * Send one user message. Runs to completion even if every subscribed
 * component unmounts; `handlers` (owned by whichever component initiated the
 * send) cover the fast failure paths that need component context.
 *
 * handlers: { on402, on412, onToolUsed, onSessionId, persistSession, onDashboardOps }
 *
 * The "My dashboards" page also passes `dashboardId` and `getSummary` (a
 * function, called at send time so the backend sees the live doc, unsaved
 * edits included). When the reply carries `dashboard_ops`, onDashboardOps
 * applies them and its `{ applied, diff, error }` is kept on the assistant
 * message for the bubble to show. Other pages pass neither and get the same
 * request and message as before.
 *
 * `agent` ("birdy" | "media_buyer" | "sales_coach") says which agent is being
 * talked to. With `stream: true` the message goes to /api/chat/stream (falling
 * back to /api/chat when that is missing), and while other agents work the
 * chat's `route` updates live. A reply that involved other agents keeps its
 * `route` (and any `proposals`) on the assistant message.
 */
export async function sendChatMessage(sessionKey, payload, handlers = {}) {
  // Always read the live entry: emit() swaps in a fresh object for
  // useSyncExternalStore, so a reference held across an emit goes stale and
  // anything written to it afterwards (the reply, loading=false) is lost.
  const chat = () => entry(sessionKey)
  if (chat().loading) return
  const generation = generations.get(sessionKey) ?? 0
  const stale = () => (generations.get(sessionKey) ?? 0) !== generation
  const { text, page, agent, stream, agentId, cardId, cardReadOnly, clientGroupId, clientName, dashboardId, getSummary, attachments } = payload

  chat().messages = [
    ...chat().messages,
    { role: "user", content: text, ...(attachments?.length ? { attachments } : {}) },
  ]
  chat().loading = true
  emit(sessionKey)

  // Surface in the sidebar only once the request is genuinely slow — quick
  // answers shouldn't flash a "background job".
  let jobId = null
  const slowTimer = setTimeout(() => {
    jobId = startJob("Birdy AI is working", {
      detail: "A longer analysis is running — you'll be notified when it's done.",
    })
  }, SLOW_AFTER_MS)

  try {
    const body = {
      message: text,
      session_id: chat().sessionId,
      page,
      // undefined drops out of the JSON, so other pages' bodies are unchanged.
      agent_id: agentId || undefined,
      // The Media Buying chat about one card (page stock_card).
      card_id: cardId || undefined,
      // A card opened read-only (a past run or month): the server's card tools then refuse.
      card_read_only: cardId && cardReadOnly ? true : undefined,
      client_group_id: clientGroupId,
      client_name: clientName,
      // undefined drops out of the JSON, so other pages' bodies are unchanged.
      dashboard_id: dashboardId ?? undefined,
      summary: dashboardId ? getSummary?.() : undefined,
      view_catalogues: readViewCatalogues(),
      attachments: attachments?.length ? attachments : undefined,
      // Which agent is being talked to; undefined keeps other pages' bodies unchanged.
      agent: agent || undefined,
    }

    let res
    if (stream) {
      res = await postChat(body, {
        onRoute: (route) => {
          if (stale()) return
          chat().route = route
          emit(sessionKey)
        },
      })
    } else {
      const raw = await apiRequest("/api/chat", { method: "POST", body: JSON.stringify(body) })
      res = { ok: raw.ok, status: raw.status, raw }
    }

    if (stale()) return

    if (res.status === 412) {
      handlers.on412?.()
      // Remove the orphaned user bubble — the message never reached a model.
      chat().messages = chat().messages.slice(0, -1)
      return
    }
    if (res.status === 402) {
      handlers.on402?.()
      chat().messages = chat().messages.slice(0, -1)
      return
    }

    // Say why in the console: the reply below is all the person sees, and it hides the status.
    if (!res.ok) console.warn(`[chat] /api/chat answered ${res.status} for page "${page ?? "none"}"`, res.raw ? await res.raw.clone().text().catch(() => "") : res.text ?? "")
    const data = res.ok
      ? (res.raw ? await res.raw.json() : res.data) ?? { reply: "", tools_used: [] }
      : { reply: "Sorry, something went wrong.", tools_used: [] }

    if (data.session_id) {
      chat().sessionId = data.session_id
      handlers.onSessionId?.(data.session_id)
      if (handlers.persistSession && typeof window !== "undefined") {
        sessionStorage.setItem(sessionKey, data.session_id)
      }
    }

    if (stale()) return
    const toolsUsed = data.tools_used || []
    const assistant = { role: "assistant", content: data.reply, tools_used: toolsUsed }
    if (data.dashboard_ops?.length) {
      // The reply does not echo which dashboard it was about; the request did.
      const result = handlers.onDashboardOps?.(data.dashboard_ops, { ...data, dashboard_id: data.dashboard_id ?? dashboardId })
      assistant.dashboard_ops = data.dashboard_ops
      assistant.dashboard_diff = result?.diff ?? []
      assistant.dashboard_applied = result?.applied ?? false
      assistant.dashboard_error = result?.error
    }
    // Saved views Birdy made: the open table applies them, the bubble shows a receipt.
    if (data.page_view_ops?.length) {
      announceViewOps(data.page_view_ops)
      assistant.page_view_ops = data.page_view_ops
    }
    // The agent training tools echo what they changed; kept for the "rule updated" chips.
    if (data.agent_changes?.length) assistant.agent_changes = data.agent_changes
    // Other agents that helped with this reply, for the route map, and the changes they propose.
    if (data.route?.steps?.length) assistant.route = data.route
    if (data.proposals?.length) assistant.proposals = data.proposals
    chat().messages = [...chat().messages, assistant]
    toolsUsed.forEach((t) => handlers.onToolUsed?.(t))

    // Nobody watching this chat any more → the modal was closed mid-run.
    if (!hasWatchers(sessionKey)) {
      toast.success("Birdy finished working", {
        description: (data.reply || "").replace(/[#*`:]/g, "").slice(0, 110) || "Your analysis is ready.",
        action: { label: "View", onClick: () => openBirdyChat() },
        duration: 10000,
      })
    }
  } catch {
    if (!stale()) {
      // If agents had started, keep their route on the error so the owner still sees who did what.
      const route = chat().route?.steps?.length ? { ...chat().route, status: "failed" } : null
      chat().messages = [...chat().messages, { role: "assistant", content: "Sorry, I hit an error. Please try again.", tools_used: [], ...(route ? { route } : {}) }]
    }
  } finally {
    clearTimeout(slowTimer)
    if (jobId) finishJob(jobId)
    if (!stale()) {
      chat().loading = false
      chat().route = null
      emit(sessionKey)
    }
    handlers.onSettled?.()
  }
}
