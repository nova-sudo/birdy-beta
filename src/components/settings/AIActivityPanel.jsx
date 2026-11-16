"use client"

// components/settings/AIActivityPanel.jsx
// The side panel for one AI activity entry: what was asked, what Birdy did and
// what it cost. Also home to the small formatters the list shares with it.
// Full screen with a back button below 768px, a column beside the table above.

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, X } from "lucide-react"
import { apiRequest } from "@/lib/api"
import AppLogo from "@/components/connect/AppLogo"

export const KIND_LABEL = {
  lookup: "Looked up",
  change: "Change",
  preview: "Preview",
  live: "Live change",
  refused: "Refused",
}
export const KIND_DOT = {
  lookup: "bg-pd-border-strong",
  change: "bg-pd-primary",
  preview: "bg-pd-primary",
  live: "bg-pd-warning",
  refused: "bg-pd-danger",
}
const REFUSAL_REASON = {
  view_only: "View-only connection",
  no_subscription: "Subscription inactive",
  out_of_credits: "Out of credits",
  rate_limit: "Too many requests",
  bad_code: "Approval code invalid or expired",
  state_changed: "Changed since the preview",
}
const ACCESS_LABEL = { read: "View my data", write: "View and make changes" }

const pad = (n) => String(n).padStart(2, "0")
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export function formatClock(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Local time: HH:MM today, "Yesterday", otherwise "14 Nov".
export function formatWhen(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  if (sameDay(d, now)) return formatClock(iso)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return "Yesterday"
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatWhenLong(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const when = formatWhen(iso)
  return /^\d/.test(when) && when.includes(":") ? `Today ${when}` : `${when} ${formatClock(iso)}`
}

export function formatCredits(n) {
  return String(Number((Number(n) || 0).toFixed(2)))
}

export function kindLabel(kind, reason) {
  if (kind === "refused" && reason) return `Refused · ${REFUSAL_REASON[reason] || reason}`
  return KIND_LABEL[kind] || kind || ""
}

function prettyArgs(args) {
  if (args == null || (typeof args === "object" && Object.keys(args).length === 0)) return null
  return typeof args === "string" ? args : JSON.stringify(args, null, 2)
}

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-pd-subtle">{title}</h4>
      {children}
    </section>
  )
}

const boxClass = "mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-[10px] border border-pd-border bg-pd-table-head px-3 py-2.5 text-[13px] text-pd-body"

// Below 768px the panel covers the page, so it behaves as a modal dialog there.
const FULL_SCREEN = "(max-width: 767px)"
const isFullScreen = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(FULL_SCREEN).matches

export default function AIActivityPanel({ id, onClose, onOpen }) {
  const panelRef = useRef(null)
  const [modal, setModal] = useState(isFullScreen)
  const [entry, setEntry] = useState(null)
  const [error, setError] = useState(false)
  const [related, setRelated] = useState(null) // { id, at, label }

  useEffect(() => {
    let live = true
    setEntry(null)
    setError(false)
    setRelated(null)
    ;(async () => {
      try {
        const res = await apiRequest(`/api/mcp/activity/${encodeURIComponent(id)}`)
        if (!res.ok) throw new Error("load failed")
        const data = await res.json()
        if (!live) return
        setEntry(data)
        try {
          if (data.confirmed_after) {
            const r = await apiRequest(`/api/mcp/activity/${encodeURIComponent(data.confirmed_after)}`)
            if (r.ok && live) {
              const p = await r.json()
              if (p?.created_at) setRelated({ id: data.confirmed_after, at: p.created_at, label: "Confirmed after the preview at" })
            }
          } else if (data.kind === "preview") {
            const r = await apiRequest(`/api/mcp/activity?confirmed_after=${encodeURIComponent(id)}&from=${String(data.created_at).slice(0, 10)}&limit=1`)
            if (r.ok && live) {
              const hit = (await r.json())?.items?.[0]
              if (hit?.created_at) setRelated({ id: hit.id, at: hit.created_at, label: "Confirmed at" })
            }
          }
        } catch {
          // The related line is a nicety; leave it out.
        }
      } catch {
        if (live) setError(true)
      }
    })()
    return () => { live = false }
  }, [id])

  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(FULL_SCREEN)
    const onChange = () => setModal(mq.matches)
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [])

  // Take focus when the panel opens and give it back to the row that opened it; lock page scroll behind the full-screen one.
  useEffect(() => {
    const opener = document.activeElement
    panelRef.current?.focus()
    return () => { if (opener && opener.isConnected) opener.focus?.() }
  }, [])

  useEffect(() => {
    if (!modal) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [modal])

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const args = entry ? prettyArgs(entry.args) : null
  const credits = entry?.credits || {}
  const clients = (entry?.clients || []).map((c) => c.name).filter(Boolean)

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal={modal ? "true" : "false"}
      aria-label="Activity details"
      tabIndex={-1}
      className="fixed inset-0 z-50 overflow-y-auto bg-white p-4 focus:outline-none md:static md:z-auto md:border-l md:border-pd-border md:p-[18px]"
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-pd-primary md:hidden">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to activity
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="ml-auto hidden size-8 flex-none place-items-center rounded-[8px] text-pd-muted hover:bg-pd-canvas md:grid"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-[13px] text-pd-danger">Couldn't load this entry. Close it and try again.</p>
      ) : !entry ? (
        <p className="mt-4 text-[13px] text-pd-subtle">Loading…</p>
      ) : (
        <div className="mt-3 md:mt-0">
          <h3 className="font-pd-display text-[15px] font-semibold text-pd-ink">{entry.summary}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-pd-subtle">
            <span>{formatWhenLong(entry.created_at)}</span>·
            <span className="inline-flex items-center gap-1.5"><AppLogo name={entry.app_name} />{entry.app_name}{entry.revoked ? " (disconnected)" : ""}</span>
            {ACCESS_LABEL[entry.access] && <>·<span>{ACCESS_LABEL[entry.access]}</span></>}
          </p>

          <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
            {entry.tool_label && (<><dt className="text-pd-subtle">Tool</dt><dd className="break-words text-pd-ink">{entry.tool_label}</dd></>)}
            {clients.length > 0 && (<><dt className="text-pd-subtle">Client</dt><dd className="break-words text-pd-ink">{clients.join(", ")}</dd></>)}
            <dt className="text-pd-subtle">Result</dt>
            <dd>
              <span className={`inline-flex rounded-full px-[9px] py-0.5 text-[12px] font-medium ${
                entry.kind === "refused" ? "bg-pd-danger-bg text-pd-danger"
                  : entry.result_status === "error" ? "bg-pd-danger-bg text-pd-danger"
                  : "bg-pd-success-bg text-pd-success"}`}
              >
                {entry.kind === "refused"
                  ? kindLabel("refused", entry.refusal_reason)
                  : entry.result_status === "error" ? "Didn't go through" : "Done"}
              </span>
            </dd>
            {related && (
              <>
                <dt className="text-pd-subtle">Confirmed</dt>
                <dd className="text-pd-ink">
                  {related.label}{" "}
                  <button type="button" onClick={() => onOpen(related.id)} className="font-medium text-pd-primary hover:underline">
                    {formatClock(related.at)}
                  </button>
                </dd>
              </>
            )}
          </dl>

          {args && (
            <Section title="What was asked">
              <pre className={`${boxClass} font-mono text-[12px]`}>{args}</pre>
            </Section>
          )}
          {(entry.result_excerpt || entry.link) && (
            <Section title="What Birdy did">
              <div className={boxClass}>
                {entry.result_excerpt}
                {entry.link && (
                  <>
                    {entry.result_excerpt ? " " : ""}
                    <a href={entry.link} className="font-medium text-pd-primary hover:underline">Open in Birdy →</a>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section title="Credits">
            <div className="mt-1.5 text-[13px] text-pd-body">
              <div className="flex justify-between gap-3 py-[3px]"><span>Request</span><span className="tabular-nums">{formatCredits(credits.request)}</span></div>
              <div className="flex justify-between gap-3 py-[3px]">
                <span>Data returned ({(entry.response_chars || 0).toLocaleString("en-US")} characters)</span>
                <span className="tabular-nums">{formatCredits(credits.data)}</span>
              </div>
              <div className="flex justify-between gap-3 py-[3px]"><span>Live change</span><span className="tabular-nums">{formatCredits(credits.live)}</span></div>
              <div className="mt-1 flex justify-between gap-3 border-t border-pd-divider pt-1.5 font-semibold text-pd-ink">
                <span>Total</span><span className="tabular-nums">{formatCredits(credits.total)}</span>
              </div>
            </div>
          </Section>
        </div>
      )}
    </aside>
  )
}
