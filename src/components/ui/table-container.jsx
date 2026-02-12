'use client';

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import {
  loadCustomMetrics,
  evaluateFormula,
  formatMetricValue,
} from "@/lib/metrics";

/**
 * Reusable container for dashboard tables with glassmorphism styling
 */
export const TableContainer = ({ children, title, description }) => (
  <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow bg-white/50 backdrop-blur-sm">
    <CardHeader className="pb-3 border-b border-border/30">
      <div>
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {description && <CardDescription className="text-xs text-muted-foreground mt-1">{description}</CardDescription>}
      </div>
    </CardHeader>
    <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
  </Card>
)

const StyledTable = ({
  columns = [],
  data = [],
  clickableFirstColumn = false,
  onFirstColumnClick,
  onRowClick,
  columnVisibility = {},
  searchQuery = "",
  customMetrics,
  setCustomMetrics,
  // NEW: Feature flag to enable enhanced extraction
  enableEnhancedExtraction = false,
}) => {
  /* ---------- STATE ---------- */
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [columnOrder, setColumnOrder] = useState([]);

  const isClientMode = customMetrics !== undefined;

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
      visible: col.id === "name" ? true : columnVisibility[col.id] ?? col.visible ?? true,
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

  /* ---------- HELPER FUNCTIONS FOR ENHANCED EXTRACTION ---------- */
  const getTopTags = (group, count = 5) => {
    const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
    return Object.entries(tagBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count);
  };

  const getActiveCampaignCount = (group) => {
    const campaigns = group?.facebook?.campaigns || [];
    return campaigns.filter(c => c.status === "Active").length;
  };

  const getPausedCampaignCount = (group) => {
    const campaigns = group?.facebook?.campaigns || [];
    return campaigns.filter(c => c.status === "Paused").length;
  };

  const getDataFreshness = (timestamp) => {
    if (!timestamp) return null;
    const hours = Math.floor((Date.now() - new Date(timestamp)) / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getBestPerformingAd = (group) => {
    const ads = group?.facebook?.ads || [];
    if (ads.length === 0) return null;
    return ads.reduce((best, ad) => 
      (ad.ctr > (best?.ctr || 0)) ? ad : best
    , null);
  };

  const getTotalTagCount = (group) => {
    const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
    return Object.keys(tagBreakdown).length;
  };

  // NEW: Get count for a specific tag
  const getSpecificTagCount = (group, tagName) => {
    const tagBreakdown = group?.gohighlevel?.metrics?.tag_breakdown || {};
    return tagBreakdown[tagName] || 0;
  };

  /* ---------- FLATTENED DATA (BACKWARD COMPATIBLE + ENHANCED + TAGS) ---------- */
  const flattenedData = useMemo(() => {
    if (!isClientMode) {
      return data;
    }

    return data.map((group) => {
      // ===== EXISTING FIELDS (UNCHANGED) =====
      const ghlContacts = group.gohighlevel?.metrics?.total_contacts ?? 0;
      const metaCampaigns = group.facebook?.metrics?.total_campaigns ?? 0;
      const metaAdsets = group.facebook?.metrics?.total_adsets ?? 0;
      const metaAds = group.facebook?.metrics?.total_ads ?? 0;
      const metaSpend = group.facebook?.metrics?.insights?.spend ?? 0;
      const metaImpressions = group.facebook?.metrics?.insights?.impressions ?? 0;
      const metaClicks = group.facebook?.metrics?.insights?.clicks ?? 0;
      const metaReach = group.facebook?.metrics?.insights?.reach ?? 0;
      const metaResults = group.facebook?.metrics?.insights?.results ?? 0;
      const metaCpm = group.facebook?.metrics?.insights?.cpm ?? 0;
      const metaCpc = group.facebook?.metrics?.insights?.cpc ?? 0;
      const metaCtr = group.facebook?.metrics?.insights?.ctr ?? 0;
      const metaCostPerResult = group.facebook?.metrics?.insights?.cost_per_result ?? 0;
      const metaLeads = group.facebook?.metrics?.total_leads ?? 0;
      const hpLeads = group.hotprospector?.metrics?.total_leads ?? 0;

      const base = {
        id: group.id,
        name: group.name || "Unnamed Group",
        ghl_contacts: ghlContacts,
        meta_campaigns: metaCampaigns,
        meta_adsets: metaAdsets,
        meta_ads: metaAds,
        meta_spend: metaSpend,
        meta_impressions: metaImpressions,
        meta_clicks: metaClicks,
        meta_reach: metaReach,
        meta_results: metaResults,
        meta_cpm: metaCpm,
        meta_cpc: metaCpc,
        meta_ctr: metaCtr,
        meta_cost_per_result: metaCostPerResult,
        meta_leads: metaLeads,
        hp_leads: hpLeads,
        original: group,
        _isCreating: group._isCreating || false,
        _isPending: group._isPending || false,

        // ALIASES for formula compatibility
        leads: ghlContacts,
        "ad-spend": metaSpend,
        clicks: metaClicks,
        impressions: metaImpressions,
        conversions: metaLeads,
      };

      // ===== ENHANCED FIELDS (ONLY IF ENABLED) =====
      if (enableEnhancedExtraction) {
        // Core information
        base.ghl_location_id = group.ghl_location_id ?? "";
        base.meta_ad_account_id = group.meta_ad_account_id ?? "";
        base.notes = group.notes ?? "";
        base.created_at = group.created_at ?? "";
        base.updated_at = group.updated_at ?? "";
        base.last_ghl_refresh = group.last_ghl_refresh ?? "";
        base.last_meta_refresh = group.last_meta_refresh ?? "";
        base.last_hp_refresh = group.last_hp_refresh ?? "";

        // GoHighLevel details
        base.ghl_address = group.gohighlevel?.address ?? "";
        base.ghl_name = group.gohighlevel?.name ?? "";
        base.total_tags = getTotalTagCount(group);
        const topTags = getTopTags(group, 3);
        base.top_tag_string = topTags.map(([tag, count]) => `${tag} (${count})`).join(", ");

        // NEW: Extract specific tag counts dynamically based on column config
        columns.forEach((col) => {
          if (col.type === 'tag' && col.tagName) {
            base[col.id] = getSpecificTagCount(group, col.tagName);
          }
        });

        // Meta status
        base.active_campaigns = getActiveCampaignCount(group);
        base.paused_campaigns = getPausedCampaignCount(group);
        base.meta_account_name = group.facebook?.name ?? "Unknown";
        base.meta_currency = group.facebook?.currency ?? "";

        // Ad performance
        const bestAd = getBestPerformingAd(group);
        base.best_ad_name = bestAd?.name ?? "";
        base.best_ad_ctr = bestAd?.ctr ?? 0;

        // Calculated metrics
        base.conversion_rate = metaClicks > 0 ? ((metaLeads / metaClicks) * 100) : 0;
        base.cost_per_lead = metaLeads > 0 ? (metaSpend / metaLeads) : 0;
        base.engagement_rate = metaImpressions > 0 ? (((metaClicks + metaResults) / metaImpressions) * 100) : 0;

        // Data freshness
        base.meta_freshness = getDataFreshness(group.last_meta_refresh);
        base.ghl_freshness = getDataFreshness(group.last_ghl_refresh);
        base.hp_freshness = getDataFreshness(group.last_hp_refresh);

        // Account age
        const accountAgeMs = group.created_at ? Date.now() - new Date(group.created_at) : 0;
        base.account_age_days = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
      }

      // Calculate custom metrics
      if (customMetrics) {
        customMetrics.forEach((metric) => {
          if (metric.formulaParts) {
            const result = evaluateFormula(metric.formulaParts, base);
            base[metric.id] = typeof result === 'object' ? 0 : (result ?? 0);
          }
        });
      }

      return base;
    });
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
    if (!sortConfig.key) return filteredData;
    const copy = [...filteredData];
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
  const formatCurrency = (v) => {
    const num = typeof v === "number" ? v : parseFloat(v) || 0;
    return `$${num.toFixed(2)}`;
  };
  
  const formatPercentage = (v) => {
    const num = typeof v === "number" ? v : parseFloat(v) || 0;
    return `${num.toFixed(2)}%`;
  };
  
  const formatNumber = (v) => {
    const num = typeof v === "number" ? v : parseFloat(v) || 0;
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

    // Handle undefined/null values
    if (value === undefined || value === null) {
      return "—";
    }

    // Handle objects (shouldn't happen, but safety check)
    if (typeof value === "object") {
      console.warn(`Object detected in cell for column ${columnId}:`, value);
      return "—";
    }

    // Custom metrics formatting
    if (customMetrics?.some((m) => m.id === columnId)) {
      return formatMetricValue(value, columnId);
    }

    // Built-in column formatting
    if (columnId.includes("spend") || columnId.includes("cpc") || columnId.includes("cpm") || columnId.includes("cost_per")) {
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
    
    // String values
    return String(value);
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
            min-width: 250px;
            font-weight: 600;
            max-width: 250px;
          }
          .fixed-column-odd {
            text-align: left;
            position: sticky;
            left: 0;
            background: #f4f3f9;
            z-index: 50;
            min-width: 250px;
            font-weight: 600;
            max-width: 250px;
          }
          .fixed-header {
            position: sticky;
            left: 0;
            z-index: 50;
            background: white;
            min-width: 150px;
            width: 5%;
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
        <table className="text-sm">
          <thead className="top-0 z-40">
            <tr className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted h-12 bg-white">
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  draggable={col.id !== "name"}
                  onDragStart={(e) => handleDragStart(e, col.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`h-12 font-semibold text-gray-900/78 select-none cursor-default ${
                    col.id === "name"
                      ? "fixed-header"
                      : "min-w-[135px] whitespace-nowrap"
                  }`}
                >
                  <div className="flex items-center justify-between border border-2 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7] h-full gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <button
                        onClick={() => col.sortable && handleSort(col.id)}
                        className={`truncate align-middle text-left items-center gap-1 ${
                          col.sortable
                            ? "hover:text-foreground cursor-pointer"
                            : "cursor-default"
                        }`}
                      >
                        {typeof col.header === "function" ? col.header() : col.header}
                        {col.sortable && sortConfig.key === col.id && (
                          <span className="text-sm px-2 text-right">
                            {sortConfig.direction === "asc" ? "↑" : "↓ "}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="flex-shrink-0 ml-auto">
                      {col.icons ? (
                        typeof col.icons === "function" ? (
                          (() => {
                            const Icon = col.icons;
                            return <Icon className="h-4 w-4 text-muted-foreground" />;
                          })()
                        ) : (
                          <img
                            src={col.icons.src ? col.icons.src : col.icons}
                            alt={`${col.label} icon`}
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
                <td colSpan={visibleColumns.length} className="px-4 py-4 text-muted-foreground">
                  {isClientMode ? "No client groups found" : "No data available."}
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => !(row._isCreating || row._isPending) && onRowClick?.(row.original || row)}
                  className={`border-b transition-colors ${
                    (row._isCreating || row._isPending)
                      ? "bg-muted/30 cursor-wait opacity-60" 
                      : "hover:bg-muted/50 cursor-pointer"
                  } 
                  ${idx % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"}`}
                >
                  {visibleColumns.map((col, colIdx) => (
                    <td
                      key={`${row.id || idx}-${col.id}`}
                      className={`text-foreground truncate ${
                        colIdx === 0
                          ? idx % 2 === 0
                            ? "fixed-column-odd"
                            : "fixed-column-even"
                          : ""
                      }`}
                    >
                      <div
                        className={
                          colIdx === 0
                            ? "py-2 px-4 border border-2 border-l-0 border-t-0 border-b-0 border-[#e4e4e7] flex items-center gap-2 min-w-0 "
                            : "min-w-0"
                        }
                      >
                        {/* Add spinner for first column when creating OR pending */}
                        {colIdx === 0 && (row._isCreating || row._isPending) && (
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`truncate min-w-0 ${
                                  row._isCreating || row._isPending ? "text-muted-foreground" : ""
                                }`}
                              >
                                {colIdx === 0 && clickableFirstColumn && !onRowClick ? (
                                  <button
                                    onClick={() => onFirstColumnClick?.(row)}
                                    className="text-left font-semibold text-primary hover:underline cursor-pointer w-full"
                                  >
                                    {col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)}
                                  </button>
                                ) : (
                                  col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)
                                )}
                              </span>
                            </TooltipTrigger>
                            {colIdx === 0 && !col.cell && (
                              <TooltipContent>
                                <p>{getCellValue(row, col.id)}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isClientMode && (
        <div className="text-sm text-center font-semibold text-black/50 text-muted-foreground">
          Showing {sortedData.length} of {flattenedData.length} client groups
        </div>
      )}

    </div>
  );
}

export default StyledTable