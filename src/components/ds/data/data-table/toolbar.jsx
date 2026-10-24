"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../../primitives/button"
import { Input } from "../../primitives/input"
import { DataTableFacetedFilter } from "./faceted-filter"
import { DataTableViewOptions } from "./view-options"

const FACET_VARIANTS = ["select", "multiSelect"]

/**
 * Search box, one faceted filter per `select` / `multiSelect` column, reset, and view options.
 * Columns opt in through `meta: { variant: "text" | "select" | "multiSelect", options, label }`.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Table} props.table
 * @param {React.ReactNode} [props.children] Extra controls after the filters
 */
function DataTableToolbar({ table, children, className, ...props }) {
  const columns = table.getAllColumns().filter((c) => c.getCanFilter())
  const search = columns.find((c) => c.columnDef.meta?.variant === "text")
  const facets = columns.filter((c) => FACET_VARIANTS.includes(c.columnDef.meta?.variant))
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div
      data-ds="data-table-toolbar"
      role="toolbar"
      className={cn("flex w-full flex-wrap items-center gap-2 p-1", className)}
      {...props}
    >
      {search && (
        <Input
          type="search"
          aria-label={`Search ${search.columnDef.meta?.label ?? search.id}`}
          placeholder={`Search ${(search.columnDef.meta?.label ?? search.id).toLowerCase()}…`}
          value={search.getFilterValue() ?? ""}
          onChange={(e) => search.setFilterValue(e.target.value || undefined)}
          className="h-control-sm w-full sm:w-56"
        />
      )}
      {facets.map((column) => (
        <DataTableFacetedFilter
          key={column.id}
          column={column}
          title={column.columnDef.meta?.label ?? column.id}
          options={column.columnDef.meta?.options ?? []}
          multiple={column.columnDef.meta?.variant === "multiSelect"}
        />
      ))}
      {isFiltered && (
        <Button variant="ghost" size="sm" aria-label="Reset filters" onClick={() => table.resetColumnFilters()}>
          <XIcon aria-hidden />
          Reset
        </Button>
      )}
      {children}
      <DataTableViewOptions table={table} />
    </div>
  )
}

export { DataTableToolbar }
