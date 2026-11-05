"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, ListFilterIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../../primitives/button"
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover"
import { FacetOptions, selectedOf } from "./faceted-filter"

const FACET_VARIANTS = ["select", "multiSelect"]

/** The table's `select` / `multiSelect` columns: what the Filter button filters by. */
function facetColumnsOf(table) {
  return table
    .getAllColumns()
    .filter((c) => c.getCanFilter() && FACET_VARIANTS.includes(c.columnDef.meta?.variant))
}

/**
 * The toolbar's Filter button. While any filter is on it stays held, with the count in an ink pill.
 *
 * @param {object} props
 * @param {number} props.count Fields with a filter on
 */
const DataTableFilterButton = React.forwardRef(function DataTableFilterButton({ count, className, ...props }, ref) {
  const on = count > 0
  return (
    <Button
      ref={ref}
      data-ds="filters"
      variant="secondary"
      size="md"
      aria-label={on ? `Filter, ${count} on` : "Filter"}
      data-active={on || undefined}
      className={cn("data-[active]:bg-raised-held data-[active]:shadow-control-held", on && "pr-2.5", className)}
      {...props}
    >
      <ListFilterIcon aria-hidden />
      Filter
      {on && (
        <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[7px] bg-foreground px-1.5 text-[13px] leading-none font-normal text-background tabular-nums">
          {count}
        </span>
      )}
    </Button>
  )
})

const LIST_ITEM =
  "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0"

/**
 * One Filter button for every facet column. With one facet it opens straight onto its values;
 * with several it lists the fields first, each with its active count, and a field opens its values.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Table} props.table
 */
function DataTableFilterPopover({ table, className }) {
  const [open, setOpen] = React.useState(false)
  const [fieldId, setFieldId] = React.useState(null)

  const fields = facetColumnsOf(table)
  if (fields.length === 0) return null

  const single = fields.length === 1
  const field = single ? fields[0] : fields.find((c) => c.id === fieldId)
  const countOf = (column) => selectedOf(column.getFilterValue()).size
  const labelOf = (column) => column.columnDef.meta?.label ?? column.id
  const activeFields = fields.filter((c) => countOf(c) > 0).length

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setFieldId(null)
      }}
    >
      <PopoverTrigger asChild>
        <DataTableFilterButton count={activeFields} className={className} />
      </PopoverTrigger>
      <PopoverContent align="start" data-slot="data-table-filter-popover" className="flex max-h-[min(70vh,480px)] w-[280px] flex-col overflow-y-auto p-1.5">
        {field ? (
          <>
            {!single && (
              <button type="button" onClick={() => setFieldId(null)} className={cn(LIST_ITEM, "font-medium [&_svg]:text-muted-foreground")}>
                <ChevronLeftIcon aria-hidden />
                <span className="sr-only">Back to filters, </span>
                {labelOf(field)}
              </button>
            )}
            <FacetOptions
              key={field.id}
              title={labelOf(field)}
              options={field.columnDef.meta?.options ?? []}
              multiple={field.columnDef.meta?.variant === "multiSelect"}
              selected={selectedOf(field.getFilterValue())}
              onChange={(values) => field.setFilterValue(values.length ? values : undefined)}
              onPicked={() => setOpen(false)}
            />
          </>
        ) : (
          <div role="menu" aria-label="Filter by">
            {fields.map((column) => {
              const count = countOf(column)
              return (
                <button key={column.id} type="button" role="menuitem" onClick={() => setFieldId(column.id)} className={LIST_ITEM}>
                  <span className="min-w-0 flex-1 truncate">{labelOf(column)}</span>
                  {count > 0 && <span className="text-sm font-medium text-primary tabular-nums">{count}</span>}
                  <ChevronRightIcon aria-hidden className="text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { DataTableFilterButton, DataTableFilterPopover, facetColumnsOf }
