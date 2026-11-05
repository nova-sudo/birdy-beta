"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../../primitives/button"
import { SearchInput } from "../../forms/search-input"
import { DataTableFilterPopover, facetColumnsOf } from "./filters"
import { DataTableViewOptions } from "./view-options"

// Pull a caller's SearchInput (also inside fragments) out of its controls so it sits at the left edge.
function splitSearch(children) {
  const searches = []
  const rest = []
  const walk = (nodes) =>
    React.Children.forEach(nodes, (child) => {
      if (React.isValidElement(child) && child.type === React.Fragment) walk(child.props.children)
      else if (React.isValidElement(child) && child.type === SearchInput) searches.push(child)
      else rest.push(child)
    })
  walk(children)
  return [searches, rest]
}

const SEARCH_SLOT =
  "w-72 max-w-full shrink-0 @max-xl/table:w-auto @max-xl/table:min-w-0 @max-xl/table:flex-1 @max-xl/table:basis-full"

/**
 * The 56 strip at the top of a table: the search first at the left edge, then one Filter button
 * for every `select` / `multiSelect` column, then the caller's controls and view options on the
 * right. Below 576 of the table's width the search takes the first row and the rest wrap under it.
 * Columns opt in through `meta: { variant: "text" | "select" | "multiSelect", options, label, placeholder }`.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Table} props.table
 * @param {React.ReactNode} [props.children] Extra controls at the right end; a SearchInput among them moves to the left edge
 */
function DataTableToolbar({ table, children, className, ...props }) {
  const columns = table.getAllColumns().filter((c) => c.getCanFilter())
  const search = columns.find((c) => c.columnDef.meta?.variant === "text")
  const hasFilters = facetColumnsOf(table).length > 0
  const isFiltered = table.getState().columnFilters.length > 0
  const label = search && (search.columnDef.meta?.label ?? search.id)
  const [searches, controls] = splitSearch(children)

  return (
    <div
      data-ds="data-table-toolbar"
      role="toolbar"
      aria-label="Table tools"
      className={cn("flex min-h-14 shrink-0 flex-wrap items-center gap-2 px-3 py-2 @max-xl/table:py-3", className)}
      {...props}
    >
      {search && (
        <div className={SEARCH_SLOT}>
          <SearchInput
            // The table filters in the browser, so the rows move with the keystroke.
            debounceMs={0}
            placeholder={search.columnDef.meta?.placeholder ?? `Search ${label.toLowerCase()}…`}
            value={search.getFilterValue() ?? ""}
            onChange={(next) => search.setFilterValue(next || undefined)}
          />
        </div>
      )}
      {searches.map((node, i) => (
        <div key={node.key ?? i} className={SEARCH_SLOT}>
          {node}
        </div>
      ))}
      {hasFilters && <DataTableFilterPopover table={table} />}
      {isFiltered && (
        <Button variant="ghost" aria-label="Reset filters" onClick={() => table.resetColumnFilters()}>
          <XIcon aria-hidden />
          Reset
        </Button>
      )}
      <div data-slot="data-table-toolbar-end" className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        {controls}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  )
}

export { DataTableToolbar }
