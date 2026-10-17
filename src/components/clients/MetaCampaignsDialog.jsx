"use client"

// Client settings: which campaigns of the group's Meta ad account it owns.
// A shared account must name its campaigns ("All campaigns" is hidden), and
// an empty list never saves from here.

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MetaCampaignPicker } from "@/components/clients/MetaCampaignPicker"
import { apiRequest } from "@/lib/api"

export function MetaCampaignsDialog({ open, onOpenChange, group, onSaved }) {
  const shared = !!group?.meta_scope?.shared
  const initial = group?.meta_campaign_ids ?? null
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Start from the stored selection each time it opens — only on the
  // closed -> open transition. SWR revalidation (window focus included) hands
  // back a new meta_campaign_ids array on every pass, and resetting on that
  // would wipe the ticks the user has not saved yet.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      const ids = group?.meta_campaign_ids ?? null
      setValue(shared && ids === null ? [] : ids)
      setError(null)
    }
    wasOpen.current = open
  }, [open, group?.meta_campaign_ids, shared])

  if (!group) return null

  const empty = Array.isArray(value) && value.length === 0

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiRequest(`/api/client-groups/${group.id}/meta-campaigns`, {
        method: "PATCH",
        body: JSON.stringify({ campaign_ids: value }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body?.detail || "Could not save campaigns.")
        return
      }
      toast.success("Campaigns saved — Meta data is refreshing")
      for (const g of body.converted || []) {
        toast.info(`${g.name} now keeps the remaining campaigns`)
      }
      onSaved?.(body)
      onOpenChange?.(false)
    } catch (e) {
      setError(e?.message || "Could not save campaigns.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!open} onOpenChange={(o) => !saving && onOpenChange?.(o)}>
      <DialogContent className="bg-pd-surface grid-cols-[minmax(0,1fr)] sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="font-pd-display">Meta campaigns for {group.name}</DialogTitle>
          <DialogDescription>
            {shared
              ? "This ad account is shared with another client. Pick the campaigns that belong to this one."
              : "Choose which campaigns count towards this client."}
          </DialogDescription>
        </DialogHeader>

        {open && group.meta_ad_account_id && (
          <MetaCampaignPicker
            adAccountId={group.meta_ad_account_id}
            groupId={group.id}
            value={value}
            onChange={(next) => {
              setValue(next)
              setError(null)
            }}
            required={shared}
          />
        )}

        {empty && <p className="text-xs text-pd-amber">Pick at least one campaign to save.</p>}
        {error && (
          <p role="alert" className="rounded-xl border border-pd-danger-border bg-pd-danger-bg p-3 text-sm text-pd-danger">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || empty} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save campaigns
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default MetaCampaignsDialog
