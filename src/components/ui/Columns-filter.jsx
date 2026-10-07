'use client';

import { useState, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import { ChevronDown } from "lucide-react"
import { SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ColumnVisibilityDropdown({
  isOpen,
  setIsOpen,

  categories,
  selectedCategory,
  setSelectedCategory,
  categoryCounts,

  // Accept but no longer require external search state
  searchTerm: _externalSearch,
  setSearchTerm: _externalSetSearch,

  filteredColumns,
  triggerClassName,
  columnVisibility,
  toggleColumnVisibility,

  getIcon,

  selectAll,
  clearAll,
  save,
}) {
  // ── Local search state (avoids re-rendering the entire parent on each keystroke) ──
  const [localSearch, setLocalSearch] = useState("")
  const inputRef = useRef(null)

  // Reset local search when dropdown opens/closes or category changes
  useEffect(() => {
    setLocalSearch("")
  }, [isOpen, selectedCategory])

  // Also sync to parent if it expects it (backward compat)
  useEffect(() => {
    _externalSetSearch?.(localSearch)
  }, [localSearch])

  // Filter columns locally so the parent doesn't need to recompute
  const displayColumns = useMemo(() => {
    if (!localSearch) return filteredColumns
    const q = localSearch.toLowerCase()
    return filteredColumns.filter(col =>
      col.label?.toLowerCase().includes(q) ||
      col.id?.toLowerCase().includes(q)
    )
  }, [filteredColumns, localSearch])

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={triggerClassName ?? "flex items-center gap-1 md:gap-2 px-2 md:px-4 h-10 text-sm"}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden lg:inline">Columns</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="bg-pd-surface p-0 w-screen sm:w-fit md:w-fit">
        {/* Categories */}
        <div className="flex flex-nowrap justify-between gap-1 p-2 border-b border-pd-divider overflow-x-auto md:overflow-x-visible">
          {categories.map(({ id, label }) => (
            <Button
              key={id}
              variant={selectedCategory === id ? "default" : "secondary"}
              size="sm"
              onClick={() => setSelectedCategory(id)}
              data-state={selectedCategory === id ? "active" : "inactive"}
              className="flex-shrink-0"
            >
              {label} {categoryCounts[id] || 0}
            </Button>
          ))}
        </div>

        {/* Search — fully local, no parent re-render */}
        <div className="px-2 mt-2 mb-2" onFocusCapture={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            className="h-9 text-sm"
            placeholder={`Search in ${
              categories.find(c => c.id === selectedCategory)?.label ||
              "All Metrics"
            }...`}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoComplete="off"
          />
        </div>

        {/* Columns */}
        <div className="max-h-80 overflow-y-auto px-2 pb-2 border-t border-pd-divider">
          {displayColumns.map((col) => {
            const Icon = getIcon?.(col)

            return (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={columnVisibility[col.id] ?? col.visible}
                onCheckedChange={() => toggleColumnVisibility(col.id)}
                onSelect={(e) => e.preventDefault()}
              >
                {col.label}

                {Icon && (
                  <Image
                    src={Icon || "/placeholder.svg"}
                    alt=""
                    width={16}
                    height={16}
                    className="ml-auto opacity-70"
                  />
                )}
              </DropdownMenuCheckboxItem>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex p-2 border-t border-pd-divider">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            className="mr-2"
          >
            Select All
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="mr-2"
          >
            Clear
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={save}
          >
            Save view
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
