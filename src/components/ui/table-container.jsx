'use client';

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"

import {
  loadCustomMetrics,
  evaluateFormula,
  formatMetricValue,
} from "@/lib/metrics";
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
const userCurrency = localStorage.getItem("user_default_currency");
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
}) => {
  /* ---------- STATE ---------- */
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [columnOrder, setColumnOrder] = useState([]);
  // FIX: only true when Client Hub explicitly passes BOTH customMetrics array AND setCustomMetrics setter
  const isClientMode = Array.isArray(customMetrics) && setCustomMetrics !== undefined;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

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
      const ghlContacts = group.gohighlevel?.metrics?.total_contacts ?? 0;
      const ghlOppStats = group.gohighlevel?.metrics?.opportunity_stats || {}
      const ghlRevenue = ghlOppStats.won_revenue ?? 0;
      const ghlWonOpps = ghlOppStats.won ?? 0;
      const ghlLostOpps = ghlOppStats.lost ?? 0;
      const ghlOpenOpps = ghlOppStats.open ?? 0;
      const ghlAbandonedOpps = ghlOppStats.abandoned ?? 0;
      const ghlTotalOpps = ghlOppStats.total_opportunities ?? 0;
      const metaCampaigns = group.facebook?.metrics?.total_campaigns ?? 0;
      const metaAdsets = group.facebook?.metrics?.total_adsets ?? 0;
      const metaAds = group.facebook?.metrics?.total_ads ?? 0;
      const metaSpend = group.facebook?.metrics?.insights?.spend ?? 0;
      const metaImpressions = group.facebook?.metrics?.insights?.impressions ?? 0;
      const metaClicks = group.facebook?.metrics?.insights?.clicks ?? 0;
      const metaReach = group.facebook?.metrics?.insights?.reach ?? 0;
      // Use insights.results first; if 0, sum from campaigns array as fallback
      let metaResults = group.facebook?.metrics?.insights?.results ?? 0;
      if (!metaResults && group.facebook?.campaigns?.length) {
        metaResults = group.facebook.campaigns.reduce((sum, c) => sum + (c.results || 0), 0);
      }
      const metaCpm = group.facebook?.metrics?.insights?.cpm ?? 0;
      const metaCpc = group.facebook?.metrics?.insights?.cpc ?? 0;
      const metaCtr = group.facebook?.metrics?.insights?.ctr ?? 0;
      const metaCostPerResult = group.facebook?.metrics?.insights?.cost_per_result ?? 0;
      const metaLeads = metaResults || group.facebook?.metrics?.insights?.total_leads || 0;
      const hpLeads = group.hotprospector?.metrics?.total_leads ?? 0;

      const base = {
        id: group.id,
        name: group.name || "Unnamed Group",
        ghl_contacts: ghlContacts,
        ghl_revenue: ghlRevenue,
        ghl_won_opps: ghlWonOpps,
        ghl_lost_opps: ghlLostOpps,
        ghl_open_opps: ghlOpenOpps,
        ghl_abandoned_opps: ghlAbandonedOpps,
        ghl_total_opps: ghlTotalOpps,
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

      if (enableEnhancedExtraction) {
        base.ghl_location_id = group.ghl_location_id ?? "";
        base.meta_ad_account_id = group.meta_ad_account_id ?? "";
        base.notes = group.notes ?? "";
        base.created_at = group.created_at ?? "";
        base.updated_at = group.updated_at ?? "";
        base.last_ghl_refresh = group.last_ghl_refresh ?? "";
        base.last_meta_refresh = group.last_meta_refresh ?? "";
        base.last_hp_refresh = group.last_hp_refresh ?? "";

        base.ghl_address = group.gohighlevel?.address ?? "";
        base.ghl_name = group.gohighlevel?.name ?? "";
        base.total_tags = getTotalTagCount(group);
        const topTags = getTopTags(group, 3);
        base.top_tag_string = topTags.map(([tag, count]) => `${tag} (${count})`).join(", ");

        columns.forEach((col) => {
          if (col.type === 'tag' && col.tagName) {
            base[col.id] = getSpecificTagCount(group, col.tagName);
          }
        });

        base.active_campaigns = getActiveCampaignCount(group);
        base.paused_campaigns = getPausedCampaignCount(group);
        base.meta_account_name = group.facebook?.name ?? "Unknown";
        base.meta_currency = group.facebook?.currency ?? "";

        const bestAd = getBestPerformingAd(group);
        base.best_ad_name = bestAd?.name ?? "";
        base.best_ad_ctr = bestAd?.ctr ?? 0;

        base.conversion_rate = metaClicks > 0 ? ((metaLeads / metaClicks) * 100) : 0;
        base.cost_per_lead = metaLeads > 0 ? (metaSpend / metaLeads) : 0;
        base.engagement_rate = metaImpressions > 0 ? (((metaClicks + metaResults) / metaImpressions) * 100) : 0;

        base.meta_freshness = getDataFreshness(group.last_meta_refresh);
        base.ghl_freshness = getDataFreshness(group.last_ghl_refresh);
        base.hp_freshness = getDataFreshness(group.last_hp_refresh);

        const accountAgeMs = group.created_at ? Date.now() - new Date(group.created_at) : 0;
        base.account_age_days = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
      }

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

  /* ---------- PAGINATION ---------- */
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedData.length, pageSize]);

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
    return `${getSymbolFromCurrency(userCurrency)}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    if (value === undefined || value === null) {
      return "—";
    }

    if (typeof value === "object") {
      console.warn(`Object detected in cell for column ${columnId}:`, value);
      return "—";
    }

    if (columnId === "name" || columnId === "full_name" || columnId === "contactName") {
      const str = String(value);
      return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    }

    const customMatch = customMetrics?.find((m) => m.id === columnId);
    if (customMatch) {
      const fmt = customMatch.formatType || customMatch.format_type || "integer";
      if (fmt === "currency") return formatCurrency(value);
      if (fmt === "percentage") return `${Number(value).toFixed(2)}%`;
      if (fmt === "decimal") return Number(value).toFixed(2);
      return Number(value).toLocaleString();
    }

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
            min-width: 200px;
            font-weight: 565;
            max-width: 245px;
          }
          .fixed-column-odd {
            text-align: left;
            position: sticky;
            left: 0;
            background: #f4f3f9;
            z-index: 50;
            min-width: 200px;
            font-weight: 565;
            max-width: 245px;
          }
          .fixed-header {
            position: sticky;
            left: 0;
            z-index: 50;
            background: white;
            min-width: 200px;
            width: 5%;
          }
        }

        @media (max-width: 767px) {
          .fixed-column-even,
          .fixed-column-odd {
            text-align: left;
            background: white;
            min-width: 200px;
            font-weight: 575;
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
            <tr className="transition-colors data-[state=selected]:bg-muted h-12 bg-white">
              {/* Checkbox header column */}
              {enableSelection && (
                <th className="h-12 w-10 px-2 pr-0 min-w-0 bg-white" style={{ position: 'sticky', left: 0, zIndex: 51 }}>
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
              {/* Status toggle header */}
              {enableStatusToggle && (
                <th className="h-12 w-[70px] min-w-[70px] px-1 bg-white text-xs font-semibold text-gray-900/78" style={enableSelection ? { position: 'sticky', left: 40, zIndex: 50 } : { position: 'sticky', left: 0, zIndex: 50 }}>
                  <div className="flex items-center justify-center">Status</div>
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  draggable={col.id !== "name"}
                  onDragStart={(e) => handleDragStart(e, col.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`h-12 font-semibold text-gray-900/78 select-none cursor-default ${col.id === "name" || col.id === "full_name" || col.id === "contactName"
                      ? "fixed-header"
                      : "min-w-[135px] whitespace-nowrap"
                    }`}
                  style={(enableSelection || enableStatusToggle) && (col.id === "name" || col.id === "full_name" || col.id === "contactName") ? { left: (enableSelection ? 40 : 0) + (enableStatusToggle ? 70 : 0) } : undefined}
                >
                  <div className="flex items-center justify-between w-full border border-1 border-l-0 border-t-0 border-b-0 px-2 border-[#e4e4e7] h-full gap-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <button
                        onClick={() => col.sortable && handleSort(col.id)}
                        className={`truncate align-middle text-left items-center gap-1 ${col.sortable
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

          <tbody className="text-left">
            {/* CASE 1: Loading → skeleton rows */}
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, idx) => (
                <tr
                  key={`skeleton-${idx}`}
                  className={`border-b ${idx % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"}`}
                >
                  {enableSelection && (
                    <td className="w-10 px-2 pr-0 min-w-0">
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                  )}
                  {(visibleColumns.length > 0 ? visibleColumns : Array.from({ length: 6 }).map((_, i) => ({ id: `skeleton-col-${i}` }))).map((col, colIdx) => (
                    <td
                      key={`skeleton-${idx}-${col.id}`}
                      className={`text-foreground truncate ${
                        colIdx === 0
                          ? idx % 2 === 0
                            ? "fixed-column-odd h-11"
                            : "fixed-column-even h-11"
                          : ""
                      }`}
                      style={enableSelection && colIdx === 0 ? { left: 40 } : undefined}
                    >
                      <div
                        className={
                          colIdx === 0
                            ? "py-3 px-2 border border-1 border-l-0 border-t-0 border-b-0 border-[#e4e4e7] flex items-center gap-2 min-w-0"
                            : "flex items-center justify-center px-2 h-11"
                        }
                      >
                        <Skeleton className={`h-4 rounded ${colIdx === 0 ? "w-36" : "w-20"}`} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              /* CASE 2: Done loading, no data → empty state message */
              <tr>
                <td
                  colSpan={visibleColumns.length + (enableSelection ? 1 : 0)}
                  className="h-48 text-center align-middle"
                >
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-10">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-8 w-8 opacity-30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.75 9.75h.008v.008H9.75V9.75zm4.5 0h.008v.008h-.008V9.75zM12 3a9 9 0 100 18A9 9 0 0012 3zm0 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                      />
                    </svg>
                    <p className="text-sm font-medium">No data available</p>
                    <p className="text-xs opacity-60">Try adjusting your filters or date range</p>
                  </div>
                </td>
              </tr>
            ) : (
              /* CASE 3: Has data → real rows */
              paginatedData.map((row, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx;
                const isSelected = enableSelection && selectedRows.has(row.id);
                return (
                  <tr
                    key={row.id || idx}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => !(row._isCreating || row._isPending) && onRowClick?.(row.original || row)}
                    className={`border-b transition-colors ${(row._isCreating || row._isPending)
                        ? "bg-muted/30 cursor-wait opacity-60 w-fit"
                        : "hover:bg-muted/50 cursor-pointer w-fit"
                      } 
                  ${globalIdx % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"}
                  ${isSelected ? "!bg-primary/5" : ""}`}
                  >
                    {/* Row checkbox */}
                    {enableSelection && (
                      <td
                        className={`w-10 px-2 pr-0 min-w-0 ${globalIdx % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"} ${isSelected ? "!bg-primary/5" : ""}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (!onSelectionChange) return;
                            const next = new Set(selectedRows);
                            if (checked) {
                              next.add(row.id);
                            } else {
                              next.delete(row.id);
                            }
                            onSelectionChange(next);
                          }}
                          aria-label={`Select ${row.name || row.id}`}
                        />
                      </td>
                    )}
                    {/* Status toggle cell */}
                    {enableStatusToggle && (
                      <td
                        className={`w-[70px] min-w-[70px] px-1 ${globalIdx % 2 === 0 ? "bg-[#F4F3F9]" : "bg-white"} ${isSelected ? "!bg-primary/5" : ""}`}
                        style={enableSelection ? { position: 'sticky', left: 40, zIndex: 30 } : { position: 'sticky', left: 0, zIndex: 30 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {togglingRows.has(row.id) ? (
                          <div className="flex items-center justify-center">
                            <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <button
                            onClick={() => onStatusToggle?.(row.id, row.status)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                              String(row.status).toLowerCase() === "active"
                                ? "bg-purple-600"
                                : "bg-gray-300"
                            }`}
                          >
                            <span className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                              String(row.status).toLowerCase() === "active" ? "translate-x-[18px]" : "translate-x-[3px]"
                            }`} />
                          </button>
                        )}
                      </td>
                    )}
                    {visibleColumns.map((col, colIdx) => (
                      <td
                        key={`${row.id || idx}-${col.id}`}
                        className={`text-foreground truncate  ${colIdx === 0
                            ? globalIdx % 2 === 0
                              ? "fixed-column-odd h-11"
                              : "fixed-column-even h-11"
                            : ""
                          } ${isSelected && colIdx === 0 ? "!bg-primary/5" : ""}`}
                        style={(enableSelection || enableStatusToggle) && colIdx === 0 ? { left: (enableSelection ? 40 : 0) + (enableStatusToggle ? 70 : 0) } : undefined}
                      >
                        <div
                          className={
                            colIdx === 0
                              ? "py-3 px-2 border border-1 border-l-0 border-t-0 border-b-0 border-[#e4e4e7] flex items-center gap-2 min-w-0 "
                              : "min-w-0 px-2"
                          }
                        >
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={`truncate min-w-0 ${row._isCreating || row._isPending ? "text-muted-foreground" : ""
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

                                  {/* Creation Spinner - after text */}
                                  {colIdx === 0 && isRowLoading?.(row) && (
                                    <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                                      <svg
                                        className="animate-spin h-3 w-3 shrink-0"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12" cy="12" r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                        />
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8v8z"
                                        />
                                      </svg>
                                      Setting up…
                                    </span>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {!isLoading && sortedData.length > 0 && totalPages > 1 && (
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