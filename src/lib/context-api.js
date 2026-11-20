// What a section knows (the Context page): the agency's cards, one client's own
// card, and the owner's notes. One shared context for every agent; the server
// owns it. Routes:
//   GET    /api/context?client_group_id=      -> { cards, client, notes }
//   POST   /api/context/items                 { card, text, client_group_id? }
//   PATCH  /api/context/items/{id}            { text }
//   DELETE /api/context/items/{id}
//   POST   /api/context/notes                 { text, client_group_id? }
//   PATCH  /api/context/notes/{id}            { text }
//   DELETE /api/context/notes/{id}
// Refusals are {detail, code}; the page shows `detail`. Derived lines have ids starting "derived:"
// and editable false (an edit of one answers 409 managed_elsewhere).

import useSWR from "swr"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"

/** The cards in the order the page shows them. Anything else the server sends goes after them. */
export const CARD_ORDER = ["agency", "targets", "how_we_work", "rules"]

/** The card key a line on a client's own card is sent with (it needs client_group_id). */
export const CLIENT_CARD = "client"

/**
 * One request to a JSON route. Throws an Error with `status`, `code` and `detail` when the
 * server refuses, so a page can tell "not built yet" (404) from "something went wrong".
 */
export async function request(endpoint, method = "GET", body) {
  const res = await apiRequest(endpoint, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  let data = null
  try {
    data = await res.json()
  } catch {
    // Empty or not JSON.
  }
  if (!res.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : null
    const err = new Error(detail ?? `HTTP ${res.status}`)
    err.status = res.status
    err.code = typeof data?.code === "string" ? data.code : null
    err.detail = detail
    throw err
  }
  return data
}

const str = (v) => (typeof v === "string" ? v : "")

function item(raw) {
  return {
    id: str(raw?.id),
    text: str(raw?.text),
    updated_at: raw?.updated_at ?? null,
    source: ["owner", "setup", "derived"].includes(raw?.source) ? raw.source : "owner",
    editable: raw?.editable !== false && !String(raw?.id ?? "").startsWith("derived:"),
  }
}

const items = (list) => (Array.isArray(list) ? list.filter((i) => i && i.id).map(item) : [])

/** The server's answer made safe to draw: lists are lists, cards in the page's order. */
export function normalizeContext(raw) {
  const cards = (Array.isArray(raw?.cards) ? raw.cards : [])
    .filter((c) => c && typeof c.key === "string")
    .map((c) => ({ key: c.key, title: str(c.title) || c.key, used_when: str(c.used_when), items: items(c.items) }))
  const rank = (key) => (CARD_ORDER.includes(key) ? CARD_ORDER.indexOf(key) : CARD_ORDER.length)
  cards.sort((a, b) => rank(a.key) - rank(b.key))
  const client = raw?.client && raw.client.id ? { id: str(raw.client.id), name: str(raw.client.name), used_when: str(raw.client.used_when), items: items(raw.client.items) } : null
  const notes = (Array.isArray(raw?.notes) ? raw.notes : [])
    .filter((n) => n && n.id)
    .map((n) => ({ id: str(n.id), text: str(n.text), client_group_id: n.client_group_id || null, client_name: str(n.client_name) || null, created_at: n.created_at ?? null, updated_at: n.updated_at ?? null, author: str(n.author) || null }))
  return { cards, client, notes }
}

/** "Birdy uses this when it judges a client." from the server's `used_when`, whether or not it starts the sentence itself. */
export function usedWhenLine(usedWhen) {
  const text = str(usedWhen).trim()
  if (!text) return ""
  const sentence = /^birdy uses/i.test(text) ? text : `Birdy uses this when ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`
}

export const contextKey = (clientId) => (clientId ? `/api/context?client_group_id=${encodeURIComponent(clientId)}` : "/api/context")

/**
 * The context for the whole agency, or with one client's card and notes.
 * `unavailable` is true while the server has no Context route yet (404).
 */
export function useContext(clientId) {
  const { data, error, isLoading, mutate } = useSWR(contextKey(clientId), fetcher, { shouldRetryOnError: (e) => e?.status !== 404 })
  const unavailable = error?.status === 404
  return {
    context: data ? normalizeContext(data) : null,
    unavailable,
    error: unavailable ? null : error ?? null,
    isLoading,
    mutate,
  }
}

export const addContextItem = ({ card, text, clientId }) =>
  request("/api/context/items", "POST", { card, text, ...(clientId ? { client_group_id: clientId } : {}) })
export const changeContextItem = (id, text) => request(`/api/context/items/${encodeURIComponent(id)}`, "PATCH", { text })
export const removeContextItem = (id) => request(`/api/context/items/${encodeURIComponent(id)}`, "DELETE")

export const addNote = ({ text, clientId }) => request("/api/context/notes", "POST", { text, ...(clientId ? { client_group_id: clientId } : {}) })
export const changeNote = (id, text) => request(`/api/context/notes/${encodeURIComponent(id)}`, "PATCH", { text })
export const removeNote = (id) => request(`/api/context/notes/${encodeURIComponent(id)}`, "DELETE")

/** A refusal in words: the server's own `detail` when it sent one. */
export const contextErrorMessage = (err) => err?.detail || "That didn’t save. Check your connection and try again."

/**
 * What saving an edited card has to send: lines added, changed and removed.
 * Lines left empty are removed; lines the owner can't edit are never touched.
 *
 * @param {{id: string, text: string, editable: boolean}[]} before the card's items
 * @param {{id: string|null, text: string, removed?: boolean}[]} draft the fields, `id: null` for a new line
 */
export function cardChanges(before, draft) {
  const was = new Map(before.filter((i) => i.editable).map((i) => [i.id, i.text]))
  const add = []
  const change = []
  const remove = []
  for (const line of draft) {
    const text = line.text.trim()
    if (!line.id) {
      if (text && !line.removed) add.push(text)
    } else if (was.has(line.id)) {
      if (line.removed || !text) remove.push(line.id)
      else if (text !== was.get(line.id).trim()) change.push({ id: line.id, text })
    }
  }
  return { add, change, remove }
}

/** Sends a card's changes, one request each. Stops at the first refusal and throws it. */
export async function saveCard({ card, clientId, changes }) {
  for (const id of changes.remove) await removeContextItem(id)
  for (const { id, text } of changes.change) await changeContextItem(id, text)
  for (const text of changes.add) await addContextItem({ card, text, clientId })
}
