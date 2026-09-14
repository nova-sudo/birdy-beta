"use client"

/**
 * Bulk-import GoHighLevel sub-accounts as clients, after onboarding is over.
 *
 * The review table, the Facebook matching and the per-row lead-source column
 * all already existed — but only inside the onboarding wizard, which runs once
 * and never again. An agency that signed up with eight clients and won three
 * more had to add them one at a time through the five-step wizard, re-picking
 * the same GHL and Meta accounts by hand.
 *
 * So this is deliberately a thin shell around the same <ReviewStep> the wizard
 * uses, talking to the same two endpoints. `prepare-review` mints location
 * tokens and flags recent activity; `import-subaccounts` skips any location
 * already imported, so re-opening this after a partial import shows only
 * what's left rather than offering duplicates.
 *
 * Being a thin shell means letting ReviewStep do its own job. It already
 * renders its own loading state — a SpinnerRing over a real or estimated
 * progress bar, because the prep job can take a minute on a large agency — and
 * the first version of this dialog put a second, older loader in front of it
 * and never let that state show. It is handed `review` in both states now and
 * decides for itself.
 *
 * ReviewStep is a fixed-width column (`max-w-[860px]`) that expects its parent
 * to centre it and to supply pd-* fonts on an ancestor, exactly as the
 * onboarding shell does. Both are this component's responsibility.
 *
 * Two things the wizard does that this deliberately doesn't: it never routes
 * through billing (an existing customer already has a plan, and the import
 * endpoint enforces the client limit itself, reporting what it skipped), and
 * it doesn't apply KPI targets — those belong to the client, and are set per
 * client afterwards.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { pdFontClass } from "@/lib/pd-fonts"
import ReviewStep from "@/app/onboarding/ReviewStep"

const POLL_MS = 2500

export default function BulkImportDialog({ open, onOpenChange, onImported }) {
  const [review, setReview] = useState(null)
  const [settled, setSettled] = useState(false)
  const [importing, setImporting] = useState(false)
  const cancelled = useRef(false)

  // Poll while the prep job runs. Same shape as the wizard's review poll: the
  // job mints a token per location and asks GHL when each last saw a lead, so
  // it is genuinely slow on a large agency and the table fills in underneath.
  useEffect(() => {
    if (!open) return
    cancelled.current = false
    setReview(null)
    setSettled(false)

    let timer
    const poll = async () => {
      try {
        const res = await apiRequest("/api/onboarding/subaccounts-review")
        if (cancelled.current) return
        if (!res.ok) throw new Error("review")
        const d = await res.json()
        setReview(d)
        if (d?.prep?.status !== "running") {
          setSettled(true)
          return
        }
      } catch {
        if (cancelled.current) return
        // Keep whatever the last good poll returned rather than blanking a
        // table someone may already be working through, and keep polling —
        // ReviewStep goes on showing its progress state meanwhile.
      }
      timer = setTimeout(poll, POLL_MS)
    }

    apiRequest("/api/onboarding/prepare-review", { method: "POST" })
      .catch(() => {})
      .finally(poll)

    return () => {
      cancelled.current = true
      clearTimeout(timer)
    }
  }, [open])

  const runImport = useCallback(
    async (accounts) => {
      if (!accounts?.length) {
        onOpenChange(false)
        return
      }
      setImporting(true)
      try {
        const res = await apiRequest("/api/onboarding/import-subaccounts", {
          method: "POST",
          body: JSON.stringify({ accounts }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(d?.detail || "Import failed")
          return
        }

        const added = d?.imported?.length ?? 0
        const overLimit = d?.skipped_limit?.length ?? 0
        const already = d?.skipped_existing?.length ?? 0

        if (added) {
          toast.success(
            `Importing ${added} client${added === 1 ? "" : "s"} — their data is syncing now.`
          )
        }
        // Say what was left out and why. A silent partial import looks like a
        // bug to the person who ticked twelve boxes and got nine clients.
        if (overLimit) {
          toast.warning(
            `${overLimit} client${overLimit === 1 ? "" : "s"} skipped — your plan's client limit is full.`
          )
        }
        if (already && !added) {
          toast.info("Those clients are already in Birdy.")
        }

        onOpenChange(false)
        onImported?.()
      } finally {
        setImporting(false)
      }
    },
    [onOpenChange, onImported]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${pdFontClass} max-h-[92vh] overflow-y-auto overflow-x-hidden border-pd-border bg-white p-5 sm:max-w-[920px] md:p-7`}
      >
        {/* sr-only so Radix has its accessible label without printing a second
            heading above ReviewStep's own — which already says what this is,
            and says it in the right typeface. Same pattern as the Add Client
            wizard in the page that opens this. */}
        <DialogHeader className="sr-only">
          <DialogTitle>Import clients from GoHighLevel</DialogTitle>
        </DialogHeader>

        {/* ReviewStep is a fixed-width column and centres nothing itself —
            the onboarding shell does that for it, and so does this. */}
        <div className="flex w-full justify-center">
          <ReviewStep
            review={review}
            settled={settled}
            importing={importing}
            onImport={runImport}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
