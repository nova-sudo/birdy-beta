"use client"

import { useEffect, useState } from "react"
import { SlidersHorizontal, X, Search, Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * FilterPanel — tab-style filter panel using shadcn DropdownMenu.
 *
 * Props:
 *   sources                      string[]
 *   allTags                      string[]
 *
 *   selectedSource               string   — "all" | specific
 *   setSelectedSource            fn
 *   selectedOpportunityStatus    string
 *   setSelectedOpportunityStatus fn
 *   selectedTags                 string[]
 *   setSelectedTags              fn
 *
 *   onSave   fn
 */
export function FilterPanel({
  sources = [],
  allTags = [],

  selectedSource,
  setSelectedSource,
  selectedTags,
  setSelectedTags,

  onSave,
}) {
  const [activeTab, setActiveTab] = useState("sources")
  const [search, setSearch] = useState("")

  // Reset search on tab change
  useEffect(() => { setSearch("") }, [activeTab])

  // ── Tab counts ──────────────────────────────────────────────────────────────
  const sourceCount = selectedSource !== "all" ? 1 : 0
  const tagCount    = selectedTags?.length ?? 0
  const totalActive = sourceCount  + tagCount

  const tabs = [
    { id: "sources",       label: "Sources",       count: sourceCount },
    { id: "tags",          label: "Tags",          count: tagCount    },
  ]

  // ── Items & state helpers ───────────────────────────────────────────────────
  const getItems = () => {
    switch (activeTab) {
      case "sources":       return sources
      case "types":         return types
      case "tags":          return allTags
      default:              return []
    }
  }

  const isChecked = (item) => {
    switch (activeTab) {
      case "sources":       return selectedSource === item
      case "types":         return selectedType === item
      case "opportunities": return selectedOpportunityStatus === item
      case "tags":          return selectedTags?.includes(item)
      default:              return false
    }
  }

  const toggle = (item) => {
    switch (activeTab) {
      case "sources":
        setSelectedSource?.((prev) => prev === item ? "all" : item); break
      case "types":
        setSelectedType?.((prev) => prev === item ? "all" : item); break
      case "opportunities":
        setSelectedOpportunityStatus?.((prev) => prev === item ? "all" : item); break
      case "tags":
        setSelectedTags?.((prev) =>
          prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item]
        ); break
    }
  }

  const handleClear = () => {
    switch (activeTab) {
      case "sources":       setSelectedSource?.("all");             break
      case "types":         setSelectedType?.("all");               break
      case "opportunities": setSelectedOpportunityStatus?.("all"); break
      case "tags":          setSelectedTags?.([]);                  break
    }
  }

  const filteredItems = getItems().filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  )

  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Filters"

  return (
    <DropdownMenu>

      {/* ── Trigger ── */}
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-4 hover:bg-purple-100 font-semibold bg-white h-10 text-sm rounded-lg border border-gray-200 transition-colors duration-150 cursor-pointer">
          <SlidersHorizontal size={14} />
          Filters
          {totalActive > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[11px] font-bold text-white bg-violet-700">
              {totalActive}
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </DropdownMenuTrigger>

      {/* ── Panel ── */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[360px] rounded-2xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >

        {/* Tab bar */}
        <div className="flex gap-1.5 px-3.5 pt-3 mb-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full",
                  "text-[13px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap",
                  active
                    ? "bg-violet-700 text-white"
                    : "bg-gray-100 text-black-700",
                ].join(" ")}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={[
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1",
                    "text-[11px] font-bold text-white",
                    active ? "bg-white/25" : "bg-violet-700",
                  ].join(" ")}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div
          className="px-3.5 pt-3 border-b border-t border-gray-200 pb-1.5"
          onFocusCapture={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Search in ${activeTabLabel}...`}
              autoComplete="off"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[280px] overflow-y-auto px-3.5 pb-2 pt-1">
          {filteredItems.length === 0 ? (
            <p className="text-center text-gray-400 text-[13px] py-6">No results</p>
          ) : filteredItems.map((item) => {
            const checked = isChecked(item)
            return (
              <label
                key={item}
                onClick={() => toggle(item)}
                className="flex items-center gap-2.5 px-1.5 py-2.5 rounded-lg cursor-pointer hover:bg-violet-50 transition-colors duration-100"
              >
                <span className={[
                  "shrink-0 w-[18px] h-[18px] rounded-[5px] flex items-center justify-center transition-all duration-150",
                  checked ? "bg-violet-700 border-0" : "bg-white border border-gray-300",
                ].join(" ")}>
                  {checked && <Check size={11} color="#fff" strokeWidth={3} />}
                </span>
                <span className="text-sm text-gray-900 flex-1 select-none">{item}</span>
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-3.5 py-3 border-t border-gray-100 bg-white">
          <button
            onClick={handleClear}
            className="h-9 px-3.5 rounded-lg border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
          >
            Clear
          </button>
          <button
            onClick={() => onSave?.()}
            className="flex-1 h-9 rounded-lg border-0 bg-violet-700 text-white text-[13px] font-semibold hover:bg-violet-800 cursor-pointer transition-colors duration-150"
          >
            Apply filters
          </button>
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}