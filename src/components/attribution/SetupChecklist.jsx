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

import { cn } from "@/lib/utils"

export default function SetupChecklist({ diagnostics, polling }) {
  if (!diagnostics) return null

  // An instant-form client was never asked to install anything; showing them a
  // wall of crosses would be telling them to fix a setup they don't have.
  if (!diagnostics.applicable) {
    return (
      <div className="flex items-start gap-2 rounded-[12px] border border-pd-border bg-pd-canvas px-4 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-pd-subtle" aria-hidden="true" />
        <p className="text-[12.5px] leading-[1.5] text-pd-body">
          This client&apos;s leads come straight from Meta Instant Forms, so there is
          nothing to install. Their leads and CPL are already reported.
        </p>
      </div>
    )
  }

  const stages = diagnostics.stages || []

  return (
    <div className="flex flex-col gap-2">
      {stages.map((stage) => {
        const isBlocker = stage.key === diagnostics.next_step
        return (
          <div
            key={stage.key}
            className={cn(
              "rounded-[12px] border px-3.5 py-3",
              isBlocker
                ? "border-pd-border-strong bg-pd-surface"
                : "border-pd-border bg-pd-surface",
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  stage.done
                    ? "bg-pd-success-bg text-pd-success"
                    : "bg-pd-divider text-pd-faint",
                )}
              >
                {stage.done ? (
                  <Check className="size-[12px]" aria-hidden="true" />
                ) : (
                  <CircleDashed className="size-[12px]" aria-hidden="true" />
                )}
              </span>

              <span
                className={cn(
                  "text-[13px]",
                  stage.done ? "text-pd-body" : "font-medium text-pd-ink",
                )}
              >
                {stage.label}
              </span>

              {stage.optional && !stage.done && (
                <span className="rounded-full bg-pd-divider px-2 py-0.5 text-[10.5px] text-pd-faint">
                  optional
                </span>
              )}

              {isBlocker && polling && (
                <span className="ml-auto text-[11px] text-pd-faint">checking…</span>
              )}
            </div>

            {/* Only the thing actually blocking progress explains itself. */}
            {isBlocker && stage.hint && (
              <p className="mt-2 pl-[30px] text-[12px] leading-[1.5] text-pd-body">
                {stage.hint}
              </p>
            )}
          </div>
        )
      })}

      {diagnostics.complete && (
        <div className="flex items-center gap-2 rounded-[12px] border border-pd-healthy-border bg-pd-healthy-surface px-3.5 py-3">
          <Check className="size-4 shrink-0 text-pd-success" aria-hidden="true" />
          <p className="text-[12.5px] text-pd-body">
            Tracking is working. Leads from this client&apos;s landing pages are being
            counted against the ads that produced them.
          </p>
        </div>
      )}
    </div>
  )
}
