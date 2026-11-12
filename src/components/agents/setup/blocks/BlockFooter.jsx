"use client"

import { Check } from "lucide-react"

import { Button } from "@/components/ds"

/**
 * The foot of a setup block: its save button, or once saved, a quiet "Saved" line.
 * A block on an older message (not the latest reply) shows no button.
 */
export function BlockFooter({ saved, savedLabel = "Saved", active, saving, onSave, label, children }) {
  if (saved) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check aria-hidden className="size-3.5 text-success" />
        {savedLabel}
      </p>
    )
  }
  if (!active) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" size="sm" loading={saving} onClick={() => onSave()}>
        {label}
      </Button>
      {children}
    </div>
  )
}
