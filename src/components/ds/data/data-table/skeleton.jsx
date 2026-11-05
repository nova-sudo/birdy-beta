import * as React from "react"

import { cn } from "@/lib/utils"

const SKELETON_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-1/3", "w-2/3"]

const SKELETON_BAR =
  "block h-3 rounded-full bg-skeleton motion-safe:animate-skeleton motion-safe:bg-[linear-gradient(90deg,var(--color-skeleton)_25%,var(--color-skeleton-shine)_50%,var(--color-skeleton)_75%)] motion-safe:bg-[length:200%_100%]"

const SKELETON_CELL = "bg-background px-3 py-2.5 align-middle first:pl-4 last:pr-4"

/**
 * Placeholder rows for a table body while it loads: one bar per cell, widths staggered so the rows
 * do not read as a grid. The table's heads stay put above them.
 *
 * @param {object} props
 * @param {number} props.columnCount
 * @param {number} [props.rowCount=5]
 * @param {string} [props.rowHeight="h-15"]
 */
function DataTableSkeletonRows({ columnCount, rowCount = 5, rowHeight = "h-15", className }) {
  return (
    <tbody data-ds="data-table-skeleton" aria-busy="true" className={className}>
      {Array.from({ length: rowCount }, (_, i) => (
        <tr key={i} aria-hidden data-slot="data-table-skeleton-row">
          {Array.from({ length: columnCount }, (__, j) => (
            <td key={j} className={cn(SKELETON_CELL, rowHeight)}>
              <span className={cn(SKELETON_BAR, SKELETON_WIDTHS[(i + j) % 5])} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/**
 * A two-line placeholder for each row of the narrow list.
 *
 * @param {object} props
 * @param {number} [props.rowCount=5]
 */
function DataTableSkeletonItems({ rowCount = 5 }) {
  return Array.from({ length: rowCount }, (_, i) => (
    <li key={i} aria-hidden data-ds="data-table-skeleton" className="flex flex-col gap-3 px-4 py-4">
      <span className="flex justify-between gap-6">
        <span className={cn(SKELETON_BAR, "w-2/5")} />
        <span className={cn(SKELETON_BAR, "w-1/6")} />
      </span>
      <span className="flex justify-between gap-6">
        <span className={cn(SKELETON_BAR, "h-6 w-1/4 rounded-[7px]")} />
        <span className={cn(SKELETON_BAR, "w-1/3")} />
      </span>
    </li>
  ))
}

/**
 * Standalone placeholder for a table that has not mounted yet: rows on a surface with hairlines.
 *
 * @param {object} props
 * @param {number} props.columnCount
 * @param {number} [props.rowCount=8]
 */
function DataTableSkeleton({ columnCount, rowCount = 8, className, ...props }) {
  return (
    <div
      data-ds="data-table-skeleton"
      role="status"
      aria-label="Loading"
      className={cn("w-full overflow-clip rounded-frame bg-background shadow-surface", className)}
      {...props}
    >
      <table className="w-full border-separate border-spacing-0">
        <DataTableSkeletonRows
          columnCount={columnCount}
          rowCount={rowCount}
          className="[&>tr:not(:first-child)>*]:border-t [&>tr>*]:border-divider"
        />
      </table>
    </div>
  )
}

export { DataTableSkeleton, DataTableSkeletonItems, DataTableSkeletonRows, SKELETON_BAR }
