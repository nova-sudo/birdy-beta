"use client"

import { Calendar, GitBranch, Mail, Megaphone, Phone } from "lucide-react"
import { cameFrom, formatDuration, statusPill } from "@/lib/lead-detail"

// ─── Lead detail: Profile tab ───────────────────────────────────────────────
// Contact rows (icon chip, small grey label, value), the first three tags with
// the rest folded into "+N", and the phase-1 engagement figures.

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

function InfoRow({ icon: Icon, label, children, valueClassName = "text-pd-ink" }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-pd-primary-tint text-pd-primary">
        <Icon className="size-[14px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-pd-subtle">{label}</p>
        <p className={`break-words text-[13px] font-medium ${valueClassName}`}>{children}</p>
      </div>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-pd-subtle">
      {children}
    </h3>
  )
}

export function LeadProfileTab({ detail }) {
  const contact = detail.contact || {}
  const tags = contact.tags || []
  const stage = statusPill(detail.opportunities)?.label
  const engagement = detail.engagement || {}

  const figures = [
    ["Time to close", formatDuration(engagement.time_to_close_seconds)],
    ["Total touchpoints", engagement.touchpoints ?? 0],
    ["Dials", engagement.dials ?? 0],
    ["Calls answered", engagement.answered ?? 0],
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-3.5">
        <InfoRow icon={Phone} label="Phone">{contact.phone || "—"}</InfoRow>
        <InfoRow icon={Mail} label="Email">{contact.email || "—"}</InfoRow>
        <InfoRow icon={Megaphone} label="Came from">{cameFrom(detail)}</InfoRow>
        <InfoRow icon={Calendar} label="Created">{formatCreated(contact.date_added)}</InfoRow>
        <InfoRow icon={GitBranch} label="Pipeline stage" valueClassName="text-pd-amber">
          {stage || "—"}
        </InfoRow>
      </div>

      <div className="border-t border-pd-divider pt-5">
        <SectionHeading>
          Tags
          <span className="rounded-md bg-pd-primary-tint px-1.5 py-0.5 text-pd-primary">{tags.length}</span>
        </SectionHeading>
        {tags.length === 0 ? (
          <p className="text-[12.5px] text-pd-subtle">No tags.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, TAGS_SHOWN).map((tag) => (
              <span key={tag} className="rounded-md bg-pd-divider px-2 py-1 text-[11.5px] text-pd-body">
                {tag}
              </span>
            ))}
            {tags.length > TAGS_SHOWN && (
              <span
                className="rounded-md border border-pd-border px-2 py-1 text-[11.5px] font-medium text-pd-primary"
                title={tags.slice(TAGS_SHOWN).join(", ")}
              >
                +{tags.length - TAGS_SHOWN}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-pd-divider pt-5">
        <SectionHeading>Engagement</SectionHeading>
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
