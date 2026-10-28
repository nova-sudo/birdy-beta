"use client"

import { LeadSummaryCard } from "./LeadSummaryCard"
import { cameFrom, statusPill } from "@/lib/lead-detail"

// ─── Lead detail: Profile tab ───────────────────────────────────────────────
// The AI summary, contact rows (grey label left, value right), the first
// three tags with the rest folded into "+N", and the call and message counts.
// Time to close and touchpoints sit in LeadHeader's figure strip.

const TAGS_SHOWN = 3

const createdFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function formatCreated(iso) {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : createdFormat.format(date)
}

function InfoRow({ label, children, valueClassName = "text-pd-ink" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <p className="shrink-0 text-pd-subtle">{label}</p>
      <p className={`min-w-0 break-words text-right font-medium ${valueClassName}`}>{children}</p>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h3 className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-pd-subtle">
      {children}
    </h3>
  )
}

export function LeadProfileTab({ detail, messageCount = 0, summary = null }) {
  const contact = detail.contact || {}
  const tags = contact.tags || []
  const stage = statusPill(detail.opportunities)?.label
  const engagement = detail.engagement || {}

  const figures = [
    ["Messages", messageCount],
    ["Dials", engagement.dials ?? 0],
    ["Calls answered", engagement.answered ?? 0],
  ]

  return (
    <div className="space-y-6">
      {summary && <LeadSummaryCard {...summary} />}
      <div className="space-y-3">
        <InfoRow label="Phone">{contact.phone || "—"}</InfoRow>
        <InfoRow label="Email">{contact.email || "—"}</InfoRow>
        <InfoRow label="Came from">{cameFrom(detail)}</InfoRow>
        <InfoRow label="Created">{formatCreated(contact.date_added)}</InfoRow>
        <InfoRow label="Pipeline stage" valueClassName={stage ? "text-pd-amber" : undefined}>
          {stage || "—"}
        </InfoRow>
      </div>

      <div className="border-t border-pd-divider pt-5">
        <SectionHeading>
          Tags
          <span className="rounded-full bg-pd-primary-tint px-1.5 py-px text-pd-primary">{tags.length}</span>
        </SectionHeading>
        {tags.length === 0 ? (
          <p className="text-[12.5px] text-pd-subtle">No tags.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, TAGS_SHOWN).map((tag) => (
              <span key={tag} className="rounded-full bg-pd-divider px-2.5 py-1 text-[11.5px] font-medium text-pd-body">
                {tag}
              </span>
            ))}
            {tags.length > TAGS_SHOWN && (
              <span
                className="rounded-full bg-pd-primary-tint px-2.5 py-1 text-[11.5px] font-semibold text-pd-primary"
                title={tags.slice(TAGS_SHOWN).join(", ")}
              >
                +{tags.length - TAGS_SHOWN}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-pd-divider pt-5">
        <SectionHeading>Activity</SectionHeading>
        <dl className="space-y-2">
          {figures.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between text-[12.5px]">
              <dt className="text-pd-body">{label}</dt>
              <dd className="font-semibold text-pd-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
