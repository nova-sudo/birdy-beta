"use client"

import { MessageSquare, Phone } from "lucide-react"
import { Reveal } from "@/components/motion"
import { toneClass } from "@/components/portfolio"
import { cameFrom, formatDuration, initials, leadTitle, statusPill } from "@/lib/lead-detail"
import { cn } from "@/lib/utils"

// ─── Lead detail: header ────────────────────────────────────────────────────
// Redesign option A ("Editorial"): a large identity row (initials avatar, name,
// status pill, client · source) with Call / Message actions, then a strip of
// four figures. "Message" only moves focus to the composer; there is no
// separate message flow.

// statusPill's tones, said in the kit's tone words.
const PILL_TONE = { won: "success", lost: "danger", open: "amber", neutral: "neutral" }

export const COMPOSER_INPUT_ID = "lead-composer-input"

const createdFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
// GHL sends no currency with an opportunity, so the value is shown as a number.
const valueFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 })

function formatCreated(iso) {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : createdFormat.format(date)
}

/** The first opportunity's value, or "—". */
export function dealValue(opportunities) {
  const value = Number(opportunities?.[0]?.monetary_value)
  return Number.isFinite(value) && value > 0 ? valueFormat.format(value) : "—"
}

function Figure({ label, value }) {
  return (
    <div className="min-w-0 border-pd-divider px-5 py-4 first:pl-0 sm:border-l sm:first:border-l-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-pd-subtle">{label}</dt>
      <dd className="mt-1 truncate font-pd-display text-[22px] font-bold tabular-nums text-pd-ink">{value}</dd>
    </div>
  )
}

export function LeadHeader({ detail, messageCount = 0 }) {
  const contact = detail.contact || {}
  const name = leadTitle(contact)
  const pill = statusPill(detail.opportunities)
  const engagement = detail.engagement || {}
  const source = cameFrom(detail)
  const subline = [contact.group_name, source !== "—" ? source : null].filter(Boolean).join(" · ")

  const focusComposer = () => {
    const box = document.getElementById(COMPOSER_INPUT_ID)
    box?.scrollIntoView({ behavior: "smooth", block: "center" })
    box?.focus({ preventScroll: true })
  }

  return (
    <header className="border-b border-pd-divider bg-pd-surface px-5 pt-5 md:px-7 md:pt-6">
      <Reveal className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#F3E8DD,#E9DFF7)] font-pd-display text-[19px] font-bold text-[#6A4A2E]"
        >
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-pd-display text-[24px] font-bold leading-tight tracking-[-0.01em] text-pd-ink md:text-[26px]">
              {name}
            </h1>
            {pill?.label && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", toneClass(PILL_TONE[pill.tone]))}>
                {pill.label}
              </span>
            )}
          </div>
          {subline && <p className="mt-0.5 truncate text-[13.5px] text-pd-muted">{subline}</p>}
        </div>
        <div className="flex gap-2">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-pd-border bg-pd-surface px-4 text-[13px] font-medium text-pd-ink transition-colors hover:border-pd-border-strong"
            >
              <Phone className="size-4" aria-hidden="true" />
              Call
            </a>
          )}
          <button
            type="button"
            onClick={focusComposer}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-pd-primary px-4 text-[13px] font-medium text-white shadow-[0_6px_14px_-6px_rgba(91,63,214,0.6)] transition-transform hover:-translate-y-px"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            Message
          </button>
        </div>
      </Reveal>

      <dl className="mt-5 grid grid-cols-2 border-t border-pd-divider sm:grid-cols-4">
        {[
          ["Deal value", dealValue(detail.opportunities)],
          ["Time to close", formatDuration(engagement.time_to_close_seconds)],
          ["Touchpoints", (engagement.touchpoints ?? 0) + messageCount],
          ["Created", formatCreated(contact.date_added)],
        ].map(([label, value]) => (
          <Figure key={label} label={label} value={value} />
        ))}
      </dl>
    </header>
  )
}
