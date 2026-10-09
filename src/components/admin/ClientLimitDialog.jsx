"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      <DialogContent className="bg-white sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Client limit for {agency.owner}</DialogTitle>
          <DialogDescription>
            Their plan allows <span className="font-medium text-gray-900">{agency.plan_client_limit}</span>{" "}
            {agency.plan_client_limit === 1 ? "client" : "clients"}; they have{" "}
            <span className="font-medium text-gray-900">{agency.sub_accounts}</span>. An override replaces
            the plan&apos;s limit and applies with or without a subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
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
              <p className="text-xs text-red-600">Enter a whole number from 0 to {MAX_LIMIT}.</p>
            )}
            {belowCurrent && (
              <p className="text-xs text-amber-700">
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
            <button
              type="button"
              onClick={() => save(null)}
              disabled={saving}
              className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-muted disabled:opacity-50"
            >
              Remove override
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save(parsed)}
              disabled={saving || !valid}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save limit
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
