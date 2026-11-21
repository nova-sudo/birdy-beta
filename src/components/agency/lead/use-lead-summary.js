"use client"

// The lead's AI summary: GET .../summary once per lead (it generates when nothing
// is cached); refresh POSTs. Both answer 200 with {status, summary, generated_at,
// stale}. "generating" means another request is writing it, so it asks again.

import { useCallback, useEffect, useRef, useState } from "react"
import { apiRequest } from "@/lib/api"

const POLL_MS = 2000
// Matches the backend's 30s generation lease (12 x 2s = 24s of re-checks).
const POLL_MAX = 12

// Re-render every `ms` so relative times stay true while the page is open.
export function useNow(ms) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function useLeadSummary(contactId, enabled = true) {
  // null while the first fetch runs.
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const req = useRef(0)
  const inFlight = useRef(false)
  const timer = useRef(null)
  const endpoint = `/api/leads/contact/${encodeURIComponent(contactId)}/summary`

  const run = useCallback(async (method) => {
    if (inFlight.current) return
    inFlight.current = true
    const id = ++req.current
    setBusy(true)
    try {
      // "generating" means another request is writing the summary: ask again.
      for (let attempt = 0; ; attempt++) {
        const res = await apiRequest(endpoint, method === "POST" && attempt === 0 ? { method } : undefined)
        if (!res.ok) throw new Error(`The summary request failed (${res.status}).`)
        const next = await res.json()
        if (id !== req.current) return
        if (next.status !== "generating") {
          setData(next)
          return
        }
        if (attempt >= POLL_MAX) throw new Error("The summary took too long.")
        setData(next)
        await new Promise((resolve) => {
          timer.current = setTimeout(resolve, POLL_MS)
        })
        if (id !== req.current) return
      }
    } catch {
      if (id !== req.current) return
      setData((prev) => ({ ...(prev || {}), status: "failed" }))
    } finally {
      if (id === req.current) {
        inFlight.current = false
        setBusy(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    // A different lead starts over; any older request is dropped.
    req.current += 1
    clearTimeout(timer.current)
    inFlight.current = false
    setData(null)
    setBusy(false)
    if (enabled) run("GET")
    return () => {
      req.current += 1
      clearTimeout(timer.current)
    }
  }, [enabled, run])

  return { data, busy, onRefresh: () => run("POST") }
}
