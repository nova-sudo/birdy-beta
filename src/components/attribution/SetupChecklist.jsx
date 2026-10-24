"use client"

// The live verification list on the setup portal.
//
// The point of this component is the sentence, not the tick. A red cross with
// nothing beside it tells someone their tracking is broken and leaves them to
// guess whether the problem is the snippet, the ads, or the form — which are
// three different people to go and talk to. So only the first unmet stage
// explains itself, and it explains the one cause that is actually likely at
// that point.
//
// Later stages stay quiet: telling someone their leads aren't tied to an ad
// when the script isn't even installed yet is noise that makes the real problem
// harder to find.

import { Check, CircleDashed, Info } from "lucide-react"

import { Badge, Notice, Surface } from "@/components/ds"
import { cn } from "@/lib/utils"

export default function SetupChecklist({ diagnostics, polling }) {
  if (!diagnostics) return null

  // An instant-form client was never asked to install anything; showing them a
  // wall of crosses would be telling them to fix a setup they don't have.
  if (!diagnostics.applicable) {
    return (
      <Notice tone="neutral">
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            This client&apos;s leads come straight from Meta Instant Forms, so there is
            nothing to install. Their leads and CPL are already reported.
          </span>
        </span>
      </Notice>
    )
  }

  const stages = diagnostics.stages || []

  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage) => {
        const isBlocker = stage.key === diagnostics.next_step
        return (
          <Surface key={stage.key} data-slot="checklist-stage" className="px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  stage.done ? "bg-success-soft text-success-ink" : "bg-muted text-muted-foreground"
                )}
              >
                {stage.done ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-3" aria-hidden="true" />
                )}
              </span>

              <span className={cn("text-sm", stage.done ? "text-body" : "font-medium text-foreground")}>
                {stage.label}
              </span>

              {stage.optional && !stage.done && <Badge tone="neutral">optional</Badge>}

              {isBlocker && polling && (
                <span className="ml-auto text-xs text-muted-foreground">checking…</span>
              )}
            </div>

            {/* Only the thing actually blocking progress explains itself. */}
            {isBlocker && stage.hint && (
              <p className="mt-2 pl-7 text-sm leading-normal text-body">{stage.hint}</p>
            )}
          </Surface>
        )
      })}

      {diagnostics.complete && (
        <Notice tone="success">
          <span className="flex items-center gap-2">
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span>
              Tracking is working. Leads from this client&apos;s landing pages are being
              counted against the ads that produced them.
            </span>
          </span>
        </Notice>
      )}
    </div>
  )
}
