"use client"

import { useEffect, useState, useMemo } from "react"
import { SlidersHorizontal, X, Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * The table toolbar's Filters control.
 *
 * Takes arbitrary filter groups rather than a fixed sources/tags pair, so a
 * page can put every one of its filters here. That matters because filters used
 * to be split across two controls — some in here, the rest hidden inside the
 * column-visibility menu — which meant "Filters" didn't show you all of them
 * and the column menu wasn't only about columns.
 *
 * Two selection modes:
 *   multi   an array of chosen values (Sources, Tags)
 *   single  one value, with `allValue` meaning "no filter" (Types, Opportunities)
 *
 * Choices are drafted locally and only committed on Apply, so a half-made
 * selection never refetches the table.
 *
 * @param {Array} groups  [{ id, label, mode, items, value, onChange, allValue?, allLabel? }]
 *                        `items` may be strings or { value, label } objects.
 */
export function FilterPanel({ groups = [], onSave, triggerClassName }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(groups[0]?.id)
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState({})

  // Normalise items so a group can be given plain strings.
  const normalised = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        mode: g.mode ?? "multi",
        allValue: g.allValue ?? "all",
        options: (g.items ?? []).map((item) =>
          typeof item === "string" ? { value: item, label: item } : item
        ),
      })),
    [groups]
  )

  // Re-seed the draft whenever the panel opens or the parent resets a value
  // from outside — otherwise a "Clear all" elsewhere would leave stale ticks.
  const committed = useMemo(
    () => Object.fromEntries(normalised.map((g) => [g.id, g.value])),
    [normalised]
  )
  useEffect(() => { setDraft(committed) }, [committed])

  useEffect(() => { setSearch("") }, [activeTab])
  useEffect(() => {
    if (!normalised.some((g) => g.id === activeTab)) setActiveTab(normalised[0]?.id)
  }, [normalised, activeTab])

  const group = normalised.find((g) => g.id === activeTab) ?? normalised[0]

  /** How many choices a group is currently contributing. */
  const countFor = (g) => {
    const value = draft[g.id]
    if (g.mode === "single") return value && value !== g.allValue ? 1 : 0
    return (value ?? []).length
  }
  const totalActive = normalised.reduce((sum, g) => sum + countFor(g), 0)

  const isChecked = (optionValue) => {
    if (!group) return false
    const value = draft[group.id]
    return group.mode === "single"
      ? value === optionValue
      : (value ?? []).includes(optionValue)
  }

  const toggle = (optionValue) => {
    if (!group) return
    setDraft((prev) => {
      const value = prev[group.id]
      if (group.mode === "single") {
        // Clicking the chosen one clears back to "all" — otherwise a
        // single-select filter can only ever be narrowed, never undone.
        return {
          ...prev,
          [group.id]: value === optionValue ? group.allValue : optionValue,
        }
      }
      const list = value ?? []
      return {
        ...prev,
        [group.id]: list.includes(optionValue)
          ? list.filter((v) => v !== optionValue)
          : [...list, optionValue],
      }
    })
  }

  const handleClear = () => {
    if (!group) return
    setDraft((prev) => ({
      ...prev,
      [group.id]: group.mode === "single" ? group.allValue : [],
    }))
  }

  const handleApply = () => {
    normalised.forEach((g) => g.onChange?.(draft[g.id]))
    onSave?.()
    setOpen(false)
  }

  const visibleOptions = (group?.options ?? []).filter((o) =>
    String(o.label).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={
            triggerClassName ??
            "gap-1 md:gap-2 px-2 md:px-4 h-10 text-sm"
          }
        >
          <SlidersHorizontal size={14} />
          <span className="hidden lg:inline">Filters</span>
          {totalActive > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[11px] font-bold text-white bg-pd-primary">
              {totalActive}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-pd-subtle" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[340px] rounded-2xl border border-pd-border bg-pd-surface shadow-pd-popover overflow-hidden p-0 flex flex-col"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Tab bar — one per filter group, wrapping once there are more than
            a couple, since this panel now carries every filter on the page. */}
        <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 pb-1 shrink-0">
          {normalised.map((g) => {
            const active = g.id === activeTab
            const count = countFor(g)
            return (
              <button
                key={g.id}
                onClick={() => setActiveTab(g.id)}
                className={[
                  "inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full",
                  "text-[12px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap",
                  active ? "bg-pd-primary text-white" : "bg-pd-divider text-pd-body hover:bg-pd-border",
                ].join(" ")}
              >
                {g.label}
                {count > 0 && (
                  <span className={[
                    "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full px-1",
                    "text-[10px] font-bold text-white",
                    active ? "bg-white/25" : "bg-pd-primary",
                  ].join(" ")}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div
          className="px-3 py-1.5 border-t border-pd-border shrink-0"
          onFocusCapture={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Search ${group?.label ?? "filters"}…`}
              aria-label={`Search ${group?.label ?? "filters"}`}
              autoComplete="off"
              className="h-8 pr-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 text-pd-faint hover:text-pd-body transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1 max-h-[280px]">
          {visibleOptions.length === 0 ? (
            <p className="text-center text-pd-faint text-[12px] py-5">No results</p>
          ) : (
            visibleOptions.map((option) => {
              const checked = isChecked(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role={group?.mode === "single" ? "radio" : "checkbox"}
                  aria-checked={checked}
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-2.5 px-1.5 py-[7px] rounded-xl cursor-pointer hover:bg-pd-primary-tint transition-colors duration-100 text-left"
                >
                  <span
                    className={[
                      "shrink-0 w-[16px] h-[16px] flex items-center justify-center transition-all duration-150",
                      // Round for single-select, square for multi — the shape
                      // is the only cue that one choice replaces the others.
                      group?.mode === "single" ? "rounded-full" : "rounded-[4px]",
                      checked ? "bg-pd-primary border-0" : "bg-background border border-gray-300",
                    ].join(" ")}
                  >
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="text-[13px] text-pd-ink flex-1 select-none">
                    {option.label}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-pd-divider bg-pd-surface shrink-0">
          <Button
            variant="outline"
            size="md"
            onClick={handleClear}
          >
            Clear
          </Button>
          <Button
            size="md"
            onClick={handleApply}
            className="flex-1"
          >
            Apply filters
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
