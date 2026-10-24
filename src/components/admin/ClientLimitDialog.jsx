"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label,
} from "@/components/ds"
import { setClientLimit } from "@/lib/admin-api"

const MAX_LIMIT = 1000

/**
 * Give one account a different number of clients than its plan allows.
 *
 * The override replaces the plan's limit outright — it is not added to it —
 * and works with or without a subscription. Lowering it below the account's
 * current clients deletes nothing; it only stops new ones being added.
 */
export default function ClientLimitDialog({ agency, onClose, onSaved }) {
  const [limit, setLimit] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!agency) return
    setLimit(agency.client_limit_override != null ? String(agency.client_limit_override) : "")
    setNote(agency.client_limit_override_note || "")
  }, [agency])

  if (!agency) return null

  const hasOverride = agency.client_limit_override != null
  const parsed = limit.trim() === "" ? null : Number(limit)
  const valid = parsed !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_LIMIT
  const belowCurrent = valid && parsed < agency.sub_accounts

  const save = async (value) => {
    setSaving(true)
    try {
      await setClientLimit(agency.email, { limit: value, note })
      toast.success(
        value === null
          ? `${agency.email} is back on its plan's limit`
          : `${agency.email} can now have ${value} clients`,
      )
      onSaved?.()
    } catch (e) {
      toast.error("Couldn't update the client limit", { description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!agency} onOpenChange={(o) => !o && !saving && onClose?.()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Client limit for {agency.owner}</DialogTitle>
          <DialogDescription>
            Their plan allows <span className="font-semibold text-foreground">{agency.plan_client_limit}</span>{" "}
            {agency.plan_client_limit === 1 ? "client" : "clients"}; they have{" "}
            <span className="font-semibold text-foreground">{agency.sub_accounts}</span>. An override replaces
            the plan&apos;s limit and applies with or without a subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="client-limit">Clients allowed</Label>
            <Input
              id="client-limit"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_LIMIT}
              placeholder={String(agency.plan_client_limit)}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
            {limit.trim() !== "" && !valid && (
              <p className="text-xs text-danger-ink">Enter a whole number from 0 to {MAX_LIMIT}.</p>
            )}
            {belowCurrent && (
              <p className="text-xs text-warning-ink">
                That&apos;s fewer than the {agency.sub_accounts} clients they already have. Nothing is
                removed; they just can&apos;t add more.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-limit-note">Reason (optional)</Label>
            <Input
              id="client-limit-note"
              maxLength={280}
              placeholder="e.g. Pilot agreed with Hadley"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {hasOverride ? (
            <Button type="button" onClick={() => save(null)} disabled={saving}>
              Remove override
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => save(parsed)} loading={saving} disabled={!valid}>
              Save limit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
