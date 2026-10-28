"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { RefreshCw, Sparkles } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { timeAgo } from "@/lib/lead-detail"
import { cn } from "@/lib/utils"

// ─── Lead detail: AI summary ────────────────────────────────────────────────
// GET .../summary once per lead (generates when nothing is cached); the
// refresh button POSTs. Both answer 200 with {status, summary, generated_at,
// stale}. The refresh button is also the in-flight guard.

const POLL_MS = 2000
// Matches the backend's 30s generation lease (12 x 2s = 24s of re-checks).
const POLL_MAX = 12

// Re-render every `ms` so relative times stay true while the page is open.
function useNow(ms) {
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

export function LeadSummaryCard({ data, busy = false, onRefresh }) {
  // Hooks first: an early return above them breaks when the status changes.
  const now = useNow(60_000)
  if (data?.status === "unavailable") return null

  const loading = data === null || data.status === "generating"
  const status = data?.status
  const text = data?.summary
  const when = timeAgo(data?.generated_at, now)

  return (
    <section aria-label="AI summary" className="rounded-xl border border-pd-primary-pale/60 bg-pd-primary-tint p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-[14px] text-pd-primary" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold text-pd-primary">AI summary</h3>
        <span className="ml-auto flex items-center gap-1.5">
          {when && <span className="text-[11px] text-pd-subtle">{when}</span>}
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy || loading}
            aria-label="Regenerate summary"
            className="flex size-6 items-center justify-center rounded-md text-pd-primary hover:bg-pd-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden="true" />
          </button>
        </span>
      </div>

      <div aria-live="polite">
        {(loading || (busy && !text)) && (
          <p className="text-[13px] leading-relaxed text-pd-subtle">Writing a summary…</p>
        )}
        {text && <p className="text-[13px] leading-relaxed text-pd-ink">{text}</p>}
        {status === "ok" && data.stale && (
          <p className="mt-1.5 text-[11.5px] text-pd-amber">New activity since this summary.</p>
        )}
        {status === "blocked" && (
          <p className="mt-1.5 text-[12.5px] text-pd-body">
            You&apos;re out of credits.{" "}
            <Link href="/credits" className="font-semibold text-pd-primary hover:underline">
              Top up
            </Link>{" "}
            to generate AI summaries.
          </p>
        )}
        {status === "failed" && !busy && (
          <p className="mt-1.5 text-[12.5px] text-pd-body">
            Couldn&apos;t write the summary.{" "}
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              className="font-semibold text-pd-primary hover:underline disabled:opacity-60"
            >
              Try again
            </button>
          </p>
        )}
      </div>
    </section>
  )
}
