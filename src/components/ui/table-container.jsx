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
}) => {
  /* ---------- STATE ---------- */
  const [sortConfig, setSortConfig] = useState({ key: "spend", direction: "desc" });
  // The table opens sorted by spend, and used to advertise that with a ↓ on the
  // header. But an arrow the reader never asked for reads as a control they left
  // switched on. It stays hidden until someone actually sorts — the default
  // ordering is unchanged, only the claim about it is withheld.
  const [hasSorted, setHasSorted] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [columnOrder, setColumnOrder] = useState(initialColumnOrder || []);

  useEffect(() => {
    if (Array.isArray(initialColumnOrder) && initialColumnOrder.length > 0) {
      setColumnOrder(initialColumnOrder);
    }
  }, [initialColumnOrder]);
  const isClientMode = Array.isArray(customMetrics) && setCustomMetrics !== undefined;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

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

  /* ---------- FLATTENED DATA ---------- */
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

      // Call Center (HotProspector) — per-preset windowed stats from call_stats
      const hpStats = group.hotprospector?.call_stats || {};
      const hpTotalCalls = hpStats.total_calls ?? 0;
      const hpLeadsWithCalls = hpStats.leads_with_calls ?? 0;
      const hpTotalLeads = hpStats.total_leads ?? hpLeads;
      const hpAnswered = hpStats.answered_calls ?? 0;
      const hpConnectRate = hpTotalLeads > 0 ? (hpLeadsWithCalls / hpTotalLeads) * 100 : 0;
      const hpAnswerRate = hpTotalCalls > 0 ? (hpAnswered / hpTotalCalls) * 100 : 0;

      const base = {
        id: group.id,
        name: group.name || "Unnamed Group",
        status: group.client_status ?? "Active",
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
        hp_total_calls: hpTotalCalls,
        hp_inbound: hpStats.inbound_count ?? 0,
        hp_outbound: hpStats.outbound_count ?? 0,
        hp_transfers: hpStats.transfers ?? 0,
        hp_leads_with_calls: hpLeadsWithCalls,
        hp_answered_calls: hpAnswered,
        hp_talk_time: hpStats.total_talk_min ?? 0,
        hp_connect_rate: hpConnectRate,
        hp_answer_rate: hpAnswerRate,
        original: group,
        _isCreating: group._isCreating || false,
        _isPending: group._isPending || false,
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, targetId, targetColIdx) => {
    e.preventDefault();
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
    return `${getSymbolFromCurrency(userCurrency)}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  return (
    <div className="space-y-4">
      {/* Zebra rows are painted here rather than with Tailwind classes because
          the name column is `position: sticky` — it scrolls over its
          neighbours, so it needs an opaque background of its own that matches
          the row it belongs to. The two have to agree, and a token is the only
          way to keep them agreeing. */}
      <style jsx>{`
        .fixed-column-even,
        .fixed-column-odd,
        .fixed-header {
          text-align: left;
          min-width: 200px;
          max-width: 245px;
          width: 245px;
        }

        .fixed-column-even {
          background: var(--pd-surface);
        }
        .fixed-column-odd {
          background: var(--pd-row-zebra);
        }
        .fixed-header {
          background: var(--pd-table-head);
        }

        @media (min-width: 768px) {
          .fixed-column-even,
          .fixed-column-odd {
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
        className="table-container rounded-2xl border border-pd-border bg-pd-surface"
        style={{
          "--name-sticky-left": `${nameStickyLeft}px`,
          overflowX: isEmptyState ? "hidden" : "auto",
        }}
      >
        <table className="w-full text-sm" style={isEmptyState ? { width: "100%" } : undefined}>
          {/* Uppercase, letter-spaced and a shade off white — the header reads
              as a label strip rather than a first row of data. */}
          <thead className="top-0 z-40 border-b border-pd-border bg-pd-table-head text-[12.5px] font-bold tracking-[.03em] text-pd-faint uppercase">
            <tr className="h-12 bg-pd-table-head transition-colors">

              {/* Checkbox header — sticky at left: 0 */}
              {enableSelection && (
                <th
                  className="h-12 w-10 min-w-0 bg-pd-table-head px-2 pr-0"
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
                  className="h-12 w-[70px] min-w-[70px] bg-pd-table-head px-1"
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
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id, colIdx)}
                    className={`h-12 cursor-default select-none ${
                      colIdx === 0
                        ? "fixed-header"
                        : isEmptyState
                          ? ""
                          : "min-w-[135px] whitespace-nowrap"
                    }`}
                  >
                    {/* No vertical rule between columns: the design separates
                        them by alignment and spacing, and a grid of hairlines
                        competes with the figures.

                        The source icon sits at the far end, away from the
                        label, so it marks where the column came from without
                        crowding the word it belongs to. */}
                    <div className="flex h-full w-full items-center gap-2 px-[22px]">
                      <button
                        onClick={() => col.sortable && handleSort(col.id)}
                        className={`flex min-w-0 items-center gap-1 truncate text-left align-middle ${
                          col.sortable ? "cursor-pointer hover:text-pd-ink" : "cursor-default"
                        }`}
                      >
                        <span className="truncate">
                          {typeof col.header === "function" ? col.header() : col.header}
                        </span>
                        {col.sortable && hasSorted && sortConfig.key === col.id && (
                          // The active sort column takes the ink colour, so
                          // the arrow is legible against the muted header.
                          <span className="shrink-0 text-sm text-pd-ink">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>

                      <div className="ml-auto shrink-0">
                        {col.icons ? (
                          typeof col.icons === "function" ? (
                            (() => {
                              const Icon = col.icons;
                              return <Icon className="size-4 text-pd-faint" aria-hidden="true" />;
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
                <tr
                  key={`skeleton-${idx}`}
                  className={`border-b border-pd-row-border ${idx % 2 === 0 ? "bg-pd-row-zebra" : "bg-pd-surface"}`}
                >
                  {enableSelection && (
                    <td
                      className={`w-10 min-w-0 px-2 pr-0 ${idx % 2 === 0 ? "bg-pd-row-zebra" : "bg-pd-surface"}`}
                      style={{ position: 'sticky', left: 0, zIndex: 30 }}
                    >
                      <Skeleton className="size-4 rounded" />
                    </td>
                  )}

                  {showToggleCol && (
                    <td
                      className={`w-[70px] min-w-[70px] px-1 ${idx % 2 === 0 ? "bg-pd-row-zebra" : "bg-pd-surface"}`}
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
                      <td
                        className={`truncate ${
                          colIdx === 0
                            ? `${idx % 2 === 0 ? "fixed-column-odd" : "fixed-column-even"} h-11`
                            : ""
                        }`}
                      >
                        <div
                          className={
                            colIdx === 0
                              ? "flex min-w-0 items-center gap-2 px-[22px] py-3"
                              : "flex h-11 items-center px-[22px]"
                          }
                        >
                          <Skeleton className={`h-4 rounded ${colIdx === 0 ? "w-36" : "w-20"}`} />
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
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-pd-faint">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="size-8 opacity-40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.75 9.75h.008v.008H9.75V9.75zm4.5 0h.008v.008h-.008V9.75zM12 3a9 9 0 100 18A9 9 0 0012 3zm0 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"
                      />
                    </svg>
                    <p className="text-[13.5px] font-semibold text-pd-ink">
                      {emptyMessage?.title ?? "No data available"}
                    </p>
                    <p className="text-[12px]">
                      {emptyMessage?.subtitle ?? "Try adjusting your filters or date range"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              /* CASE 3: Has data */
              paginatedData.map((row, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx;
                const isSelected = enableSelection && selectedRows.has(row.id);
                // Alternating white and a hair off it. The stripe is there to
                // help the eye track one row across a wide table, not to band
                // the table — anything heavier competes with the figures.
                const rowBg = globalIdx % 2 === 0 ? "bg-pd-row-zebra" : "bg-pd-surface";
                const isToggling = showToggleCol && togglingRows.has(row.id);
                const isActive = String(row.status).toLowerCase() === "active";

                return (
                  <tr
                    key={`${row.id ?? 'row'}-${idx}`}
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => !(row._isCreating || row._isPending) && onRowClick?.(row.original || row)}
                    className={`border-b border-pd-row-border transition-colors ${
                      (row._isCreating || row._isPending)
                        ? "w-fit cursor-wait bg-muted/30 opacity-60"
                        : "w-fit cursor-pointer hover:bg-pd-divider/60"
                    } ${rowBg} ${isSelected ? "!bg-pd-primary-tint" : ""}`}
                  >
                    {/* Checkbox cell */}
                    {enableSelection && (
                      <td
                        className={`w-10 px-2 pr-0 min-w-0 ${rowBg} ${isSelected ? "!bg-pd-primary-tint" : ""}`}
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
                        className={`w-[70px] min-w-[70px] px-1 ${rowBg} ${isSelected ? "!bg-pd-primary-tint" : ""}`}
                        style={{ position: 'sticky', left: enableSelection ? 40 : 0, zIndex: 30 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {togglingRows.has(row.id) ? (
                          <div className="flex items-center justify-center">
                            <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
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

                    {visibleColumns.map((col, colIdx) => (
                      <Fragment key={`${row.id || idx}-${col.id}`}>
                        <td
                          className={`truncate ${
                            colIdx === 0
                              ? // The name carries the row: heavier, in ink,
                                // against numerics that sit back in body grey.
                                `${globalIdx % 2 === 0 ? "fixed-column-odd" : "fixed-column-even"} h-11 text-[14px] font-semibold text-pd-ink`
                              : "text-[13.5px] text-pd-body"
                          } ${isSelected && colIdx === 0 ? "!bg-pd-primary-tint" : ""}`}
                        >
                          <div
                            className={
                              colIdx === 0
                                ? "flex min-w-0 items-center gap-2 px-[22px] py-3"
                                : "min-w-0 px-[22px]"
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
                                  isActive ? "bg-[#15803D]" : "bg-pd-faint"
                                }`}
                              />
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className={`min-w-0 flex items-center gap-2 w-full overflow-hidden ${
                                      row._isCreating || row._isPending ? "text-muted-foreground" : ""
                                    }`}
                                  >
                                    {colIdx === 0 && clickableFirstColumn && !onRowClick ? (
                                      <button
                                        onClick={() => onFirstColumnClick?.(row)}
                                        className="text-left font-semibold text-primary hover:underline cursor-pointer truncate min-w-0"
                                      >
                                        {col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)}
                                      </button>
                                    ) : (
                                      <span className="truncate min-w-0 block">
                                        {col.cell ? col.cell(row[col.id], row) : getCellValue(row, col.id)}
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
                          </div>
                        </td>

                      </Fragment>
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