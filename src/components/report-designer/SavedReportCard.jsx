"use client"

// Settings → Notification preferences: the live Slack report as it will be
// posted, and two ways to change it: redesign it with Birdy (the same copilot
// onboarding uses) or edit its sections by hand (ReportEditor). Both open in
// the same modal. Schedule changes stay on the controls above this; they
// keep the report's sections.

import { useCallback, useEffect, useState } from "react"
import { Pencil, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { reportApi, scheduleLabel } from "@/lib/report-designer"
import ReportDesigner from "./ReportDesigner"
import ReportEditor from "./ReportEditor"
import SlackMessagePreview from "./SlackMessagePreview"

export default function SavedReportCard({ brief, onSaved }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // null | "copilot" | "editor"
  const open = mode !== null
  const setOpen = (v) => { if (!v) setMode(null) }
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPreview(await reportApi.preview(null, "saved"))
    } catch {
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-render whenever the stored report changes (a schedule save, a redesign).
  const version = brief?.updated_at ?? JSON.stringify(brief ?? null)
  useEffect(() => { load() }, [load, version])

  const save = useCallback(async (template) => {
    setSaving(true)
    try {
      const { brief: saved } = await reportApi.save(template)
      onSaved?.(saved)
      setOpen(false)
      toast.success("Slack report saved")
    } catch {
      toast.error("Could not save the report")
    } finally {
      setSaving(false)
    }
  }, [onSaved])

  const template = preview?.template

  return (
    <div className="mt-6 border-t border-pd-divider pt-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-pd-ink">What&apos;s in the report</p>
          <p className="text-xs text-pd-subtle">
            {template ? scheduleLabel(template) : "Exactly what Birdy posts to Slack, with your latest numbers."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setMode("editor")} className="gap-1.5">
            <Pencil className="size-3.5 text-pd-primary" aria-hidden="true" />
            Edit sections
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode("copilot")} className="gap-1.5">
            <Sparkles className="size-3.5 text-pd-primary" aria-hidden="true" />
            Redesign with Birdy
          </Button>
        </div>
      </div>

      <div className="max-w-[560px]">
        {!loading && !template ? (
          <p className="rounded-xl border border-dashed border-pd-border px-4 py-5 text-sm text-pd-subtle">
            No report yet. Design one with Birdy and it will go out on the schedule above.
          </p>
        ) : (
          <SlackMessagePreview blocks={preview?.blocks} time={template?.time} loading={loading && !!preview} />
        )}
        {preview?.sample && (
          <p className="mt-2 text-[11.5px] text-pd-faint">Sample numbers until your clients have synced.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="w-[min(1160px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] max-w-none gap-0 overflow-y-auto bg-pd-canvas p-5 sm:max-w-none sm:p-6">
          <DialogTitle className="font-pd-display text-[18px] font-semibold text-pd-ink">
            {mode === "editor" ? "Edit your Slack report" : "Redesign your Slack report"}
          </DialogTitle>
          <DialogDescription className="mb-4 mt-1 text-[13px] text-pd-subtle">
            {mode === "editor"
              ? "Add, remove and reorder sections. Nothing changes until you press Save report."
              : "Nothing changes until you press Save report."}
          </DialogDescription>
          {mode === "editor" && (
            <ReportEditor
              brief={template || brief}
              onSave={save}
              onCancel={() => setMode(null)}
              saving={saving}
            />
          )}
          {mode === "copilot" && (
            <ReportDesigner
              sessionKey="birdy_settings_report"
              onUse={save}
              saving={saving}
              primaryLabel="Save report"
              heightClass="lg:h-[min(620px,calc(100dvh-200px))]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
