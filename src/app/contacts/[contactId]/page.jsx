"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ChevronRight, UserX } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
import { leadTitle, threadDays, withGhlCalls } from "@/lib/lead-detail"
import { usePageHeader } from "@/components/page-header"
import { LoadError, LoadingPulse, PdCard } from "@/components/portfolio"
import { LeadProfilePanel } from "@/components/leads/LeadProfilePanel"
import { LeadHeader } from "@/components/leads/LeadHeader"
import { useLeadSummary } from "@/components/leads/LeadSummaryCard"
import { LeadComposer } from "@/components/leads/LeadComposer"
import { LeadThread } from "@/components/leads/LeadThread"
import { cn } from "@/lib/utils"

// ─── Lead detail ────────────────────────────────────────────────────────────
// One lead, opened from a row in the Leads hub (/contacts). Redesign option A
// ("Editorial"): edge to edge, the identity header and figure strip on top,
// the tabbed profile panel on the left (380px) and the thread on the right.
// On a large screen the page is one screen tall (dvh) and each column scrolls
// on its own; on a phone they stack and the thread is a screen-tall pane.
//
// The lead comes from GET /api/leads/contact/{contactId}, which answers 404
// when the lead is no longer in Birdy — that gets its own message rather than
// the generic failure card, since retrying will not bring it back.
//
// Messages are fetched live from GoHighLevel by GET .../messages once the lead
// has loaded. That call is slow and can fail on its own (missing scope, no
// token), so it has its own status and never blocks or breaks the page.

const LOADING = [
  "Finding this lead…",
  "Matching the ad they came from…",
  "Gathering their calls…",
]

export default function LeadDetailPage() {
  const params = useParams()
  const contactId = decodeURIComponent(params?.contactId || "")

  const [detail, setDetail] = useState(null)
  // "loading" | "ready" | "not-found" | "error"
  const [state, setState] = useState("loading")
  const [error, setError] = useState(null)

  const [messages, setMessages] = useState([])
  // Calls made in GoHighLevel, from the same response as the messages.
  const [ghlCalls, setGhlCalls] = useState([])
  // "loading" | "ok" | "reconnect" | "unavailable"
  const [messagesStatus, setMessagesStatus] = useState("loading")

  // "partial" / "truncated" flags from the endpoint, shown as a note.
  const [messagesNote, setMessagesNote] = useState(null)
  // Only the newest request may write; a slow earlier one is dropped.
  const messagesReq = useRef(0)

  const loadMessages = useCallback(async () => {
    const id = ++messagesReq.current
    setMessagesStatus("loading")
    setMessages([])
    // GHL calls stay until the new answer lands, so a playing card isn't torn down.
    setMessagesNote(null)
    try {
      const res = await apiRequest(`/api/leads/contact/${encodeURIComponent(contactId)}/messages`)
      if (!res.ok) throw new Error(`The messages request failed (${res.status}).`)
      const data = await res.json()
      if (id !== messagesReq.current) return
      setMessages(data.messages || [])
      setGhlCalls(data.calls || [])
      setMessagesNote(
        data.partial
          ? "Some messages couldn't be loaded."
          : data.truncated
            ? "Showing the most recent messages."
            : null
      )
      setMessagesStatus(data.status || "unavailable")
    } catch {
      if (id !== messagesReq.current) return
      setMessages([])
      setMessagesStatus("unavailable")
    }
  }, [contactId])

  // The Journey is fetched on the first open of its tab and kept for the page.
  const [journey, setJourney] = useState(null)
  // "idle" | "loading" | "ready" | "error"
  const [journeyStatus, setJourneyStatus] = useState("idle")
  const journeyReq = useRef(0)
  const journeyStarted = useRef(false)

  const fetchJourney = useCallback(async () => {
    const id = ++journeyReq.current
    journeyStarted.current = true
    setJourneyStatus("loading")
    try {
      const res = await apiRequest(`/api/leads/contact/${encodeURIComponent(contactId)}/journey`)
      if (!res.ok) throw new Error(`The journey request failed (${res.status}).`)
      const data = await res.json()
      if (id !== journeyReq.current) return
      setJourney(data)
      setJourneyStatus("ready")
    } catch {
      if (id !== journeyReq.current) return
      setJourneyStatus("error")
    }
  }, [contactId])

  const openJourney = useCallback(() => {
    if (!journeyStarted.current) fetchJourney()
  }, [fetchJourney])

  useEffect(() => {
    // A different lead starts over.
    journeyReq.current += 1
    journeyStarted.current = false
    setGhlCalls([])
    setJourney(null)
    setJourneyStatus("idle")
  }, [contactId])

  const load = useCallback(async () => {
    setState("loading")
    setError(null)
    try {
      const res = await apiRequest(`/api/leads/contact/${encodeURIComponent(contactId)}`)
      if (res.status === 404) {
        setState("not-found")
        return
      }
      if (!res.ok) throw new Error(`The lead request failed (${res.status}).`)
      setDetail(await res.json())
      setState("ready")
      loadMessages()
    } catch (err) {
      if (err?.status === 404) {
        setState("not-found")
        return
      }
      setError(err?.message || "The request failed.")
      setState("error")
    }
  }, [contactId, loadMessages])

  useEffect(() => {
    load()
  }, [load])

  // Non-blocking: starts once the lead has loaded.
  const summary = useLeadSummary(contactId, state === "ready" && String(detail?.contact?.id) === contactId)

  const name = detail ? leadTitle(detail.contact) : null
  const header = useMemo(
    () => ({
      title: (
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link href="/contacts" className="font-medium text-pd-primary hover:underline">
            Leads
          </Link>
          {name && (
            <>
              <ChevronRight className="size-3.5 shrink-0 text-pd-faint" aria-hidden="true" />
              <span className="truncate font-semibold text-pd-ink">{name}</span>
            </>
          )}
        </nav>
      ),
    }),
    [name]
  )
  usePageHeader(header)

  // The lead with its GHL calls folded into calls and the engagement counts.
  const lead = useMemo(() => (detail ? withGhlCalls(detail, ghlCalls, contactId) : null), [detail, ghlCalls, contactId])
  const days = useMemo(() => threadDays(lead?.calls, messages), [lead, messages])

  return (
    <div
      className={cn(
        pdFontClass,
        // The ready page cancels the shell's padding and fills the screen
        // under the 60px app header; the panels scroll inside it.
        state === "ready" ? "-m-4 flex min-w-0 flex-col md:-m-6 lg:h-[calc(100dvh-3.75rem)] lg:overflow-hidden" : "w-full p-4 md:p-6"
      )}
    >
      {state === "loading" && <LoadingPulse statements={LOADING} className="h-[240px]" />}

      {state === "error" && <LoadError title={"Couldn\u2019t load this lead"} error={error} onRetry={load} />}

      {state === "not-found" && (
        <PdCard className="mx-auto max-w-md text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-pd-neutral-badge text-pd-subtle">
            <UserX className="size-5" aria-hidden="true" />
          </span>
          <h1 className="font-pd-display text-[16px] font-semibold text-pd-ink">
            This lead isn&apos;t in Birdy anymore
          </h1>
          <p className="mt-1 text-[12.5px] text-pd-subtle">
            It may have been deleted or merged in GoHighLevel.
          </p>
          <Link
            href="/contacts"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-pd-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Leads
          </Link>
        </PdCard>
      )}

      {state === "ready" && detail && (
        <div className="flex min-h-0 flex-1 flex-col bg-pd-canvas">
          <LeadHeader detail={lead} messageCount={messages.length} />
          <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
            <LeadProfilePanel
              detail={lead}
              messageCount={messages.length}
              summary={summary}
              journey={journey}
              journeyStatus={journeyStatus === "idle" ? "loading" : journeyStatus}
              onJourneyOpen={openJourney}
              onJourneyRetry={fetchJourney}
            />
            <LeadThread
              days={days}
              leadName={name}
              messagesStatus={messagesStatus}
              messagesNote={messagesNote}
              onRetry={loadMessages}
              composer={
                <LeadComposer
                  contact={detail.contact}
                  contactId={contactId}
                  status={messagesStatus}
                  onSent={(message) => setMessages((prev) => [...prev, message])}
                  onUnconfirmed={loadMessages}
                />
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
