"use client"

// ─── Lead detail: Ads tab ───────────────────────────────────────────────────
// The ad this lead came from: the creative, the ad's names and copy, when the
// form was submitted, and the lead's form answers. Phase 1 omits CTA and
// placement — no source carries them per lead.

const submittedFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

function formatSubmitted(iso) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(submittedFormat.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.weekday} · ${parts.hour}:${parts.minute} ${(parts.dayPeriod || "").toUpperCase()}`.trim()
}

function platformLabel(attribution) {
  const raw = attribution.platform || ""
  const name = /^(facebook|meta|instagram)$/i.test(raw) ? "Meta" : raw.charAt(0).toUpperCase() + raw.slice(1)
  return attribution.is_organic ? `${name || "Unknown"} · organic` : name || "—"
}

function Section({ title, children }) {
  return (
    <div className="border-t border-pd-divider pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-pd-subtle">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-[12.5px]">
      <dt className="text-pd-subtle">{label}</dt>
      <dd className="break-words text-pd-ink">{children || "—"}</dd>
    </div>
  )
}

export function LeadAdsTab({ attribution }) {
  if (!attribution) {
    return (
      <p className="text-[12.5px] text-pd-subtle">
        Birdy has no ad on record for this lead.
      </p>
    )
  }

  const image = attribution.creative_image || attribution.creative_thumbnail
  const answers = attribution.form_answers || []

  return (
    <div className="space-y-5">
      {image && (
        <Section title="Source ad">
          {/* Ad creatives live on Meta's CDN, which next/image isn't configured for. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={attribution.creative_title || attribution.ad_name || "Ad creative"}
            className="w-full rounded-xl border border-pd-border object-cover"
          />
        </Section>
      )}

      <Section title="Ad details">
        <dl className="space-y-2">
          <Row label="Platform">{platformLabel(attribution)}</Row>
          <Row label="Ad name">{attribution.ad_name}</Row>
          <Row label="Ad set">{attribution.adset_name}</Row>
          <Row label="Campaign">{attribution.campaign_name}</Row>
          <Row label="Ad copy">
            {attribution.creative_body && (
              <span className="whitespace-pre-line">{attribution.creative_body}</span>
            )}
          </Row>
          <Row label="Submitted">{formatSubmitted(attribution.submitted_at)}</Row>
        </dl>
      </Section>

      {answers.length > 0 && (
        <Section title="Form answers">
          <dl className="space-y-3">
            {answers.map((a, i) => (
              <div key={`${a.question}-${i}`} className="text-[12.5px]">
                <dt className="text-pd-subtle">{a.question}</dt>
                <dd className="mt-0.5 font-medium text-pd-ink">{a.answer || "—"}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </div>
  )
}
