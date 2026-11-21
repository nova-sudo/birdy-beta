// Sending a chat message with live progress.
//
// POST /api/chat/stream answers with a text/event-stream:
//   event: route   data = the whole current route, re-sent on every change
//   event: final   data = exactly what POST /api/chat would have returned
//   event: error   data = { "message": "..." }
//
// If that endpoint is missing or fails before its first event (404, 405, a
// network error, a 5xx), the message is sent to the plain /api/chat instead,
// so a server without streaming behaves exactly as before. Auth, headers and
// the base URL come from apiRequest, the same path chat-store has always used.

import { apiRequest } from "@/lib/api"

/** Statuses the caller handles itself (no AI key, out of credits): never retried on the other endpoint. */
// 423: the agent is locked until it is set up; its body says which one it waits on.
const PASS_THROUGH = new Set([402, 412, 423])

/**
 * Splits a text/event-stream into events as chunks arrive. Chunks may cut an
 * event, a line or even a multi-byte character anywhere.
 *
 * @param {(event: {event: string, data: string}) => void} onEvent
 */
export function createEventParser(onEvent) {
  let buffer = ""
  let event = ""
  let data = []

  const dispatch = () => {
    if (data.length) onEvent({ event: event || "message", data: data.join("\n") })
    event = ""
    data = []
  }

  const line = (raw) => {
    if (raw === "") return dispatch()
    if (raw.startsWith(":")) return // a comment, often a keep-alive
    const colon = raw.indexOf(":")
    const field = colon === -1 ? raw : raw.slice(0, colon)
    let value = colon === -1 ? "" : raw.slice(colon + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    if (field === "event") event = value
    else if (field === "data") data.push(value)
  }

  return {
    /** Feed decoded text. */
    push(text) {
      buffer += text
      let nl
      while ((nl = buffer.search(/\r\n|\r|\n/)) !== -1) {
        // A lone \r at the very end may be the first half of \r\n: wait for the next chunk.
        if (buffer[nl] === "\r" && nl === buffer.length - 1) break
        const width = buffer[nl] === "\r" && buffer[nl + 1] === "\n" ? 2 : 1
        line(buffer.slice(0, nl))
        buffer = buffer.slice(nl + width)
      }
    },
    /** The stream ended: an event without its closing blank line still counts. */
    end() {
      if (buffer) line(buffer.replace(/\r$/, ""))
      buffer = ""
      dispatch()
    },
  }
}

const json = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** POST /api/chat, the way chat-store always sent it. */
async function plainChat(body, signal) {
  const res = await apiRequest("/api/chat", { method: "POST", body, signal })
  if (!res.ok) {
    const text = await res.text?.().catch(() => "")
    return { ok: false, status: res.status, data: null, text, streamed: false }
  }
  return { ok: true, status: res.status, data: await res.json(), streamed: false }
}

/**
 * Sends one chat message, streaming the route as it changes.
 *
 * Resolves with `{ ok, status, data, streamed }`: `data` is the /api/chat JSON
 * (null when the request failed), `streamed` says which endpoint answered.
 * A 402 or 412 comes back as-is for the caller to handle. An `error` event, or
 * a stream that breaks after it has started, rejects.
 *
 * @param {object} payload the /api/chat body (it is sent unchanged to either endpoint)
 * @param {{onRoute?: (route: object) => void, signal?: AbortSignal}} [options]
 */
export async function postChat(payload, { onRoute, signal } = {}) {
  const body = JSON.stringify(payload)
  let res
  try {
    res = await apiRequest("/api/chat/stream", { method: "POST", body, signal, headers: { Accept: "text/event-stream" } })
  } catch (err) {
    if (signal?.aborted) throw err
    return plainChat(body, signal)
  }

  if (PASS_THROUGH.has(res.status)) {
    const data = res.status === 423 ? await res.json?.().catch(() => null) ?? null : null
    return { ok: false, status: res.status, data, streamed: true }
  }
  if (!res.ok) return plainChat(body, signal)

  // A server that ignores the stream route and answers with the JSON itself.
  const type = res.headers?.get?.("content-type") ?? ""
  if (!type.includes("text/event-stream") && type.includes("application/json")) {
    return { ok: true, status: res.status, data: await res.json(), streamed: false }
  }

  const reader = res.body?.getReader?.()
  if (!reader) return plainChat(body, signal)

  const decoder = new TextDecoder()
  let started = false
  let final
  let failure
  const parser = createEventParser(({ event, data }) => {
    started = true
    if (event === "route") {
      const route = json(data)
      if (route !== undefined) onRoute?.(route)
    } else if (event === "final") {
      final = json(data) ?? null
    } else if (event === "error") {
      failure = json(data)?.message || "The reply couldn’t be finished."
    }
  })

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.push(typeof value === "string" ? value : decoder.decode(value, { stream: true }))
      if (final !== undefined || failure) break
    }
    parser.push(decoder.decode())
    parser.end()
  } catch (err) {
    if (signal?.aborted) throw err
    if (!started) return plainChat(body, signal)
    throw err
  } finally {
    if (final !== undefined || failure) reader.cancel?.()?.catch?.(() => {})
  }

  if (failure) throw new Error(failure)
  if (final) return { ok: true, status: res.status, data: final, streamed: true }
  // The stream closed without a word: the endpoint is there but did nothing.
  if (!started) return plainChat(body, signal)
  throw new Error("The reply stopped before it was finished.")
}
