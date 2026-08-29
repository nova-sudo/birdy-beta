"use client"

// components/clients/ClientTargetsForm.jsx
// The Targets tab of the Client Detail settings modal — the six monthly goals
// the design specifies, each with a help line.
//
// These are not decoration: `monthly_wins` is what the weekly health pass
// measures a client against, and the Goals strip on the overview reads all six.
// Until one is set a client has no expectation to miss, which resolves to
// Healthy — so an empty form here means an unmonitored account.

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { apiRequest } from "@/lib/api"

// In the order the design lists them.
const FIELDS = [
  {
    id: "cpl", label: "Cost per lead", prefix: "currency",
    help: "What you aim to pay for each new lead.",
  },
  {
    id: "monthly_wins", label: "Monthly closes",
    help: "Closes expected per month. This is what the health band is measured against.",
  },
  {
    id: "monthly_revenue", label: "Monthly revenue", prefix: "currency",
    help: "Revenue this client should generate each month.",
  },
  {
    id: "conversion_rate", label: "Close rate", suffix: "%", percent: true,
    help: "Share of leads expected to close.",
  },
  {
    id: "monthly_spend", label: "Monthly spend", prefix: "currency",
    help: "Planned ad spend per month. With cost per lead, this implies the lead target.",
  },
  {
    id: "aov", label: "Average order value", prefix: "currency",
    help: "Typical value of one closed deal.",
  },
]

/** Stored value → what the user types. Close rate is held as a fraction. */
function toInput(field, value) {
  if (value == null) return ""
  return field.percent ? String(Number(value) * 100) : String(value)
}

/** What the user typed → what gets stored. */
function toStored(field, raw) {
  const trimmed = String(raw ?? "").trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return field.percent ? n / 100 : n
}

export function ClientTargetsForm({
  clientId,
  targets,
  currencySymbol = "$",
  onSaved,
}) {
  const [values, setValues] = useState({})
  const [saveAsDefault, setSaveAsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Re-seed whenever the stored targets change, so reopening the modal after a
  // save shows what was actually stored rather than a stale draft.
  useEffect(() => {
    setValues(
      Object.fromEntries(FIELDS.map((f) => [f.id, toInput(f, targets?.[f.id])]))
    )
    setErrors({})
  }, [targets])

  const setField = (id, raw) => {
    setValues((prev) => ({ ...prev, [id]: raw }))
    setErrors((prev) => ({ ...prev, [id]: undefined }))
  }

  const validate = () => {
    const next = {}
    for (const field of FIELDS) {
      const raw = String(values[field.id] ?? "").trim()
      if (raw === "") continue
      const n = Number(raw)
      if (!Number.isFinite(n)) next[field.id] = "Must be a number"
      else if (n < 0) next[field.id] = "Cannot be negative"
      else if (field.percent && n > 100) next[field.id] = "Cannot exceed 100%"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    // Only send what has a value. The endpoint merges, so omitting a field
    // leaves whatever is stored — it does not blank it.
    const payload = {}
    for (const field of FIELDS) {
      const stored = toStored(field, values[field.id])
      if (stored !== null) payload[field.id] = stored
    }

    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one target")
      return
    }

    setSaving(true)
    try {
      const res = await apiRequest(`/api/client-groups/${clientId}/targets`, {
        method: "PUT",
        body: JSON.stringify({ ...payload, save_as_default: saveAsDefault }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      toast.success("Targets saved")
      onSaved?.(data.targets)
    } catch {
      toast.error("Failed to save targets")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-foreground">Monthly targets</p>
        <p className="text-xs text-muted-foreground">
          What this client should be achieving each month. The closes target
          drives the health band, recalculated every Monday.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.id}>
            <Label htmlFor={`target-${field.id}`} className="text-xs font-semibold">
              {field.label}
            </Label>
            <div className="relative mt-1.5">
              {field.prefix === "currency" && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                  {currencySymbol}
                </span>
              )}
              <Input
                id={`target-${field.id}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={values[field.id] ?? ""}
                onChange={(e) => setField(field.id, e.target.value)}
                placeholder="Not set"
                aria-describedby={`help-${field.id}`}
                aria-invalid={errors[field.id] ? "true" : undefined}
                className={`h-[38px] text-[13px] ${
                  field.prefix === "currency" ? "pl-7" : ""
                } ${field.suffix ? "pr-8" : ""} ${
                  errors[field.id] ? "border-destructive" : ""
                }`}
              />
              {field.suffix && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                  {field.suffix}
                </span>
              )}
            </div>
            <p
              id={`help-${field.id}`}
              className={`mt-1 text-[11px] ${
                errors[field.id] ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {errors[field.id] ?? field.help}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={saveAsDefault}
            onCheckedChange={(v) => setSaveAsDefault(v === true)}
          />
          Also save these as the default for new clients
        </label>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? "Saving…" : "Save targets"}
        </Button>
      </div>
    </div>
  )
}
