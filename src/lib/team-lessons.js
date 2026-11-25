// A main agent's lessons (Marketing Guru, Sales Coach): what the owner has told it
// to do differently, kept per agent and shown on its Context page. Routes:
//   GET    /api/team/{agent}/lessons?client_group_id=
//          -> {lessons: [{id, text, client_group_id, client_name, source, created_at, updated_at}]}
//   POST   /api/team/{agent}/lessons        {text, client_group_id?}
//   PATCH  /api/team/{agent}/lessons/{id}   {text}
//   DELETE /api/team/{agent}/lessons/{id}
// Refusals are {detail, code}; the page shows `detail`.

import useSWR from "swr"
import { request } from "@/lib/context-api"
import { fetcher } from "@/lib/fetcher"
import { parseServerDate } from "@/lib/stock-agent-api"

export const LESSON_MAX = 500

const str = (v) => (typeof v === "string" ? v : "")

/** Where a lesson came from, in words. Unknown sources say nothing rather than guess. */
export const LESSON_SOURCES = {
  app: "Added by you", owner: "Added by you", chat: "From a chat", dismiss: "From a dismissed card", edit: "From an edited card",
  promoted: "Promoted from a card", slack: "From Slack", setup: "From setup",
}

/** A lesson from the server made safe to draw. */
export function normalizeLesson(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null
  return {
    id: str(raw.id),
    text: str(raw.text),
    client_group_id: str(raw.client_group_id) || null,
    client_name: str(raw.client_name) || null,
    source: str(raw.source) || null,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
  }
}

const time = (iso) => parseServerDate(iso)?.getTime?.() || 0

/** Inside a client, its own lessons first; newest first inside each group. */
export function sortLessons(list, clientId = null) {
  return [...list].sort((a, b) => {
    if (clientId) {
      const mine = (l) => (l.client_group_id === clientId ? 0 : 1)
      if (mine(a) !== mine(b)) return mine(a) - mine(b)
    }
    return time(b.created_at) - time(a.created_at)
  })
}

export const lessonsKey = (agent, clientId) =>
  agent ? `/api/team/${encodeURIComponent(agent)}/lessons${clientId ? `?client_group_id=${encodeURIComponent(clientId)}` : ""}` : null

/**
 * An agent's lessons, for the whole agency or with one client's. `unavailable` is true while
 * the server has no lessons route yet (404).
 * @param {"media_buyer"|"sales_coach"|null} agent
 */
export function useTeamLessons(agent, clientId = null) {
  const { data, error, isLoading, mutate } = useSWR(lessonsKey(agent, clientId), fetcher, { shouldRetryOnError: (e) => e?.status !== 404 })
  const unavailable = error?.status === 404
  const list = Array.isArray(data?.lessons) ? data.lessons : []
  return {
    lessons: sortLessons(list.map(normalizeLesson).filter(Boolean), clientId),
    unavailable,
    error: unavailable ? null : error ?? null,
    isLoading: Boolean(agent) && isLoading,
    mutate,
  }
}

const base = (agent) => `/api/team/${encodeURIComponent(agent)}/lessons`

export const addLesson = (agent, { text, clientId }) => request(base(agent), "POST", { text, ...(clientId ? { client_group_id: clientId } : {}) })
export const changeLesson = (agent, id, text) => request(`${base(agent)}/${encodeURIComponent(id)}`, "PATCH", { text })
export const removeLesson = (agent, id) => request(`${base(agent)}/${encodeURIComponent(id)}`, "DELETE")

/** A refusal in words: the server's own `detail` when it sent one. */
export function lessonErrorMessage(err) {
  if (err?.detail) return err.detail
  if (err?.status === 404) return "That lesson is no longer there. Reload to see the current list."
  return "That didn’t save. Check your connection and try again."
}
