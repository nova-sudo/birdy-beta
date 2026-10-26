"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Button } from "../../primitives/button"
import { EmptyState } from "../../surfaces/empty-state"
import { useInsideFrame } from "../../surfaces/frame"
import { DataTableColumnHeader } from "./column-header"
import { DataTablePagination } from "./pagination"
import { DataTableSkeletonItems, DataTableSkeletonRows } from "./skeleton"
import { DataTableToolbar } from "./toolbar"

const FACET_VARIANTS = ["select", "multiSelect"]

// A facet filter value is the list of accepted cell values.
const facetFilterFn = (row, columnId, values) => [].concat(values).includes(row.getValue(columnId))
facetFilterFn.autoRemove = (values) => values == null || values === "" || values.length === 0

const HEAD_CELL =
  "h-9 px-3 text-left align-middle text-sm font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4"

// Birdy keeps cells on one line (`whitespace-nowrap`); a wide table scrolls sideways instead.
const BODY_CELL =
  "bg-background px-3 py-2.5 align-middle text-sm whitespace-nowrap text-foreground transition-colors first:pl-4 last:pr-4 group-hover/row:bg-row-hover group-data-[state=selected]/row:bg-row-selected"

/**
 * The surface: rows sit on white with one outline, hairlines between. Borders draw inside the
 * cells, so the scroll strip sits a pixel wider than the frame to put that outline on the frame's
 * own line, and the corners take one more pixel of radius so they follow the frame's curve.
 */
const SURFACE_BODY = cn(
  "[&>tr:not(:first-child)>*]:border-t [&>tr>*]:border-divider",
  "[&>tr:first-child>*]:border-t [&>tr:first-child>*]:border-t-surface-ring",
  "[&>tr:last-child>*]:border-b [&>tr:last-child>*]:border-b-surface-ring",
  "[&>tr>*:first-child]:border-l [&>tr>*:first-child]:border-l-surface-ring",
  "[&>tr>*:last-child]:border-r [&>tr>*:last-child]:border-r-surface-ring",
  "[&>tr:first-child>*:first-child]:rounded-tl-[calc(var(--radius-frame)+1px)] [&>tr:first-child>*:last-child]:rounded-tr-[calc(var(--radius-frame)+1px)]",
  "[&>tr:last-child>*:first-child]:rounded-bl-[calc(var(--radius-frame)+1px)] [&>tr:last-child>*:last-child]:rounded-br-[calc(var(--radius-frame)+1px)]"
)

// The cells round the surface at the table's own ends. A table wider than its frame scrolls those
// ends out of view, so these pieces draw the corners and side outline on the visible edges
// instead. They paint over the same spot as the cell corners when nothing scrolls. The head row is
// h-9, so the surface starts 36px down.
const EDGE_RADIUS = "calc(var(--radius-frame) + 1px)"
const corner = (at) =>
  `radial-gradient(circle at ${at}, transparent calc(${EDGE_RADIUS} - 1px), var(--color-surface-ring) calc(${EDGE_RADIUS} - 1px), var(--color-surface-ring) ${EDGE_RADIUS}, var(--color-frame) ${EDGE_RADIUS})`

function SurfaceEdges() {
  const piece = "pointer-events-none absolute z-20 size-[calc(var(--radius-frame)+1px)]"
  return (
    <div aria-hidden data-slot="data-table-edges">
      <span className={cn(piece, "top-9 left-0")} style={{ backgroundImage: corner("100% 100%") }} />
      <span className={cn(piece, "top-9 right-0")} style={{ backgroundImage: corner("0 100%") }} />
      <span className={cn(piece, "bottom-0 left-0")} style={{ backgroundImage: corner("100% 0") }} />
      <span className={cn(piece, "right-0 bottom-0")} style={{ backgroundImage: corner("0 0") }} />
      <span className="pointer-events-none absolute top-9 bottom-0 left-0 z-10 w-px bg-surface-ring" />
      <span className="pointer-events-none absolute top-9 right-0 bottom-0 z-10 w-px bg-surface-ring" />
    </div>
  )
}

const BARE_BODY = "[&>tr>*]:border-t [&>tr>*]:border-divider"

const MOBILE_ITEM =
  "block w-full min-w-0 overflow-hidden px-4 py-3 text-left outline-none transition-colors hover:bg-row-hover focus-visible:bg-row-hover"

// First column pinned: opaque so scrolled cells pass beneath it, with a hairline on its right edge.
const STICKY = "sticky left-0 z-10 shadow-[inset_-1px_0_0_var(--color-divider)]"

const minWidthStyle = (column) => {
  const minWidth = column.columnDef.meta?.minWidth
  return minWidth ? { minWidth } : undefined
}

const headerLabel = (column) =>
  column.columnDef.meta?.label ?? (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)

/**
 * Every list in the app. One frame holds the toolbar (search, Filter, the caller's controls), the
 * column heads and the footer; the rows sit on its white surface. Loading and empty change only
 * the surface, so the heads stay put. Below 576 of its own width (a container query) the rows fold
 * into a list. Set inside a Frame, or with `bare`, it draws no frame of its own.
 * Both renderings are in the DOM; the container query hides the one that does not fit.
 *
 * Columns are TanStack `ColumnDef`s. `meta` opts a column into the toolbar:
 * `{ label, variant: "text" | "select" | "multiSelect", options: [{ value, label }], placeholder, cardHidden, align: "right" }`
 * (`align: "right"` right-aligns the head, for a number column).
 * Keep `columns` and `data` referentially stable (memoise them): a new array each render re-runs the table.
 * Table and list both exist in the DOM, so tests should scope to `role=table` or `data-slot=data-table-card`.
 *
 * State lives here unless the page passes `state` / `onStateChange` (`sorting`,
 * `columnFilters`, `columnVisibility`, `columnOrder`, `pagination`, `expanded`), which is how a page syncs to a URL.
 *
 * @param {object} props
 * @param {import("@tanstack/react-table").ColumnDef[]} props.columns
 * @param {object[]} props.data
 * @param {boolean} [props.loading] Shows skeleton rows in place of the body
 * @param {React.ReactNode} [props.empty] Shown when `data` itself is empty
 * @param {React.ReactNode} [props.emptyFiltered] Shown when filters leave no rows; defaults to "No results" with a clear-filters action
 * @param {React.ReactNode|((table: import("@tanstack/react-table").Table) => React.ReactNode)} [props.toolbar] Extra toolbar controls
 * @param {boolean} [props.bare] Draws no frame of its own; implied inside a Frame or FrameSurface
 * @param {boolean} [props.dense] 52 rows instead of 60
 * @param {number} [props.pageSize=25]
 * @param {number[]} [props.pageSizeOptions] Choices in the rows-per-page select
 * @param {boolean} [props.manualPagination] `data` is already the current page (server paging): rows are not sliced, `rowCount` sets the page count and `state.pagination` / `onStateChange` carry the page index
 * @param {number} [props.rowCount] Total rows across all pages; only with `manualPagination`
 * @param {boolean} [props.stickyFirstColumn] Pins the first column while the table scrolls sideways. Cells never wrap; `meta.minWidth` (px) sets a column's minimum width
 * @param {string[]} [props.lockedColumnIds] Columns that cannot be dragged and cannot be dropped onto (so nothing lands before a locked first column)
 * @param {(fromId: string, toId: string) => void} [props.onColumnReorder] Makes headers draggable; called with the dragged column id and the one it was dropped on
 * @param {(row: object) => object[]|undefined} [props.getSubRows] Opts into row expansion: returns a row's child rows. Child rows render under an expanded parent with a muted background and an indented first cell; a column's `cell` toggles with `row.getToggleExpandedHandler()`. Paging counts parent rows only
 * @param {(row: object) => void} [props.onRowClick]
 * @param {(row: object, index: number, parent?: import("@tanstack/react-table").Row) => string} [props.getRowId]
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
  bare: bareProp = false,
  dense = false,
  pageSize = 25,
  pageSizeOptions,
  manualPagination = false,
  rowCount,
  onColumnReorder,
  stickyFirstColumn = false,
  lockedColumnIds = [],
  getSubRows,
  onRowClick,
  getRowId,
  state: controlled,
  onStateChange,
  className,
  ...props
}) {
  const insideFrame = useInsideFrame()
  const bare = bareProp || insideFrame
  const [local, setLocal] = React.useState({
    sorting: [],
    columnFilters: [],
    columnVisibility: {},
    columnOrder: [],
    pagination: { pageIndex: 0, pageSize },
    expanded: {},
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
    getSubRows,
    onExpandedChange: update("expanded"),
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
    ...(getSubRows ? { getExpandedRowModel: getExpandedRowModel(), paginateExpandedRows: false } : {}),
    manualPagination,
    rowCount: manualPagination ? rowCount : undefined,
    autoResetPageIndex: false,
  })

  const rows = table.getRowModel().rows
  const visibleColumns = table.getVisibleLeafColumns()
  const showToolbar = toolbar != null || columns.some((c) => c.meta?.variant)
  const totalRows = table.getPrePaginationRowModel().rows.length
  const isEmpty = !loading && totalRows === 0
  const showFooter = !loading && !isEmpty
  const pageIndex = state.pagination.pageIndex
  const pageCount = table.getPageCount()
  const [dragOver, setDragOver] = React.useState(null)
  const rowHeight = dense ? "h-13" : "h-15"
  const bodyLines = bare ? BARE_BODY : SURFACE_BODY

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

  const emptyContent =
    data.length === 0
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
        ))

  const head = (
    <thead>
      {table.getHeaderGroups().map((group) => (
        <tr key={group.id}>
          {group.headers.map((header, colIndex) => {
            const { column } = header
            const sorted = column.getIsSorted()
            const locked = lockedColumnIds.includes(column.id)
            const pinned = stickyFirstColumn && colIndex === 0
            return (
              <th
                key={header.id}
                scope="col"
                aria-sort={
                  column.getCanSort() ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined
                }
                style={minWidthStyle(column)}
                className={cn(
                  HEAD_CELL,
                  column.columnDef.meta?.align === "right" && "text-right",
                  onColumnReorder && !locked && "cursor-grab",
                  // A pinned head is opaque in whatever the heads sit on: the frame, or the surface when bare.
                  pinned && cn(STICKY, bare ? "bg-background" : "bg-frame"),
                  dragOver === column.id && "bg-muted"
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
  )

  const body = loading ? (
    <DataTableSkeletonRows columnCount={visibleColumns.length} rowHeight={rowHeight} className={bodyLines} />
  ) : (
    <tbody className={bodyLines}>
      {rows.map((row) => (
        <tr
          key={row.id}
          data-slot="data-table-row"
          data-depth={row.depth}
          {...rowProps(row)}
          className={cn(
            "group/row outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-inset",
            row.depth > 0 && "bg-row-child",
            rowProps(row).className
          )}
        >
          {row.getVisibleCells().map((cell, colIndex) => (
            <td
              key={cell.id}
              style={minWidthStyle(cell.column)}
              className={cn(
                BODY_CELL,
                rowHeight,
                stickyFirstColumn && colIndex === 0 && STICKY,
                // Child rows sit a step down: tinted (opaque, so a pinned cell still hides what
                // scrolls under it), the first cell indented past the parent's.
                row.depth > 0 && "bg-row-child",
                row.depth > 0 && colIndex === 0 && "first:pl-10"
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )

  return (
    <section
      data-ds="data-table"
      data-slot="data-table-frame"
      data-bare={bare || undefined}
      className={cn(
        "@container/table flex w-full min-w-0 flex-col text-foreground",
        !bare && "rounded-frame bg-frame shadow-frame",
        className
      )}
      {...props}
    >
      {showToolbar && (
        <DataTableToolbar table={table}>{typeof toolbar === "function" ? toolbar(table) : toolbar}</DataTableToolbar>
      )}
      <div
        className={cn("relative @max-xl/table:hidden", !bare && "-mx-px", !bare && !showFooter && !isEmpty && "-mb-px")}
      >
        <div data-slot="data-table-scroll" className="relative overflow-x-auto">
          <table className="w-full border-separate border-spacing-0">
            {head}
            {!isEmpty && body}
          </table>
        </div>
        {!bare && !isEmpty && <SurfaceEdges />}
      </div>
      {isEmpty ? (
        <div
          data-slot="data-table-empty"
          className={cn(
            "bg-background px-4 py-10",
            bare ? "border-t border-divider @max-xl/table:border-t-0" : "-mx-px -mb-px rounded-frame shadow-surface"
          )}
        >
          {emptyContent}
        </div>
      ) : (
        <ul
          data-slot="data-table-list"
          aria-busy={loading || undefined}
          className={cn(
            "hidden flex-col divide-y divide-divider overflow-clip @max-xl/table:flex",
            !bare && "rounded-frame bg-background shadow-surface"
          )}
        >
          {loading ? (
            <DataTableSkeletonItems />
          ) : (
            rows.map((row) => {
              const [lead, ...rest] = row.getVisibleCells()
              return (
                <li
                  key={row.id}
                  data-slot="data-table-card"
                  data-depth={row.depth}
                  {...rowProps(row)}
                  className={cn(MOBILE_ITEM, row.depth > 0 && "bg-row-child pl-8", rowProps(row).className)}
                >
                  {lead && (
                    <div className="mb-1.5 text-base font-medium">{flexRender(lead.column.columnDef.cell, lead.getContext())}</div>
                  )}
                  <dl className="flex flex-col gap-1">
                    {rest
                      .filter((cell) => !cell.column.columnDef.meta?.cardHidden)
                      // A child row leaves out the columns it has no value for.
                      .filter((cell) => row.depth === 0 || cell.getValue() != null)
                      .map((cell) => (
                        <div key={cell.id} className="flex items-center justify-between gap-3 text-sm">
                          <dt className="text-xs text-muted-foreground">{headerLabel(cell.column)}</dt>
                          <dd className="min-w-0">{flexRender(cell.column.columnDef.cell, cell.getContext())}</dd>
                        </div>
                      ))}
                  </dl>
                </li>
              )
            })
          )}
        </ul>
      )}
      {showFooter && <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />}
    </section>
  )
}

export { DataTable }
