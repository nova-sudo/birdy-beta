"use client"

import { PhoneIncoming, PhoneOutgoing } from "lucide-react"
import { formatDuration } from "@/lib/lead-detail"

// ─── Lead detail: Calls tab ─────────────────────────────────────────────────
// Call history, newest first: direction · status, when, how long, and the
// recording and transcript when the call log has them. CallMedia is shared
// with the thread's call cards.

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

export function capitalise(word) {
  if (!word) return ""
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** "17 Jul, 4:59 PM", or "" when there is no usable time. */
export function formatCallTime(iso) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const p = Object.fromEntries(whenFormat.formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${(p.dayPeriod || "").toUpperCase()}`.trim()
}

// Call logs come from several dialers; a transcript may be plain text or a
// list of segments.
function transcriptText(transcript) {
  if (!transcript) return ""
  if (typeof transcript === "string") return transcript
  if (Array.isArray(transcript)) {
    return transcript
      .map((s) => (typeof s === "string" ? s : [s?.speaker, s?.text].filter(Boolean).join(": ")))
      .filter(Boolean)
      .join("\n")
  }
  return transcript.text || ""
}

/** The native player and a Transcript disclosure, each only when there is one. */
export function CallMedia({ call }) {
  const transcript = transcriptText(call.transcript)
  if (!call.recording_url && !transcript) return null

  return (
    <div className="mt-2.5 space-y-2">
      {call.recording_url && (
        <audio controls preload="none" src={call.recording_url} className="h-9 w-full">
          <a href={call.recording_url}>Download the recording</a>
        </audio>
      )}
      {transcript && (
        <details className="group rounded-lg border border-pd-border bg-pd-surface">
          <summary className="cursor-pointer select-none px-3 py-1.5 text-[12px] font-semibold text-pd-primary">
            Transcript
          </summary>
          <p className="max-h-60 overflow-y-auto whitespace-pre-line border-t border-pd-divider px-3 py-2 text-[12px] text-pd-body">
            {transcript}
          </p>
        </details>
      )}
    </div>
  )
}

export function LeadCallsTab({ calls }) {
  const list = [...(calls || [])].sort((a, b) => new Date(b.started_at) - new Date(a.started_at))

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-pd-subtle">
        Call history · {list.length}
      </h3>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-pd-subtle">No calls logged for this lead yet.</p>
      ) : (
        <ul className="divide-y divide-pd-divider">
          {list.map((call) => {
            const Icon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing
            const sub = [formatCallTime(call.started_at), call.source].filter(Boolean).join(" · ")
            return (
              <li key={call.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pd-primary-tint text-pd-primary">
                    <Icon className="size-[14px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-pd-ink">
                      {[capitalise(call.direction) || "Call", call.status].filter(Boolean).join(" · ")}
                    </p>
                    {sub && <p className="mt-0.5 text-[11.5px] text-pd-subtle">{sub}</p>}
                  </div>
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-pd-ink">
                    {formatDuration(call.duration_seconds)}
                  </span>
                </div>
                <CallMedia call={call} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
