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
import { Button } from "../../primitives/button"
import { EmptyState } from "../../surfaces/empty-state"
import { DataTableColumnHeader } from "./column-header"
import { DataTablePagination } from "./pagination"
import { DataTableSkeleton } from "./skeleton"
import { DataTableToolbar } from "./toolbar"

const FACET_VARIANTS = ["select", "multiSelect"]

// A facet filter value is the list of accepted cell values.
const facetFilterFn = (row, columnId, values) => [].concat(values).includes(row.getValue(columnId))
facetFilterFn.autoRemove = (values) => values == null || values === "" || values.length === 0

// First column pinned: opaque so scrolled cells pass beneath it, with a hairline on its right edge.
const STICKY_CELL = "sticky left-0 z-10 bg-background shadow-[inset_-1px_0_0_var(--color-border)]"

const STICKY_CELL_DRAG = STICKY_CELL.replace("bg-background", "bg-muted")

const minWidthStyle = (column) => {
  const minWidth = column.columnDef.meta?.minWidth
  return minWidth ? { minWidth } : undefined
}

const headerLabel = (column) =>
  column.columnDef.meta?.label ?? (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)

/**
 * Sortable, filterable, paginated table that collapses to stacked cards below `md`.
 * Both renderings are in the DOM; Tailwind hides the one that does not fit.
 *
 * Columns are TanStack `ColumnDef`s. `meta` opts a column into the toolbar:
 * `{ label, variant: "text" | "select" | "multiSelect", options: [{ value, label }], cardHidden }`.
 * Keep `columns` and `data` referentially stable (memoise them): a new array each render re-runs the table.
 * Table and cards both exist in the DOM, so tests should scope to `role=table` or `data-slot=data-table-card`.
 *
 * State lives here unless the page passes `state` / `onStateChange` (`sorting`,
 * `columnFilters`, `columnVisibility`, `columnOrder`, `pagination`), which is how a page syncs to a URL.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").ColumnDef[]} props.columns
 * @param {object[]} props.data
 * @param {boolean} [props.loading] Shows skeleton rows in place of the body
 * @param {React.ReactNode} [props.empty] Shown when `data` itself is empty
 * @param {React.ReactNode} [props.emptyFiltered] Shown when filters leave no rows; defaults to "No results" with a clear-filters action
 * @param {React.ReactNode|((table: import("@tanstack/react-table").Table) => React.ReactNode)} [props.toolbar] Extra toolbar controls
 * @param {number} [props.pageSize=25]
 * @param {number[]} [props.pageSizeOptions] Choices in the rows-per-page select
 * @param {boolean} [props.manualPagination] `data` is already the current page (server paging): rows are not sliced, `rowCount` sets the page count and `state.pagination` / `onStateChange` carry the page index
 * @param {number} [props.rowCount] Total rows across all pages; only with `manualPagination`
 * @param {boolean} [props.stickyFirstColumn] Pins the first column while the table scrolls sideways. Cells never wrap; `meta.minWidth` (px) sets a column's minimum width
 * @param {string[]} [props.lockedColumnIds] Columns that cannot be dragged and cannot be dropped onto (so nothing lands before a locked first column)
 * @param {(fromId: string, toId: string) => void} [props.onColumnReorder] Makes headers draggable; called with the dragged column id and the one it was dropped on
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
  emptyFiltered,
  toolbar,
  pageSize = 25,
  pageSizeOptions,
  manualPagination = false,
  rowCount,
  onColumnReorder,
  stickyFirstColumn = false,
  lockedColumnIds = [],
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
    columnOrder: [],
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
    onColumnOrderChange: update("columnOrder"),
    onPaginationChange: update("pagination"),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination,
    rowCount: manualPagination ? rowCount : undefined,
    autoResetPageIndex: false,
  })

  const rows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns()
  const showToolbar = toolbar != null || columns.some((c) => c.meta?.variant)
  const totalRows = table.getPrePaginationRowModel().rows.length
  const isEmpty = !loading && totalRows === 0
  const pageIndex = state.pagination.pageIndex
  const pageCount = table.getPageCount()
  const [dragOver, setDragOver] = React.useState(null)

  // Data can shrink under the current page (refetch, narrower filter); pull back to the last page.
  React.useEffect(() => {
    // With server paging the page owns the index; clamping would fight it.
    if (!manualPagination && pageIndex > 0 && pageIndex >= pageCount) table.setPageIndex(Math.max(0, pageCount - 1))
  })

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
          <div data-slot="data-table-empty">
            {data.length === 0
              ? empty
              : (emptyFiltered ?? (
                  <EmptyState
                    title="No results"
                    description="Nothing matches the current filters."
                    action={
                      <Button
                        size="sm"
                        onClick={() => {
                          table.resetColumnFilters()
                          table.resetGlobalFilter()
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                ))}
          </div>
        ) : (
          <>
            <div data-slot="data-table-scroll" className="overflow-x-auto max-md:hidden">
              <table className="w-full text-sm">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id} className="border-b border-border">
                      {group.headers.map((header, colIndex) => {
                        const { column } = header
                        const sorted = column.getIsSorted()
                        const locked = lockedColumnIds.includes(column.id)
                        return (
                          <th
                            key={header.id}
                            scope="col"
                            aria-sort={
                              column.getCanSort() ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined
                            }
                            style={minWidthStyle(column)}
                            className={cn(
                              "h-10 whitespace-nowrap px-4 text-left text-xs font-medium text-muted-foreground",
                              onColumnReorder && !locked && "cursor-grab",
                              stickyFirstColumn && colIndex === 0 && (dragOver === column.id ? STICKY_CELL_DRAG : STICKY_CELL),
                              // After the pinned bg-background, and swaps it out rather than racing it.
                              dragOver === column.id && !(stickyFirstColumn && colIndex === 0) && "bg-muted"
                            )}
                            {...(onColumnReorder
                              ? {
                                  draggable: !locked,
                                  onDragStart: (e) => {
                                    e.dataTransfer.effectAllowed = "move"
                                    e.dataTransfer.setData("text/plain", column.id)
                                  },
                                  onDragOver: (e) => {
                                    if (locked) return
                                    e.preventDefault()
                                    setDragOver(column.id)
                                  },
                                  onDragLeave: () => setDragOver(null),
                                  onDrop: (e) => {
                                    e.preventDefault()
                                    setDragOver(null)
                                    const from = e.dataTransfer.getData("text/plain")
                                    if (locked) return
                                    if (from && from !== column.id && !lockedColumnIds.includes(from)) onColumnReorder(from, column.id)
                                  },
                                }
                              : {})}
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
                      {row.getVisibleCells().map((cell, colIndex) => (
                        <td
                          key={cell.id}
                          style={minWidthStyle(cell.column)}
                          className={cn(
                            "whitespace-nowrap px-4 py-3 align-middle",
                            stickyFirstColumn && colIndex === 0 && STICKY_CELL
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      {!loading && !isEmpty && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
    </div>
  )
}

export { DataTable }
