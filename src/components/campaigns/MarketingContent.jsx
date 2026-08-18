"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadCustomMetrics, evaluateFormula, formatMetricValue, setCustomMetricsCache } from "@/lib/metrics"
import { apiRequest } from "@/lib/api"
import { useColumnViews } from "@/lib/useColumnViews"
import {
  LayoutGrid,
  Grid3X3,
  FileBarChart,
  Users,
  X,
  TrendingUp,
  DollarSign,
  Target,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { metaIcon as metaa, flaskIcon as Flask, ghlIcon as ghlIco } from "@/lib/icons"
import { getMetricDisplayName, getCustomMetricById } from "@/lib/metrics"
import StyledTable from "@/components/ui/table-container"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import getSymbolFromCurrency from "currency-symbol-map"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

import { presetToStartEnd as getDateRangeFromPreset } from "@/lib/date-utils"
import { DrillDownBreadcrumb } from "@/components/campaigns/DrillDownBreadcrumb"
import { useCurrency } from "@/hooks/useCurrency"
import { DateRangeSelect } from "@/components/DateRangeSelect"

// The Marketing Hub is drawn on the design system in
// design_handoff_hubs/Birdy Style Guide.md — Poppins for headings and numerals,
// Inter for body, on the --pd-* tokens in globals.css. Both were already
// implemented for the Portfolio Dashboard, which came from the same handoff
// bundle, so this screen scopes the same fonts rather than declaring its own.
import { portfolioFontClass } from "@/app/dashboard/fonts"
import { CHART_LOADING, LoadingPulse, PdCard, StatTile, TrendChart } from "@/components/portfolio"
import { useMarketingHubData } from "@/components/campaigns/useMarketingHubData"
import { DATE_PRESETS } from "@/lib/constants"
import { Banknote, Eye, Megaphone, MousePointerClick } from "lucide-react"

// Which icon and colour family each KPI tile wears, from the handoff's tile
// table — except for spend. The design draws a pound sign, but this screen
// renders whatever currency the ad account reports, so a neutral note icon goes
// beside a figure that might be in dollars.
const MARKETING_KPI_PRESENTATION = {
  activeCampaigns: { icon: Megaphone, tone: "primary" },
  spend: { icon: Banknote, tone: "success" },
  leads: { icon: Users, tone: "info" },
  cpl: { icon: Target, tone: "amber" },
  impressions: { icon: Eye, tone: "info" },
  ctr: { icon: MousePointerClick, tone: "primary" },
}

// FIX: non-empty defaults so skeletons always have columns
export const DEFAULT_VISIBLE_COLUMNS = {
  campaigns: ["name", "spend", "results", "cpl", "impressions", "reach", "clicks", "ctr"],
  adsets: ["name", "spend", "results", "cpl", "impressions", "reach", "clicks", "ctr"],
  ads: ["name", "spend", "results", "cpl", "impressions", "reach", "clicks", "ctr"],
  leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform", "created_time", "group_name", "ghl_matched", "ghl_opportunity_status"],
}

// ── Main component ────────────────────────────────────────────────────────────
export function MarketingContent({
  clientGroups,
  groupsLoading,
  groupsError,
  datePreset,
  setDatePreset,
  showGroupFilter = true,
  showHeader = true,
  onCacheInvalidate,
}) {
  const { currency: userCurrency, currencySymbol } = useCurrency()

  const [customMetrics, setCustomMetrics] = useState([])
  const [selectedClientGroup, setSelectedClientGroup] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [allAdSets, setAllAdSets] = useState([])
  const [allAds, setAllAds] = useState([])
  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("campaigns")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterConditions, setFilterConditions] = useState([])

  // ── Drill-down state: each holds the full row object for name display ──────
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedAdSet, setSelectedAdSet] = useState(null)
  const [selectedAd, setSelectedAd] = useState(null)

  // ── Multi-row checkbox selection (per-tab) ────────────────────────────────
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(new Set())
  const [selectedAdSetIds, setSelectedAdSetIds] = useState(new Set())
  const [selectedAdIds, setSelectedAdIds] = useState(new Set())

  // ── Status toggle (Active ↔ Paused) ──────────────────────────────────────
  const [togglingRows, setTogglingRows] = useState(new Set())

  const handleStatusToggle = async (objectId, currentStatus) => {
    const newStatus = String(currentStatus).toLowerCase() === "active" ? "PAUSED" : "ACTIVE"
    const objectType = activeTab === "campaigns" ? "campaign" : activeTab === "adsets" ? "adset" : "ad"

    // Optimistic UI update
    setTogglingRows(prev => new Set(prev).add(objectId))
    const updateState = (setter) => setter(prev => prev.map(item =>
      item.id === objectId ? { ...item, status: newStatus.toLowerCase() } : item
    ))
    if (activeTab === "campaigns") updateState(setCampaigns)
    else if (activeTab === "adsets") updateState(setAllAdSets)
    else if (activeTab === "ads") updateState(setAllAds)

    try {
      const res = await apiRequest("/api/facebook/update-status", {
        method: "POST",
        body: JSON.stringify({ object_id: objectId, object_type: objectType, status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to update status")
      }
      toast.success(`${objectType.charAt(0).toUpperCase() + objectType.slice(1)} ${newStatus === "ACTIVE" ? "activated" : "paused"}`)
      onCacheInvalidate?.()
    } catch (err) {
      // Revert on error
      const revertStatus = newStatus === "ACTIVE" ? "paused" : "active"
      const revertState = (setter) => setter(prev => prev.map(item =>
        item.id === objectId ? { ...item, status: revertStatus } : item
      ))
      if (activeTab === "campaigns") revertState(setCampaigns)
      else if (activeTab === "adsets") revertState(setAllAdSets)
      else if (activeTab === "ads") revertState(setAllAds)
      toast.error(err.message || "Failed to update status")
    } finally {
      setTogglingRows(prev => {
        const next = new Set(prev)
        next.delete(objectId)
        return next
      })
    }
  }

  // One stable hook instance per tab — page keys never change between renders,
  // so hook call order is always the same (Rules of Hooks satisfied).
  const { savedColumns: savedCampaigns, saveView: saveCampaigns, saveViewDebounced: saveCampaignsDebounced, viewsLoaded: loadedCampaigns } = useColumnViews("mktg_campaigns")
  const { savedColumns: savedAdsets,    saveView: saveAdsets,    saveViewDebounced: saveAdsetsDebounced,    viewsLoaded: loadedAdsets    } = useColumnViews("mktg_adsets")
  const { savedColumns: savedAds,       saveView: saveAds,       saveViewDebounced: saveAdsDebounced,       viewsLoaded: loadedAds       } = useColumnViews("mktg_ads")
  const { savedColumns: savedLeads,     saveView: saveLeads,     saveViewDebounced: saveLeadsDebounced,     viewsLoaded: loadedLeads     } = useColumnViews("mktg_leads")

  // Per-tab debounced-save lookup, used by the table's onColumnOrderChange to
  // auto-persist drag-reorder events without needing a manual "Save View".
  const saveDebouncedByTab = {
    campaigns: saveCampaignsDebounced,
    adsets:    saveAdsetsDebounced,
    ads:       saveAdsDebounced,
    leads:     saveLeadsDebounced,
  }

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS)

  // ── Track which tabs have been hydrated from the server ───────────────────
  // This prevents the custom-metrics append effect from stomping over a saved
  // view that was just loaded from the DB.
  const [hydratedTabs, setHydratedTabs] = useState(new Set())

  // Hydrate each tab independently — stable deps, no dynamic array size
  useEffect(() => {
    if (!loadedCampaigns) return
    if (savedCampaigns) {
      setVisibleColumns(prev => ({ ...prev, campaigns: savedCampaigns }))
    }
    // Mark as hydrated regardless — even if savedCampaigns is null (no saved
    // view), we still don't want the auto-append to run after the fact.
    setHydratedTabs(prev => new Set(prev).add("campaigns"))
  }, [loadedCampaigns, savedCampaigns])

  useEffect(() => {
    if (!loadedAdsets) return
    if (savedAdsets) {
      setVisibleColumns(prev => ({ ...prev, adsets: savedAdsets }))
    }
    setHydratedTabs(prev => new Set(prev).add("adsets"))
  }, [loadedAdsets, savedAdsets])

  useEffect(() => {
    if (!loadedAds) return
    if (savedAds) {
      setVisibleColumns(prev => ({ ...prev, ads: savedAds }))
    }
    setHydratedTabs(prev => new Set(prev).add("ads"))
  }, [loadedAds, savedAds])

  useEffect(() => {
    if (!loadedLeads || !savedLeads) return
    setVisibleColumns(prev => ({ ...prev, leads: savedLeads }))
  }, [loadedLeads, savedLeads])

  const [columnsOpen, setColumnsOpen] = useState(false)
  const [gridOpen, setGridOpen] = useState(false)
  const [groupSearch, setGroupSearch] = useState("")
  const gridRef = useRef(null)
  const [columnsSearch, setColumnsSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // ── Custom metrics (load from API) ─────────────────────────────────────────
  const [metricsLoaded, setMetricsLoaded] = useState(false)
  useEffect(() => {
    apiRequest("/api/custom-metrics").then(async res => {
      if (!res.ok) { setMetricsLoaded(true); return }
      const data = await res.json()
      const all = (data.custom_metrics || []).map(m => ({
        id: m.id, name: m.name, description: m.description || "",
        source: "Custom Formula", dashboard: (m.dashboards || []).join(", "),
        dashboards: m.dashboards || [], formula: m.formula_display || "",
        formulaParts: m.formula_parts || [], formatType: m.format_type || "integer",
        displayOnDashboard: true, category: "custom", enabled: true,
      }))
      setCustomMetricsCache(all)
      setCustomMetrics(all.filter(m =>
        m.dashboards?.some(d => ["campaigns", "adsets", "ads", "marketing_leads"].includes(d)) ||
        m.dashboard === "Campaigns"
      ))
      setMetricsLoaded(true)
    }).catch(() => setMetricsLoaded(true))
  }, [])

  // ── Tag rollup data for campaign/adset/ad level ──────────────────────────
  const [tagRollup, setTagRollup] = useState({ by_campaign: {}, by_adset: {}, by_ad: {} })
  const [availableTags, setAvailableTags] = useState([])

  useEffect(() => {
    if (!clientGroups?.length) return
    const groupIds = clientGroups.map(g => g.id).join(",")
    apiRequest(`/api/campaigns/tag-rollup?groups=${groupIds}`).then(async res => {
      if (!res.ok) return
      const data = await res.json()
      setTagRollup(data)
      // Discover all unique tags from the rollup data
      const allTags = new Set()
      for (const tags of Object.values(data.by_campaign || {})) for (const t of Object.keys(tags)) allTags.add(t)
      for (const tags of Object.values(data.by_adset || {})) for (const t of Object.keys(tags)) allTags.add(t)
      for (const tags of Object.values(data.by_ad || {})) for (const t of Object.keys(tags)) allTags.add(t)
      setAvailableTags([...allTags].sort())
    }).catch(() => {})
  }, [clientGroups])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gridRef.current && !gridRef.current.contains(e.target)) {
        setGridOpen(false)
        setGroupSearch("")
      }
    }
    if (gridOpen) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [gridOpen])

  // ── GHL opportunity attribution per campaign/adset/ad ────────────────────
  // Drives the GHL columns (won/lost/open/abandoned/total/revenue/contacts)
  // by walking each lead's GHL match in the selected date range. Recomputes
  // whenever the date preset changes so the columns track the leads tab.
  const [oppRollup, setOppRollup] = useState({ by_campaign: {}, by_adset: {}, by_ad: {} })

  useEffect(() => {
    if (!clientGroups?.length) {
      setOppRollup({ by_campaign: {}, by_adset: {}, by_ad: {} })
      return
    }
    const groupIds = clientGroups.map(g => g.id).join(",")
    const { start, end } = getDateRangeFromPreset(datePreset)
    apiRequest(
      `/api/campaigns/opp-rollup?groups=${groupIds}&start_date=${start}&end_date=${end}`
    ).then(async res => {
      if (!res.ok) return
      const data = await res.json()
      setOppRollup({
        by_campaign: data.by_campaign || {},
        by_adset: data.by_adset || {},
        by_ad: data.by_ad || {},
      })
    }).catch(() => {})
  }, [clientGroups, datePreset])

  // ── Append custom metric IDs only for tabs that have NOT been hydrated ────
  // If a tab was loaded from the DB, the user's saved columns already include
  // whichever custom metrics they want — don't append anything.
  // If a tab has no saved view, auto-append so new custom metrics are visible.
  useEffect(() => {
    const ids = customMetrics.map(m => m.id)
    if (!ids.length) return
    setVisibleColumns(prev => {
      const updated = { ...prev }
      ;["campaigns", "adsets", "ads"].forEach(tab => {
        // Skip tabs already hydrated from the server — their columns are
        // exactly what the user saved and must not be modified.
        if (hydratedTabs.has(tab)) return
        const existing = new Set(updated[tab] || [])
        ids.forEach(id => { if (!existing.has(id)) updated[tab] = [...(updated[tab] || []), id] })
      })
      return updated
    })
  }, [customMetrics, hydratedTabs])

  // ── Process client groups from props into campaigns/adsets/ads ─────────────
  // NOTE: This processes BASE data only. Custom metrics are applied separately
  // via useMemo below to avoid race conditions with the async metrics API.
  useEffect(() => {
    if (groupsLoading) return

    if (!clientGroups.length) {
      setCampaigns([]); setAllAdSets([]); setAllAds([])
      return
    }

    const processedCampaigns = []
    const processedAdsets = []
    const processedAds = []

    // GHL columns come from oppRollup — per-row, attributed via Meta leads →
    // GHL contacts → opportunities. Group-level totals would duplicate the
    // sub-account total onto every row (which was the old bug).
    const ghlFor = (rollup, id) => {
      const b = rollup?.[id] || {}
      return {
        ghl_contacts: b.contacts || 0,
        ghl_revenue: b.revenue || 0,
        ghl_won_opps: b.won || 0,
        ghl_lost_opps: b.lost || 0,
        ghl_open_opps: b.open || 0,
        ghl_abandoned_opps: b.abandoned || 0,
        ghl_total_opps: b.total || 0,
      }
    }

    for (const group of clientGroups) {
      const fb = group.facebook || {}
      const groupMeta = {
        _groupId: group.id,
        clientGroup: group.name,
        adAccount: fb.ad_account_id || "",
        account_currency: fb.currency || "USD",
        meta_spend: fb.metrics?.insights?.spend || 0,
        meta_impressions: fb.metrics?.insights?.impressions || 0,
        meta_clicks: fb.metrics?.insights?.clicks || 0,
        meta_reach: fb.metrics?.insights?.reach || 0,
        meta_results: fb.metrics?.insights?.results || 0,
        meta_leads: fb.metrics?.insights?.results || fb.metrics?.insights?.total_leads || 0,
      }

      for (const c of (fb.campaigns || [])) {
        const cResults = c.results || 0
        const cSpend = c.spend || 0
        const cClicks = c.clicks || 0
        processedCampaigns.push({
          ...groupMeta,
          ...ghlFor(oppRollup.by_campaign, c.id),
          id: c.id, name: c.name,
          status: (c.status || "inactive").toLowerCase(),
          spend: cSpend, impressions: c.impressions || 0, clicks: cClicks,
          reach: c.reach || 0, leads: cResults, results: cResults,
          cpl: cResults > 0 ? cSpend / cResults : 0,
          cost_per_result: cResults > 0 ? cSpend / cResults : 0,
          conversion_rate: cClicks > 0 ? (cResults / cClicks * 100) : 0,
          ctr: c.ctr || 0, cpc: c.cpc || 0, cpm: c.cpm || 0,
          cpp: c.reach > 0 ? cSpend / c.reach : 0,
          frequency: c.reach > 0 ? c.impressions / c.reach : 0,
        })
      }

      for (const a of (fb.adsets || [])) {
        const aResults = a.results || 0
        const aSpend = a.spend || 0
        const aClicks = a.clicks || 0
        processedAdsets.push({
          ...groupMeta,
          ...ghlFor(oppRollup.by_adset, a.id),
          id: a.id, name: a.name,
          status: (a.status || "inactive").toLowerCase(),
          _campaignId: a.campaign_id || "", campaign_name: a.campaign_id || "",
          spend: aSpend, impressions: a.impressions || 0, clicks: aClicks,
          reach: a.reach || 0, leads: aResults, results: aResults,
          cpl: aResults > 0 ? aSpend / aResults : 0,
          cost_per_result: aResults > 0 ? aSpend / aResults : 0,
          conversion_rate: aClicks > 0 ? (aResults / aClicks * 100) : 0,
          ctr: a.ctr || 0, cpc: a.cpc || 0, cpm: a.cpm || 0,
          cpp: a.reach > 0 ? aSpend / a.reach : 0,
          frequency: a.reach > 0 ? a.impressions / a.reach : 0,
        })
      }

      for (const ad of (fb.ads || [])) {
        const adResults = ad.results || 0
        const adSpend = ad.spend || 0
        const adClicks = ad.clicks || 0
        processedAds.push({
          ...groupMeta,
          ...ghlFor(oppRollup.by_ad, ad.id),
          id: ad.id, name: ad.name,
          status: (ad.status || "inactive").toLowerCase(),
          _campaignId: ad.campaign_id || "", _adsetId: ad.adset_id || "",
          campaign_name: ad.campaign_id || "",
          spend: adSpend, impressions: ad.impressions || 0, clicks: adClicks,
          reach: ad.reach || 0, leads: adResults, results: adResults,
          cpl: adResults > 0 ? adSpend / adResults : 0,
          cost_per_result: adResults > 0 ? adSpend / adResults : 0,
          conversion_rate: adClicks > 0 ? (adResults / adClicks * 100) : 0,
          ctr: ad.ctr || 0, cpc: ad.cpc || 0, cpm: ad.cpm || 0,
          cpp: ad.reach > 0 ? adSpend / ad.reach : 0,
          frequency: ad.reach > 0 ? ad.impressions / ad.reach : 0,
        })
      }
    }

    setCampaigns(processedCampaigns)
    setAllAdSets(processedAdsets)
    setAllAds(processedAds)
  }, [clientGroups, groupsLoading, oppRollup])

  // ── Apply custom metrics as a SEPARATE reactive layer ─────────────────────
  // This useMemo recomputes whenever campaigns or customMetrics change,
  // so custom metric values appear as soon as the API responds — no race condition.
  const enhancedCampaigns = useMemo(() => {
    const source = campaigns
    return source.map(item => {
      const row = { ...item }
      if (customMetrics.length) {
        customMetrics.forEach(m => { if (m.formulaParts) row[m.id] = evaluateFormula(m.formulaParts, row) })
      }
      // Sanitize all Infinity/NaN values
      Object.keys(row).forEach(key => {
        const val = row[key]
        if (typeof val === "number" && (!isFinite(val) || isNaN(val))) {
          row[key] = null
        }
      })
      return row
    })
  }, [campaigns, customMetrics])

  const enhancedAdSets = useMemo(() => {
    return allAdSets.map(item => {
      const row = { ...item }
      if (customMetrics.length) {
        customMetrics.forEach(m => { if (m.formulaParts) row[m.id] = evaluateFormula(m.formulaParts, row) })
      }
      Object.keys(row).forEach(key => {
        const val = row[key]
        if (typeof val === "number" && (!isFinite(val) || isNaN(val))) {
          row[key] = null
        }
      })
      return row
    })
  }, [allAdSets, customMetrics])

  const enhancedAds = useMemo(() => {
    return allAds.map(item => {
      const row = { ...item }
      if (customMetrics.length) {
        customMetrics.forEach(m => { if (m.formulaParts) row[m.id] = evaluateFormula(m.formulaParts, row) })
      }
      Object.keys(row).forEach(key => {
        const val = row[key]
        if (typeof val === "number" && (!isFinite(val) || isNaN(val))) {
          row[key] = null
        }
      })
      return row
    })
  }, [allAds, customMetrics])

  // ── Leads fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (groupsLoading || !clientGroups.length) {
      setLeads([])
      if (!groupsLoading) setIsLoading(false)
      return
    }

    const ctrl = new AbortController()
    setIsLoading(true)
    setError(null)

    const fetchLeads = async () => {
      try {
        const groupIds = clientGroups.map(g => g.id).join(",")
        const { start, end } = getDateRangeFromPreset(datePreset)
        const leadsRes = await apiRequest(
          `/api/facebook-leads/filtered?groups=${groupIds}&limit=5000&start_date=${start}&end_date=${end}`,
          { signal: ctrl.signal }
        )
        const leadsData = leadsRes.ok ? await leadsRes.json() : { leads: [] }
        setLeads(leadsData.leads || [])
      } catch (err) {
        if (err.name === "AbortError") return
        console.error("fetchLeads error:", err)
        setError(err.message || "Failed to load leads data")
      } finally {
        if (!ctrl.signal.aborted) setIsLoading(false)
      }
    }

    fetchLeads()
    return () => ctrl.abort()
  }, [clientGroups, groupsLoading, datePreset])

  // ── Drill-down row-click handler ──────────────────────────────────────────
  // Clicking a campaign row selects it, clears downstream, and advances the tab.
  // Same pattern for adsets and ads.
  const handleRowClick = (row) => {
    if (activeTab === "campaigns") {
      setSelectedCampaign(row)
      setSelectedAdSet(null)
      setSelectedAd(null)
      setActiveTab("adsets")
    } else if (activeTab === "adsets") {
      setSelectedAdSet(row)
      setSelectedAd(null)
      setActiveTab("ads")
    } else if (activeTab === "ads") {
      setSelectedAd(row)
      setActiveTab("leads")
    }
    // leads tab: no further drill-down
  }

  // Clear handlers — each clears from that level downward
  const clearCampaign = () => { setSelectedCampaign(null); setSelectedAdSet(null); setSelectedAd(null); setSelectedCampaignIds(new Set()); setSelectedAdSetIds(new Set()); setSelectedAdIds(new Set()) }
  const clearAdSet = () => { setSelectedAdSet(null); setSelectedAd(null); setSelectedAdSetIds(new Set()); setSelectedAdIds(new Set()) }
  const clearAd = () => { setSelectedAd(null); setSelectedAdIds(new Set()) }

  // ── Filtering ─────────────────────────────────────────────────────────────
  // const isAllZerosRow = (item) => {
  //   if (activeTab === "leads") return false
  //   const fields = ["spend", "impressions", "clicks", "reach", "leads", "ctr", "cpc", "cpm", "cpp", "frequency"]
  //   return !fields.some(f => { const v = item[f]; return v !== undefined && v !== null && Number(v) !== 0 })
  // }

  const applyFilters = (data) => {
    let filtered = [...data]

    // Client group
    if (selectedClientGroup && selectedClientGroup !== "all") {
      if (activeTab === "leads") {
        const grp = clientGroups.find(g => g.id === selectedClientGroup)
        if (grp) filtered = filtered.filter(i => i.group_name === grp.name)
      } else {
        filtered = filtered.filter(i => i._groupId === selectedClientGroup)
      }
    }

    // ── Drill-down filters ─────────────────────────────────────────────────
    // Multi-select (checkboxes) takes priority over single drill-down click
    if (activeTab === "adsets") {
      if (selectedCampaignIds.size > 0) {
        filtered = filtered.filter(i => selectedCampaignIds.has(i._campaignId))
      } else if (selectedCampaign) {
        filtered = filtered.filter(i => i._campaignId === selectedCampaign.id)
      }
    }

    if (activeTab === "ads") {
      if (selectedAdSetIds.size > 0) {
        filtered = filtered.filter(i => selectedAdSetIds.has(i._adsetId))
      } else if (selectedAdSet) {
        filtered = filtered.filter(i => i._adsetId === selectedAdSet.id)
      } else if (selectedCampaignIds.size > 0) {
        filtered = filtered.filter(i => selectedCampaignIds.has(i._campaignId))
      } else if (selectedCampaign) {
        filtered = filtered.filter(i => i._campaignId === selectedCampaign.id)
      }
    }

    if (activeTab === "leads") {
      if (selectedAdIds.size > 0) {
        const adObjs = allAds.filter(a => selectedAdIds.has(a.id))
        filtered = filtered.filter(i =>
          adObjs.some(ad => i.ad_id === ad.id || i.ad_name === ad.name)
        )
      } else if (selectedAd) {
        filtered = filtered.filter(i =>
          i.ad_id === selectedAd.id || i.ad_name === selectedAd.name
        )
      } else if (selectedAdSetIds.size > 0) {
        const adsetObjs = allAdSets.filter(a => selectedAdSetIds.has(a.id))
        filtered = filtered.filter(i =>
          adsetObjs.some(as => i.adset_id === as.id || i.adset_name === as.name)
        )
      } else if (selectedAdSet) {
        filtered = filtered.filter(i =>
          i.adset_id === selectedAdSet.id || i.adset_name === selectedAdSet.name
        )
      } else if (selectedCampaignIds.size > 0) {
        const campObjs = campaigns.filter(c => selectedCampaignIds.has(c.id))
        filtered = filtered.filter(i =>
          campObjs.some(c => i.campaign_id === c.id || i.campaign_name === c.name)
        )
      } else if (selectedCampaign) {
        filtered = filtered.filter(i =>
          i.campaign_id === selectedCampaign.id || i.campaign_name === selectedCampaign.name
        )
      }
    }

    // Search term
    const lower = searchTerm.toLowerCase()
    if (searchTerm) {
      filtered = filtered.filter(i => {
        const leadName = i.full_name || i.field_data?.["full name"] || i.field_data?.full_name ||
          i.fullName || i.name || `${i.first_name || ""} ${i.last_name || ""}`.trim() || ""
        return i.name?.toLowerCase().includes(lower) ||
          i.clientGroup?.toLowerCase().includes(lower) ||
          i.adAccount?.toLowerCase().includes(lower) ||
          (activeTab === "leads" && (
            leadName.toLowerCase().includes(lower) ||
            i.email?.toLowerCase().includes(lower) ||
            i.phone_number?.toLowerCase().includes(lower) ||
            i.ad_name?.toLowerCase().includes(lower) ||
            i.adset_name?.toLowerCase().includes(lower) ||
            i.campaign_name?.toLowerCase().includes(lower) ||
            i.group_name?.toLowerCase().includes(lower) ||
            i.platform?.toLowerCase().includes(lower)
          ))
      })
    }

    // Advanced filter conditions
    filterConditions.forEach(c => {
      filtered = filtered.filter(i => {
        let val = i[c.field]
        if (c.field === "full_name") {
          val = i.full_name || i.field_data?.["full name"] || i.field_data?.full_name ||
            i.fullName || i.name || `${i.first_name || ""} ${i.last_name || ""}`.trim() || ""
        }
        if (typeof val === "string") {
          if (c.operator === "equals") return val.toLowerCase() === String(c.value).toLowerCase()
          if (c.operator === "contains") return val.toLowerCase().includes(String(c.value).toLowerCase())
        } else if (typeof val === "number") {
          const n = Number(c.value)
          if (isNaN(n)) return true
          if (c.operator === "equals") return val === n
          if (c.operator === "greaterThan") return val > n
          if (c.operator === "lessThan") return val < n
        }
        return true
      })
    })

    return filtered
  }

  const getFilteredDataForTab = () => {
    if (activeTab === "campaigns") return applyFilters(enhancedCampaigns)
    if (activeTab === "adsets") return applyFilters(enhancedAdSets)
    if (activeTab === "ads") return applyFilters(enhancedAds)
    if (activeTab === "leads") return applyFilters(leads)
    return []
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const metaColumns = [
    "adAccount", "spend", "results", "cpl", "cost_per_result", "conversion_rate",
    "social_spend", "impressions", "clicks",
    "cpc", "cpp", "reach", "ctr", "cpm", "frequency",
    "conversion_rate_ranking", "account_currency",
  ]
  const ghlColumns = [
    "ghl_contacts", "ghl_revenue", "ghl_won_opps", "ghl_lost_opps",
    "ghl_open_opps", "ghl_abandoned_opps", "ghl_total_opps",
  ]
  const baseColumns = [...metaColumns, ...ghlColumns]

  // Map Marketing Hub tab → dashboard key for filtering custom metrics
  const TAB_TO_DASHBOARD = { campaigns: "campaigns", adsets: "adsets", ads: "ads", leads: "marketing_leads" }
  const tabDashboardKey = TAB_TO_DASHBOARD[activeTab] || "campaigns"
  const activeTabMetrics = customMetrics.filter(m =>
    m.dashboards?.includes(tabDashboardKey) || m.dashboard === "Campaigns"
  )

  // ── Deduplicated tag columns ───────────────────────────────────────────────
  const { tagColumnIds, dedupedTags } = useMemo(() => {
    const seen = new Set()
    const ids = []
    const tags = []
    for (const t of availableTags) {
      const id = `tag_${t.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`
      if (!seen.has(id)) {
        seen.add(id)
        ids.push(id)
        tags.push(t)
      }
    }
    return { tagColumnIds: ids, dedupedTags: tags }
  }, [availableTags])

  const getAvailableColumns = () =>
    activeTab === "leads"
      ? ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform", "created_time", "group_name",
         "ghl_matched", "ghl_opportunity_status", "ghl_opportunity_value", "ghl_tags"]
      : ["name", "clientGroup", ...baseColumns, ...tagColumnIds, ...activeTabMetrics.map(m => m.id)]

  const categories = [{ id: "all", label: "All" }, { id: "meta", label: "Meta" }, { id: "ghl", label: "GHL" }, { id: "tags", label: "Tags" }, { id: "custom", label: "Custom" }]
  const toggleableColumns = getAvailableColumns().filter(col => col !== "name")
  const metaColCount = toggleableColumns.filter(col => metaColumns.includes(col)).length
  const ghlColCount = toggleableColumns.filter(col => ghlColumns.includes(col)).length
  const tagsCount = toggleableColumns.filter(col => tagColumnIds.includes(col)).length
  const customCount = toggleableColumns.length - metaColCount - ghlColCount - tagsCount
  const categoryCounts = { all: toggleableColumns.length, meta: metaColCount, ghl: ghlColCount, tags: tagsCount, custom: customCount }

  const getColType = (col) => {
    if (metaColumns.includes(col)) return "meta"
    if (ghlColumns.includes(col) || col.startsWith("ghl_")) return "ghl"
    if (tagColumnIds.includes(col)) return "tags"
    // Leads tab: Meta-sourced columns
    if (["ad_name", "adset_name", "campaign_name", "platform", "created_time"].includes(col)) return "meta"
    if (customMetrics.some(m => m.id === col)) return "custom"
    return "meta"
  }

  const allColumnsForDropdown = toggleableColumns.map(col => {
    const customMatch = customMetrics.find(m => m.id === col)
    return {
      id: col,
      label: tagColumnIds.includes(col)
        ? `Tag: ${dedupedTags[tagColumnIds.indexOf(col)] || col}`
        : customMatch ? customMatch.name : getMetricDisplayName(col),
      visible: (visibleColumns[activeTab] || []).includes(col),
      type: getColType(col),
    }
  })

  const filteredColumns = allColumnsForDropdown.filter(col =>
    (selectedCategory === "all" || col.type === selectedCategory) &&
    col.label.toLowerCase().includes(columnsSearch.toLowerCase())
  )

  const getCurrentVisibleColumns = () => visibleColumns[activeTab] || DEFAULT_VISIBLE_COLUMNS[activeTab]
  const columnVisibility = Object.fromEntries(getCurrentVisibleColumns().map(col => [col, true]))

  const toggleColumn = (col) => {
    setVisibleColumns(prev => {
      const cur = prev[activeTab] || DEFAULT_VISIBLE_COLUMNS[activeTab]
      const updated = cur.includes(col) ? cur.filter(c => c !== col) : [...cur, col]
      return { ...prev, [activeTab]: updated }
    })
  }

  const selectAll = () => setVisibleColumns(prev => ({ ...prev, [activeTab]: getAvailableColumns() }))
  const clearAll = () => setVisibleColumns(prev => ({ ...prev, [activeTab]: activeTab === "leads" ? [] : ["name"] }))

  // Dispatch to the correct per-tab saver
  const saveView = async () => {
    const cols = visibleColumns[activeTab]
    if (activeTab === "campaigns") await saveCampaigns(cols)
    else if (activeTab === "adsets")  await saveAdsets(cols)
    else if (activeTab === "ads")     await saveAds(cols)
    else if (activeTab === "leads")   await saveLeads(cols)
    setColumnsOpen(false)
  }

  const getIcon = (col) => {
    if (col.id === "clientGroup" || col.id === "name") return null
    // GHL metrics (opp stats, contacts, revenue, tags)
    if (col.id.startsWith("ghl_") || col.id.startsWith("tag_")) return ghlIco
    // Custom formula metrics
    if (customMetrics.some(m => m.id === col.id)) return Flask
    // Everything else is Meta
    return metaa
  }

  const formatCellValue = (value, col, row) => {
    // Tag rollup columns — look up count from tagRollup data
    if (typeof value === "number" && (!isFinite(value) || isNaN(value))) return "-"

    if (tagColumnIds.includes(col)) {
      const tagIdx = tagColumnIds.indexOf(col)
      const tagName = dedupedTags[tagIdx]
      if (!tagName) return "-"
      let rollupMap = {}
      if (activeTab === "campaigns") rollupMap = tagRollup.by_campaign?.[row?.id] || {}
      else if (activeTab === "adsets") rollupMap = tagRollup.by_adset?.[row?.name] || {}
      else if (activeTab === "ads") rollupMap = tagRollup.by_ad?.[row?.id] || {}

      const count = rollupMap[tagName]
      return count ? count.toLocaleString() : "-"
    }
    // GHL enrichment columns on Meta leads tab
    if (col === "ghl_matched") return value ? "✅" : "–"
    if (col === "ghl_opportunity_status") {
      if (!value) return "–"
      const colors = { won: "text-green-600 bg-green-50", lost: "text-red-600 bg-red-50", open: "text-blue-600 bg-blue-50", abandoned: "text-gray-600 bg-gray-50" }
      return <span className={`${colors[value] || ""} px-2 py-0.5 rounded-full text-xs font-medium capitalize`}>{value}</span>
    }
    if (col === "ghl_opportunity_value") return value ? `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(0)}` : "–"
    if (col === "ghl_tags") {
      if (!value || !Array.isArray(value) || value.length === 0) return "–"
      return value.slice(0, 2).join(", ") + (value.length > 2 ? ` +${value.length - 2}` : "")
    }
    if (col === "full_name") {
      value = value || row?.field_data?.["full name"] || row?.field_data?.full_name ||
        row?.full_name || row?.fullName || row?.name ||
        (row?.first_name || row?.last_name ? `${row?.first_name || ""} ${row?.last_name || ""}`.trim() : null)
    }
    if (value === null || value === undefined || value === "") return "-"
    const customMatch = customMetrics.find(m => m.id === col)
    if (customMatch) {
      const fmt = customMatch.formatType || customMatch.format_type || "integer"
      if (fmt === "currency") return `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(2)}`
      if (fmt === "percentage") return `${(Number(value) * 100).toFixed(2)}%`
      if (fmt === "decimal") return Number(value).toFixed(2)
      return Number(value).toLocaleString()
    }
    if (["spend", "cpc", "cpm", "cpp", "social_spend", "cpl", "cost_per_result"].includes(col))
      return `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(2)}`
    if (col === "ctr" || col === "conversion_rate") return `${Number(value).toFixed(2)}%`
    if (col === "account_currency") return value.toUpperCase()
    if (col === "conversion_rate_ranking") return value.replace(/_/g, " ")
    if (col === "created_time" && value) {
      try { return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) }
      catch { return value }
    }
    if (col === "platform") return value === "fb" ? "Facebook" : value === "ig" ? "Instagram" : value
    if (col === "full_name" || col === "name")
      return String(value).split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    if (typeof value === "number") return value.toLocaleString()
    return value
  }

  // FIX: useMemo with non-empty fallback so StyledTable always has columns for skeletons
  const tableColumns = useMemo(() => {
    const cols = getCurrentVisibleColumns()
    const effectiveCols = cols.length > 0 ? cols : DEFAULT_VISIBLE_COLUMNS[activeTab]
    return effectiveCols.map(col => {
      // Resolve custom metric names from local state (not global cache)
      const customMatch = customMetrics.find(m => m.id === col)
      const displayName = customMatch ? customMatch.name : getMetricDisplayName(col)
      // Determine source icon for table header
      // Use global cache so metrics filtered from local state (different dashboard) still get Flask icon
      const isCustomMetric = customMatch || !!getCustomMetricById(col)
      let colIcon = metaa
      if (col === "clientGroup" || col === "name" || col === "full_name") colIcon = null
      else if (col.startsWith("ghl_") || col.startsWith("tag_")) colIcon = ghlIco
      else if (isCustomMetric) colIcon = Flask

      return {
        id: col, key: col,
        header: displayName,
        label: displayName,
        icons: colIcon,
        sortable: true,
        render: (value, row) => formatCellValue(value, col, row),
      }
    })
  }, [visibleColumns, activeTab, customMetrics, userCurrency])

  // ── KPI tiles ─────────────────────────────────────────────────────────────
  // These read the campaign rows for the selected client group — the same rows
  // the table draws — rather than a parallel total of their own, so the tiles
  // and the table can never disagree and the group picker filters both at once.
  // Deliberately not narrowed by the drill-down: the tiles describe the account
  // for this period, while the table below is what you have drilled into.
  const heroRows = useMemo(() => {
    if (!selectedClientGroup || selectedClientGroup === "all") return campaigns
    return campaigns.filter(i => i._groupId === selectedClientGroup)
  }, [campaigns, selectedClientGroup])

  const [chartMetric, setChartMetric] = useState("spend")

  const dateRangeLabel = useMemo(
    () => DATE_PRESETS.find(p => p.value === datePreset)?.label ?? datePreset,
    [datePreset]
  )

  const { kpis, chartMetrics, seriesLoading } = useMarketingHubData({
    clientGroups,
    rows: heroRows,
    datePreset,
    selectedClientGroup,
    currencySymbol: getSymbolFromCurrency(userCurrency) || "£",
  })

  const kpiTiles = useMemo(
    () => kpis.map(k => ({ ...k, ...(MARKETING_KPI_PRESENTATION[k.key] ?? {}) })),
    [kpis]
  )

  const chartTabs = useMemo(
    () => Object.entries(chartMetrics).map(([key, m]) => ({ key, tab: m.tab })),
    [chartMetrics]
  )

  const chart = useMemo(() => {
    const metric = chartMetrics[chartMetric] ?? chartMetrics.spend
    if (!metric?.values?.length) return null

    // The chart's headline delta is the same period-over-period figure the tile
    // for that metric shows — one number, computed once.
    const kpi = kpis.find(k => k.key === chartMetric)
    const decimals = metric.decimals ?? 0

    return {
      ...metric,
      subtitle: `${dateRangeLabel} · ${metric.subtitle}`,
      pointValues: metric.values.map(v =>
        `${metric.valuePrefix ?? ""}${Number(v).toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}`
      ),
      direction: kpi?.direction,
      delta: kpi?.delta,
      polarity: kpi?.polarity,
    }
  }, [chartMetrics, chartMetric, kpis, dateRangeLabel])

  // ── Filter condition helpers ──────────────────────────────────────────────
  const addFilterCondition = () => setFilterConditions(prev => [...prev, { field: activeTab === "leads" ? "full_name" : "name", operator: "contains", value: "" }])
  const updateFilterCondition = (idx, field, val) => setFilterConditions(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  const removeFilterCondition = (idx) => setFilterConditions(prev => prev.filter((_, i) => i !== idx))
  const handleClearFilters = () => { setFilterConditions([]); setSearchTerm("") }

  // ── Tab count badges ──────────────────────────────────────────────────────
  const tabBadge = (tab) => {
    if (tab === "adsets" && selectedCampaign)
      return allAdSets.filter(a => a._campaignId === selectedCampaign.id).length
    if (tab === "ads" && selectedAdSet)
      return allAds.filter(a => a._adsetId === selectedAdSet.id).length
    if (tab === "ads" && selectedCampaign)
      return allAds.filter(a => a._campaignId === selectedCampaign.id).length
    return null
  }

  const ghlClientGroups = clientGroups // Marketing uses all groups (not filtered by ghl_location_id)

  const gridItems = useMemo(() => [
    { id: "all", name: "All Groups" },
    ...clientGroups.slice(0, 49),
  ], [clientGroups])

  const selectedGroupLabel = useMemo(() => {
    if (!selectedClientGroup || selectedClientGroup === "all") return "All Groups"
    return clientGroups.find(g => g.id === selectedClientGroup)?.name ?? "All Groups"
  }, [selectedClientGroup, clientGroups])

  const filteredGridItems = useMemo(() =>
    gridItems.filter(item =>
      item.name.toLowerCase().includes(groupSearch.toLowerCase())
    ),
    [gridItems, groupSearch]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] mx-auto md:w-[calc(100dvw-130px)]">
      <div className="flex flex-col gap-6">

        {/* Header */}
        {showHeader && (
          <div className="flex flex-col sm:flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Title block per the handoff: the page name over a sub-line
                naming what it covers. The 68px icon rail, ⌘K field, bell and
                avatar the design also draws are already rendered globally by
                src/app/layout.jsx, so they are not repeated here — the same
                call the Portfolio Dashboard made from this bundle. */}
            <div className={`${portfolioFontClass} flex gap-4 flex-col md:flex-row md:items-center md:justify-between w-full`}>
              <div className="min-w-0">
                <h1 className="font-pd-display text-[19px] font-bold text-pd-ink">
                  Marketing Hub
                </h1>
                <p className="mt-px text-[12px] text-pd-faint">
                  Campaign performance across all connected ad accounts
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 w-fit">
              {setDatePreset && (
                <DateRangeSelect value={datePreset} onChange={setDatePreset} />
              )}
              {showGroupFilter && clientGroups.length > 0 && (
                <div className="relative" ref={gridRef}>
                  <button
                    onClick={() => setGridOpen(prev => !prev)}
                    className="h-10 bg-white font-semibold border border-gray-200 rounded-md px-3 flex items-center gap-2 text-sm min-w-[120px] max-w-[200px] hover:bg-gray-50 transition-colors"
                  >
                    <span className="truncate flex-1 text-left text-gray-800">
                      {selectedGroupLabel}
                    </span>
                    <svg
                      className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-150 ${gridOpen ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {gridOpen && (
                    <div className="absolute z-50 mt-1 right-0 w-[320px] max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="Search groups..."
                          value={groupSearch}
                          onChange={e => setGroupSearch(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>

                      {filteredGridItems.length > 0 ? (
                        <div
                          className="grid gap-1 max-h-72 overflow-y-auto"
                          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
                        >
                          {filteredGridItems.map(item => {
                            const isSelected =
                              item.id === "all"
                                ? !selectedClientGroup || selectedClientGroup === "all"
                                : selectedClientGroup === item.id

                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setSelectedClientGroup(item.id)
                                  setGridOpen(false)
                                  setGroupSearch("")
                                }}
                                title={item.name}
                                className={`text-xs px-2.5 py-2 rounded-md border text-left truncate transition-colors
                                  ${isSelected
                                    ? "bg-purple-600 text-white border-purple-600 font-semibold"
                                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
                                  }`}
                              >
                                {item.name}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-3 px-6">
                          No groups found
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
        )}

        {/* Meta reconnect banner — only for a single selected client group with a connection problem, never on "All Groups" */}
        {(() => {
          if (!selectedClientGroup || selectedClientGroup === "all") return null

          const group = clientGroups.find(g => g.id === selectedClientGroup)
          if (!group) return null

          // Inactive clients aren't being actively managed, so a lapsed Meta
          // token there isn't worth surfacing — only check the token for
          // clients that are currently active.
          const isActive = String(group.client_status || "").toLowerCase() === "active"
          if (!isActive) return null
          if (!group.meta_token_error) return null

          return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>
                  Your Meta connection has expired or lost permissions. Please reconnect to continue seeing campaign data.
                </span>
              </div>
              <a
                href="/settings?tab=integrations"
                className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
              >
                Reconnect Meta
              </a>
            </div>
          )
        })()}

        {/* ── Hero row: trend chart (1.65) · KPI tiles (0.85) ────────────────
            The handoff's "chart + insights row". The tiles move out of a full
            width strip and into the chart's right-hand column, six of them in
            a 1fr 1fr grid so the column's height matches the chart's.

            A metric with no comparable previous period renders without a pill
            rather than with a zero: an unknown delta is not a flat one. */}
        <div className={`${portfolioFontClass} flex flex-col gap-[18px] lg:flex-row lg:items-stretch`}>
          <div className="flex min-w-0 flex-col lg:flex-[1.65]">
            {groupsLoading || seriesLoading ? (
              <LoadingPulse className="h-[340px] flex-1" statements={CHART_LOADING} />
            ) : chart ? (
              <TrendChart
                className="flex-1"
                chart={chart}
                metrics={chartTabs}
                activeMetric={chartMetric}
                onMetricChange={setChartMetric}
                redrawKey={`${chartMetric}-${datePreset}-${selectedClientGroup ?? "all"}`}
              />
            ) : (
              <PdCard className="flex-1" title="Trend">
                <p className="py-8 text-center text-[12px] text-pd-faint">
                  {chartMetric === "spend"
                    ? "No measured daily spend cached for this window yet."
                    : "No dated leads in this window yet."}
                </p>
              </PdCard>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-2 content-start gap-[10px] lg:flex-[0.85]">
            {groupsLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[52px] rounded-xl" />
                ))
              : kpiTiles.map(tile => (
                  <StatTile
                    key={tile.key}
                    layout="compact"
                    icon={tile.icon}
                    tone={tile.tone}
                    value={tile.value}
                    label={tile.label}
                    direction={tile.direction}
                    delta={tile.delta}
                    polarity={tile.polarity}
                  />
                ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Section tabs on the handoff's segmented-control spec: the track is
              the divider tint, the selected item lifts onto white with the
              purple-tinted shadow. Radix Tabs still drives the behaviour —
              only the skin changes. */}
          <div className={`${portfolioFontClass} flex flex-col md:flex-row md:items-center gap-3`}>
            <TabsList className="h-auto justify-start gap-[5px] overflow-x-auto rounded-[10px] border border-pd-border bg-pd-divider p-1">
              {[
                { value: "campaigns", icon: LayoutGrid, label: "Campaigns" },
                { value: "adsets", icon: Grid3X3, label: "Ad Sets" },
                { value: "ads", icon: FileBarChart, label: "Ads" },
                { value: "leads", icon: Users, label: "Leads" },
              ].map(tab => {
                const badge = tabBadge(tab.value)
                return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-[7px] rounded-lg px-[15px] py-[7px] font-pd-display text-[13px] font-semibold text-pd-muted data-[state=active]:bg-pd-surface data-[state=active]:text-pd-ink data-[state=active]:shadow-pd-segment"
                >
                    <tab.icon className="size-[14px]" />
                    {tab.label}
                    {badge !== null && (
                    <span className="ml-1 rounded-[5px] bg-pd-primary-tint px-1.5 text-[10.5px] font-bold leading-4 text-pd-primary">
                      {badge}
                    </span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* Search and Columns as the handoff's 38px controls, sitting
                together at the right end of the tab row. */}
            <div className="ml-auto flex w-fit shrink-0 items-center gap-[10px]">
              <Input
                type="search"
                placeholder={`Search ${activeTab}…`}
                className="h-[38px] w-fit rounded-[10px] border-pd-border bg-pd-surface text-[13px] md:w-[220px]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <ColumnVisibilityDropdown
                isOpen={columnsOpen} setIsOpen={setColumnsOpen}
                categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                categoryCounts={categoryCounts} searchTerm={columnsSearch} setSearchTerm={setColumnsSearch}
                filteredColumns={filteredColumns} columnVisibility={columnVisibility}
                toggleColumnVisibility={toggleColumn} getIcon={getIcon}
                selectAll={selectAll} clearAll={clearAll} save={saveView}
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4" key={activeTab}>

            {/* Drill-down breadcrumb */}
            <DrillDownBreadcrumb
              selectedCampaign={selectedCampaign}
              selectedAdSet={selectedAdSet}
              selectedAd={selectedAd}
              onClearCampaign={clearCampaign}
              onClearAdSet={clearAdSet}
              onClearAd={clearAd}
              onTabChange={setActiveTab}
            />

            {/* Advanced filter conditions */}
            {filterConditions.length > 0 && (
              <div className="border rounded-lg my-3 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm px-4 mt-2 font-semibold text-foreground">Active Filters</h3>
                  <Button variant="ghost" size="sm" onClick={() => setFilterConditions([])} className="h-8 px-4 mt-2 text-xs">Clear all</Button>
                </div>
                <div className="space-y-2">
                  {filterConditions.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-muted/50 border-t">
                      <Select value={c.field} onValueChange={v => updateFilterCondition(idx, "field", v)}>
                        <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {activeTab === "leads" ? (
                            <>
                              <SelectItem value="full_name">Full Name</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone_number">Phone Number</SelectItem>
                              <SelectItem value="ad_name">Ad Name</SelectItem>
                              <SelectItem value="adset_name">Ad Set Name</SelectItem>
                              <SelectItem value="campaign_name">Campaign Name</SelectItem>
                              <SelectItem value="platform">Platform</SelectItem>
                              <SelectItem value="group_name">Client Group</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="name">Name</SelectItem>
                              <SelectItem value="clientGroup">Client Group</SelectItem>
                              <SelectItem value="adAccount">Ad Account</SelectItem>
                              <SelectItem value="spend">Spend</SelectItem>
                              <SelectItem value="leads">Leads</SelectItem>
                              <SelectItem value="clicks">Clicks</SelectItem>
                              {customMetrics.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <Select value={c.operator} onValueChange={v => updateFilterCondition(idx, "operator", v)}>
                        <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="greaterThan">Greater Than</SelectItem>
                          <SelectItem value="lessThan">Less Than</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="text" placeholder="Value" value={c.value} onChange={e => updateFilterCondition(idx, "value", e.target.value)} className="flex-1 h-9" />
                      <Button variant="ghost" size="sm" onClick={() => removeFilterCondition(idx)} className="h-9 w-9 p-0">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end items-center gap-3 flex-1">
              {(filterConditions.length > 0 || searchTerm) && (
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-2 bg-transparent">
                  <X className="h-4 w-4" /> Clear
                </Button>
              )}
            </div>

            {/* Table */}
            {error ? (
              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                <div className="rounded-full bg-destructive/10 p-3 mb-4">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Error loading data</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
              </div>
            ) : (
              <StyledTable
                columns={tableColumns}
                data={getFilteredDataForTab()}
                columnVisibility={columnVisibility}
                isLoading={isLoading}
                emptyMessage={
                  activeTab === "leads" && datePreset === "last_year"
                    ? { title: "We currently don't hold your last year lead data", subtitle: "Last year lead data is not available at this time" }
                    : undefined
                }
                  // Drill-down: campaigns/adsets/ads rows are clickable; leads are not
                onRowClick={activeTab !== "leads" ? handleRowClick : undefined}
                  // Multi-row checkbox selection (not on leads tab)
                enableSelection={activeTab !== "leads"}
                selectedRows={
                  activeTab === "campaigns" ? selectedCampaignIds :
                  activeTab === "adsets" ? selectedAdSetIds :
                        activeTab === "ads" ? selectedAdIds :
                          new Set()
                }
                onSelectionChange={
                  activeTab === "campaigns" ? setSelectedCampaignIds :
                  activeTab === "adsets" ? setSelectedAdSetIds :
                        activeTab === "ads" ? setSelectedAdIds :
                          undefined
                }
                enableStatusToggle={activeTab !== "leads"}
                onStatusToggle={handleStatusToggle}
                togglingRows={togglingRows}
                  // Persist column order per-tab. visibleColumns[activeTab] is
                  // already an ordered array of visible IDs — feed it as the
                  // initial order, and any drag updates the same slot.
                initialColumnOrder={visibleColumns[activeTab] || []}
                onColumnOrderChange={(newOrder) => {
                  setVisibleColumns(prev => ({ ...prev, [activeTab]: newOrder }))
                  // Auto-persist the new order for the active tab (debounced).
                  saveDebouncedByTab[activeTab]?.(newOrder)
                }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}