"use client"

// components/clients/DiagnosticsFunnel.jsx
// The Client Detail overview's diagnostics card — the four cohort stages as a
// vertical list on a connecting spine.
//
// The design pairs this with a red "Problem found" panel that names the failing
// stage and offers "View calls". That is deliberately not built: deciding what
// counts as a problem is a rule nobody has written down, and a wrong one would
// send people chasing clients that are fine. The stages are shown; the
// judgement is left to the reader.

import { Users, FileText, Phone, Trophy } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatShare } from "@/lib/client-funnel"

const ICONS = {
  leads: Users,
  in_crm: FileText,
  called: Phone,
  closes: Trophy,
}

const TINTS = {
  leads: { color: "#6B4EE6", bg: "#F1EEFC" },
  in_crm: { color: "#3B7DD6", bg: "#EAF1FD" },
  called: { color: "#E0920A", bg: "#FDF6EC" },
  closes: { color: "#25A55F", bg: "#EDF8F1" },
}

function Shell({ children }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-pd-border bg-pd-surface">
      <div className="border-b border-pd-border px-[22px] py-4">
        <p className="font-pd-display text-[15px] font-semibold text-pd-ink">
          Diagnostics
        </p>
        <p className="mt-0.5 text-[11.5px] text-pd-faint">
          How far this window&rsquo;s leads have got
        </p>
      </div>
      {children}
    </div>
  )
}

export function DiagnosticsFunnel({ stages, loading = false }) {
  if (loading) {
    return (
      <Shell>
        <div className="space-y-4 px-[22px] py-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-[30px] shrink-0 rounded-full" />
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
        <p className="px-[22px] py-8 text-center text-[12px] text-pd-faint">
          No funnel data for this window yet.
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="relative px-[22px] py-5">
        {/* The spine, running behind the icons. Inset top and bottom by half a
            circle so it starts and ends at the first and last icon centres
            rather than floating past them. */}
        <span
          className="absolute left-[37px] top-[35px] bottom-[35px] w-0.5 bg-pd-divider"
          aria-hidden="true"
        />

        <ol className="relative space-y-[18px]">
          {stages.map((stage) => {
            const Icon = ICONS[stage.id] ?? Users
            const tint = TINTS[stage.id] ?? TINTS.leads
            return (
              <li key={stage.id} className="flex items-center gap-3">
                <span
                  className="relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: tint.bg, color: tint.color }}
                >
                  <Icon className="size-[15px]" aria-hidden="true" />
                </span>

                <span className="shrink-0 text-[13px] font-semibold text-pd-ink">
                  {stage.label}
                </span>

                {/* Pushes the count to the right edge, as the design draws it. */}
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-pd-faint">
                  {formatShare(stage.share)}
                </span>

                <span className="shrink-0 font-pd-display text-[15px] font-bold text-pd-ink">
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
