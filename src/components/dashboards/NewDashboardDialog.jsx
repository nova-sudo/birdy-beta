"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@/components/ds"

/**
 * Name a new dashboard and, optionally, tell the AI what to build in it.
 * `onCreate({ title, brief })` does the saving and navigating; this only
 * collects input and keeps the form honest while that is in flight.
 */
export function NewDashboardDialog({ open, onOpenChange, onCreate }) {
  const [title, setTitle] = useState("")
  const [brief, setBrief] = useState("")
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setTitle("")
    setBrief("")
  }

  const handleOpenChange = (next) => {
    // A save in flight owns the dialog; closing it would orphan the navigation.
    if (saving) return
    if (!next) reset()
    onOpenChange(next)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ title: title.trim(), brief: brief.trim() })
      // Navigation takes over from here; clear for the next time it opens.
      reset()
      onOpenChange(false)
    } catch {
      toast.error("Couldn't create the dashboard. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {/* The form is the frame's one child, so it lays out the header strip, body and footer strip. */}
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New dashboard</DialogTitle>
            <DialogDescription>
              Start blank, or describe what you want and Birdy will build a first draft.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-2">
              <Label htmlFor="new-dashboard-title">Title</Label>
              <Input
                id="new-dashboard-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly client performance"
                maxLength={120}
                autoFocus
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-dashboard-brief">Brief (optional)</Label>
              <Textarea
                id="new-dashboard-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. spend and leads by client for the last 7 days, and a trend of spend by day"
                rows={4}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!title.trim() || saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
