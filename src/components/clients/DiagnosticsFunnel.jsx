"use client"

// components/clients/DiagnosticsFunnel.jsx
// The Client Detail overview's funnel — the four cohort stages as one segmented
// bar (FunnelBar), with each stage's count, share of the cohort and movement.
//
// The verdict that used to sit under it — which stage fell hardest — is now a
// finding in the page's BirdyRead, where it can be acted on. This card only
// says whether there is a previous window to compare against: where the
// selected preset has none, no stage carries movement and it says so rather
// than implying a flat trend.

import { EmptyState, Frame, FunnelBar } from "@/components/ds"
import { FUNNEL_STAGES } from "@/lib/client-funnel"

// What each stage is called when the bar is only a phone wide.
const SHORT_LABELS = { in_crm: "CRM" }

// The first stage is the CRM cohort (the leads that reached the CRM), not every
// lead the ad accounts report, so it says so.
const LABELS = { leads: "CRM leads" }

const stepOf = (stage) => ({
  key: stage.id,
  label: LABELS[stage.id] ?? stage.label,
  shortLabel: SHORT_LABELS[stage.id],
  // A stage the client has no data source for reads as a dash, not a bold 0 —
  // the Called stage for a client whose sales answer was "I don't call my
  // leads". stage.count stays a real number for callers doing arithmetic.
  value: stage.unavailable ? null : stage.count,
  hint: stage.unavailable ? "Not available — no call-centre integration" : undefined,
  // Percentages are of the cohort (the first stage), not of the stage above.
  share: stage.share,
  delta: stage.direction ? (stage.direction === "down" ? -stage.delta : stage.delta) : undefined,
})

export function DiagnosticsFunnel({
  stages,
  loading = false,
  // False where the window has no expressible previous period, which is most of
  // them — see PREVIOUS_PERIOD. Without it the stages carry no movement.
  hasComparison = false,
  className,
}) {
  return (
    <Frame
      title="Performance funnel"
      description={hasComparison ? "CRM cohort · vs previous period" : "CRM cohort"}
      className={className}
      footer={
        !loading && stages && !hasComparison ? (
          <p>
            No stage movement for this window — switch to Today or Last 7 days to
            see how each stage is trending.
          </p>
        ) : undefined
      }
    >
      <div data-slot="diagnostics-funnel" className="p-5">
        {!loading && !stages ? (
          // No funnel cached for this window. Saying so beats drawing four
          // zeroes, which reads as "no results" when it means "not measured".
          <EmptyState title="No funnel data for this window yet." className="p-4" />
        ) : (
          <FunnelBar loading={loading} steps={(stages ?? FUNNEL_STAGES).map(stepOf)} />
        )}
      </div>
    </Frame>
  )
}
