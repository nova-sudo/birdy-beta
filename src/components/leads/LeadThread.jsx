"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { Phone } from "lucide-react"
import { Reveal } from "@/components/motion"
import { formatDuration, initials } from "@/lib/lead-detail"
import { CallMedia, capitalise, formatCallTime } from "./LeadCallsTab"

// ─── Lead detail: right column ──────────────────────────────────────────────
// The conversation with this lead, grouped by day: calls from Birdy's own call
// log interleaved with the GHL messages fetched live, then a status note for
// the message fetch and the composer. Message bodies are always text — email
// arrives with its tags already stripped, and nothing here is set as HTML.

function CallCard({ call }) {
  const outbound = call.direction !== "inbound"
  const time = formatCallTime(call.started_at).split(", ")[1] || ""
  const title = `${capitalise(call.direction) || "Phone"} call${call.status ? ` · ${call.status}` : ""}`

  return (
    <div className={outbound ? "flex justify-end" : "flex justify-start"}>
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl border border-pd-border bg-pd-surface px-3.5 py-3 shadow-[0_2px_8px_-3px_rgba(24,24,27,0.10)]">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pd-primary text-white shadow-[0_4px_10px_-3px_rgba(91,63,214,0.5)]">
              <Phone className="size-[14px]" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-pd-ink">{title}</p>
            <span className="text-[12px] tabular-nums text-pd-subtle">{formatDuration(call.duration_seconds)}</span>
          </div>
          <CallMedia call={call} />
        </div>
        <p className={`mt-1 text-[11px] text-pd-faint ${outbound ? "text-right" : ""}`}>
          {["Call", time].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message, leadName }) {
  const outbound = message.direction === "outbound"
  const time = formatCallTime(message.date).split(", ")[1] || ""
  const attachments = message.attachments || []

  return (
    <div data-direction={message.direction} className={outbound ? "flex justify-end" : "flex items-end justify-start gap-2.5"}>
      {!outbound && (
        <span
          aria-hidden="true"
          className="mb-5 flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[#F3E8DD] text-[11px] font-semibold text-[#8A5A2B]"
        >
          {initials(leadName)}
        </span>
      )}
      <div className="max-w-[min(78%,520px)]">
        <div
          className={
            outbound
              ? "rounded-[20px] rounded-br-md bg-[linear-gradient(135deg,#6A4FE0,#5B3FD6)] px-4 py-2.5 text-white shadow-[0_8px_18px_-10px_rgba(91,63,214,0.7)]"
              : "rounded-[20px] rounded-bl-md border border-pd-border bg-pd-surface px-4 py-2.5 text-pd-ink"
          }
        >
          {message.subject && <p className="mb-1 text-[13.5px] font-semibold">{message.subject}</p>}
          {message.body && <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{message.body}</p>}
          {attachments.length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] underline">
              {attachments.map((url, i) => (
                <a key={`${i}-${url}`} href={url} target="_blank" rel="noopener noreferrer">
                  {`Attachment ${i + 1}`}
                </a>
              ))}
            </p>
          )}
        </div>
        <p className={`mt-1 text-[11px] text-pd-faint ${outbound ? "text-right" : ""}`}>
          {[message.channel, time].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  )
}

function StatusNote({ status, hasItems, onRetry }) {
  const cls = "text-center text-[12px] text-pd-subtle"
  if (status === "loading") return <p className={cls}>Loading messages…</p>
  if (status === "reconnect") {
    return (
      <p className={cls}>
        Reconnect GoHighLevel in Settings to see and send messages.{" "}
        <Link href="/settings" className="font-semibold text-pd-primary hover:underline">
          Open Settings
        </Link>
      </p>
    )
  }
  if (status === "unavailable") {
    return (
      <p className={cls}>
        Messages couldn&apos;t be loaded.{" "}
        <button type="button" onClick={onRetry} className="font-semibold text-pd-primary hover:underline">
          Try again
        </button>
      </p>
    )
  }
  return hasItems ? null : <p className={cls}>No messages yet.</p>
}

/**
 * @param {{day: string, items: object[]}[]} days threadDays() output
 * @param {"loading"|"ok"|"reconnect"|"unavailable"} messagesStatus
 * @param {string} [messagesNote] shown at the top when the message list is partial
 */
export function LeadThread({ days, leadName, messagesStatus, messagesNote, onRetry, composer }) {
  // Like any chat, open on the newest message and follow new ones.
  const scroller = useRef(null)
  const count = days.reduce((n, d) => n + d.items.length, 0)
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count, messagesStatus])

  return (
    <section
      aria-label="Conversation"
      className="flex h-[calc(100dvh-3.75rem)] min-w-0 flex-col bg-pd-canvas bg-[radial-gradient(1200px_400px_at_70%_-10%,#F1EEFB_0%,transparent_60%)] lg:h-auto lg:min-h-0"
    >
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 md:px-10">
        {messagesStatus === "ok" && messagesNote && (
          <p className="text-center text-[11.5px] text-pd-subtle">{messagesNote}</p>
        )}
        {days.map(({ day, items }) => (
          <Reveal key={day} className="flex flex-col gap-3.5">
            <p className="self-center rounded-full border border-pd-border bg-pd-surface px-3 py-1 text-[11.5px] text-pd-subtle">
              {day}
            </p>
            {items.map((item) =>
              item.kind === "call" ? (
                <CallCard key={`call-${item.id}`} call={item} />
              ) : (
                <MessageBubble key={`message-${item.id}`} message={item} leadName={leadName} />
              )
            )}
          </Reveal>
        ))}
        <div className="mt-auto">
          <StatusNote status={messagesStatus} hasItems={days.length > 0} onRetry={onRetry} />
        </div>
      </div>
      <div className="shrink-0 px-3 pb-4 pt-2 md:px-10 md:pb-6">{composer}</div>
    </section>
  )
}
