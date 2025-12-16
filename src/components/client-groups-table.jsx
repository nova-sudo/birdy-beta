// src/components/client-groups-table.jsx
import { useState, useMemo, useEffect } from "react";

import {
  loadCustomMetrics,
  evaluateFormula,
  formatMetricValue,
} from "@/lib/metrics";




export function ClientGroupsTable({ data, onRowClick, columns, columnVisibility, searchQuery , customMetrics , setCustomMetrics}) {
  /* ---------- STATE ---------- */
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Drag-and-drop order
  const [columnOrder, setColumnOrder] = useState([]);

  /* ---------- LOAD CUSTOM METRICS ---------- */
  useEffect(() => {
    const metrics = loadCustomMetrics();
    setCustomMetrics(metrics);
  }, []);

  /* ---------- DERIVED COLUMNS (no duplicates) ---------- */


  /* ---------- VISIBLE + ORDERED COLUMNS ---------- */
  const visibleColumns = useMemo(() => {
    let list = columns.map((col) => ({
      ...col,
      visible: col.id === "name" ? true : columnVisibility[col.id] ?? col.visible,
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

  /* ---------- FLATTENED DATA (with aliases) ---------- */
const flattenedData = useMemo(() => {
    return data.map((group) => {
      const base = {
        id: group.id,
        name: group.name || "Unnamed Group",
        ghl_contacts: group.gohighlevel?.metrics?.total_contacts || 0,
        meta_campaigns: group.facebook?.metrics?.total_campaigns || 0,
        meta_adsets: group.facebook?.metrics?.total_adsets || 0,
        meta_ads: group.facebook?.metrics?.total_ads || 0,
        meta_spend: group.facebook?.metrics?.insights?.spend || 0,
        meta_impressions: group.facebook?.metrics?.insights?.impressions || 0,
        meta_clicks: group.facebook?.metrics?.insights?.clicks || 0,
        meta_reach: group.facebook?.metrics?.insights?.reach || 0,
        meta_results: group.facebook?.metrics?.insights?.results || 0,
        meta_cpm: group.facebook?.metrics?.insights?.cpm || 0,
        meta_cpc: group.facebook?.metrics?.insights?.cpc || 0,
        meta_ctr: group.facebook?.metrics?.insights?.ctr || 0,
        meta_cost_per_result: group.facebook?.metrics?.insights?.cost_per_result || 0,
        meta_leads: group.facebook?.metrics?.total_leads || 0,
        hp_leads: group.hotprospector?.metrics?.total_leads || 0,
        original: group,
        _isCreating: group._isCreating || false, // Track creating state

        // ALIASES for formula compatibility
        leads: group.gohighlevel?.metrics?.total_contacts || 0,
        "ad-spend": group.facebook?.metrics?.insights?.spend || 0,
        clicks: group.facebook?.metrics?.insights?.clicks || 0,
        impressions: group.facebook?.metrics?.insights?.impressions || 0,
        conversions: group.facebook?.metrics?.total_leads || 0,
      };

      customMetrics.forEach((metric) => {
        if (metric.formulaParts) {
          base[metric.id] = evaluateFormula(metric.formulaParts, base);
        }
      });

      return base;
    });
  }, [data, customMetrics]);

  /* ---------- FILTER & SORT ---------- */
  const filteredData = useMemo(() => {
    if (!searchQuery) return flattenedData;
    const q = searchQuery.toLowerCase();
    return flattenedData.filter((row) => row.name.toLowerCase().includes(q));
  }, [flattenedData, searchQuery]);

  const sortedData = useMemo(() => {
    const copy = [...filteredData];
    copy.sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      if (typeof av === "string") {
        return sortConfig.direction === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortConfig.direction === "asc" ? av - bv : bv - av;
    });
    return copy;
  }, [filteredData, sortConfig]);


  /* ---------- SORT HANDLER ---------- */
  const handleSort = (columnId) => {
    setSortConfig((prev) => ({
      key: columnId,
      direction:
        prev.key === columnId && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  /* ---------- DRAG-AND-DROP ---------- */
  const handleDragStart = (e, columnId) => {
    if (columnId === "name") return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetId || targetId === "name") {
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
  };

  /* ---------- FORMATTERS ---------- */
  const formatCurrency = (v) =>
    typeof v === "number" ? `$${v.toFixed(2)}` : "$0.00";
  const formatPercentage = (v) =>
    typeof v === "number" ? `${v.toFixed(2)}%` : "0%";
  const formatNumber = (v) =>
    typeof v === "number" ? v.toLocaleString() : "0";

  const getCellValue = (row, columnId) => {
    const value = row[columnId];

    if (customMetrics.some((m) => m.id === columnId)) {
      return formatMetricValue(value, columnId);
    }

    if (columnId.includes("spend") || columnId.includes("cpc") || columnId.includes("cpm")) {
      return formatCurrency(value);
    }
    if (columnId.includes("ctr")) return formatPercentage(value);
    if (typeof value === "number") return formatNumber(value);
    return value;
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="space-y-4">
      <style jsx>{`
        @media (min-width: 768px) {
          .fixed-column-even {
            text-align: left;
            position: sticky;
            left: 0;
            background: white;
            z-index: 50;
            min-width: 243px;
            font-weight: 600;
          }
          .fixed-column-odd {
            text-align: left;
            position: sticky;
            left: 0;
            background: #f4f3f9;
            z-index: 50;
            min-width: 243px;
            font-weight: 600;
          }
          .fixed-header {
            position: sticky;
            left: 0;
            z-index: 50;
            background: white;
            min-width: 150px;
            width: 100%;
          }
        }

        @media (max-width: 767px) {
          .fixed-column-even,
          .fixed-column-odd {
            text-align: left;
            background: white;
            min-width: 200px;
            font-weight: 600;
          }
          .fixed-column-odd {
            background: #f4f3f9;
          }
          .fixed-header {
            background: white;
            min-width: 150px;
            width: 100%;
          }
        }

        .table-container {
          position: relative;
          overflow: auto;
        }
      `}</style>
      {/* Table */}
      <div className="table-container border rounded-md">
        <table className="text-sm ">
          <thead className="top-0 z-40">
            <tr className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted h-12 bg-white">
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  draggable={column.id !== "name"}
                  onDragStart={(e) => handleDragStart(e, column.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`h-12 font-semibold text-gray-900/78 select-none cursor-default ${
                    column.id === "name"
                      ? "fixed-header"
                      : "min-w-[135px]  whitespace-nowrap "
                  }`}
                >
                  <div className="flex items-center border border-2 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7] h-full  justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => column.sortable && handleSort(column.id)}
                        className={`align-middle text-left items-center gap-1 ${
                          column.sortable ? "hover:text-foreground cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {column.label}
                        {column.sortable && sortConfig.key === column.id && (
                          <span className="text-sm px-2 text-right">
                            {sortConfig.direction === "asc" ? "↑" : "↓ "}
                          </span>
                        )}
                      </button>
                    </div>
                    <div>
                      {column.icons ? (
                        typeof column.icons === "function" ? (
                          (() => {
                            const Icon = column.icons;
                            return <Icon className="h-4 w-4 text-muted-foreground" />;
                          })()
                        ) : (
                          <img
                            src={column.icons.src ? column.icons.src : column.icons}
                            alt={`${column.label} icon`}
                            className="text-muted-foreground object-scale-down size-4"
                          />
                        )
                      ) : null}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="text-center">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-8 text-muted-foreground">
                  No client groups found
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => !row._isCreating && onRowClick(row.original)}
                  className={`border-b transition-colors ${
                    row._isCreating 
                      ? "bg-muted/30 cursor-wait opacity-60" 
                      : "hover:bg-muted/50 cursor-pointer"
                  } ${idx % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"}`}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={`${row.id}-${column.id}`}
                      className={`text-foreground ${
                        column.id === "name"
                          ? idx % 2 === 0
                            ? "fixed-column-odd"
                            : "fixed-column-even"
                          : ""
                      }`}
                    >
                      <div
                        className={
                          column.id === "name"
                            ? "py-3 px-4 border border-2 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7] flex items-center gap-2"
                            : ""
                        }
                      >
                        {/* Add spinner for name column when creating */}
                        {column.id === "name" && row._isCreating && (
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        )}
                        <span className={row._isCreating ? "text-muted-foreground" : ""}>
                          {getCellValue(row, column.id)}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-center font-semibold text-black/50 text-muted-foreground">
        Showing {sortedData.length} of {flattenedData.length} client groups
      </div>
    </div>
  );
}