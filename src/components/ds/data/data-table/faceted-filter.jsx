"use client"

import * as React from "react"
import { CheckIcon, PlusCircleIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "../../primitives/badge"
import { Button } from "../../primitives/button"
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover"

/** Option lists at least this long get a search field above them. */
const SEARCH_THRESHOLD = 8

/**
 * A facet's checklist: `checkbox` rows for a multi-select, `radio` rows for a single one, a search
 * field once the list is long, and Clear filters while anything is picked. Shared by the
 * standalone faceted filter and the table toolbar's Filter popover.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {{value: string, label: string, count?: number}[]} props.options
 * @param {boolean} [props.multiple]
 * @param {Set<string>} props.selected
 * @param {(values: string[]) => void} props.onChange
 * @param {() => void} [props.onPicked] Called after a single-select pick, to close the list
 */
function FacetOptions({ title, options, multiple, selected, onChange, onPicked }) {
  const [search, setSearch] = React.useState("")
  const hasSearch = options.length >= SEARCH_THRESHOLD
  const needle = search.trim().toLowerCase()
  const visible = hasSearch && needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options

  const pick = (option) => {
    const isSelected = selected.has(option.value)
    if (multiple) {
      const next = new Set(selected)
      if (isSelected) next.delete(option.value)
      else next.add(option.value)
      onChange(Array.from(next))
    } else {
      onChange(isSelected ? [] : [option.value])
      onPicked?.()
    }
  }

  return (
    <>
      {hasSearch && (
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={title}
          aria-label={`Search ${title}`}
          className="mb-1 h-control-sm w-full border-b border-divider bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
      {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>}
      {visible.map((option) => {
        const isSelected = selected.has(option.value)
        return (
          <button
            key={option.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={isSelected}
            onClick={() => pick(option)}
            className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center bg-background shadow-control",
                multiple ? "rounded-sm" : "rounded-full",
                isSelected && "bg-primary text-primary-foreground"
              )}
            >
              {isSelected && <CheckIcon className="size-3" />}
            </span>
            <span className="truncate">{option.label}</span>
            {option.count !== undefined && <span className="num ml-auto text-xs text-muted-foreground">{option.count}</span>}
          </button>
        )
      })}
      {selected.size > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-control border-t border-divider px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:bg-muted"
        >
          <XIcon aria-hidden className="size-3.5" />
          Clear filters
        </button>
      )}
    </>
  )
}

/** The values a column's facet filter holds, as a Set. */
const selectedOf = (filterValue) =>
  new Set(Array.isArray(filterValue) ? filterValue : filterValue == null || filterValue === "" ? [] : [filterValue])

/**
 * Filter chip that opens a checklist. Drives a table column, or stays controlled via `value`.
 * Tables use the toolbar's one Filter button instead; this stays for filters kept outside a table.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Column} [props.column]
 * @param {string} [props.title]
 * @param {{value: string, label: string, count?: number}[]} props.options
 * @param {boolean} [props.multiple] Single select closes after a pick
 * @param {string[]} [props.value] Selected values, for a filter kept outside a column
 * @param {(values: string[]) => void} [props.onValueChange]
 */
function DataTableFacetedFilter({ column, title, options, multiple, value, onValueChange }) {
  const [open, setOpen] = React.useState(false)

  const columnValue = column?.getFilterValue()
  const selected = React.useMemo(
    () => new Set(value ?? (Array.isArray(columnValue) ? columnValue : [])),
    [value, columnValue]
  )

  const setSelected = (values) => {
    if (onValueChange) onValueChange(values)
    else column?.setFilterValue(values.length ? values : undefined)
  }

  const labelOf = (v) => options.find((o) => o.value === v)?.label ?? String(v)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button data-ds="faceted-filter" variant="outline" size="sm" className="border-dashed">
          <PlusCircleIcon aria-hidden />
          {title}
          {selected.size > 0 && (
            <>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
              <Badge size="sm" className="px-1.5 font-normal lg:hidden">{selected.size}</Badge>
              <span className="hidden items-center gap-1 lg:flex">
                {selected.size > 2 ? (
                  <Badge size="sm" className="px-1.5 font-normal">{selected.size} selected</Badge>
                ) : (
                  // A value the rows no longer offer still gets a badge, else the count has no name.
                  Array.from(selected, (v) => (
                    <Badge key={String(v)} tone="primary" size="sm" className="px-1.5 font-normal">
                      {labelOf(v)}
                    </Badge>
                  ))
                )}
              </span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1">
        {/* Mounted only while open, so its search starts empty each time. */}
        <FacetOptions
          title={title}
          options={options}
          multiple={multiple}
          selected={selected}
          onChange={setSelected}
          onPicked={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DataTableFacetedFilter, FacetOptions, selectedOf }
