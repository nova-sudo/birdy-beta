"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Trophy,
  Trash2,
  TrendingUp,
  DollarSign,
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

const ALERT_LEFT_BORDER = {
  red: "border-l-red-500 bg-red-50/50 hover:bg-background/80",
  yellow: "border-l-amber-500 bg-amber-50/50 hover:bg-background/80",
  green: "border-l-green-500 bg-green-50/50 hover:bg-background/80",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertIcon({ color }) {
  if (color === "red")
    return (
      <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-red-500" />
      </div>
    );
  if (color === "yellow")
    return (
      <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
        <DollarSign className="w-4 h-4 text-yellow-500" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
      <Trophy className="w-4 h-4 text-green-500" />
    </div>
  );
}

function ClientCard({ group, onClick }) {
  const userCurrency = (() => {
    try { 
      const currency = localStorage.getItem("user_default_currency") ?? "USD";
      if (!currency) throw new Error("Currency not fetched");
      return currency;
    } catch { 
      return "USD"; 
    }
  })();
  const symbol = getSymbolFromCurrency(userCurrency) || "$";

  const ad_spend = group.facebook?.metrics?.insights?.spend
    ? `${symbol}${parseFloat(group.facebook?.metrics?.insights?.spend)}`
    : "—";

  

  const ctr = group.facebook?.metrics?.insights?.ctr
    ? `${group.facebook?.metrics?.insights?.ctr}%`
    : "—";    
  

  const clicks = group.facebook?.metrics?.insights?.clicks
    ? `${(parseFloat(group.facebook.metrics.insights.clicks)).toFixed(0)}`
    : "—";

  const isPending = group._isPending || group._isCreating;
  const roasRaw = parseFloat(group.facebook?.metrics?.insights?.purchase_roas) || 0;
  const progress = Math.min((roasRaw / 10) * 100, 100);

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

  const [activeTab, setActiveTab] = useState("All Alerts");
  const [rawAlerts, setRawAlerts] = useState([]);
  const [query, setQuery] = useState("");

  const userCurrency = (() => {
    try { return localStorage.getItem("defaultCurrency") ?? "USD"; } catch { return "USD"; }
  })();
  const symbol = getSymbolFromCurrency(userCurrency) || "$";

  // ── Fetch alerts ────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const res = await apiRequest("/api/alerts");
        if (!res.ok) return;
        const data = await res.json();
        const all = [
          ...(data.active || []),
          ...(data.triggered || []),
          ...(data.paused || []),
        ];
        setRawAlerts(all);
      } catch {
        // non-critical
      }
    })();
  }, []);

  // ── Map DB shape → UI shape ─────────────────────────────────────────────────
  const alerts = useMemo(() => {
    return rawAlerts.map((alert) => ({
      id: alert.id,
      client: alert.name,
      platform: alert.condition?.platform ?? "Facebook",
      type:
        alert.status === "triggered"
          ? "performance"
          : alert.status === "active"
          ? "performance"
          : "client_wins",
      title: alert.metric_label,
      description:
        alert.last_eval_result?.message ??
        `${alert.metric_label ?? ""} ${alert.condition_display ?? ""} per ${alert.condition?.period ?? ""}`,
      color:
        alert.status === "triggered"
          ? "red"
          : alert.status === "active"
          ? "yellow"
          : "green",
    }));
  }, [rawAlerts]);

  // ── Delete alert ────────────────────────────────────────────────────────────
  const dismissAlert = async (id) => {
    try {
      const res = await apiRequest(`/api/alerts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRawAlerts((prev) => prev.filter((a) => a.id !== id));
        toast.success("Alert deleted");
      } else {
        toast.error("Failed to delete alert");
      }
    } catch {
      toast.error("Failed to delete alert");
    }
  };

  // ── Stats from real client data ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const activeClients = clientGroups.length;

    const totalSpend = clientGroups.reduce(
      (sum, g) => sum + (parseFloat(g.facebook?.metrics?.insights?.spend) || 0),
      0
    );

    const totalLeads = clientGroups.reduce(
      (sum, g) => sum + (parseInt(g.facebook?.metrics?.insights?.total_leads) || 0),
      0
    );

    const cplValues = clientGroups
      .map((g) => parseFloat(g.facebook?.metrics?.insights?.cost_per_result))
      .filter((v) => !isNaN(v) && v > 0);

    const averageCPL =
      cplValues.length > 0
        ? cplValues.reduce((a, b) => a + b, 0) / cplValues.length
        : 0;

    return { activeClients, totalSpend, totalLeads, averageCPL };
  }, [clientGroups]);

  const filteredAlerts = alerts.filter(TAB_FILTER[activeTab]);
  const handleClientClick = (group) => router.push(`/clients/${group.id}`);

  return (
    <div className="flex flex-col gap-8 w-full">

      {/* ── Welcome + AI Search ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to Birdy</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
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
        <h2 className="text-lg font-bold text-foreground mb-3">Action Required</h2>
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

        <div className="flex flex-col gap-2">
          {filteredAlerts.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10 bg-white border border-border/60 rounded-xl">
              No alerts in this category
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center gap-4 mb-4 p-4 rounded-lg shadow-sm border-l-4 ${ALERT_LEFT_BORDER[alert.color]}`}
              >
                <AlertIcon color={alert.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-purple-600">{alert.client}</span>
                    <Badge variant="outline" className="text-xs rounded-full px-2">{alert.platform}</Badge>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg h-8 px-4 text-xs"
                    onClick={() => {
                      const match = clientGroups.find((g) =>
                        (rawAlerts.find((r) => r.id === alert.id)?.target_group_ids || []).includes(g.id)
                      );
                      if (match) router.push(`/clients/${match.id}`);
                    }}
                  >
                    Open Client
                  </Button>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/60 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Clients Grid ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">Clients</h2>
          <Link href="/clients" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
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
              <ClientCard key={group.id} group={group} onClick={handleClientClick} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}