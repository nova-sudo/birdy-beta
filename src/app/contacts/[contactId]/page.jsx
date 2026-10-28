"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ChevronRight, UserX } from "lucide-react"
import { apiRequest } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
import { leadTitle, threadDays } from "@/lib/lead-detail"
import { usePageHeader } from "@/components/page-header"
import { LoadError, LoadingPulse, PdCard } from "@/components/portfolio"
import { LeadProfilePanel } from "@/components/leads/LeadProfilePanel"
import { LeadComposer } from "@/components/leads/LeadComposer"
import { LeadThread } from "@/components/leads/LeadThread"
import { cn } from "@/lib/utils"

// ─── Lead detail ────────────────────────────────────────────────────────────
// One lead, opened from a row in the Leads hub (/contacts). Mock variant 2a:
// the tabbed profile panel on the left (~380px), the thread on the right; on
// a phone the two stack with the thread underneath.
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
    setMessagesNote(null)
    try {
      const res = await apiRequest(`/api/leads/contact/${encodeURIComponent(contactId)}/messages`)
      if (!res.ok) throw new Error(`The messages request failed (${res.status}).`)
      const data = await res.json()
      if (id !== messagesReq.current) return
      setMessages(data.messages || [])
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

  const days = useMemo(() => threadDays(detail?.calls, messages), [detail, messages])

  return (
    <div className={cn(pdFontClass, "w-full p-4 md:p-6")}>
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
        <div className="grid items-start gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-6">
          <LeadProfilePanel detail={detail} messageCount={messages.length} />
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
      )}
    </div>
  )
}
