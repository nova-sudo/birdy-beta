"use client"

// components/clients/DiagnosticsFunnel.jsx
// The Client Detail overview's diagnostics engine — the four cohort stages as a
// vertical list on a connecting spine, over a pinned verdict panel.
//
// The verdict is not copy. diagnoseFunnel finds the stage that fell hardest and
// contrasts it with the one feeding it, which is what localises a problem to a
// step rather than to lead flow. It only speaks when there is a previous window
// to compare against; where the selected preset has none, the panel says so
// rather than reporting health it cannot see.

import { useState } from "react"
import { Activity, Users, FileText, Phone, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DiagnosticBanner } from "@/components/portfolio"
import { deltaTone } from "@/lib/portfolio-metrics"
import { formatSharePct } from "@/lib/client-funnel"

const ICONS = {
  leads: Users,
  in_crm: FileText,
  called: Phone,
  closes: Trophy,
}

const TINTS = {
  leads: "#6B4EE6",
  in_crm: "#3B7DD6",
  called: "#E0920A",
  closes: "#25A55F",
}

function Shell({ children, footer }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-pd-border bg-pd-surface">
      <div className="flex flex-1 flex-col px-[22px] py-5">
        <div className="mb-3.5 flex items-center gap-[9px]">
          <Activity className="size-4 shrink-0 text-pd-primary" aria-hidden="true" />
          <p className="font-pd-display text-[15px] font-semibold text-pd-ink">
            Diagnostics engine
          </p>
        </div>
        {children}
      </div>
      {footer}
    </div>
  )
}

/** The design's pill: an arrow and a percentage, tinted by whether it is good news. */
function StageDelta({ direction, delta }) {
  const tone = deltaTone(direction)
  return (
    <span
      className={`flex shrink-0 items-center gap-0.5 rounded-full px-2 py-[3px] text-[11px] font-semibold ${tone.text} ${tone.bg}`}
    >
      <span aria-hidden="true">{direction === "up" ? "↑" : "↓"}</span>
      <span className="sr-only">{direction} </span>
      {delta}%
    </span>
  )
}

export function DiagnosticsFunnel({
  stages,
  loading = false,
  diagnosis = null,
  // False where the window has no expressible previous period, which is most of
  // them — see PREVIOUS_PERIOD. Without it the stages carry no movement and a
  // verdict would be an assertion with nothing behind it.
  hasComparison = false,
  onViewCalls,
}) {
  const [dismissed, setDismissed] = useState(false)

  if (loading) {
    return (
      <Shell>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-[30px] shrink-0 rounded-[9px]" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </Shell>
    )
  }

  if (!stages) {
    // No funnel cached for this window. Saying so beats drawing four zeroes,
    // which reads as "no results" when it means "not measured".
    return (
      <Shell>
        <p className="py-8 text-center text-[12px] text-pd-faint">
          No funnel data for this window yet.
        </p>
      </Shell>
    )
  }

  const verdict =
    dismissed ? null : !hasComparison ? (
      <div className="border-t border-pd-border bg-pd-canvas px-5 py-[14px]">
        <p className="text-[12px] leading-[1.45] text-pd-faint">
          No stage movement for this window — switch to Today or Last 7 days to
          see how each stage is trending.
        </p>
      </div>
    ) : diagnosis ? (
      <div
        className={`border-t px-5 py-4 ${
          diagnosis.state === "problem"
            ? "border-pd-danger-border bg-pd-danger-surface"
            : "border-pd-healthy-border bg-pd-healthy-surface"
        }`}
      >
        <DiagnosticBanner
          state={diagnosis.state}
          title={diagnosis.title}
          body={diagnosis.body}
          className="rounded-none border-0 bg-transparent p-0"
        />

        {diagnosis.state === "problem" && (
          <div className="mt-3 flex gap-2">
            {onViewCalls && (
              <Button
                size="sm"
                onClick={onViewCalls}
                className="h-auto rounded-[9px] bg-pd-primary px-[13px] py-2 text-[12.5px] font-semibold text-white hover:bg-[#5A3FD6]"
              >
                View calls
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDismissed(true)}
              className="h-auto rounded-[9px] border-[#F0DADA] bg-white px-[13px] py-2 text-[12.5px] font-semibold text-pd-body hover:bg-white"
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
    ) : null

  return (
    <Shell footer={verdict}>
      <div className="relative flex flex-1 flex-col">
        {/* The spine, running behind the icons. Inset top and bottom by half a
            chip so it starts and ends at the first and last icon centres
            rather than floating past them. */}
        <span
          className="absolute bottom-[15px] left-[15px] top-[15px] w-0.5 bg-pd-divider"
          aria-hidden="true"
        />

        <ol className="relative flex flex-1 flex-col">
          {stages.map((stage) => {
            const Icon = ICONS[stage.id] ?? Users
            return (
              <li key={stage.id} className="flex flex-1 items-center gap-[10px] px-0.5 py-2.5">
                {/* White chip on the spine rather than a tinted one — the design
                    lifts it off the line with a shadow so the line reads as
                    passing behind it. */}
                <span
                  className="relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-white shadow-[0_1px_3px_rgba(30,25,60,.12)]"
                  style={{ color: TINTS[stage.id] ?? TINTS.leads }}
                >
                  <Icon className="size-[15px]" aria-hidden="true" />
                </span>

                <span className="shrink-0 text-[12.5px] text-pd-body">
                  {stage.label}
                </span>

                {/* Pushes the pill and count to the right edge, as the design
                    draws it. */}
                <span className="min-w-0 flex-1 truncate pl-2.5 text-[11px] text-pd-faint">
                  {formatSharePct(stage.share)}
                </span>

                {stage.direction && (
                  <StageDelta direction={stage.direction} delta={stage.delta} />
                )}

                <span className="min-w-[40px] shrink-0 text-right font-pd-display text-[19px] font-bold text-pd-ink">
                  {stage.count.toLocaleString()}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </Shell>
  )
}
