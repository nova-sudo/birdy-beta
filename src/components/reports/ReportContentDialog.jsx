"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ds"
import ReportDesigner from "@/components/report-designer/ReportDesigner"
import { resetChat } from "@/lib/chat-store"

/**
 * The report copilot over the report form: Birdy designs what one report says,
 * starting from that report's current content. Nothing is saved here — "Use
 * this content" hands the template back to the form, which saves it with the
 * rest of the report.
 *
 * Each opening starts a fresh conversation: the copilot keeps one draft per
 * account, so carrying on an old chat could resume another report's draft.
 */
export function ReportContentDialog({ open, onOpenChange, reportId, template, scheduleText, onUse }) {
  const sessionKey = `birdy_slack_report_${reportId || "new"}`
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    if (!open) return
    resetChat(sessionKey)
    try { sessionStorage.removeItem(sessionKey) } catch { /* private mode */ }
    setGeneration((g) => g + 1)
  }, [open, sessionKey])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[calc(100dvh-48px)] overflow-y-auto">
        <DialogTitle className="sr-only">Design report content with Birdy</DialogTitle>
        <DialogDescription className="sr-only">
          Chat with Birdy to choose what this Slack report shows. The preview uses your real numbers.
        </DialogDescription>
        <div className="p-5">
          {open && generation > 0 && (
            <ReportDesigner
              key={generation}
              sessionKey={sessionKey}
              seedTemplate={template}
              scheduleText={scheduleText}
              primaryLabel="Use this content"
              onUse={(t) => {
                onUse(t)
                onOpenChange(false)
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
