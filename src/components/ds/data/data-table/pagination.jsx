"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../../primitives/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select"

/**
 * Rows-per-page select, page counter and first/prev/next/last buttons.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").Table} props.table
 * @param {number[]} [props.pageSizeOptions]
 */
function DataTablePagination({ table, pageSizeOptions: options, className, ...props }) {
  const pageSizeOptions = options ?? [10, 25, 50, 100]
  const pageSize = table.getState().pagination.pageSize
  // An unlisted size would leave the Select blank, so fold the current one in.
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  return (
    <div
      data-ds="data-table-pagination"
      className={cn("flex w-full flex-col-reverse items-center justify-between gap-4 p-1 sm:flex-row", className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <p className="whitespace-nowrap text-sm text-muted-foreground">Rows per page</p>
        <Select value={`${pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
          <SelectTrigger aria-label="Rows per page" className="w-[4.5rem]">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {sizes.map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-4">
        <p className="num text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            aria-label="Go to first page"
            size="icon-sm"
            className="max-lg:hidden"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            aria-label="Go to previous page"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label="Go to next page"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            aria-label="Go to last page"
            size="icon-sm"
            className="max-lg:hidden"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

export { DataTablePagination }
