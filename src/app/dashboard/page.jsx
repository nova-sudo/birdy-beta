"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Trophy,
  DollarSign,
  User,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  BellRing,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientGroups } from "@/lib/useClientGroups";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import getSymbolFromCurrency from "currency-symbol-map";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = ["All Alerts", "Ads Not Running", "Performance", "Client Wins"];

const TAB_FILTER = {
  "All Alerts": () => true,
  "Ads Not Running": (a) => a.type === "ads_not_running",
  "Performance": (a) => a.type === "performance",
  "Client Wins": (a) => a.type === "client_wins",
};

const BORDER_COLOR = {
  red:    "border-l-red-500 bg-red-50/50",
  yellow: "border-l-amber-500 bg-amber-50/50",
  green:  "border-l-green-500 bg-green-50/50",
};

// ─── Grouping helper ──────────────────────────────────────────────────────────
// Mirrors the alerts page groupTriggeredRows logic:
// - Non-virtual rows  → standalone (no children)
// - Virtual rows with the same alertId → collapsed under one parent header

function groupAlerts(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.isVirtual) {
      map.set(`real_${row.rowId}`, { parent: row, children: [] });
      continue;
    }
    const key = row.alertId;
    if (!map.has(key)) {
      map.set(key, {
        parent: {
          rowId:            row.alertId,
          alertId:          row.alertId,
          isVirtual:        false,
          isGroup:          true,
          clientId:         null,
          client:           row.alertName,      // the real alert name as header
          platform:         row.platform,
          type:             row.type,
          title:            row.title,
          description:      row.groupDescription,
          color:            row.color,
          targetGroupIds:   row.targetGroupIds,
          childCount:       0,
        },
        children: [],
      });
    }
    const entry = map.get(key);
    entry.children.push(row);
    entry.parent.childCount = entry.children.length;
  }

  return [...map.values()];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertIcon({ color, small = false }) {
  const ring = small ? "w-7 h-7" : "w-9 h-9";
  const ico  = small ? "w-3 h-3" : "w-4 h-4";
  if (color === "red")
    return (
      <div className={`${ring} rounded-full bg-red-100 flex items-center justify-center shrink-0`}>
        <AlertTriangle className={`${ico} text-red-500`} />
      </div>
    );
  if (color === "yellow")
    return (
      <div className={`${ring} rounded-full bg-yellow-100 flex items-center justify-center shrink-0`}>
        <DollarSign className={`${ico} text-yellow-500`} />
      </div>
    );
  return (
    <div className={`${ring} rounded-full bg-green-100 flex items-center justify-center shrink-0`}>
      <Trophy className={`${ico} text-green-500`} />
    </div>
  );
}

function AlertSkeletonItem() {
  return (
    <div className="flex items-center gap-4 mb-4 p-4 rounded-lg border-l-4 border-l-muted bg-white shadow-sm">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-lg" />
      </div>
    </div>
  );
}

/** Animated circle → checkmark dismiss button */
function DismissButton({ rowId, dismissingIds, onDismiss, title }) {
  const active = dismissingIds.has(rowId);
  return (
    <button
      disabled={active}
      onClick={onDismiss}
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/60 transition-colors disabled:cursor-not-allowed shrink-0"
      title={title}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
        active
          ? "bg-green-500 border-green-500 scale-110"
          : "border-muted-foreground/40 hover:border-green-500"
      }`}>
        <svg
          className={`w-3 h-3 text-white transition-all duration-200 ${active ? "opacity-100 scale-100" : "opacity-0 scale-0"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </button>
  );
}

/** Plain non-grouped alert row (mirrors the original design) */
function StandaloneAlertRow({ alert, dismissingIds, onDismiss, onOpenClient }) {
  const isDismissing = dismissingIds.has(alert.rowId);
  return (
    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
      isDismissing ? "max-h-0 opacity-0 mb-0" : "max-h-96 opacity-100 mb-3"
    }`}>
      <div className={`flex items-center gap-4 p-4 rounded-lg shadow-sm border-l-4 transition-all duration-300 ease-in-out ${
        BORDER_COLOR[alert.color]
      } ${isDismissing ? "-translate-x-full" : "translate-x-0"}`}>
        <AlertIcon color={alert.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-[#713CDDE6] truncate">{alert.client}</span>
            <Badge variant="outline" className="text-xs rounded-full px-2 shrink-0">{alert.platform}</Badge>
          </div>
          <p className="text-sm font-semibold text-foreground">{alert.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-8 px-4 text-xs"
            onClick={onOpenClient}
          >
            Open Client
          </Button>
          <DismissButton
            rowId={alert.rowId}
            dismissingIds={dismissingIds}
            onDismiss={onDismiss}
            title="Delete alert"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Group header row + collapsible children.
 * Mirrors GroupHeaderRow from the alerts page:
 * - Header shows alert name + red "{n} clients" badge + chevron
 * - Expanding reveals individual per-client rows with indent + purple bar
 */
function GroupHeaderRow({ group, isExpanded, onToggle, dismissingIds, onDismissChild, onOpenClient }) {
  const { parent, children } = group;

  return (
    <div className={`rounded-lg shadow-sm border-l-4 overflow-hidden ${BORDER_COLOR[parent.color]}`}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-black/5 transition-colors"
        onClick={onToggle}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>

        <AlertIcon color={parent.color} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-medium text-[#713CDDE6] truncate">{parent.client}</span>
            <Badge variant="outline" className="text-xs rounded-full px-2 shrink-0">{parent.platform}</Badge>
            {/* Red clients badge — identical to the alerts page pill */}
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 rounded-full px-1.5 py-0.5 shrink-0">
              <BellRing className="h-2.5 w-2.5" />
              {children.length} client{children.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground">{parent.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{parent.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-8 px-4 text-xs"
            onClick={onOpenClient}
          >
            View All
          </Button>
        </div>
      </div>

      {/* ── Children (expanded) ──────────────────────────────────────────── */}
      {isExpanded && (
        <div className="border-t border-border/30">
          {children.map((child) => {
            const isDismissing = dismissingIds.has(child.rowId);
            return (
              <div
                key={child.rowId}
                className={`transition-all duration-500 ease-in-out overflow-hidden ${
                  isDismissing ? "max-h-0 opacity-0" : "max-h-40 opacity-100"
                }`}
              >
                <div className={`flex items-center gap-3 px-4 py-3 border-b border-border/20 last:border-0 hover:bg-black/5 transition-all duration-300 ${
                  isDismissing ? "-translate-x-full" : "translate-x-0"
                }`}>
                  {/* Indent + purple bar — matches SubAlertRow in the alerts page */}
                  <div className="pl-6 flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-0.5 h-8 rounded-full bg-purple-300 shrink-0" />
                    <AlertIcon color={child.color} small />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="h-3 w-3 text-purple-500 shrink-0" />
                        <span className="text-xs font-semibold text-purple-900 truncate">{child.client}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-1.5 py-0.5 shrink-0">
                          Per Client
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{child.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-7 px-3 text-xs"
                      onClick={() => child._openClientFn?.()}
                    >
                      Open
                    </Button>
                    <DismissButton
                      rowId={child.rowId}
                      dismissingIds={dismissingIds}
                      onDismiss={() => onDismissChild(child)}
                      title="Remove triggered entry"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ClientCard ───────────────────────────────────────────────────────────────

function ClientCard({ group, onClick }) {
  const userCurrency = (() => {
    try { return localStorage.getItem("user_default_currency") ?? "USD"; } catch { return "USD"; }
  })();
  const symbol = getSymbolFromCurrency(userCurrency) || "$";

  const ad_spend = group.facebook?.metrics?.insights?.spend
    ? `${symbol}${parseFloat(group.facebook?.metrics?.insights?.spend)}`
    : "—";

  const ctr = group.facebook?.metrics?.insights?.ctr
    ? `${group.facebook?.metrics?.insights?.ctr}%`
    : "—";

  const clicks = group.facebook?.metrics?.insights?.clicks
    ? `${parseFloat(group.facebook.metrics.insights.clicks).toFixed(0)}`
    : "—";

  const isPending = group._isPending || group._isCreating;
  const progress  = Math.min(((parseFloat(group.facebook?.metrics?.insights?.purchase_roas) || 0) / 10) * 100, 100);

  return (
    <div
      onClick={() => !isPending && onClick(group)}
      className={`bg-white border border-border/60 rounded-2xl p-5 flex flex-col gap-4 transition-all cursor-pointer
        ${isPending ? "opacity-60 pointer-events-none" : "hover:shadow-md hover:border-purple-200"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-foreground text-base leading-tight">{group.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.niche || group.gohighlevel?.location?.business_type || "Marketing Agency"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-50 border border-border/60 rounded-full px-2.5 py-1 shrink-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${isPending ? "bg-yellow-400" : "bg-green-500"}`} />
          <span className="text-xs font-medium text-foreground">
            {isPending ? "Syncing..." : "Healthy"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Ad Spend", value: ad_spend },
          { label: "CTR", value: ctr },
          { label: "Clicks", value: clicks },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-bold text-foreground mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <TrendingUp className="w-4 h-4 text-purple-400 shrink-0" />
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { clientGroups, loading } = useClientGroups(DEFAULT_DATE_PRESET);

  const [activeTab,      setActiveTab]      = useState("All Alerts");
  const [rawRows,        setRawRows]        = useState([]);
  const [alertsLoading,  setAlertsLoading]  = useState(true);
  const [query,          setQuery]          = useState("");
  const [dismissingIds,  setDismissingIds]  = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // ── Fetch alerts ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setAlertsLoading(true);
        const res = await apiRequest("/api/alerts");
        if (!res.ok) return;
        const data = await res.json();
        setRawRows([
          ...(data.active    || []),
          ...(data.triggered || []),
          ...(data.paused    || []),
        ]);
      } catch {
        // non-critical
      } finally {
        setAlertsLoading(false);
      }
    })();
  }, []);

  // ── Map DB → UI ────────────────────────────────────────────────────────────
  const alerts = useMemo(() => rawRows.map((row) => {
    const rowId       = row._virtual_id ?? row.id;
    const clientLabel = row._virtual ? row._client_name : row.name;
    const baseDescription =
      row.last_eval_result?.message ??
      `${row.metric_label ?? ""} ${row.condition_display ?? ""} per ${row.condition?.period ?? ""}`;
    const description = row._virtual && row._client_value != null
      ? `${baseDescription} — actual: ${Number(row._client_value).toFixed(2)}`
      : baseDescription;
    const color =
      row.status === "triggered" ? "red" :
      row.status === "active"    ? "yellow" : "green";
    const type =
      row.status === "triggered" || row.status === "active" ? "performance" : "client_wins";

    return {
      rowId,
      alertId:          row.id,
      alertName:        row.name,
      isVirtual:        !!row._virtual,
      isGroup:          false,
      clientId:         row._client_id ?? null,
      client:           clientLabel,
      platform:         row.condition?.platform ?? "Facebook",
      type,
      title:            row.metric_label ?? row.name,
      description,
      groupDescription: baseDescription,   // used on parent header (no per-client value)
      color,
      targetGroupIds:   row.target_group_ids || [],
    };
  }), [rawRows]);

  // ── Group virtual rows ─────────────────────────────────────────────────────
  const groups = useMemo(() => groupAlerts(alerts), [alerts]);

  // ── Filter by tab ──────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    const filter = TAB_FILTER[activeTab];
    return groups
      .filter(({ parent, children }) =>
        children.length > 0 ? children.some(filter) : filter(parent)
      )
      .map(({ parent, children }) => ({
        parent,
        children: children.filter(filter),
      }));
  }, [groups, activeTab]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const openClient = (alert) => {
    if (alert.isVirtual && alert.clientId) {
      const m = clientGroups.find((g) => g.id === alert.clientId);
      if (m) { router.push(`/clients/${m.id}`); return; }
    }
    const m = clientGroups.find((g) => alert.targetGroupIds.includes(g.id));
    if (m) router.push(`/clients/${m.id}`);
  };

  const dismissAlert = async ({ rowId, alertId, isVirtual, clientId }) => {
    const removed = rawRows.find((r) => (r._virtual_id ?? r.id) === rowId);
    setRawRows((prev) => prev.filter((r) => (r._virtual_id ?? r.id) !== rowId));

    try {
      let res;
      if (isVirtual && clientId) {
        res = await apiRequest(`/api/alerts/${alertId}/dismiss-client`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId }),
        });
      } else {
        res = await apiRequest(`/api/alerts/${alertId}`, { method: "DELETE" });
      }

      if (res.ok) {
        toast.success(isVirtual ? "Triggered entry removed" : "Alert deleted");
      } else {
        if (removed) setRawRows((prev) => [removed, ...prev]);
        setDismissingIds((prev) => { const s = new Set(prev); s.delete(rowId); return s; });
        const errText = await res.text().catch(() => "");
        toast.error(
          isVirtual ? "Failed to remove triggered entry" : "Failed to delete alert",
          { description: errText || `Status ${res.status}` },
        );
      }
    } catch (err) {
      if (removed) setRawRows((prev) => [removed, ...prev]);
      setDismissingIds((prev) => { const s = new Set(prev); s.delete(rowId); return s; });
      toast.error("Something went wrong", { description: String(err) });
    }
  };

  const triggerDismiss = (alert) => {
    if (dismissingIds.has(alert.rowId)) return;
    setDismissingIds((prev) => new Set([...prev, alert.rowId]));
    setTimeout(() => dismissAlert(alert), 800);
  };

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Welcome + AI Search ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to Birdy</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your AI Marketing Manager – Ask questions about your marketing performance
        </p>

        <div className="mt-4 bg-[#F3F0FD] rounded-2xl p-5">
          <div className="relative max-w-2xl mx-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your marketing metrics, client performance, or campaign insights..."
              className="w-full bg-white border border-border/60 rounded-xl px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 max-w-2xl mx-auto">
            <span className="text-xs text-muted-foreground">Try asking:</span>
            {[
              "Why are bookings down this week?",
              "Which tag gave the best cost per booking?",
              "Show ROAS breakdown by campaign",
            ].map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="text-xs bg-white border border-border/60 rounded-lg px-3 py-1.5 hover:bg-purple-50 hover:border-purple-300 transition-colors text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action Required ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Action Required</h2>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="!flex w-full h-fit bg-muted/50 border border-border/60 mb-4 rounded-xl px-1 py-2 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="!flex-1 min-w-[110px] text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-purple-100/50 data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col mb-4">
          {alertsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <AlertSkeletonItem key={i} />)
          ) : filteredGroups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10 bg-white border border-border/60 rounded-xl">
              No alerts in this category
            </div>
          ) : (
            filteredGroups.map(({ parent, children }) => {
              const hasChildren = children.length > 0;
              const groupKey    = hasChildren ? `group_${parent.alertId}` : `real_${parent.rowId}`;
              const isExpanded  = expandedGroups.has(groupKey);

              // Attach open-client fn to each child to avoid prop-drilling clientGroups
              const childrenWithFn = children.map((c) => ({
                ...c,
                _openClientFn: () => openClient(c),
              }));

              if (!hasChildren) {
                return (
                  <StandaloneAlertRow
                    key={groupKey}
                    alert={parent}
                    dismissingIds={dismissingIds}
                    onDismiss={() => triggerDismiss(parent)}
                    onOpenClient={() => openClient(parent)}
                  />
                );
              }

              return (
                <div key={groupKey} className="mb-3">
                  <GroupHeaderRow
                    group={{ parent, children: childrenWithFn }}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(groupKey)}
                    dismissingIds={dismissingIds}
                    onDismissChild={triggerDismiss}
                    onOpenClient={() => openClient(parent)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Clients Grid ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-foreground">Clients</h2>
          <Link href="/clients" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-border/60 rounded-2xl flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="flex flex-col gap-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : clientGroups.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12 bg-white border border-border/60 rounded-2xl">
            No clients yet.{" "}
            <Link href="/clients" className="text-purple-600 underline">
              Add your first client
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clientGroups.slice(0, 6).map((group) => (
              <ClientCard key={group.id} group={group} onClick={(g) => router.push(`/clients/${g.id}`)} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}