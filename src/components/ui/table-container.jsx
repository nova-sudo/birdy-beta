'use client';

import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { ChevronRight, Inbox } from "lucide-react"
import { EmptyState } from "@/components/by/card"
import {
  TABLE_BODY_TEXT,
  TABLE_CARD,
  TABLE_HEAD_CELL,
  TABLE_HEAD_ROW,
  TABLE_HEAD_TEXT,
  TABLE_HOVER_BG,
  TABLE_NAME_TEXT,
  TABLE_NUM,
  TABLE_PAD_X,
  TABLE_ROW_H,
  TABLE_ROW_H_TALL,
  TABLE_ROW_RULE_SHADOW,
  TABLE_SELECTED_BG,
  TABLE_SUB_TEXT,
} from "@/lib/table-style"
import { SYNCING_MESSAGE } from "@/lib/client-loading"

import {
  loadCustomMetrics,
  formatMetricValue,
} from "@/lib/metrics";
import { defaultMetricFormat } from "@/lib/default-metrics";
import { formatMetric } from "@/lib/format-metric";
import { flattenClientGroup } from "@/lib/client-rows";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import getSymbolFromCurrency from "currency-symbol-map";

/**
 * Reusable container for dashboard tables with glassmorphism styling
 */
export const TableContainer = ({ children, title, description }) => (
  <Card className="border border-pd-border shadow-sm hover:shadow-md transition-shadow bg-pd-surface rounded-2xl">
    <CardHeader className="pb-3 border-b border-pd-divider">
      <div>
        <CardTitle className="font-pd-display text-base font-semibold text-pd-ink">{title}</CardTitle>
        {description && <CardDescription className="text-xs text-pd-subtle mt-1">{description}</CardDescription>}
      </div>
    </CardHeader>
    <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
  </Card>
)

// Read on use, not at import. At module scope this ran the moment the file was
// loaded, which on the server is before there is a localStorage at all — the
// whole page failed to prerender with "localStorage is not defined". It was
// also stale on the client: the symbol was fixed at import, so changing your
// currency in settings left every table showing the old one until a reload.
const getUserCurrency = () =>
  typeof window === "undefined" ? null : localStorage.getItem("user_default_currency");

// ── Compute the total left offset for the sticky name column ────────────────
const getNameStickyLeft = (enableSelection, showToggleCol) =>
  (enableSelection ? 40 : 0) + (showToggleCol ? 70 : 0);

const StyledTable = ({
  columns = [],
  data = [],
  isLoading = false,
  clickableFirstColumn = false,
  onFirstColumnClick,
  onRowClick,
  columnVisibility = {},
  searchQuery = "",
  customMetrics,
  setCustomMetrics,
  enableEnhancedExtraction = false,
  isRowLoading,
  enableSelection = false,
  selectedRows = new Set(),
  onSelectionChange,
  enableStatusToggle = false,
  onStatusToggle,
  togglingRows = new Set(),
  initialColumnOrder = [],
  onColumnOrderChange,
  emptyMessage,
  initialPageSize = 15,
  // Off for tables whose rows belong together (a parent and its expanded children).
  paginate = true,
  // In a height-bounded flex column (the agent sections' Dashboard tab): the
  // card shrinks to the space it is given, its rows scroll inside it under a
  // header that stays put, and the pagination stays below it.
  fill = false,
  // Rows this says yes to come first, whatever the sort; the sort still orders each half.
  // The Marketing table uses it to keep what is switched on above what is off.
  pinFirst = null,
}) => {
  /* ---------- STATE ---------- */
  const [sortConfig, setSortConfig] = useState({ key: "spend", direction: "desc" });
  // The table opens sorted by spend, and used to advertise that with a ↓ on the
  // header. But an arrow the reader never asked for reads as a control they left
  // switched on. It stays hidden until someone actually sorts — the default
  // ordering is unchanged, only the claim about it is withheld.
  const [hasSorted, setHasSorted] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState(null);
  // The header currently hovered mid-drag — wears the dashed drop-target
  // border so the drag shows exactly where the column will land.
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [columnOrder, setColumnOrder] = useState(initialColumnOrder || []);

  useEffect(() => {
    if (Array.isArray(initialColumnOrder) && initialColumnOrder.length > 0) {
      setColumnOrder(initialColumnOrder);
    }
  }, [initialColumnOrder]);
  const isClientMode = Array.isArray(customMetrics) && setCustomMetrics !== undefined;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Toggle column is only visible when NOT in client mode
  const showToggleCol = !isClientMode && enableStatusToggle;

  const nameStickyLeft = getNameStickyLeft(enableSelection, showToggleCol);

  /* ---------- LOAD CUSTOM METRICS ---------- */
  useEffect(() => {
    if (setCustomMetrics) {
      const metrics = loadCustomMetrics();
      setCustomMetrics(metrics);
    }
  }, [setCustomMetrics]);

  /* ---------- VISIBLE + ORDERED COLUMNS ---------- */
  const visibleColumns = useMemo(() => {
    let list = columns.map((col) => ({
      ...col,
      id: col.id || col.key,
      header: col.header || col.label,
      cell: col.cell || col.render,
      visible: ["name", "full_name"].includes(col.id || col.key) ? true : columnVisibility[col.id || col.key] ?? col.visible ?? true,
    }));

    list = list.filter((c) => c.visible);

    if (columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((id, idx) => [id, idx]));
      list.sort(
        (a, b) =>
          (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return list;
  }, [columns, columnVisibility, columnOrder]);

  useEffect(() => {
    if (!sortConfig.key && visibleColumns.length > 0) {
      setSortConfig({ key: visibleColumns[0].id, direction: "asc" });
    }
  }, [visibleColumns, sortConfig.key]);

  /* ---------- FLATTENED DATA ---------- */
  const flattenedData = useMemo(() => {
    if (!isClientMode) {
      return data;
    }

    return data.map((group) =>
      flattenClientGroup(group, { columns, customMetrics, enhanced: enableEnhancedExtraction })
    );
  }, [data, customMetrics, isClientMode, enableEnhancedExtraction, columns]);

  /* ---------- FILTER & SORT ---------- */
  const filteredData = useMemo(() => {
    if (!searchQuery) return flattenedData;
    const q = searchQuery.toLowerCase();
    const searchKey = visibleColumns[0]?.id;
    if (!searchKey) return flattenedData;
    return flattenedData.filter((row) => {
      const value = row[searchKey];
      return value != null && value.toString().toLowerCase().includes(q);
    });
  }, [flattenedData, searchQuery, visibleColumns]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key && !pinFirst) return filteredData;
    const copy = [...filteredData];
    if (sortConfig.key)
    copy.sort((a, b) => {
      let av = a[sortConfig.key];
      let bv = b[sortConfig.key];
      if (av == null) av = typeof bv === 'string' ? '' : 0;
      if (bv == null) bv = typeof av === 'string' ? '' : 0;
      let cmp;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else {
        cmp = Number(av) - Number(bv);
      }
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    if (!pinFirst) return copy;
    return [...copy.filter((row) => pinFirst(row)), ...copy.filter((row) => !pinFirst(row))];
  }, [filteredData, sortConfig, pinFirst]);

  /* ---------- PAGINATION ---------- */
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    if (!paginate) return sortedData;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize, paginate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedData.length, pageSize]);

  /* ---------- NUMERIC COLUMNS ---------- */
  // Figures sit flush right so the eye can compare magnitudes down a column;
  // words stay flush left. A column declares `align`, or is read off the page
  // in view: any numeric value makes it a numeric column. The name column is
  // never numeric, whatever it holds.
  const numericColumns = useMemo(() => {
    const set = new Set();
    visibleColumns.forEach((col, colIdx) => {
      if (colIdx === 0 || col.align === "left") return;
      if (col.align === "right" || sortedData.some((row) => typeof row[col.id] === "number")) {
        set.add(col.id);
      }
    });
    return set;
  }, [visibleColumns, sortedData]);

  const getPageNumbers = () => {
    const pages = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    pages.push(1);

    if (showEllipsisStart) {
      pages.push('ellipsis-start');
    } else {
      for (let i = 2; i < currentPage; i++) {
        pages.push(i);
      }
    }

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (showEllipsisEnd) {
      pages.push('ellipsis-end');
    } else {
      for (let i = currentPage + 1; i < totalPages; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
    }

    if (totalPages > 1 && !pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  /* ---------- SORT HANDLER ---------- */
  const handleSort = (columnId) => {
    // Only a real click reveals the indicator. The fallback below that picks a
    // sort key when none is set is housekeeping, not a choice the reader made,
    // so it deliberately does not flip this.
    setHasSorted(true);
    setSortConfig((prev) => ({
      key: columnId,
      direction:
        prev.key === columnId && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  /* ---------- DRAG-AND-DROP ---------- */
  const handleDragStart = (e, columnId, colIdx) => {
    if (colIdx === 0) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, columnId, colIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // dragover refires continuously while hovering — only write on change.
    const next = colIdx === 0 ? null : columnId;
    if (dragOverColumn !== next) setDragOverColumn(next);
  };

  const handleDrop = (e, targetId, targetColIdx) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedColumn || draggedColumn === targetId || targetColIdx === 0) {
      setDraggedColumn(null);
      return;
    }

    const newOrder = visibleColumns
      .map((c) => c.id)
      .filter((id) => id !== draggedColumn);
    const targetIdx = newOrder.indexOf(targetId);
    newOrder.splice(targetIdx, 0, draggedColumn);

    setColumnOrder(newOrder);
    setDraggedColumn(null);

    onColumnOrderChange?.(newOrder);
  };

  /* ---------- FORMATTERS ---------- */
  const formatCurrency = (v) => {
    const num = typeof v === "number" ? v : parseFloat(v) || 0;
    if (!isFinite(num)) return "-";
    return `${getSymbolFromCurrency(getUserCurrency())}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (v) => {
    const num = typeof v === "number" ? v : parseFloat(v) || 0;
    if (!isFinite(num)) return "-";
    return `${num.toFixed(2)}%`;
  };

  const formatNumber = (v) => {
    const num = typeof v === "number" ? v : parseFloat(v) || 0;
    if (!isFinite(num)) return "-";
    return num.toLocaleString();
  };

  const formatDate = (v) => {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  const getCellValue = (row, columnId) => {
    const value = row[columnId];

    if (value === undefined || value === null) {
      return "—";
    }
    if (typeof value === "number" && (!isFinite(value) || isNaN(value))) return "-";

    if (typeof value === "object") {
      console.warn(`Object detected in cell for column ${columnId}:`, value);
      return "—";
    }

    if (columnId === "name" || columnId === "full_name" || columnId === "contactName") {
      const str = String(value);
      return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    // Birdy's own metrics format from their definition, ahead of the substring
    // rules below — "roas" matches none of them and would print a bare 15.
    const defaultFormat = defaultMetricFormat(columnId);
    if (defaultFormat) {
      return formatMetric(value, defaultFormat, getSymbolFromCurrency(getUserCurrency()));
    }

    const customMatch = customMetrics?.find((m) => m.id === columnId);
    if (customMatch) {
      const fmt = customMatch.formatType || customMatch.format_type || "integer";
      if (fmt === "currency") return formatCurrency(value);
      if (fmt === "percentage") return `${(Number(value) * 100).toFixed(2)}%`;
      if (fmt === "decimal") return Number(value).toFixed(2);
      return Number(value).toLocaleString();
    }

    if (columnId.includes("spend") || columnId.includes("cpc") || columnId.includes("cpm") || columnId.includes("cost_per") || columnId.includes("revenue")) {
      return formatCurrency(value);
    }
    if (columnId.includes("ctr") || columnId.includes("rate")) {
      return formatPercentage(value);
    }
    if (columnId.includes("_at") || columnId.includes("refresh")) {
      return formatDate(value);
    }
    if (columnId.includes("freshness")) {
      return value || "—";
    }
    if (typeof value === "number") {
      return formatNumber(value);
    }

    return String(value);
  };

  /* ---------- RENDER ---------- */
  // No data: don't let header column min-widths force the table wider than
  // its container — that's what was causing a horizontal scrollbar to
  // appear under an empty state instead of a centered message.
  const isEmptyState = !isLoading && paginatedData.length === 0;
  // One height for every row: the taller one when the name column carries a
  // second line under it (a campaign with its client), else the single-line one.
  const rowHeight = visibleColumns[0]?.sub ? TABLE_ROW_H_TALL : TABLE_ROW_H;

  return (
    <div className={fill ? "flex min-h-0 flex-col gap-4" : "space-y-4"}>
      {/* The pinned cells (checkbox, status switch, name) are `position:
          sticky`: they scroll over their neighbours, so each paints an opaque
          background of its own. Hover therefore goes on every cell of the row
          at once, from one rule, with no fade — the pinned cells used to snap
          while the rest of the row faded in, so the two halves moved apart.
          Colours and sizes come from lib/table-style, shared with the kit
          table so the two cannot drift. */}
      <style jsx>{`
        .fixed-column,
        .fixed-header {
          text-align: left;
          min-width: 200px;
          max-width: 245px;
          width: 245px;
        }

        .fixed-column,
        .pinned-cell {
          background: var(--by-surface);
        }
        /* The row rule. The table collapses its borders, and a collapsed
           border stays on the grid while a sticky cell slides over it, so
           every cell draws the rule inside itself: pinned or not, they line up. */
        tbody td {
          box-shadow: ${TABLE_ROW_RULE_SHADOW};
        }
        /* A syncing row sits in the hover colour whether or not it is hovered:
           it is the row the reader is waiting on, and the tint lifts it off the
           table without introducing a colour the table doesn't already use. */
        .row-syncing > td {
          background: ${TABLE_HOVER_BG};
        }
        .fixed-header {
          background: var(--by-canvas);
        }

        tr.row-hoverable:hover > td {
          background: ${TABLE_HOVER_BG};
        }
        /* A ticked row keeps its tint under the pointer too. */
        tr[data-state="selected"] > td {
          background: ${TABLE_SELECTED_BG} !important;
        }

        @media (min-width: 768px) {
          .fixed-column {
            position: sticky;
            left: var(--name-sticky-left, 0px);
            z-index: 30;
          }
          .fixed-header {
            position: sticky;
            left: var(--name-sticky-left, 0px);
            z-index: 40;
          }
        }

        .table-container {
          position: relative;
          overflow: auto;
        }

        .table-container table {
          min-width: 100%;
          width: max-content;
        }
      `}</style>

      {/* Table */}
      <div
        className={`table-container ${TABLE_CARD}${fill ? " min-h-0" : ""}`}
        style={{
          "--name-sticky-left": `${nameStickyLeft}px`,
          overflowX: isEmptyState ? "hidden" : "auto",
        }}
      >
        <table className={`w-full font-by-body ${TABLE_BODY_TEXT}`} style={isEmptyState ? { width: "100%" } : undefined}>
          {/* Uppercase, letter-spaced and a shade off white — the header reads
              as a label strip rather than a first row of data. */}
          <thead className={`${fill ? "sticky " : ""}top-0 z-40`}>
            <tr className={TABLE_HEAD_ROW}>

              {/* Checkbox header — sticky at left: 0 */}
              {enableSelection && (
                <th
                  className={`${TABLE_HEAD_CELL} w-[40px] min-w-[40px] px-2 pr-0`}
                  style={{ position: 'sticky', left: 0, zIndex: 51 }}
                >
                  <div className="flex items-center">
                    <Checkbox
                      checked={
                        paginatedData.length > 0 &&
                        paginatedData.every((row) => selectedRows.has(row.id))
                      }
                      onCheckedChange={(checked) => {
                        if (!onSelectionChange) return;
                        const next = new Set(selectedRows);
                        if (checked) {
                          paginatedData.forEach((row) => next.add(row.id));
                        } else {
                          paginatedData.forEach((row) => next.delete(row.id));
                        }
                        onSelectionChange(next);
                      }}
                      aria-label="Select all rows"
                    />
                  </div>
                </th>
              )}

              {/* ── Status toggle column — ONLY when NOT isClientMode ── */}
              {showToggleCol && (
                <th
                  className={`${TABLE_HEAD_CELL} w-[70px] min-w-[70px] px-1`}
                  style={{ position: 'sticky', left: enableSelection ? 40 : 0, zIndex: 51 }}
                >
                  <div className="flex items-center justify-center">Status</div>
                </th>
              )}

              {visibleColumns.map((col, colIdx) => (
                <Fragment key={col.id}>
                  <th
                    draggable={colIdx !== 0}
                    onDragStart={(e) => handleDragStart(e, col.id, colIdx)}
                    onDragOver={(e) => handleDragOver(e, col.id, colIdx)}
                    onDragLeave={() => { if (dragOverColumn === col.id) setDragOverColumn(null); }}
                    onDrop={(e) => handleDrop(e, col.id, colIdx)}
                    onDragEnd={() => { setDraggedColumn(null); setDragOverColumn(null); }}
                    className={`${TABLE_HEAD_CELL} select-none ${colIdx === 0 ? "cursor-default" : "cursor-grab"} ${
                      colIdx === 0
                        ? "fixed-header"
                        : isEmptyState
                          ? ""
                          : `${col.minWidthClass ?? "min-w-[135px]"} whitespace-nowrap`
                    } ${draggedColumn === col.id ? "!bg-pd-primary-tint" : ""}`}
                    // Straight-edged dashed line on the live drop target, per
                    // the handoff. At rest the 2px it takes is padding instead,
                    // so hovering doesn't nudge the header sideways, and no
                    // border breaks the rule under the header row.
                    style={
                      colIdx === 0
                        ? undefined
                        : draggedColumn && dragOverColumn === col.id && draggedColumn !== col.id
                          ? { borderLeft: "2px dashed var(--pd-primary)" }
                          : { paddingLeft: 2 }
                    }
                  >
                    {/* No vertical rule between columns: the design separates
                        them by alignment and spacing, and a grid of hairlines
                        competes with the figures.

                        The source icon sits at the far end, away from the
                        label, so it marks where the column came from without
                        crowding the word it belongs to. */}
                    <div
                      className={`flex h-full w-full items-center gap-2 ${TABLE_PAD_X} ${
                        numericColumns.has(col.id) ? "flex-row-reverse" : ""
                      }`}
                    >
                      <button
                        onClick={() => col.sortable && handleSort(col.id)}
                        className={`flex min-w-0 items-center gap-1 truncate text-left align-middle ${TABLE_HEAD_TEXT} ${
                          col.sortable ? "cursor-pointer hover:text-by-text" : "cursor-default"
                        }`}
                      >
                        <span className="truncate">
                          {typeof col.header === "function" ? col.header() : col.header}
                        </span>
                        {col.sortable && hasSorted && sortConfig.key === col.id && (
                          // The active sort column takes the ink colour, so
                          // the arrow is legible against the muted header.
                          <span className="shrink-0 text-by-text">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>

                      <div className="ml-auto shrink-0">
                        {col.icons ? (
                          typeof col.icons === "function" ? (
                            (() => {
                              const Icon = col.icons;
                              return <Icon className="size-4 text-by-muted" aria-hidden="true" />;
                            })()
                          ) : (
                            <img
                              src={col.icons.src ? col.icons.src : col.icons}
                              alt=""
                              aria-hidden="true"
                              className="size-4 object-scale-down"
                            />
                          )
                        ) : null}
                      </div>
                    </div>
                  </th>

                </Fragment>
              ))}
            </tr>
          </thead>

          <tbody className="text-left">
            {/* CASE 1: Loading → skeleton rows */}
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  {enableSelection && (
                    <td
                      className={`pinned-cell ${rowHeight} w-[40px] min-w-[40px] px-2 pr-0`}
                      style={{ position: 'sticky', left: 0, zIndex: 30 }}
                    >
                      <Skeleton className="size-4 rounded-md" />
                    </td>
                  )}

                  {showToggleCol && (
                    <td
                      className={`pinned-cell ${rowHeight} w-[70px] min-w-[70px] px-1`}
                      style={{ position: 'sticky', left: enableSelection ? 40 : 0, zIndex: 30 }}
                    >
                      <div className="flex items-center justify-center">
                        <Skeleton className="h-[19px] w-[34px] rounded-full" />
                      </div>
                    </td>
                  )}

                  {(visibleColumns.length > 0
                    ? visibleColumns
                    : Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-col-${i}` }))
                  ).map((col, colIdx) => (
                    <Fragment key={`skeleton-${idx}-${col.id}`}>
                      <td className={`truncate ${rowHeight} ${colIdx === 0 ? "fixed-column" : ""}`}>
                        <div className={`flex min-w-0 items-center ${TABLE_PAD_X}`}>
                          <Skeleton className={`h-4 rounded-full ${colIdx === 0 ? "w-36" : "w-20"}`} />
                        </div>
                      </td>

                    </Fragment>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              /* CASE 2: Done loading, no data */
              <tr>
                <td
                  colSpan={visibleColumns.length + (enableSelection ? 1 : 0) + (showToggleCol ? 1 : 0)}
                  className="h-48 text-center align-middle"
                >
                  <EmptyState icon={<Inbox />} title={emptyMessage?.title ?? "No data available"} className="py-10">
                    {emptyMessage?.subtitle ?? "Try adjusting your filters or date range"}
                  </EmptyState>
                </td>
              </tr>
            ) : (
              /* CASE 3: Has data */
              paginatedData.map((row, idx) => {
                const isSelected = enableSelection && selectedRows.has(row.id);
                // No zebra: rows sit on white with a soft rule under each. A
                // syncing row takes the hover colour permanently (see the
                // style block), so a run of freshly imported clients reads as
                // one block of work in progress.
                const isToggling = showToggleCol && togglingRows.has(row.id);
                const isActive = String(row.status).toLowerCase() === "active";

                return (
                  <tr
                    key={`${row.id ?? 'row'}-${idx}`}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => !(row._isCreating || row._isPending) && onRowClick?.(row.original || row)}
                    // A clickable row has to open from the keyboard too, or
                    // keyboard users can't reach what it links to. Enter and
                    // Space on the row itself only — a key pressed inside a
                    // link, button or input belongs to that control.
                    tabIndex={onRowClick && !(row._isCreating || row._isPending) ? 0 : undefined}
                    onKeyDown={onRowClick && !(row._isCreating || row._isPending) ? (e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      onRowClick(row.original || row);
                    } : undefined}
                    className={`${row._isSyncing ? "row-syncing " : ""}${
                      (row._isCreating || row._isPending)
                        // Not clickable yet — the document isn't there to open.
                        // The row keeps its full opacity now that its cells
                        // shimmer: dimming on top of that read as "disabled",
                        // which is the wrong idea. It is working, not inert.
                        ? "w-fit cursor-wait"
                        : "row-hoverable group w-fit cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pd-primary"
                    }`}
                  >
                    {/* Checkbox cell */}
                    {enableSelection && (
                      <td
                        className={`pinned-cell ${rowHeight} w-[40px] min-w-[40px] px-2 pr-0`}
                        style={{ position: 'sticky', left: 0, zIndex: 30 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (!onSelectionChange) return;
                            const next = new Set(selectedRows);
                            if (checked) next.add(row.id);
                            else next.delete(row.id);
                            onSelectionChange(next);
                          }}
                          aria-label={`Select ${row.name || row.id}`}
                        />
                      </td>
                    )}

                    {/* ── Toggle switch cell — ONLY when NOT isClientMode ── */}
                    {showToggleCol && (
                      <td
                        className={`pinned-cell ${rowHeight} w-[70px] min-w-[70px] px-1`}
                        style={{ position: 'sticky', left: enableSelection ? 40 : 0, zIndex: 30 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {togglingRows.has(row.id) ? (
                          <div className="flex items-center justify-center">
                            <Spinner className="size-4 text-pd-primary" />
                          </div>
                        ) : (
                          // 34 × 19 pill around a 15px knob, per the handoff.
                          // Laid out with justify-content rather than a
                          // translate so the knob lands on the padding edge at
                          // either end without a hand-tuned offset.
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            aria-label={`${isActive ? "Pause" : "Activate"} ${row.name || row.id}`}
                            onClick={() => onStatusToggle?.(row.id, row.status)}
                            className={`flex h-[19px] w-[34px] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary ${
                              isActive ? "justify-end bg-pd-primary" : "justify-start bg-pd-chevron"
                            }`}
                          >
                            <span className="pointer-events-none block size-[15px] rounded-full bg-white shadow-sm" />
                          </button>
                        )}
                      </td>
                    )}

                    {visibleColumns.map((col, colIdx) => {
                      // ── A syncing row keeps its name, badges the second
                      // column and gives the rest over to one sentence. ───────
                      //
                      // Per-cell shimmer sat here before, and a table of it
                      // read as a page that had failed to paint: fourteen
                      // columns of grey bars say "loading" without saying what
                      // is loading, or that it is normal, or that it will take
                      // minutes. The sentence says all three in the space the
                      // placeholders were wasting.
                      //
                      // The badge takes the second column on purpose rather
                      // than by name: that is where the design puts health, and
                      // a health verdict on a client we have no data on yet is
                      // not a claim we can make. The sentence starts in the
                      // column after it, so both stay on the grid the headers
                      // set rather than floating between them.
                      if (row._isSyncing && colIdx > 2) return null;
                      if (row._isSyncing && (colIdx === 1 || colIdx === 2)) {
                        const isBadgeCell = colIdx === 1;
                        return (
                          <td
                            key={`${row.id || idx}-syncing-${colIdx}`}
                            colSpan={isBadgeCell ? 1 : visibleColumns.length - 2}
                            className={`${rowHeight} text-by-muted`}
                          >
                            <div className={`flex min-w-0 items-center ${TABLE_PAD_X}`}>
                              {isBadgeCell ? (
                                <span className="inline-flex shrink-0 items-center rounded-full bg-pd-primary px-[9px] py-[3px] text-[11px] font-bold text-white">
                                  Syncing
                                </span>
                              ) : (
                                <span className="min-w-0 truncate">{SYNCING_MESSAGE}</span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      return (
                      <Fragment key={`${row.id || idx}-${col.id}`}>
                        <td
                          className={`truncate ${rowHeight} ${
                            colIdx === 0
                              ? // The name carries the row: heavier, in ink,
                                // against figures that sit back in body grey.
                                `fixed-column ${TABLE_NAME_TEXT}`
                              : numericColumns.has(col.id) ? TABLE_NUM : ""
                          }`}
                        >
                          <div
                            className={
                              colIdx === 0
                                ? `flex min-w-0 items-center gap-2 ${TABLE_PAD_X}`
                                : `min-w-0 ${TABLE_PAD_X}`
                            }
                          >
                            {/* ── Client status — a dot rather than a badge, so
                                the state reads at a glance without spending a
                                column on it. Green is active, grey paused. ── */}
                            {colIdx === 0 && isClientMode && row.status && !isRowLoading?.(row) && (
                              <span
                                title={row.status}
                                aria-label={row.status}
                                className={`size-2 shrink-0 rounded-full ${
                                  isActive ? "bg-pd-success" : "bg-pd-faint"
                                }`}
                              />
                            )}
                            {/* A client whose first sync has not landed takes a
                                turning spinner in place of the status dot. A
                                pulsing dot sat here first and read as frozen —
                                it holds still for half of every cycle, and a
                                screenful of them breathing in unison looked
                                like a stalled page rather than work in
                                progress. A wheel only ever turns. */}
                            {/* A control before the name (an expand toggle), kept out of its tooltip. */}
                            {colIdx === 0 && col.lead?.(row)}
                            {colIdx === 0 && isClientMode && row._isSyncing && (
                              <Spinner
                                // Heavier than the icon's default hairline: at
                                // 14px a 2px stroke is the difference between a
                                // wheel you can see turning and a smudge.
                                strokeWidth={3}
                                className="size-3.5 shrink-0 text-pd-primary"
                                aria-label="Syncing, first data still loading"
                              />
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className={`min-w-0 flex items-center gap-2 w-full overflow-hidden ${
                                      row._isCreating || row._isPending ? "text-pd-subtle" : ""
                                    } ${numericColumns.has(col.id) ? "justify-end" : ""}`}
                                  >
                                    {colIdx === 0 && clickableFirstColumn && !onRowClick ? (
                                      <button
                                        onClick={() => onFirstColumnClick?.(row)}
                                        className="text-left font-semibold text-pd-primary hover:underline cursor-pointer truncate min-w-0"
                                      >
                                        {col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)}
                                      </button>
                                    ) : (
                                      <span className="min-w-0 block">
                                        <span className="block truncate">
                                          {col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)}
                                        </span>
                                        {/* A second line under the name — a
                                            column's `sub(row)` — for the one
                                            or two facts that explain the row
                                            without earning a column each. */}
                                        {colIdx === 0 && col.sub && (() => {
                                          const sub = col.sub(row);
                                          return sub ? (
                                            <span className={`mt-0.5 block truncate ${TABLE_SUB_TEXT}`}>
                                              {sub}
                                            </span>
                                          ) : null;
                                        })()}
                                      </span>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                {colIdx === 0 && (
                                  <TooltipContent>
                                    <p>{col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            {/* A row that opens something says so on hover. */}
                            {colIdx === 0 && onRowClick && !row._isSyncing && (
                              <ChevronRight
                                // Appears with the row's hover, at the same instant.
                                className="ml-auto size-4 shrink-0 text-by-muted opacity-0 group-hover:opacity-100"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                        </td>

                      </Fragment>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {paginate && !isLoading && sortedData.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage(prev => prev - 1);
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {getPageNumbers().map((page, idx) => (
                <PaginationItem key={`${page}-${idx}`}>
                  {typeof page === 'string' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(page);
                      }}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

export default StyledTable