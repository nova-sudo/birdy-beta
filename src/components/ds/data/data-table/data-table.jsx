"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { DataTableColumnHeader } from "./column-header"
import { DataTablePagination } from "./pagination"
import { DataTableSkeleton } from "./skeleton"
import { DataTableToolbar } from "./toolbar"

const FACET_VARIANTS = ["select", "multiSelect"]

// A facet filter value is the list of accepted cell values.
const facetFilterFn = (row, columnId, values) => values.includes(row.getValue(columnId))
facetFilterFn.autoRemove = (values) => !values || values.length === 0

const headerLabel = (column) =>
  column.columnDef.meta?.label ?? (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)

/**
 * Sortable, filterable, paginated table that collapses to stacked cards below `md`.
 * Both renderings are in the DOM; Tailwind hides the one that does not fit.
 *
 * Columns are TanStack `ColumnDef`s. `meta` opts a column into the toolbar:
 * `{ label, variant: "text" | "select" | "multiSelect", options: [{ value, label }], cardHidden }`.
 * State lives here unless the page passes `state` / `onStateChange` (`sorting`,
 * `columnFilters`, `columnVisibility`, `pagination`), which is how a page syncs to a URL.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").ColumnDef[]} props.columns
 * @param {object[]} props.data
 * @param {boolean} [props.loading] Shows skeleton rows in place of the body
 * @param {React.ReactNode} [props.empty] Shown when there are no rows
 * @param {React.ReactNode|((table: import("@tanstack/react-table").Table) => React.ReactNode)} [props.toolbar] Extra toolbar controls
 * @param {number} [props.pageSize=25]
 * @param {(row: object) => void} [props.onRowClick]
 * @param {(row: object, index: number) => string} [props.getRowId]
 * @param {object} [props.state] Controlled slice of table state
 * @param {(state: object) => void} [props.onStateChange] Called with the full state on every change
 */
function DataTable({
  columns,
  data,
  loading = false,
  empty,
  toolbar,
  pageSize = 25,
  onRowClick,
  getRowId,
  state: controlled,
  onStateChange,
  className,
  ...props
}) {
  const [local, setLocal] = React.useState({
    sorting: [],
    columnFilters: [],
    columnVisibility: {},
    pagination: { pageIndex: 0, pageSize },
  })
  const state = { ...local, ...controlled }

  const update = (key) => (updater) => {
    const next = { ...state, [key]: typeof updater === "function" ? updater(state[key]) : updater }
    setLocal(next)
    onStateChange?.(next)
  }

  const defs = React.useMemo(
    () =>
      columns.map((c) =>
        FACET_VARIANTS.includes(c.meta?.variant) && !c.filterFn ? { ...c, filterFn: facetFilterFn } : c
      ),
    [columns]
  )

  const table = useReactTable({
    data,
    columns: defs,
    state,
    getRowId,
    onSortingChange: update("sorting"),
    onColumnFiltersChange: (u) => {
      // A new filter changes the row set, so go back to the first page.
      const next = typeof u === "function" ? u(state.columnFilters) : u
      const nextState = { ...state, columnFilters: next, pagination: { ...state.pagination, pageIndex: 0 } }
      setLocal(nextState)
      onStateChange?.(nextState)
    },
    onColumnVisibilityChange: update("columnVisibility"),
    onPaginationChange: update("pagination"),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  })

  const rows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns()
  const showToolbar = toolbar != null || columns.some((c) => c.meta?.variant)
  const isEmpty = !loading && rows.length === 0

  const rowProps = (row) =>
    onRowClick
      ? {
          onClick: () => onRowClick(row.original),
          onKeyDown: (e) => {
            if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row.original)
          },
          tabIndex: 0,
          className: "cursor-pointer",
        }
      : {}

  return (
    <div data-ds="data-table" className={cn("flex w-full flex-col gap-3", className)} {...props}>
      {showToolbar && (
        <DataTableToolbar table={table}>{typeof toolbar === "function" ? toolbar(table) : toolbar}</DataTableToolbar>
      )}
      <div className="overflow-hidden rounded-surface bg-background shadow-surface">
        {loading ? (
          <DataTableSkeleton columnCount={visibleColumns.length} rowCount={Math.min(pageSize, 8)} />
        ) : isEmpty ? (
          <div data-slot="data-table-empty">{empty}</div>
        ) : (
          <>
            <table className="w-full text-sm max-md:hidden">
              <thead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className="border-b border-border">
                    {group.headers.map((header) => {
                      const { column } = header
                      const sorted = column.getIsSorted()
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={
                            column.getCanSort() ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined
                          }
                          className="h-10 px-4 text-left text-xs font-medium text-muted-foreground"
                        >
                          {header.isPlaceholder ? null : typeof column.columnDef.header === "string" ? (
                            <DataTableColumnHeader column={column} title={column.columnDef.header} />
                          ) : (
                            flexRender(column.columnDef.header, header.getContext())
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    {...rowProps(row)}
                    className={cn(
                      "border-b border-border transition-colors last:border-0 hover:bg-muted/50",
                      rowProps(row).className
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="flex flex-col gap-3 p-3 md:hidden">
              {rows.map((row) => {
                const [lead, ...rest] = row.getVisibleCells()
                return (
                  <li
                    key={row.id}
                    data-slot="data-table-card"
                    {...rowProps(row)}
                    className={cn("rounded-surface bg-muted/40 p-4", rowProps(row).className)}
                  >
                    {lead && <div className="mb-2">{flexRender(lead.column.columnDef.cell, lead.getContext())}</div>}
                    <dl className="flex flex-col gap-1.5">
                      {rest
                        .filter((cell) => !cell.column.columnDef.meta?.cardHidden)
                        .map((cell) => (
                          <div key={cell.id} className="flex items-center justify-between gap-3">
                            <dt className="text-xs text-muted-foreground">{headerLabel(cell.column)}</dt>
                            <dd className="min-w-0">{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
      {!loading && !isEmpty && <DataTablePagination table={table} />}
    </div>
  )
}

export { DataTable }
