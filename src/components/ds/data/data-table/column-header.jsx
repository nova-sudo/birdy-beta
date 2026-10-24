"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Header label; a sortable column renders it as a button that cycles none, asc, desc.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Column} props.column
 * @param {React.ReactNode} props.title
 */
function DataTableColumnHeader({ column, title, className }) {
  if (!column.getCanSort()) {
    return (
      <span data-ds="column-header" className={className}>
        {title}
      </span>
    )
  }

  const sorted = column.getIsSorted()
  const Icon = sorted === "desc" ? ChevronDownIcon : sorted === "asc" ? ChevronUpIcon : ChevronsUpDownIcon

  // none -> asc -> desc -> none
  const toggle = () => {
    if (!sorted) column.toggleSorting(false)
    else if (sorted === "asc") column.toggleSorting(true)
    else column.clearSorting()
  }

  return (
    <button
      type="button"
      data-ds="column-header"
      onClick={toggle}
      className={cn(
        "-ml-2 inline-flex h-control-sm items-center gap-1.5 rounded-control px-2 outline-none transition-colors hover:bg-muted focus-visible:shadow-control-focus",
        className
      )}
    >
      {title}
      <Icon aria-hidden className={cn("size-3.5 shrink-0", sorted ? "text-foreground" : "text-muted-foreground")} />
    </button>
  )
}

export { DataTableColumnHeader }
