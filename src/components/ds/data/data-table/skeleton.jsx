import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "../../surfaces/skeleton"

/**
 * Placeholder rows shown while data loads: a table from `md` up, stacked cards below.
 *
 * @param {object} props
 * @param {number} props.columnCount
 * @param {number} [props.rowCount=8]
 */
function DataTableSkeleton({ columnCount, rowCount = 8, className, ...props }) {
  const rows = Array.from({ length: rowCount })
  const cols = Array.from({ length: columnCount })
  return (
    <div
      data-ds="data-table-skeleton"
      role="status"
      aria-label="Loading"
      className={cn("w-full", className)}
      {...props}
    >
      <table className="w-full max-md:hidden">
        <tbody>
          {rows.map((_, i) => (
            <tr key={i} data-slot="data-table-skeleton-row" className="border-b border-border last:border-0">
              {cols.map((__, j) => (
                <td key={j} className="px-4 py-3">
                  <Skeleton className="h-5 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {rows.slice(0, Math.min(rowCount, 4)).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-surface" />
        ))}
      </div>
    </div>
  )
}

export { DataTableSkeleton }
