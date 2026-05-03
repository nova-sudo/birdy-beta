"use client"

import { useEffect, useState } from "react"
import { SlidersHorizontal, X, Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function FilterPanel({
  sources = [],
  allTags = [],
  selectedSources = [],
  setSelectedSources,
  selectedTags = [],
  setSelectedTags,
  onSave,
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("sources")
  const [search, setSearch] = useState("")

  // Draft state — only committed to parent on "Apply"
  const [draftSources, setDraftSources] = useState(selectedSources)
  const [draftTags, setDraftTags] = useState(selectedTags)

  // Sync draft when parent resets from outside
  useEffect(() => { setDraftSources(selectedSources) }, [selectedSources])
  useEffect(() => { setDraftTags(selectedTags) }, [selectedTags])

  // Reset search on tab change
  useEffect(() => { setSearch("") }, [activeTab])

  // Counts (based on draft)
  const sourceCount = draftSources.length
  const tagCount = draftTags.length
  const totalActive = sourceCount + tagCount

  const tabs = [
    { id: "sources", label: "Sources", count: sourceCount },
    { id: "tags",    label: "Tags",    count: tagCount },
  ]

  const getItems = () => {
    switch (activeTab) {
      case "sources": return sources
      case "tags":    return allTags
      default:        return []
    }
  }

  const isChecked = (item) => {
    switch (activeTab) {
      case "sources": return draftSources.includes(item)
      case "tags":    return draftTags.includes(item)
      default:        return false
    }
  }

  const toggle = (item) => {
    switch (activeTab) {
      case "sources":
        setDraftSources((prev) =>
          prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
        )
        break
      case "tags":
        setDraftTags((prev) =>
          prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item]
        )
        break
    }
  }

  const handleClear = () => {
    switch (activeTab) {
      case "sources": setDraftSources([]); break
      case "tags":    setDraftTags([]);    break
    }
  }

  const handleApply = () => {
    setSelectedSources?.(draftSources)
    setSelectedTags?.(draftTags)
    onSave?.()
    setOpen(false) // ← close panel after apply
  }

  const filteredItems = getItems().filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  )

  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Filters"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-4 hover:bg-purple-100 font-semibold bg-white h-10 text-sm rounded-md border border-gray-200 transition-colors duration-150 cursor-pointer">
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

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[340px] rounded-2xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden p-0 flex flex-col"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Tab bar */}
        <div className="flex gap-1.5 px-3 pt-2.5 pb-1 shrink-0">
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex-1 inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full",
                  "text-[12px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap",
                  active
                    ? "bg-violet-700 text-white"
                    : "bg-gray-100 text-gray-700",
                ].join(" ")}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={[
                    "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full px-1",
                    "text-[10px] font-bold text-white",
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
          className="px-3 py-1.5 border-t border-gray-200 shrink-0"
          onFocusCapture={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Search ${activeTabLabel}…`}
              autoComplete="off"
              className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1">
          {filteredItems.length === 0 ? (
            <p className="text-center text-gray-400 text-[12px] py-5">No results</p>
          ) : (
            filteredItems.map((item) => {
              const checked = isChecked(item)
              return (
                <label
                  key={item}
                  onClick={() => toggle(item)}
                  className="flex items-center gap-2.5 px-1.5 py-[7px] rounded-lg cursor-pointer hover:bg-violet-50 transition-colors duration-100"
                >
                  <span
                    className={[
                      "shrink-0 w-[16px] h-[16px] rounded-[4px] flex items-center justify-center transition-all duration-150",
                      checked
                        ? "bg-violet-700 border-0"
                        : "bg-white border border-gray-300",
                    ].join(" ")}
                  >
                    {checked && <Check size={10} color="#fff" strokeWidth={3} />}
                  </span>
                  <span className="text-[13px] text-gray-900 flex-1 select-none">
                    {item}
                  </span>
                </label>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 bg-white shrink-0">
          <button
            onClick={handleClear}
            className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
          >
            Clear
          </button>
          <button
            onClick={handleApply}
            className="flex-1 h-8 rounded-lg border-0 bg-violet-700 text-white text-[12px] font-semibold hover:bg-violet-800 cursor-pointer transition-colors duration-150"
          >
            Apply filters
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}