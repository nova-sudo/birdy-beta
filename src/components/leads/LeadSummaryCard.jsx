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

export function useLeadSummary(contactId, enabled = true) {
  // null while the first fetch runs.
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const req = useRef(0)
  const inFlight = useRef(false)
  const endpoint = `/api/leads/contact/${encodeURIComponent(contactId)}/summary`

  const run = useCallback(async (method) => {
    if (inFlight.current) return
    inFlight.current = true
    const id = ++req.current
    setBusy(true)
    try {
      const res = await apiRequest(endpoint, method === "POST" ? { method } : undefined)
      if (!res.ok) throw new Error(`The summary request failed (${res.status}).`)
      const next = await res.json()
      if (id !== req.current) return
      setData(next)
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
    inFlight.current = false
    setData(null)
    setBusy(false)
    if (enabled) run("GET")
    return () => {
      req.current += 1
    }
  }, [enabled, run])

  return { data, busy, onRefresh: () => run("POST") }
}

export function LeadSummaryCard({ data, busy = false, onRefresh }) {
  if (data?.status === "unavailable") return null

  const loading = data === null
  const status = data?.status
  const text = data?.summary
  const when = timeAgo(data?.generated_at)

  return (
    <section aria-label="AI summary" className="rounded-xl bg-pd-primary-tint p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-[14px] text-pd-primary" aria-hidden="true" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-pd-primary">AI summary</h3>
        <span className="ml-auto flex items-center gap-1.5">
          {when && <span className="text-[11px] text-pd-subtle">{when}</span>}
          {!loading && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={busy}
              aria-label="Regenerate summary"
              className="flex size-6 items-center justify-center rounded-md text-pd-primary hover:bg-pd-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      <div aria-live="polite">
        {loading && <p className="text-[13px] leading-relaxed text-pd-subtle">Writing a summary…</p>}
        {!loading && busy && !text && (
          <p className="text-[13px] leading-relaxed text-pd-subtle">Writing a summary…</p>
        )}
        {text && <p className="text-[13px] leading-relaxed text-pd-ink">{text}</p>}
        {status === "ok" && data.stale && (
          <p className="mt-1.5 text-[11.5px] text-pd-amber">New activity since this summary.</p>
        )}
        {status === "blocked" && (
          <p className="mt-1.5 text-[12.5px] text-pd-body">
            You&apos;re out of credits. Top up to generate AI summaries.{" "}
            <Link href="/credits" className="font-semibold text-pd-primary hover:underline">
              Top up
            </Link>
          </p>
        )}
        {status === "failed" && (
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
