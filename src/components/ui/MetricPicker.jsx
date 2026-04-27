"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ChevronDown, Check } from "lucide-react"

export default function MetricPicker({
  metrics = [],
  value,
  onChange,
  placeholder = "Select metric...",
  triggerClassName = "",
  disabled = false,
  width = "w-[360px]",
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  const categories = useMemo(() => {
    const cats = new Map()
    for (const m of metrics) {
      const cat = m.category || "Other"
      cats.set(cat, (cats.get(cat) || 0) + 1)
    }
    const result = [{ id: "all", label: "All", count: metrics.length }]
    for (const [cat, count] of cats) {
      result.push({ id: cat, label: cat, count })
    }
    return result
  }, [metrics])

  const filtered = useMemo(() => {
    return metrics.filter(m => {
      if (activeCategory !== "all" && m.category !== activeCategory) return false
      if (search && !m.label.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [metrics, activeCategory, search])

  const selectedMetric = metrics.find(m => m.id === value)

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setSearch("")
          setActiveCategory("all")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={`justify-between h-10 ${triggerClassName}`}
        >
          {selectedMetric ? (
            <span className="flex items-center gap-2 truncate">
              {selectedMetric.icon && (
                <Image src={selectedMetric.icon} alt="" width={16} height={16} className="opacity-70 shrink-0" />
              )}
              {selectedMetric.label}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={`${width} p-0 bg-white`}
        align="start"
        onWheel={e => e.stopPropagation()}
      >
        {/* Category tabs */}
        <div
          className="flex flex-nowrap gap-1 p-2 border-b overflow-x-auto overscroll-x-contain"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {categories.map(cat => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setActiveCategory(cat.id)
                setSearch("")
              }}
              className="flex-shrink-0 text-xs h-7 px-2.5"
            >
              {cat.label} <span className="ml-1 opacity-60">{cat.count}</span>
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="px-2 py-2">
          <Input
            placeholder={`Search ${activeCategory === "all" ? "all metrics" : activeCategory}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>

        {/* Metric list */}
        <div
          className="max-h-[240px] overflow-y-auto overscroll-contain px-1 pb-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No metrics found</div>
          ) : (
            filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id)
                  setOpen(false)
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors text-left ${
                  m.id === value
                    ? "bg-purple-50 text-purple-700 font-medium"
                    : "hover:bg-muted/50"
                }`}
              >
                {m.id === value ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                ) : (
                  <span className="w-3.5 shrink-0" />
                )}
                {m.icon && (
                  <Image src={m.icon} alt="" width={16} height={16} className="opacity-70 shrink-0" />
                )}
                <span className="truncate">{m.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}