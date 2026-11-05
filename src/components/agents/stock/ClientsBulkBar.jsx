"use client"

import { useState } from "react"

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds"
import { currencySymbol } from "@/lib/chat-viz"
import { parseNumber } from "./SetupShared"

/** A menu that acts as soon as an option is picked, then goes back to its label. */
function ActionSelect({ label, options, onPick }) {
  return (
    <Select value="" onValueChange={onPick}>
      <SelectTrigger size="sm" aria-label={label} className="w-36">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const targetsProblem = (green, red) => {
  const g = parseNumber(green)
  const r = parseNumber(red)
  if (!g.ok || !r.ok) return "Limits must be numbers, 0 or more."
  return g.value != null && r.value != null && r.value < g.value ? "Red must be at least the green limit." : null
}

/**
 * The bar under the clients table while clients are ticked. Treatment and prepaid apply as soon as
 * they are picked. Targets need both limits and one currency, since a limit means nothing across currencies.
 */
export function ClientsBulkBar({ picked, watching, batches, treatmentOptions, onTreatment, onChange, onSetTargets, onUseZones, onWatch, onClear }) {
  const [green, setGreen] = useState("")
  const [red, setRed] = useState("")
  const currencies = [...new Set(picked.map((c) => c.currency))]
  const mixed = currencies.length > 1
  const sym = mixed ? null : currencySymbol(currencies[0])
  const problem = targetsProblem(green, red)
  const canSet = !mixed && !problem && green.trim() !== "" && red.trim() !== ""
  const allWatched = picked.every((c) => watching.has(c.id))

  return (
    <div role="toolbar" aria-label="Change the ticked clients" className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-frame bg-foreground p-3 text-background shadow-overlay">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium">{picked.length} selected</span>
        <ActionSelect label="Treatment" options={treatmentOptions} onPick={onTreatment} />
        <ActionSelect
          label="Prepaid"
          options={[{ value: "yes", label: "Prepaid" }, { value: "no", label: "Not prepaid" }]}
          onPick={(v) => onChange({ prepaid: v === "yes" })}
        />
        {batches.length > 1 && (
          <ActionSelect label="Batch" options={batches.map((b) => ({ value: b.id, label: b.name }))} onPick={(v) => onChange({ batch_id: v })} />
        )}
        {!mixed && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!canSet) return
              onSetTargets(green.trim(), red.trim())
              setGreen("")
              setRed("")
            }}
          >
            <Input size="sm" inputMode="decimal" aria-label="Green under for selected clients" placeholder={`Green ${sym ?? ""}`.trim()} value={green} onChange={(e) => setGreen(e.target.value)} className="w-24 text-right font-mono" />
            <Input size="sm" inputMode="decimal" aria-label="Red over for selected clients" placeholder={`Red ${sym ?? ""}`.trim()} value={red} onChange={(e) => setRed(e.target.value)} className="w-24 text-right font-mono" />
            <Button size="sm" type="submit" disabled={!canSet}>
              Set targets
            </Button>
          </form>
        )}
        <Button size="sm" onClick={onUseZones}>
          Use your zones
        </Button>
        <Button size="sm" onClick={() => onWatch(!allWatched)}>
          {allWatched ? "Stop watching" : "Watch"}
        </Button>
        <Button size="sm" className="ml-auto" onClick={onClear}>
          Clear
        </Button>
      </div>
      {mixed && <p className="text-xs">These clients bill in different currencies. Select one currency at a time to set targets.</p>}
      {!mixed && problem && <p role="alert" className="text-xs">{problem}</p>}
    </div>
  )
}
