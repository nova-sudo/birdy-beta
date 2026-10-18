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
import { apiRequest } from "@/lib/api"
import { startJob, finishJob } from "@/lib/jobs-store"
import { openBirdyChat } from "@/lib/ask-birdy"

const SLOW_AFTER_MS = 6000

const EMPTY = { messages: [], loading: false, sessionId: null, submittedUIs: [] }
const chats = new Map() // sessionKey -> { messages, loading, sessionId, submittedUIs }
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

/** "New chat": drop transcript + session. */
export function resetChat(sessionKey) {
  generations.set(sessionKey, (generations.get(sessionKey) ?? 0) + 1)
  chats.set(sessionKey, { ...EMPTY })
  emit(sessionKey)
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
 */
export async function sendChatMessage(sessionKey, payload, handlers = {}) {
  // Always read the live entry: emit() swaps in a fresh object for
  // useSyncExternalStore, so a reference held across an emit goes stale and
  // anything written to it afterwards (the reply, loading=false) is lost.
  const chat = () => entry(sessionKey)
  if (chat().loading) return
  const generation = generations.get(sessionKey) ?? 0
  const stale = () => (generations.get(sessionKey) ?? 0) !== generation
  const { text, page, clientGroupId, clientName, dashboardId, getSummary } = payload

  chat().messages = [...chat().messages, { role: "user", content: text }]
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
    const res = await apiRequest("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: text,
        session_id: chat().sessionId,
        page,
        client_group_id: clientGroupId,
        client_name: clientName,
        // undefined drops out of the JSON, so other pages' bodies are unchanged.
        dashboard_id: dashboardId ?? undefined,
        summary: dashboardId ? getSummary?.() : undefined,
      }),
    })

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

    const data = res.ok
      ? await res.json()
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
      chat().messages = [...chat().messages, { role: "assistant", content: "Sorry, I hit an error. Please try again.", tools_used: [] }]
    }
  } finally {
    clearTimeout(slowTimer)
    if (jobId) finishJob(jobId)
    if (!stale()) {
      chat().loading = false
      emit(sessionKey)
    }
    handlers.onSettled?.()
  }
}
