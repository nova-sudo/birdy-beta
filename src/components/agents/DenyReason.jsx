"use client"

import { useId, useState } from "react"

import { Button, Textarea } from "@/components/ds"
import { cn } from "@/lib/utils"

/** The reasons a work item can be denied with. Codes are the backend's `reason_code`s. */
export const DENY_REASONS = [
  { code: "still_learning", label: "Still learning, give it longer" },
  { code: "client_wants_on", label: "Client wants it on" },
  { code: "creative_stale", label: "Creative is stale" },
  { code: "target_wrong", label: "Target is wrong" },
  { code: "other", label: "Something else" },
]

/**
 * Asks why a work item is denied: one reason chip (required), an optional note, then Confirm.
 *
 * @param {object} props
 * @param {(choice: {reason_code: string, note: string}) => void} props.onConfirm
 * @param {() => void} props.onCancel
 * @param {boolean} [props.busy]
 * @param {{reason_code?: string, note?: string}} [props.initial] Starts with this choice (e.g. after a failed deny)
 */
export function DenyReason({ onConfirm, onCancel, busy = false, initial, className }) {
  const [reason, setReason] = useState(initial?.reason_code ?? null)
  const [note, setNote] = useState(initial?.note ?? "")
  const labelId = useId()
  const noteId = useId()

  return (
    <div data-slot="deny-reason" className={cn("flex flex-col gap-2.5", className)}>
      <p id={labelId} className="text-sm font-medium text-foreground">
        Why not? Birdy learns from this.
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {DENY_REASONS.map((r) => {
          const on = reason === r.code
          return (
            <Button
              key={r.code}
              type="button"
              role="radio"
              aria-checked={on}
              size="sm"
              variant={on ? "primary" : "outline"}
              onClick={() => setReason(r.code)}
            >
              {r.label}
            </Button>
          )
        })}
      </div>
      <label htmlFor={noteId} className="sr-only">
        Add context (optional)
      </label>
      <Textarea
        id={noteId}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add context (optional)"
        maxLength={500}
      />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={!reason}
          loading={busy}
          onClick={() => onConfirm({ reason_code: reason, note })}
        >
          Confirm
        </Button>
      </div>
    </div>
  )
}
