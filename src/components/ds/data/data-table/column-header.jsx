"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A column head: 14/500 muted, optionally led by a small icon. A sortable head is a button that cycles ascending, descending and
 * off; the sorted column turns ink with an arrow. A right-aligned head (a number column) runs its
 * label to the cell's right edge, where the figures end.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Column} props.column
 * @param {React.ReactNode} props.title
 * @param {"left"|"right"} [props.align] Defaults to the column's `meta.align`
 * @param {React.ReactNode} [props.icon] A small mark before the label, such as the column's data source
 */
function DataTableColumnHeader({ column, title, align, icon, className }) {
  const right = (align ?? column.columnDef.meta?.align) === "right"
  const root = cn(right ? "flex w-full items-center justify-end" : "inline-flex items-center", className)
  const lead = icon ? (
    <span data-slot="column-header-icon" aria-hidden className="inline-flex shrink-0 items-center">
      {icon}
    </span>
  ) : null

  if (!column.getCanSort()) {
    return (
      <span data-ds="column-header" data-align={right ? "right" : undefined} className={cn(root, "gap-1.5")}>
        {lead}
        {title}
      </span>
    )
  }

  const sorted = column.getIsSorted()

  // none -> asc -> desc -> none
  const toggle = () => {
    if (!sorted) column.toggleSorting(false)
    else if (sorted === "asc") column.toggleSorting(true)
    else column.clearSorting()
  }

  return (
    <span data-ds="column-header" data-align={right ? "right" : undefined} className={root}>
      <button
        type="button"
        onClick={toggle}
        data-sorted={sorted || undefined}
        className="-mx-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-[8px] px-1.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:shadow-focus data-[sorted]:text-foreground"
      >
        {lead}
        {title}
        {sorted === "asc" && <ArrowUpIcon aria-hidden className="size-3.5" />}
        {sorted === "desc" && <ArrowDownIcon aria-hidden className="size-3.5" />}
      </button>
    </span>
  )
}

export { DataTableColumnHeader }
