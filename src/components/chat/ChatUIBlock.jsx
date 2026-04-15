"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Send } from "lucide-react"
import Image from "next/image"

/**
 * ChatUIBlock — renders interactive form fields inline in chat.
 *
 * Props:
 *  fields     — array of field definitions [{id, type, label, placeholder, options, required, defaultValue, icon}]
 *  onSubmit   — callback(values: object) when user clicks submit
 *  disabled   — boolean, true after submission
 */
export default function ChatUIBlock({ fields = [], onSubmit, disabled = false }) {
  const [values, setValues] = useState(() => {
    const init = {}
    for (const f of fields) {
      if (f.defaultValue !== undefined) {
        init[f.id] = f.defaultValue
      } else if (f.type === "checkboxes") {
        init[f.id] = []
      } else if (f.type === "number") {
        init[f.id] = ""
      } else {
        init[f.id] = ""
      }
    }
    return init
  })

  const setValue = (id, val) => setValues(prev => ({ ...prev, [id]: val }))

  const toggleCheckbox = (id, optionValue) => {
    setValues(prev => {
      const arr = prev[id] || []
      return {
        ...prev,
        [id]: arr.includes(optionValue)
          ? arr.filter(v => v !== optionValue)
          : [...arr, optionValue],
      }
    })
  }

  const handleSubmit = () => {
    if (disabled) return
    onSubmit?.(values)
  }

  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm my-3 overflow-hidden transition-opacity ${disabled ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Submitted badge */}
      {disabled && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-green-50 border-b border-green-200 text-green-700 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Submitted
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Render fields in a responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map(field => (
            <div
              key={field.id}
              className={`space-y-1.5 ${
                field.type === "checkboxes" || field.type === "radio"
                  ? "sm:col-span-2"
                  : ""
              }`}
            >
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>

              {/* Text input */}
              {field.type === "text" && (
                <Input
                  className="h-9 text-sm"
                  placeholder={field.placeholder || ""}
                  value={values[field.id] || ""}
                  onChange={e => setValue(field.id, e.target.value)}
                />
              )}

              {/* Number input */}
              {field.type === "number" && (
                <Input
                  className="h-9 text-sm"
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step || "any"}
                  placeholder={field.placeholder || "0"}
                  value={values[field.id] ?? ""}
                  onChange={e => setValue(field.id, e.target.value)}
                />
              )}

              {/* Date input */}
              {field.type === "date" && (
                <Input
                  className="h-9 text-sm"
                  type="date"
                  value={values[field.id] || ""}
                  onChange={e => setValue(field.id, e.target.value)}
                />
              )}

              {/* Select dropdown */}
              {field.type === "select" && (
                <Select
                  value={values[field.id] || ""}
                  onValueChange={v => setValue(field.id, v)}
                >
                  <SelectTrigger className="h-9 text-sm">
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
                      // Grouped options: { group: "Meta Ads", options: [...] }
                      if (optOrGroup.group) {
                        return (
                          <div key={i}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {optOrGroup.group}
                            </div>
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
                      // Flat option
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

              {/* Checkboxes */}
              {field.type === "checkboxes" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {(field.options || []).map(opt => {
                    const checked = (values[field.id] || []).includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                          checked
                            ? "bg-purple-50 border-purple-300 text-purple-700"
                            : "bg-white border-border hover:border-purple-200"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleCheckbox(field.id, opt.value)}
                          className="h-3.5 w-3.5"
                        />
                        {opt.label}
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Radio */}
              {field.type === "radio" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {(field.options || []).map(opt => {
                    const selected = values[field.id] === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue(field.id, opt.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          selected
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "bg-white border-border hover:border-purple-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit button */}
        {!disabled && (
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleSubmit}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2 h-9 px-5"
              size="sm"
            >
              <Send className="h-3.5 w-3.5" />
              Submit
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
