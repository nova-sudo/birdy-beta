"use client"

import { Phone } from "lucide-react"
import { formatDuration } from "@/lib/lead-detail"
import { CallMedia, capitalise, formatCallTime } from "./LeadCallsTab"

// ─── Lead detail: right column ──────────────────────────────────────────────
// The conversation with this lead, grouped by day. Phase 1 has only calls —
// messages and the composer arrive with GHL messaging (phase 2) — so the
// thread always ends with the note saying so.

export const NO_MESSAGES_NOTE = "Messages will appear here once GHL messaging is connected."

function CallCard({ call }) {
  const outbound = call.direction !== "inbound"
  const time = formatCallTime(call.started_at).split(", ")[1] || ""
  const title = `${capitalise(call.direction) || "Phone"} call${call.status ? ` · ${call.status}` : ""}`

  return (
    <div className={outbound ? "flex justify-end" : "flex justify-start"}>
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-pd-border bg-pd-surface px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pd-success-bg text-pd-success">
              <Phone className="size-[13px]" aria-hidden="true" />
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

/** @param {{day: string, items: object[]}[]} days threadDays() output */
export function LeadThread({ days }) {
  return (
    <section
      aria-label="Conversation"
      className="flex min-h-[320px] flex-col gap-5 rounded-2xl border border-pd-border bg-pd-canvas px-4 py-6 md:px-8"
    >
      {days.map(({ day, items }) => (
        <div key={day} className="space-y-4">
          <p className="text-center text-[11px] text-pd-subtle">{day}</p>
          {items.map((item) => (item.kind === "call" ? <CallCard key={item.id} call={item} /> : null))}
        </div>
      ))}
      <p className="mt-auto text-center text-[12px] text-pd-subtle">{NO_MESSAGES_NOTE}</p>
    </section>
  )
}
