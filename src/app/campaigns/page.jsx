"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loadCustomMetrics,
  evaluateFormula,
  formatMetricValue,
  METRIC_ID_TO_DATA_KEY,
} from "@/lib/metrics";
import {
  Search,
  PlusCircle,
  SlidersHorizontal,
  LayoutGrid,
  Grid3X3,
  FileBarChart,
  Users,
  X,
  TrendingUp,
  DollarSign,
  Target,
  MousePointerClick,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const Campaigns = () => {
  const [customMetrics, setCustomMetrics] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [allAdSets, setAllAdSets] = useState([]);
  const [allAds, setAllAds] = useState([]);
  const [leads, setLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("campaigns");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterConditions, setFilterConditions] = useState([]);

  const [visibleColumns, setVisibleColumns] = useState({
    campaigns: ["name", "spend", "leads", "cpl", "impressions", "clicks"],
    adsets: ["name", "spend", "leads", "cpl", "impressions", "clicks"],
    ads: ["name", "spend", "leads", "cpl", "impressions", "clicks"],
    leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform"],
  });

  // Load custom metrics (Campaign dashboard only)
  useEffect(() => {
    const metrics = loadCustomMetrics().filter((m) => m.enabled && m.dashboard === "Campaign");
    setCustomMetrics(metrics);
  }, []);

  // ----- Sync visibility when new custom metrics appear -----
  useEffect(() => {
    const customIds = customMetrics.map((m) => m.id);
    setVisibleColumns((prev) => {
      const updated = { ...prev };
      ["campaigns", "adsets", "ads"].forEach((tab) => {
        const existing = new Set(updated[tab] || []);
        customIds.forEach((id) => {
          if (!existing.has(id)) {
            updated[tab] = [...updated[tab], id];
          }
        });
      });
      return updated;
    });
  }, [customMetrics]);

  // ----- Data fetching (unchanged except enhanceWithCustomMetrics) -----
  const enhanceWithCustomMetrics = (item) => {
    const base = { ...item };
    customMetrics.forEach((metric) => {
      if (metric.formulaParts) {
        base[metric.id] = evaluateFormula(metric.formulaParts, base);
      }
    });
    return base;
  };

  const fetchAdAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/facebook/adaccounts", {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAdAccounts(data.data.data.map((a) => ({ id: a.id, name: a.name })));
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccountData = async (accountId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://birdy-backend.vercel.app/api/facebook/adaccounts/${accountId}/data`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const mapItem = (raw) => {
        const insights = raw.insights?.data?.[0] || {};
        const leadAction = insights.actions?.find((a) => a.action_type === "onsite_conversion.lead_grouped") || {};
        const costPerResult =
          insights.cost_per_result?.find((r) => r.indicator === "actions:onsite_conversion.lead_grouped") || {};

        return enhanceWithCustomMetrics({
          id: raw.id || "unknown",
         	accountId,
          name: raw.name || "Unknown",
          businessName: insights.account_name || "Unknown",
          spend: Number.parseFloat(insights.spend || "0"),
          leads: Number.parseInt(leadAction.value || "0"),
          cpl: Number.parseFloat(costPerResult.values?.[0]?.value || "0"),
          impressions: Number.parseInt(insights.impressions || "0"),
          clicks: Number.parseInt(insights.clicks || "0"),
          cpc: Number.parseFloat(insights.cpc || "0"),
          reach: Number.parseInt(insights.reach || "0"),
          frequency: Number.parseFloat(insights.frequency || "0"),
          cpm: Number.parseFloat(insights.cpm || "0"),
          ctr: Number.parseFloat(insights.ctr || "0"),
        });
      };

      const campaignData = (data.data?.data || []).map(mapItem);
      const adSetData = (data.data?.data || []).flatMap((c) =>
        (c.adsets?.data || []).map(mapItem)
      );
      const adData = (data.data?.data || []).flatMap((c) =>
        (c.ads?.data || []).map(mapItem)
      );

      setCampaigns(campaignData);
      setAllAdSets(adSetData);
      setAllAds(adData);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeads = async (accountId) => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://birdy-backend.vercel.app/api/facebook/adaccounts/${accountId}/leads`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setLeads(data.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAdAccounts(); }, []);
  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountData(selectedAccountId);
      fetchLeads(selectedAccountId);
    } else {
      setCampaigns([]); setAllAdSets([]); setAllAds([]); setLeads([]);
    }
  }, [selectedAccountId]);

  // ----- Filtering -----
  const applyFilters = (data) => {
    let filtered = [...data];
    const lower = searchTerm.toLowerCase();

    if (searchTerm) {
      filtered = filtered.filter((i) =>
        (i.name?.toLowerCase().includes(lower) ||
         i.businessName?.toLowerCase().includes(lower) ||
         (activeTab === "leads" && (
           i.full_name?.toLowerCase().includes(lower) ||
           i.email?.toLowerCase().includes(lower) ||
           i.phone_number?.toLowerCase().includes(lower) ||
           i.ad_name?.toLowerCase().includes(lower) ||
           i.campaign_name?.toLowerCase().includes(lower)
         )))
      );
    }

    filterConditions.forEach((c) => {
      filtered = filtered.filter((i) => {
        const val = i[c.field];
        if (typeof val === "string") {
          if (c.operator === "equals") return val.toLowerCase() === String(c.value).toLowerCase();
          if (c.operator === "contains") return val.toLowerCase().includes(String(c.value).toLowerCase());
        } else if (typeof val === "number") {
          const n = Number(c.value);
          if (isNaN(n)) return true;
          if (c.operator === "equals") return val === n;
          if (c.operator === "greaterThan") return val > n;
          if (c.operator === "lessThan") return val < n;
        }
        return true;
      });
    });

    return filtered;
  };

  const getFilteredDataForTab = () => {
    if (activeTab === "campaigns") return applyFilters(campaigns);
    if (activeTab === "adsets") return applyFilters(allAdSets);
    if (activeTab === "ads") return applyFilters(allAds);
    if (activeTab === "leads") return applyFilters(leads);
    return [];
  };

  // ----- Column handling -----
  const baseColumns = ["name", "spend", "leads", "cpl", "impressions", "clicks", "cpc", "reach", "ctr"];
  const getAvailableColumns = () => {
    if (activeTab === "leads")
      return ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform"];
    return [...baseColumns, ...customMetrics.map((m) => m.id)];
  };

  const getCurrentVisibleColumns = () => visibleColumns[activeTab] || [];

  const toggleColumn = (col) => {
    setVisibleColumns((prev) => {
      const cur = prev[activeTab] || [];
      const updated = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col];
      return { ...prev, [activeTab]: updated };
    });
  };

  // ----- Metrics cards -----
  const calculateMetrics = () => {
    const data = getFilteredDataForTab();
    const totalSpend = data.reduce((s, i) => s + (i.spend || 0), 0);
    const totalLeads = data.reduce((s, i) => s + (i.leads || 0), 0);
    const totalClicks = data.reduce((s, i) => s + (i.clicks || 0), 0);
    const totalImpressions = data.reduce((s, i) => s + (i.impressions || 0), 0);
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    return { totalSpend, totalLeads, totalClicks, totalImpressions, avgCPL, avgCTR };
  };
  const metrics = calculateMetrics();

  // ----- Cell formatter -----
  const formatCellValue = (value, col) => {
    if (value === null || value === undefined) return "-";
    if (customMetrics.some((m) => m.id === col)) return formatMetricValue(value, col);
    if (["spend", "cpl", "cpc", "cpm"].includes(col)) return `$${Number(value).toFixed(2)}`;
    if (col === "ctr") return `${Number(value).toFixed(2)}%`;
    if (typeof value === "number") return value.toLocaleString();
    return value;
  };

  // ----- Filter UI helpers -----
  const addFilterCondition = () => {
    setFilterConditions((prev) => [
      ...prev,
      { field: activeTab === "leads" ? "full_name" : "name", operator: "contains", value: "" },
    ]);
  };
  const updateFilterCondition = (idx, field, val) => {
    setFilterConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  };
  const removeFilterCondition = (idx) => {
    setFilterConditions((prev) => prev.filter((_, i) => i !== idx));
  };
  const handleClearFilters = () => {
    setFilterConditions([]);
    setSearchTerm("");
  };

  return (
    <div className="min-h-dvh">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Marketing Hub</h1>
          </div>
          <Select value={selectedAccountId || ""} onValueChange={(v) => setSelectedAccountId(v || null)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select an ad account" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {adAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedAccountId && (
          <>
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total Spend", icon: DollarSign, value: `$${metrics.totalSpend.toFixed(2)}` },
                { label: "Total Leads", icon: Target, value: metrics.totalLeads },
                { label: "Avg CPL", icon: TrendingUp, value: `$${metrics.avgCPL.toFixed(2)}` },
                { label: "Avg CTR", icon: MousePointerClick, value: `${metrics.avgCTR.toFixed(2)}%` },
              ].map((c, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                    <c.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{c.value}</div>
                    <p className="text-xs text-muted-foreground">Across all {activeTab}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start bg-muted/100 p-1">
                <TabsTrigger value="campaigns" className="gap-2"><LayoutGrid className="h-4 w-4" />Campaigns</TabsTrigger>
                <TabsTrigger value="adsets" className="gap-2"><Grid3X3 className="h-4 w-4" />Ad Sets</TabsTrigger>
                <TabsTrigger value="ads" className="gap-2"><FileBarChart className="h-4 w-4" />Ads</TabsTrigger>
                <TabsTrigger value="leads" className="gap-2"><Users className="h-4 w-4" />Leads</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-6">
                {/* Filters */}
                <div className="flex flex-col gap-4 p-4 rounded-lg border bg-card mb-6">
                  <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="relative w-full md:w-auto max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="search"
                          placeholder={`Search ${activeTab}...`}
                          className="w-full md:w-[320px] pl-9"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={addFilterCondition} className="gap-2">
                        <SlidersHorizontal className="h-4 w-4" />Add Filter
                      </Button>
                      {(filterConditions.length > 0 || searchTerm) && (
                        <Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-2">
                          <X className="h-4 w-4" />Clear
                        </Button>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2">
                          <SlidersHorizontal className="h-4 w-4" />Columns
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 bg-white">
                        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {getAvailableColumns().map((col) => (
                          <DropdownMenuCheckboxItem
                            key={col}
                            checked={getCurrentVisibleColumns().includes(col)}
                            onCheckedChange={() => toggleColumn(col)}
                          >
                            {col.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Active Filters */}
                  {filterConditions.length > 0 && (
                    <div className="pt-4 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Active Filters</h3>
                        <Button variant="ghost" size="sm" onClick={() => setFilterConditions([])} className="h-8 text-xs">
                          Clear all
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {filterConditions.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                            <Select value={c.field} onValueChange={(v) => updateFilterCondition(idx, "field", v)}>
                              <SelectTrigger className="w-[160px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {activeTab === "leads" ? (
                                  <>
                                    <SelectItem value="full_name">Full Name</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone_number">Phone Number</SelectItem>
                                    <SelectItem value="ad_name">Ad Name</SelectItem>
                                    <SelectItem value="campaign_name">Campaign Name</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="spend">Spend</SelectItem>
                                    <SelectItem value="leads">Leads</SelectItem>
                                    <SelectItem value="cpl">CPL</SelectItem>
                                    <SelectItem value="clicks">Clicks</SelectItem>
                                    {customMetrics.map((m) => (
                                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>

                            <Select value={c.operator} onValueChange={(v) => updateFilterCondition(idx, "operator", v)}>
                              <SelectTrigger className="w-[140px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="greaterThan">Greater Than</SelectItem>
                                <SelectItem value="lessThan">Less Than</SelectItem>
                              </SelectContent>
                            </Select>

                            <Input
                              type="text"
                              placeholder="Value"
                              value={c.value}
                              onChange={(e) => updateFilterCondition(idx, "value", e.target.value)}
                              className="flex-1 h-9"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFilterCondition(idx)}
                              className="h-9 w-9 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Table */}
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
                    <p className="text-sm text-muted-foreground">Loading {activeTab}...</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                    <div className="rounded-full bg-destructive/10 p-3 mb-4"><X className="h-6 w-6 text-destructive" /></div>
                    <h3 className="text-lg font-semibold mb-2">Error loading data</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
                  </div>
                ) : getFilteredDataForTab().length > 0 ? (
                  <div className="rounded-lg border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            {getCurrentVisibleColumns().map((col) => (
                              <th key={col} className="px-4 py-3 text-left text-sm font-medium text-foreground">
                                {customMetrics.find((m) => m.id === col)?.name ||
                                  col
                                    .split("_")
                                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                    .join(" ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {getFilteredDataForTab().map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-muted/50 transition-colors">
                              {getCurrentVisibleColumns().map((col) => (
                                <td key={`${item.id}-${col}`} className="px-4 py-3 text-sm">
                                  {formatCellValue(item[col], col)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-16">
                    <div className="rounded-full bg-muted p-3 mb-4"><Search className="h-6 w-6 text-muted-foreground" /></div>
                    <h3 className="text-lg font-semibold mb-2">No results found</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                      No data matches your current filters. Try adjusting your search criteria.
                    </p>
                    {(filterConditions.length > 0 || searchTerm) && (
                      <Button variant="outline" size="sm" onClick={handleClearFilters}>Clear all filters</Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        {!selectedAccountId && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-12">
            <div className="rounded-full bg-white p-3 mb-4"><LayoutGrid className="h-6 w-6 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold mb-2">No ad account selected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Please select an ad account from the dropdown above to view your campaigns and analytics data
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Campaigns;