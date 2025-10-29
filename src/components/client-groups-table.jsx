// src/components/client-groups-table.jsx
import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadCustomMetrics,
  evaluateFormula,
  formatMetricValue,
} from "@/lib/metrics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FaFire } from "react-icons/fa";
import ghl from "../../public/ghl_icon.png";
import metaa from "../../public/meta-icon-DH8jUhnM.png";

const DEFAULT_COLUMNS = [
  { id: "name", label: "Business Name", visible: true, sortable: true },
  { id: "ghl_contacts", label: "GHL Leads", visible: true, sortable: true, icons: ghl },
  { id: "meta_campaigns", label: "Campaigns", visible: true, sortable: true, icons: metaa },
  { id: "meta_spend", label: "Ad Spend", visible: true, sortable: true, icons: metaa },
  { id: "meta_ctr", label: "CTR", visible: true, sortable: true, icons: metaa },
  { id: "meta_cpc", label: "CPC", visible: true, sortable: true, icons: metaa },
  { id: "meta_leads", label: "Meta Leads", visible: true, sortable: true, icons: metaa },
  { id: "hp_leads", label: "HP Leads", visible: true, sortable: true, icons: FaFire },
  { id: "meta_impressions", label: "Impressions", visible: true, sortable: true, icons: metaa },
  { id: "meta_clicks", label: "Clicks", visible: true, sortable: true, icons: metaa },
  { id: "meta_reach", label: "Reach", visible: true, sortable: true, icons: metaa },
  { id: "meta_cpm", label: "CPM", visible: true, sortable: true, icons: metaa },
];

export function ClientGroupsTable({ data, onRowClick }) {
  /* ---------- STATE ---------- */
  const [customMetrics, setCustomMetrics] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedColumn, setDraggedColumn] = useState(null);

  // Visibility map (default columns keep their original `visible` flag)
  const [columnVisibility, setColumnVisibility] = useState(() => {
    const map = {};
    DEFAULT_COLUMNS.forEach((c) => (map[c.id] = c.visible));
    return map;
  });

  // Drag-and-drop order
  const [columnOrder, setColumnOrder] = useState([]);

  /* ---------- LOAD CUSTOM METRICS ---------- */
  useEffect(() => {
    const metrics = loadCustomMetrics();
    setCustomMetrics(metrics);
  }, []);

  /* ---------- DERIVED COLUMNS (no duplicates) ---------- */
  const columns = useMemo(() => {
    const base = DEFAULT_COLUMNS.map((col) => ({ ...col }));

    const custom = customMetrics
      .filter((m) => m.enabled && m.dashboard === "Clients")
      .map((m) => ({
        id: m.id,
        label: m.name,
        visible: true,
        sortable: true,
      }));

    const seen = new Set();
    const all = [...base, ...custom];
    return all.filter((col) => {
      if (seen.has(col.id)) return false;
      seen.add(col.id);
      return true;
    });
  }, [customMetrics]);

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

  /* ---------- COLUMN VISIBILITY TOGGLE ---------- */
  const toggleColumnVisibility = (columnId) => {
    if (columnId === "name") return;
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !(prev[columnId] ?? true),
    }));
  };

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
        .fixed-column {
          position: sticky;
          left: 0;
          border-right: 1px solid #e4e4e7;
          background: white;
          z-index: 20;
          min-width: 243px;
          font-weight: 600;
        }
        .fixed-header {
          position: sticky;
          left: 0;
          z-index: 30;
          background: white;
          border-right: 1px solid #e4e4e7;
          min-width: 150px;
          width: 150px;
        }
        .table-container {
          position: relative;
          overflow-x: auto;
        }
      `}</style>

      {/* Search + Column Picker */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-white pl-10"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Eye className="h-4 w-4" />
              Columns
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white">
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.id === "name" ? true : columnVisibility[col.id] ?? col.visible}
                onCheckedChange={() => toggleColumnVisibility(col.id)}
                disabled={col.id === "name"}
              >
                {columnVisibility[col.id] ?? col.visible ? (
                  <Eye className="h-4 w-4 mr-2" />
                ) : (
                  <EyeOff className="h-4 w-4 mr-2" />
                )}
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="table-container border">
        <table className="text-sm w-full">
          <thead className="border-b top-0 z-40">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted h-12 bg-muted/50">
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  draggable={column.id !== "name"}
                  onDragStart={(e) => handleDragStart(e, column.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`h-12 font-semibold text-gray-900/78 px-4 select-none cursor-default ${
                    column.id === "name"
                      ? "fixed-header"
                      : "min-w-[135px] w-max whitespace-nowrap border-r-muted/20 border-1"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => column.sortable && handleSort(column.id)}
                        className={`align-middle text-left items-center gap-1 ${
                          column.sortable ? "hover:text-foreground cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {column.label}
                        {column.sortable && sortConfig.key === column.id && (
                          <span className="text-sm text-right">
                            {sortConfig.direction === "asc" ? "up arrow" : "down arrow"}
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
                  onClick={() => onRowClick(row.original)}
                  className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                    idx % 2 === 0 ? "bg-muted/20" : "bg-white"
                  }`}
                >
                  {visibleColumns.map((column) => (
                    <td
                      key={`${row.id}-${column.id}`}
                      className={`px-4 py-3 text-foreground ${
                        column.id === "name" ? "fixed-column" : "w-full"
                      }`}
                    >
                      {getCellValue(row, column.id)}
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