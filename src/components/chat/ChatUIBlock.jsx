"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
      <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Answered</span>
      </div>
    )
  }

  return (
    <div className="mt-3 -mx-1 space-y-3">
      {fields.map(field => (
        <div key={field.id} className="space-y-2">
          {field.label && (
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-1">
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
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left text-sm transition-all ${
                      selected
                        ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-200"
                        : "bg-gray-50 border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      selected ? "border-white bg-white/30" : "border-gray-300"
                    }`}>
                      {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                      checked
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" />}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Text input */}
          {field.type === "text" && (
            <Input
              className="h-9 text-sm bg-gray-50 border-gray-200 focus:border-purple-400"
              placeholder={field.placeholder || ""}
              value={values[field.id] || ""}
              onChange={e => setValue(field.id, e.target.value)}
            />
          )}

          {/* Number input */}
          {field.type === "number" && (
            <Input
              type="number"
              className="h-9 text-sm bg-gray-50 border-gray-200 focus:border-purple-400"
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
              <SelectTrigger className="h-9 text-sm bg-gray-50 border-gray-200">
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
              <SelectContent className="bg-white max-h-[240px]">
                {(field.options || []).map((optOrGroup, i) => {
                  if (optOrGroup.group) {
                    return (
                      <div key={i}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{optOrGroup.group}</div>
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
          <Button
            onClick={handleSubmit}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-4 text-xs rounded-lg gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Confirm
          </Button>
        </div>
      )}
    </div>
  )
}
