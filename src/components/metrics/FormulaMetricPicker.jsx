"use client"

import { useMemo, useState } from "react"
import Image from "next/image"

import { Button, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, Input, TriggerButton } from "@/components/ds"

/**
 * Searchable metric picker with category chips, for the formula builder.
 * A drop-down of checkbox items: the row for `value` is ticked, choosing one calls `onChange`.
 *
 * @param {object} props
 * @param {{ id: string, label: string, category?: string, icon?: import("next/image").StaticImageData | null }[]} props.metrics
 * @param {string} [props.value] Selected metric id
 * @param {(id: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 */
export function FormulaMetricPicker({ metrics = [], value, onChange, placeholder = "Select metric...", disabled = false, className }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")

  const categories = useMemo(() => {
    const counts = new Map()
    for (const m of metrics) {
      const cat = m.category || "Other"
      counts.set(cat, (counts.get(cat) || 0) + 1)
    }
    return [{ id: "all", label: "All", count: metrics.length }, ...[...counts].map(([id, count]) => ({ id, label: id, count }))]
  }, [metrics])

  const filtered = useMemo(
    () =>
      metrics.filter((m) => {
        if (category !== "all" && (m.category || "Other") !== category) return false
        return !search || m.label.toLowerCase().includes(search.toLowerCase())
      }),
    [metrics, category, search]
  )

  const selected = metrics.find((m) => m.id === value)

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setSearch("")
          setCategory("all")
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <TriggerButton data-ds="formula-metric-picker" disabled={disabled} className={className}>
          {selected ? <span className="truncate">{selected.label}</span> : <span className="text-muted-foreground">{placeholder}</span>}
        </TriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[360px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex gap-1 overflow-x-auto border-b border-border p-2">
          {categories.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={category === c.id ? "primary" : "ghost"}
              className="shrink-0"
              onClick={() => {
                setCategory(c.id)
                setSearch("")
              }}
            >
              {c.label} <span className="num opacity-70">{c.count}</span>
            </Button>
          ))}
        </div>
        <div className="p-2">
          <Input
            autoFocus
            placeholder={`Search ${category === "all" ? "all metrics" : category}...`}
            aria-label="Search metrics"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            // Keep the menu's type-ahead and arrow handling from eating keystrokes meant for the box.
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="max-h-60 overflow-y-auto overscroll-contain p-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No metrics found</p>
          ) : (
            filtered.map((m) => (
              <DropdownMenuCheckboxItem key={m.id} checked={m.id === value} onSelect={() => onChange(m.id)}>
                {m.icon && <Image src={m.icon} alt="" width={16} height={16} className="shrink-0 opacity-70" />}
                <span className="truncate">{m.label}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
