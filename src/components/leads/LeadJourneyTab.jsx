"use client"

import Link from "next/link"
import { BarChart3, Check, Eye, Phone, User } from "lucide-react"
import { toneClass } from "@/components/portfolio"
import { formatJourneyTime, formatLocalClock, journeyChip } from "@/lib/lead-detail"
import { cn } from "@/lib/utils"

// ─── Lead detail: Journey tab ───────────────────────────────────────────────
// The lead's timeline, newest first, in the order the endpoint sends it: a
// vertical rail, a small icon per event, a coloured kind chip, the title and
// a grey "{detail} · {time}" line. The endpoint writes the copy; this only
// lays it out. Call titles already carry their duration.

const KIND_ICON = {
  conversion: Check,
  appointment: Check,
  call: Phone,
  visit: Eye,
  stage: BarChart3,
  lead: User,
}

const GLYPH_TEXT = {
  success: "text-pd-success",
  primary: "text-pd-primary",
  amber: "text-pd-amber",
  neutral: "text-pd-subtle",
}

function detailLine(event) {
  const start =
    event.kind !== "appointment"
      ? ""
      : event.starts_at_local
        ? formatLocalClock(event.starts_at)
        : formatJourneyTime(event.starts_at)
  const at = formatJourneyTime(event.at)
  const when =
    event.kind === "appointment" && at ? `${event.appointment_status === "booked" ? "booked" : "updated"} ${at}` : at
  return [event.detail, start && `for ${start}`, when].filter(Boolean).join(" · ")
}

function GhlNote({ ghl }) {
  const cls = "mt-4 text-[12px] text-pd-subtle"
  const live = { "aria-live": "polite" }
  if (ghl === "reconnect") {
    return (
      <p className={cls} {...live}>
        Reconnect GoHighLevel to include appointments and pipeline history.{" "}
        <Link href="/settings" className="font-semibold text-pd-primary hover:underline">
          Open Settings
        </Link>
      </p>
    )
  }
  if (ghl === "unavailable") return <p className={cls} {...live}>Appointments and pipeline history couldn&apos;t be loaded.</p>
  return null
}

/** status: "loading" | "ready" | "error"; journey: { events, ghl }. */
export function LeadJourneyTab({ journey, status = "ready", onRetry }) {
  const events = journey?.events || []
  const body = () => {
    if (status === "loading") return <p aria-live="polite" className="text-[12.5px] text-pd-subtle">Loading journey…</p>
    if (status === "error") {
      return (
        <p aria-live="polite" className="text-[12.5px] text-pd-subtle">
          Couldn&apos;t load the journey.{" "}
          <button type="button" onClick={onRetry} className="font-semibold text-pd-primary hover:underline">
            Try again
          </button>
        </p>
      )
    }
    return (
      <>
        {events.length === 0 ? (
          <p className="text-[12.5px] text-pd-subtle">No journey events yet.</p>
        ) : (
          <ol className="relative">
            {events.map((event, i) => {
              const chip = journeyChip(event.kind)
              const Icon = KIND_ICON[event.kind] || User
              const last = i === events.length - 1
              return (
                <li key={event.id ?? i} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last && <span aria-hidden="true" className="absolute left-[7px] top-5 bottom-0 w-px bg-pd-divider" />}
                  <span
                    className={cn(
                      "relative z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center bg-pd-surface",
                      GLYPH_TEXT[chip.tone]
                    )}
                  >
                    <Icon className="size-3" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        toneClass(chip.tone)
                      )}
                    >
                      {chip.label}
                    </span>
                    <p className="mt-1 text-[13px] font-semibold text-pd-ink">{event.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-pd-subtle">{detailLine(event)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
        <GhlNote ghl={journey?.ghl} />
      </>
    )
  }

  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-pd-subtle">Customer journey</h2>
      {body()}
    </div>
  )
}
