"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A column head: 14/500 muted. A sortable head is a button that cycles ascending, descending and
 * off; the sorted column turns ink with an arrow.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Column} props.column
 * @param {React.ReactNode} props.title
 */
function DataTableColumnHeader({ column, title, className }) {
  if (!column.getCanSort()) {
    return (
      <div data-ds="column-header" className={cn("flex items-center", className)}>
        {title}
      </div>
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
    <div data-ds="column-header" className={cn("flex items-center", className)}>
      <button
        type="button"
        onClick={toggle}
        data-sorted={sorted || undefined}
        className="-mx-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-[8px] px-1.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:shadow-focus data-[sorted]:text-foreground"
      >
        {title}
        {sorted === "asc" && <ArrowUpIcon aria-hidden className="size-3.5" />}
        {sorted === "desc" && <ArrowDownIcon aria-hidden className="size-3.5" />}
      </button>
    </div>
  )
}

export { DataTableColumnHeader }
