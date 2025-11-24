"use client";
import { saveToCache, getFromCache, clearCache } from "@/utils/cacheHelper"
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MdOutlineDisabledVisible } from "react-icons/md";

import {
  loadCustomMetrics,
  evaluateFormula,
  formatMetricValue,
} from "@/lib/metrics";
import {
  Search,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import metaa from "../../../public/meta-icon-DH8jUhnM.png";
import lab from "../../../public/lab.png";

const Campaigns = () => {
  const [customMetrics, setCustomMetrics] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
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
    campaigns: ["name", "clientGroup", "adAccount", "spend", "leads", "cpl", "impressions", "clicks"],
    adsets: ["name", "clientGroup", "adAccount", "spend", "leads", "cpl", "impressions", "clicks"],
    ads: ["name", "clientGroup", "adAccount", "spend", "leads", "cpl", "impressions", "clicks"],
    leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name", "clientGroup", "platform"],
  });

  // Load custom metrics
  useEffect(() => {
    const metrics = loadCustomMetrics().filter((m) => m.enabled && m.dashboard === "Campaign");
    setCustomMetrics(metrics);
  }, []);

  // Sync visibility when new custom metrics appear
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

  const enhanceWithCustomMetrics = (item) => {
    const base = { ...item };
    customMetrics.forEach((metric) => {
      if (metric.formulaParts) {
        base[metric.id] = evaluateFormula(metric.formulaParts, base);
      }
    });
    return base;
  };

 const fetchAllData = async () => {
  if (isLoading) return; // Prevent double-fetch

  setIsLoading(true);
  setError(null);
  setCampaigns([]);
  setAllAdSets([]);
  setAllAds([]);
  setLeads([]);

  const clientGroupsCache = getFromCache('clientGroups')  
  const cachedData = getFromCache('marketing-data') 
  if (clientGroupsCache) {
    setClientGroups(cachedData.clientGroups || []) 
    if (cachedData) {
      setCampaigns(cachedData.campaigns || [])
      setAllAdSets(cachedData.adSets || [])
      setAllAds(cachedData.ads || [])
      setLeads(cachedData.leads || [])
      setIsLoading(false)
      return
    }
  }



  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000); // 45s global timeout

  try {
    // Step 1: Fetch client groups (includes Meta ad account IDs)
    const groupsResponse = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
      credentials: "include",
      signal: controller.signal,
    });

    if (!groupsResponse.ok) throw new Error(`Failed to load client groups: ${groupsResponse.status}`);

    const { client_groups: clientGroupsData } = await groupsResponse.json();

    if (!clientGroupsData || clientGroupsData.length === 0) {
      setClientGroups([]);
      return;
    }

    setClientGroups(clientGroupsData);

    // Step 2: Prepare parallel fetch tasks
    const fetchTasks = clientGroupsData.map(async (group) => {
      const metaData = group.facebook || {};
      const adAccountId = metaData.ad_account_id;
      const clientGroupName = group.name;
      const adAccountName = metaData.name || "Unknown";

      if (!adAccountId) {
        return { group, campaigns: [], adsets: [], ads: [], leads: [] };
      }

      try {
        // Parallel: fetch account insights + leads at the same time
        const [accountRes, leadsRes] = await Promise.all([
          fetch(`https://birdy-backend.vercel.app/api/facebook/adaccounts/${adAccountId}/data`, {
            credentials: "include",
            signal: controller.signal,
          }).catch((err) => ({ ok: false, error: err })),

          fetch(`https://birdy-backend.vercel.app/api/facebook/adaccounts/${adAccountId}/leads`, {
            credentials: "include",
            signal: controller.signal,
          }).catch((err) => ({ ok: false, error: err })),
        ]);

        const accountData = accountRes.ok ? await accountRes.json() : null;
        const leadsData = leadsRes.ok ? await leadsRes.json() : { data: [] };

        if (!accountData?.data?.data) {
          console.warn(`No campaign data for account ${adAccountId}`);
          return { group, campaigns: [], adsets: [], ads: [], leads: leadsData.data || [] };
        }

        const campaigns = [];
        const adsets = [];
        const ads = [];
        const accountLeads = leadsData.data || [];

        // Process campaigns, adsets, ads
        for (const campaign of accountData.data.data) {
          const insights = campaign.insights?.data?.[0] || {};

          // Campaign-level
          campaigns.push(
            enhanceWithCustomMetrics({
              id: campaign.id,
              accountId: adAccountId,
              name: campaign.name || "Unknown Campaign",
              clientGroup: clientGroupName,
              adAccount: adAccountName,
              spend: parseFloat(insights.spend || "0"),
              leads: parseInt(insights.actions?.find(a => a.action_type === "onsite_conversion.lead_grouped")?.value || "0"),
              cpl: parseFloat(insights.cost_per_result?.find(r => r.indicator === "actions:onsite_conversion.lead_grouped")?.values?.[0]?.value || "0"),
              impressions: parseInt(insights.impressions || "0"),
              clicks: parseInt(insights.clicks || "0"),
              cpc: parseFloat(insights.cpc || "0"),
              reach: parseInt(insights.reach || "0"),
              frequency: parseFloat(insights.frequency || "0"),
              cpm: parseFloat(insights.cpm || "0"),
              ctr: parseFloat(insights.ctr || "0"),
            })
          );

          // Ad Sets
          for (const adset of campaign.adsets?.data || []) {
            const ai = adset.insights?.data?.[0] || {};
            const leadAction = ai.actions?.find(a => a.action_type === "onsite_conversion.lead_grouped") || {};
            const costPer = ai.cost_per_result?.find(r => r.indicator === "actions:onsite_conversion.lead_grouped") || {};

            adsets.push(
              enhanceWithCustomMetrics({
                id: adset.id,
                accountId: adAccountId,
                name: adset.name || "Unknown Ad Set",
                clientGroup: clientGroupName,
                adAccount: adAccountName,
                campaignName: campaign.name,
                spend: parseFloat(ai.spend || "0"),
                leads: parseInt(leadAction.value || "0"),
                cpl: parseFloat(costPer.values?.[0]?.value || "0"),
                impressions: parseInt(ai.impressions || "0"),
                clicks: parseInt(ai.clicks || "0"),
                cpc: parseFloat(ai.cpc || "0"),
                reach: parseInt(ai.reach || "0"),
                frequency: parseFloat(ai.frequency || "0"),
                cpm: parseFloat(ai.cpm || "0"),
                ctr: parseFloat(ai.ctr || "0"),
              })
            );
          }

          // Ads
          for (const ad of campaign.ads?.data || []) {
            const ai = ad.insights?.data?.[0] || {};
            const leadAction = ai.actions?.find(a => a.action_type === "onsite_conversion.lead_grouped") || {};
            const costPer = ai.cost_per_result?.find(r => r.indicator === "actions:onsite_conversion.lead_grouped") || {};

            ads.push(
              enhanceWithCustomMetrics({
                id: ad.id,
                accountId: adAccountId,
                name: ad.name || "Unknown Ad",
                clientGroup: clientGroupName,
                adAccount: adAccountName,
                campaignName: campaign.name,
                spend: parseFloat(ai.spend || "0"),
                leads: parseInt(leadAction.value || "0"),
                cpl: parseFloat(costPer.values?.[0]?.value || "0"),
                impressions: parseInt(ai.impressions || "0"),
                clicks: parseInt(ai.clicks || "0"),
                cpc: parseFloat(ai.cpc || "0"),
                reach: parseInt(ai.reach || "0"),
                frequency: parseFloat(ai.frequency || "0"),
                cpm: parseFloat(ai.cpm || "0"),
                ctr: parseFloat(ai.ctr || "0"),
              })
            );
          }
        }

        // Attach client group info to leads
        const enrichedLeads = accountLeads.map((lead) => ({
          ...lead,
          clientGroup: clientGroupName,
          adAccount: adAccountName,
        }));

        return { group, campaigns, adsets, ads, leads: enrichedLeads };
      } catch (err) {
        if (err.name === "AbortError") throw err;
        console.error(`Failed to load data for account ${adAccountId} (${clientGroupName}):`, err);
        return { group, campaigns: [], adsets: [], ads: [], leads: [], error: err.message };
      }
    });

    // Step 3: Execute all in parallel
    const results = await Promise.all(fetchTasks);

    // Step 4: Flatten results
    const allCampaigns = results.flatMap(r => r.campaigns);
    const allAdSets = results.flatMap(r => r.adsets);
    const allAds = results.flatMap(r => r.ads);
    const allLeads = results.flatMap(r => r.leads);
    
    saveToCache('marketing-data', {
      campaigns: allCampaigns,
      adSets: allAdSets,
      ads: allAds,
      leads: allLeads,
      clientGroups: clientGroupsData
    })

    setCampaigns(allCampaigns);
    setAllAdSets(allAdSets);
    setAllAds(allAds);
    setLeads(allLeads);

  } catch (err) {
    if (err.name === "AbortError") {
      setError("Request timed out. Please try again.");
    } else {
      setError(err.message || "Failed to load marketing data");
    }
    console.error("fetchAllData error:", err);
  } finally {
    clearTimeout(timeoutId);
    setIsLoading(false);
  }
};
useEffect(() => {
  const controller = new AbortController();

  fetchAllData();

  return () => controller.abort(); // Cleanup on unmount
}, []);

  // Filtering
  const applyFilters = (data) => {
    let filtered = [...data];
    const lower = searchTerm.toLowerCase();

    if (searchTerm) {
      filtered = filtered.filter((i) =>
        (i.name?.toLowerCase().includes(lower) ||
         i.businessName?.toLowerCase().includes(lower) ||
         i.clientGroup?.toLowerCase().includes(lower) ||
         i.adAccount?.toLowerCase().includes(lower) ||
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

  // Column handling
  const baseColumns = ["name", "clientGroup", "adAccount", "spend", "leads", "cpl", "impressions", "clicks", "cpc", "reach", "ctr"];
  const getAvailableColumns = () => {
    if (activeTab === "leads")
      return ["full_name", "email", "phone_number", "ad_name", "campaign_name", "clientGroup", "platform"];
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

  // Metrics cards
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

  // Cell formatter
  const formatCellValue = (value, col) => {
    if (value === null || value === undefined) return "-";
    if (customMetrics.some((m) => m.id === col)) return formatMetricValue(value, col);
    if (["spend", "cpl", "cpc", "cpm"].includes(col)) return `$${Number(value).toFixed(2)}`;
    if (col === "ctr") return `${Number(value).toFixed(2)}%`;
    if (typeof value === "number") return value.toLocaleString();
    return value;
  };

  // Filter UI helpers
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
          <div className="flex items-center gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border padding-4px rounded-lg py-1 px-1">
            <Input
              type="search"
              placeholder={`Search ${activeTab}...`}
              className="w-64 md:w-[320px]  h-10 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Button variant="outline" size="sm" onClick={addFilterCondition} className="gap-2 h-10 bg-white font-semibold">
                    <SlidersHorizontal className="h-4 w-4" />Add Filter
                  </Button>

                  <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-10 bg-white font-semibold">
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
            
        </div>

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
                <CardTitle className="text-sm text-[#71658B] font-medium">{c.label}</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <c.icon className="h-5 w-5 text-muted-foreground text-purple-500"/>
                </div>
                
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground">Across all {activeTab}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-13 item-center w-full justify-start  p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
            <TabsTrigger value="campaigns" className="gap-2
                  text-[#71658B] font-semibold 
                  hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white
                  data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm
                  data-[state=active]:border-r-0
                  data-[state=active]:rounded-md
                  data-[state=active]:border-b-2
                  data-[state=active]:border-b-purple-700">
                    <LayoutGrid className="h-4 w-4" />Campaigns</TabsTrigger>
            <TabsTrigger value="adsets" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white
                  data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm
                  data-[state=active]:border-r-0
                  data-[state=active]:rounded-md
                  data-[state=active]:border-b-2
                  data-[state=active]:border-b-purple-700">
                    <Grid3X3 className="h-4 w-4" />Ad Sets</TabsTrigger>
            <TabsTrigger value="ads" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white
                  data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm
                  data-[state=active]:border-r-0
                  data-[state=active]:rounded-md
                  data-[state=active]:border-b-2
                  data-[state=active]:border-b-purple-700">
                    <FileBarChart className="h-4 w-4" />Ads</TabsTrigger>
            <TabsTrigger value="leads" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white
                  data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm
                  data-[state=active]:border-r-0
                  data-[state=active]:rounded-md
                  data-[state=active]:border-b-2
                  data-[state=active]:border-b-purple-700">
                    <Users className="h-4 w-4" />Leads</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Filters */}
            <div className="flex flex-col gap-4 p-4 bg-card mb-6">
              <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                <div className="flex items-center gap-3 flex-1">
                  {(filterConditions.length > 0 || searchTerm) && (
                    <Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-2">
                      <X className="h-4 w-4" />Clear
                    </Button>
                  )}
                </div>                
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
                                <SelectItem value="clientGroup">Client Group</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="name">Name</SelectItem>
                                <SelectItem value="clientGroup">Client Group</SelectItem>
                                <SelectItem value="adAccount">Ad Account</SelectItem>
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
                    <thead className="bg-muted/50 border-b border-r whitespace-nowrap">
                      <tr>
                        {getCurrentVisibleColumns().map((col) => (
                          <th
                            key={col}
                            className="border-r px-4 py-3 text-left text-sm font-medium text-foreground "
                          >
                            <div className="flex items-center justify-between min-w-[200px]">
                              {/* Title */}
                              <span>
                                {customMetrics.find((m) => m.id === col)?.name ||
                                  col
                                    .split("_")
                                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                    .join(" ")}
                              </span>

                              {/* Conditional Icons - aligned to the right */}
                              {col === "clientGroup" && (
                                <img src={lab.src} alt="Lab" className="w-4 h-4 ml-2" />
                              )}
                              {col !== "name" && col !== "clientGroup" && (
                                <img src={metaa.src} alt="Meta" className="w-4 h-4 ml-2" />
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                    {getFilteredDataForTab().map((item, idx) => (
                      <tr
                        key={item.id || idx}
                        className="odd:bg-[#F4F3F9] even:bg-white hover:bg-muted/50 transition-colors whitespace-nowrap"
                      >
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
      </div>
    </div>
  );
};

export default Campaigns;