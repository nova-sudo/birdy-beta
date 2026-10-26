"use client"

import { useState } from "react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds"
import { cn } from "@/lib/utils"
import { Check, CheckCircle2 } from "lucide-react"
import Image from "next/image"

/**
 * ChatUIBlock — inline interactive form fields inside chat bubbles.
 *
 * Radio fields auto-submit on selection (no button needed).
 * Checkboxes require a confirm button.
 * Mixed forms (text + radio etc.) show a submit button.
 */
export default function ChatUIBlock({ fields = [], onSubmit, disabled = false }) {
  const [values, setValues] = useState(() => {
    const init = {}
    for (const f of fields) {
      if (f.defaultValue !== undefined) init[f.id] = f.defaultValue
      else if (f.type === "checkboxes") init[f.id] = []
      else init[f.id] = ""
    }
    return init
  })

  const setValue = (id, val) => setValues(prev => ({ ...prev, [id]: val }))

  const toggleCheckbox = (id, optionValue) => {
    setValues(prev => {
      const arr = prev[id] || []
      return {
        ...prev,
        [id]: arr.includes(optionValue) ? arr.filter(v => v !== optionValue) : [...arr, optionValue],
      }
    })
  }

  const isRadioOnly = fields.length === 1 && fields[0].type === "radio"

  const handleRadioSelect = (id, val) => {
    const next = { ...values, [id]: val }
    setValues(next)
    if (isRadioOnly && !disabled) {
      setTimeout(() => onSubmit?.(next), 80)
    }
  }

  const handleSubmit = () => {
    if (disabled) return
    onSubmit?.(values)
  }

  if (disabled) {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-success-ink">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        <span>Answered</span>
      </div>
    )
  }

  return (
    <div data-ds="chat-ui-block" className="mt-3 space-y-3">
      {fields.map(field => (
        <div key={field.id} className="space-y-2">
          {field.label && (
            <p className="text-xs font-medium text-muted-foreground px-1">
              {field.label}
            </p>
          )}

          {/* Radio — full-width choice cards */}
          {field.type === "radio" && (
            <div className="space-y-1.5">
              {(field.options || []).map(opt => {
                const selected = values[field.id] === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleRadioSelect(field.id, opt.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-control px-3.5 py-2.5 text-left text-sm outline-none transition-[background-color,box-shadow,transform] duration-150 ease-press focus-visible:shadow-control-focus active:scale-[.99] motion-reduce:transform-none",
                      selected
                        ? "bg-primary-soft shadow-[inset_0_0_0_1.5px_var(--color-primary)]"
                        : "bg-muted hover:bg-neutral-soft"
                    )}
                  >
                    <div className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      selected ? "border-primary" : "border-border"
                    )}>
                      {selected && <div className="size-1.5 rounded-full bg-primary" />}
                    </div>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Checkboxes — pill chips */}
          {field.type === "checkboxes" && (
            <div className="flex flex-wrap gap-2">
              {(field.options || []).map(opt => {
                const checked = (values[field.id] || []).includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleCheckbox(field.id, opt.value)}
                    aria-pressed={checked}
                    className={cn(
                      "flex items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium outline-none transition-[background-color,box-shadow,transform] duration-150 ease-press focus-visible:shadow-control-focus active:scale-[.98] motion-reduce:transform-none",
                      checked
                        ? "bg-primary text-primary-foreground shadow-control"
                        : "bg-muted text-foreground hover:bg-neutral-soft"
                    )}
                  >
                    {checked && <Check className="size-3" aria-hidden="true" />}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Text input */}
          {field.type === "text" && (
            <Input
              placeholder={field.placeholder || ""}
              value={values[field.id] || ""}
              onChange={e => setValue(field.id, e.target.value)}
            />
          )}

          {/* Number input */}
          {field.type === "number" && (
            <Input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step || "any"}
              placeholder={field.placeholder || "0"}
              value={values[field.id] ?? ""}
              onChange={e => setValue(field.id, e.target.value)}
            />
          )}

          {/* Select */}
          {field.type === "select" && (
            <Select value={values[field.id] || ""} onValueChange={v => setValue(field.id, v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={field.placeholder || "Select..."}>
                  {(() => {
                    const opt = (field.options || []).flatMap(o => o.options || [o]).find(o => o.value === values[field.id])
                    if (!opt) return field.placeholder || "Select..."
                    return (
                      <span className="flex items-center gap-2">
                        {opt.icon && <Image src={opt.icon} alt="" width={14} height={14} className="opacity-70" />}
                        {opt.label}
                      </span>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {(field.options || []).map((optOrGroup, i) => {
                  if (optOrGroup.group) {
                    return (
                      <div key={i}>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{optOrGroup.group}</div>
                        {optOrGroup.options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              {opt.icon && <Image src={opt.icon} alt="" width={14} height={14} className="opacity-70" />}
                              {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    )
                  }
                  return (
                    <SelectItem key={optOrGroup.value} value={optOrGroup.value}>
                      <span className="flex items-center gap-2">
                        {optOrGroup.icon && <Image src={optOrGroup.icon} alt="" width={14} height={14} className="opacity-70" />}
                        {optOrGroup.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}

      {/* Confirm button — only for non-radio-only forms */}
      {!isRadioOnly && (
        <div className="flex justify-end pt-1">
          <Button onClick={handleSubmit} variant="primary" size="sm">
            <Check aria-hidden="true" />
            Confirm
          </Button>
        </div>
      )}
    </div>
  )
}
