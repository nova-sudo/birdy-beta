"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import Image from "next/image"
import { CheckIcon, FileBarChart, Grid3X3, Info, LayoutGrid, Users, X } from "lucide-react"
import { toast } from "sonner"
import getSymbolFromCurrency from "currency-symbol-map"
import {
  Badge,
  BirdyRead,
  Button,
  Checkbox,
  DataTable,
  DataTableColumnHeader,
  EmptyState,
  ErrorState,
  Input,
  MetricTabsChart,
  Notice,
  PageHeader,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  fromPortfolioTabs,
  StateBadge,
} from "@/components/ds"
import { evaluateFormula, setCustomMetricsCache } from "@/lib/metrics"
import { apiRequest } from "@/lib/api"
import { useColumnViews } from "@/lib/useColumnViews"
import { metaIcon as metaa, flaskIcon as Flask, ghlIcon as ghlIco } from "@/lib/icons"
import { getMetricDisplayName, getCustomMetricById } from "@/lib/metrics"
import ColumnsMenu from "@/components/views/ColumnsMenu"
import { usePageViews } from "@/lib/usePageViews"
import { presetToStartEnd as getDateRangeFromPreset } from "@/lib/date-utils"
import { DrillDownBreadcrumb } from "@/components/campaigns/DrillDownBreadcrumb"
import AdsGallery, { AdsViewSwitch } from "@/components/campaigns/AdsGallery"
import { ClientGroupSelect } from "@/components/contacts/ClientGroupSelect"
import { PeriodControl } from "@/app/dashboard/PeriodControl"
import { useCurrency } from "@/hooks/useCurrency"
import { useGranularity } from "@/lib/useGranularity"
import { GRANULARITIES } from "@/lib/portfolio-series"
import { usePageHeader } from "@/components/page-header"
import { toLeadFindings, toTrendSeries } from "@/app/contacts/presentation"
import { useMarketingHubData } from "@/components/campaigns/useMarketingHubData"
import { LandingFunnel } from "@/components/attribution/LandingFunnel"
import { useLandingFunnel } from "@/lib/useLandingFunnel"
import { isOverCplCeiling, marketingInsightPrompt, scopeGroups } from "@/lib/marketing-aggregate"
import { DATE_PRESETS } from "@/lib/constants"

// What the plot says when the selected metric has no series for the window.
// Each is specific to why that metric's line can be missing while its figure
// above is not.
const CHART_EMPTY = {
  spend: "No measured daily spend cached for this window yet.",
  leads: "No dated leads in this window yet.",
  cpl: "No day in this window has both spend and leads recorded.",
  // Impressions falls back to the shape of daily spend, so reaching here
  // means there is no spend curve either.
  impressions:
    "No measured daily spend cached for this window yet, so there is nothing to shape delivery against — the total is still in the figure above.",
}

// The card's copy before there is anything to read: no spend in the window.
const BRIEFING_WAITING =
  "Once campaigns in this window have spend against them, Birdy reads the movement and names what to act on."

// The page's sections, with the tab bar's leading glyph.
const SECTION_TABS = [
  { key: "campaigns", label: "Campaigns", icon: LayoutGrid },
  { key: "adsets", label: "Ad Sets", icon: Grid3X3 },
  { key: "ads", label: "Ads", icon: FileBarChart },
  { key: "leads", label: "Leads", icon: Users },
]

// Ties the tablist to the panel it swaps, for anyone navigating by role.
const TABLE_PANEL_ID = "marketing-hub-table-panel"

// Tables page client-side; the gallery pages itself (AdsGallery).
const TABLE_PAGE_SIZE = 25

// The campaign, ad set and ad tables open sorted by spend, biggest first.
const SPEND_FIRST = [{ id: "spend", desc: true }]

// The name column leads the Meta tables and stays put: it carries the
// selection checkbox and the status switch, cannot be dragged, and nothing
// goes ahead of it. The Leads tab has no such column.
const LOCKED_COLUMNS = { campaigns: ["name"], adsets: ["name"], ads: ["name"], leads: [] }

// Any column order, with the tab's locked columns first. Saved views from
// before the lock can have Name anywhere, or not at all.
const lockedFirst = (ids, locked) => [
  ...locked,
  ...ids.filter((id) => !locked.includes(id)),
]

// The ClientGroupSelect's value is a group id, or "all".
const ALL_GROUPS = "all"

// FIX: non-empty defaults so skeletons always have columns
export const DEFAULT_VISIBLE_COLUMNS = {
  campaigns: ["name", "spend", "results", "cpl", "impressions", "reach", "clicks", "ctr"],
  adsets: ["name", "spend", "results", "cpl", "impressions", "reach", "clicks", "ctr"],
  ads: ["name", "spend", "results", "cpl", "impressions", "reach", "clicks", "ctr"],
  // lead_source takes platform's slot by default: now that a lead can come from
  // GoHighLevel's own attribution rather than a Meta form, where it came from
  // matters more than whether it was Facebook or Instagram. platform is still
  // one click away in the Columns menu.
  leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name", "lead_source", "created_time", "group_name", "ghl_matched", "ghl_opportunity_status"],
}

const OPPORTUNITY_STATE = { won: "won", lost: "lost", open: "in_progress", abandoned: "skipped" }

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
  const [selectedClientGroup, setSelectedClientGroup] = useState(ALL_GROUPS)
  const [campaigns, setCampaigns] = useState([])
  const [allAdSets, setAllAdSets] = useState([])
  const [allAds, setAllAds] = useState([])
  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  // Bumped by the error state's "Try again" to re-run the leads fetch.
  const [reloadKey, setReloadKey] = useState(0)
  const [activeTab, setActiveTab] = useState("campaigns")
  // Ads-tab-only layout switch: the same rows and column order drawn either as
  // the table or as a card grid of the ad creatives (handoff: Marketing Hub v2).
  const [adsView, setAdsView] = useState("table")
  const [searchTerm, setSearchTerm] = useState("")

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

  // Explicit-save lookup for the Columns menu's "Save" actions.
  const saveByTab = {
    campaigns: saveCampaigns,
    adsets:    saveAdsets,
    ads:       saveAds,
    leads:     saveLeads,
  }

  // Per-tab debounced-save lookup, used by onColumnOrderChange to auto-persist
  // drag-reorder events without needing a manual "Save View". This was
  // referenced but never defined, so reordering a column threw a
  // ReferenceError after the optimistic state update.
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

    // Rows are built for every group and scoped at render time instead — see
    // the picker filter below. Scoping here would need selectedClientGroup in
    // this effect's deps, and rebuilding every row on each picker change to
    // get the same answer.
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
          // Creative identity for the gallery view's thumbnail. image_url is
          // only set for image creatives; creative_thumbnail is the video
          // poster (or Meta's small thumb). Both are signed Meta CDN links
          // that can expire between cache refreshes — AdsGallery falls back
          // to a placeholder when they 404.
          creative_image: ad.creative_image || "",
          creative_thumbnail: ad.creative_thumbnail || "",
          creative_video_id: ad.creative_video_id || "",
          creative_title: ad.creative_title || "",
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

  // ── Hero row: metric tabs over the chart, and Birdy's read ───────────────
  // These read the campaign rows for the selected client group — the same rows
  // the table draws — rather than a parallel total of their own, so the figures
  // and the table can never disagree and the group picker filters both at once.
  // Deliberately not narrowed by the drill-down: the hero describes the account
  // for this period, while the table below is what you have drilled into.
  //
  // Declared above the table's column definitions because formatCellValue reads
  // the blended CPL to decide which cells turn red, and tableColumns memoises
  // the closures that call it.
  // Scoped by the same rule as the tiles and the chart above (scopeGroups):
  // inactive clients are out on "All Groups", but a specifically picked client
  // is shown whatever its status. Rows used to be unscoped here, so the table
  // totalled ~11% more than the Clients page and than its own hero figures.
  const heroRows = useMemo(() => {
    const inScope = new Set(scopeGroups(clientGroups, selectedClientGroup).map(g => g.id))
    return campaigns.filter(i => inScope.has(i._groupId))
  }, [campaigns, clientGroups, selectedClientGroup])

  // Whether a table row needs to say which client it belongs to. Only when the
  // rows span more than one group — on a single client every row would repeat
  // the name the picker already shows.
  const rowsSpanClients = useMemo(
    () => scopeGroups(clientGroups, selectedClientGroup).length > 1,
    [clientGroups, selectedClientGroup]
  )

  const [chartMetric, setChartMetric] = useState("spend")
  // How finely the trend chart buckets — the window's own choice until the
  // header's chip is used. See useGranularity.
  const { granularity, setGranularity } = useGranularity(datePreset)

  const dateRangeLabel = useMemo(
    () => DATE_PRESETS.find(p => p.value === datePreset)?.label ?? datePreset,
    [datePreset]
  )

  // ── Saved column views ─────────────────────────────────────────────────
  // Scoped per tab: each of the four tables has its own column catalogue, so
  // its own set of views. Switching tabs reloads the hook against that key.
  const tabViewKey = `mktg_${activeTab}`
  const tabViewsLoaded = {
    campaigns: loadedCampaigns,
    adsets: loadedAdsets,
    ads: loadedAds,
    leads: loadedLeads,
  }[activeTab]

  const applyColumnView = useCallback((s) => {
    if (!Array.isArray(s.visibleColumns)) return
    setVisibleColumns(prev => ({ ...prev, [activeTab]: s.visibleColumns }))
  }, [activeTab])

  const pageViews = usePageViews(tabViewKey, {
    onApply: applyColumnView,
    ready: !!tabViewsLoaded,
  })

  const {
    current: heroTotals,
    kpis,
    insight,
    findings,
    chartMetrics,
    seriesLoading,
    unlistedSpend,
  } = useMarketingHubData({
    clientGroups,
    rows: heroRows,
    datePreset,
    selectedClientGroup,
    granularity,
    currencySymbol: getSymbolFromCurrency(userCurrency) || "£",
  })

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
  }, [clientGroups, groupsLoading, datePreset, reloadKey])

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
      ? ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform", "lead_source", "created_time", "group_name",
         "ghl_matched", "ghl_opportunity_status", "ghl_opportunity_value", "ghl_tags"]
      : ["name", "clientGroup", ...baseColumns, ...tagColumnIds, ...activeTabMetrics.map(m => m.id)]

  const toggleableColumns = getAvailableColumns().filter(col => col !== "name")

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

  const getCurrentVisibleColumns = () => visibleColumns[activeTab] || DEFAULT_VISIBLE_COLUMNS[activeTab]

  // ── Columns menu plumbing ──────────────────────────────────────────────
  // `type` is already meta/ghl/tags/custom, which is exactly the menu's source.
  const columnCatalogue = allColumnsForDropdown.map(c => ({
    id: c.id,
    label: c.label,
    source: c.type,
  }))

  // "name" is not user-toggleable outside the Leads tab, so it survives every
  // write — matching what clearAll has always done.
  const setTabColumns = (ids) => {
    const next = activeTab === "leads" || ids.includes("name") ? ids : ["name", ...ids]
    setVisibleColumns(prev => ({ ...prev, [activeTab]: next }))
  }

  // One shared order for the Ads tab's two layouts: a drag in either the
  // table's headers or a gallery card's metric rows writes the same
  // visibleColumns slot and persists the same debounced way, so the other
  // layout reorders with it instantly.
  const handleColumnOrderChange = (newOrder) => {
    const next = lockedFirst(newOrder, LOCKED_COLUMNS[activeTab])
    setVisibleColumns(prev => ({ ...prev, [activeTab]: next }))
    saveDebouncedByTab[activeTab]?.(next)
  }

  // Explicit save only — see ColumnsMenu. Writes this tab's own layout.
  const saveDefaultColumns = async (ids) => {
    const next = activeTab === "leads" || ids.includes("name") ? ids : ["name", ...ids]
    await saveByTab[activeTab]?.(next)
    return true
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
    if (col === "ghl_matched")
      return value ? <><CheckIcon aria-hidden className="size-4 text-success-ink" /><span className="sr-only">Yes</span></> : "–"
    if (col === "ghl_opportunity_status") {
      if (!value) return "–"
      return <StateBadge state={OPPORTUNITY_STATE[value] ?? "unknown"} className="capitalize">{value}</StateBadge>
    }
    if (col === "lead_source") {
      const label = { instant_form: "Meta form", ghl_attribution: "GHL attribution" }[value]
      if (!label) return "–"
      return <Badge tone={value === "instant_form" ? "info" : "primary"}>{label}</Badge>
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
    // CPL turns red when a row costs more than twice what the rest of the
    // account pays for the same lead. There is no per-campaign CPL target
    // anywhere in the data, so the ceiling is relative to this selection's own
    // blended CPL — see CPL_CEILING_MULTIPLE.
    if (col === "cpl" || col === "cost_per_result") {
      const money = `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(2)}`
      return isOverCplCeiling(row, heroTotals.cpl)
        ? <span className="font-medium text-danger-ink">{money}</span>
        : money
    }
    if (["spend", "cpc", "cpm", "cpp", "social_spend"].includes(col))
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

  // What each visible column is, in order: the table maps these to DataTable
  // columns (below) and the Ads gallery draws them as card metrics.
  // FIX: non-empty fallback so the table always has columns for its skeleton
  const columnSpecs = useMemo(() => {
    const cols = getCurrentVisibleColumns()
    const effectiveCols = lockedFirst(
      cols.length > 0 ? cols : DEFAULT_VISIBLE_COLUMNS[activeTab],
      LOCKED_COLUMNS[activeTab]
    )
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
        id: col,
        header: displayName,
        label: displayName,
        icons: colIcon,
        sortable: true,
        render: (value, row) => formatCellValue(value, col, row),
        // Under the campaign/ad set/ad name, the client it belongs to — the
        // fact that explains a row on "All Groups" without earning a column.
        ...(col === "name" && activeTab !== "leads"
          ? { sub: (row) => (rowsSpanClients ? row.clientGroup || null : null) }
          : {}),
      }
    })
    // heroTotals.cpl is in here because formatCellValue closes over it to
    // decide which CPL cells render red; without it the columns keep the
    // closure from the render where the threshold was last different.
  }, [visibleColumns, activeTab, customMetrics, userCurrency, heroTotals.cpl, rowsSpanClients, tagRollup, tagColumnIds, dedupedTags])

  // ── The rows the current tab draws ────────────────────────────────────────
  // Memoised because DataTable re-runs on a new `data` reference.
  const tabRows = useMemo(
    () => getFilteredDataForTab(),
    // applyFilters reads exactly these; the function itself is rebuilt each render.
    [
      activeTab, enhancedCampaigns, enhancedAdSets, enhancedAds, leads, campaigns, allAdSets, allAds,
      clientGroups, selectedClientGroup, selectedCampaign, selectedAdSet, selectedAd,
      selectedCampaignIds, selectedAdSetIds, selectedAdIds, searchTerm,
    ]
  )

  // ── Row selection (per tab) ───────────────────────────────────────────────
  // Checked rows narrow the next level down, the same way a drill-down click
  // does (see applyFilters). The Leads tab is the end of the chain.
  const [selectedIds, setSelectedIds] = {
    campaigns: [selectedCampaignIds, setSelectedCampaignIds],
    adsets: [selectedAdSetIds, setSelectedAdSetIds],
    ads: [selectedAdIds, setSelectedAdIds],
    leads: [null, null],
  }[activeTab]

  const lockedColumns = LOCKED_COLUMNS[activeTab]

  // The visible columns as DataTable columns. On the Meta tabs the first one
  // (Name) carries the row's select checkbox and status switch ahead of the
  // name, so they stay pinned with it when the table scrolls sideways.
  const tableColumns = useMemo(() => {
    const canSelect = activeTab !== "leads"
    const allSelected = tabRows.length > 0 && tabRows.every((r) => selectedIds?.has(r.id))
    const someSelected = !allSelected && tabRows.some((r) => selectedIds?.has(r.id))

    return columnSpecs.map((spec, index) => {
      const leading = canSelect && index === 0
      return {
        id: spec.id,
        accessorFn: (row) => row?.[spec.id],
        header: ({ column }) => (
          <span className="inline-flex items-center gap-1.5">
            {leading && (
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => {
                  const next = new Set(selectedIds)
                  tabRows.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)))
                  setSelectedIds(next)
                }}
                // Dragging and sorting live on the header cell; the box is only a box.
                onClick={(e) => e.stopPropagation()}
                aria-label="Select all rows"
                className="mr-1.5"
              />
            )}
            {spec.icons && <Image src={spec.icons} alt="" width={14} height={14} className="shrink-0" />}
            <DataTableColumnHeader column={column} title={spec.header} />
          </span>
        ),
        enableSorting: true,
        enableHiding: false,
        meta: { label: spec.label, minWidth: leading ? 320 : index === 0 ? 220 : 140 },
        cell: ({ getValue, row }) => {
          const original = row.original
          const content = spec.render(getValue(), original)
          const sub = index === 0 && spec.sub ? spec.sub(original) : null
          const text = sub ? (
            <div className="flex min-w-0 flex-col gap-0.5">
              {content}
              <span className="truncate text-xs text-muted-foreground">{sub}</span>
            </div>
          ) : (
            content
          )
          if (!leading) return text

          const isActive = String(original.status).toLowerCase() === "active"
          return (
            <div className="flex min-w-0 items-center gap-3">
              {/* The row drills on click; these two must not. */}
              <span className="flex shrink-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(original.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedIds)
                    if (checked) next.add(original.id)
                    else next.delete(original.id)
                    setSelectedIds(next)
                  }}
                  aria-label={`Select ${original.name || original.id}`}
                />
                <Switch
                  checked={isActive}
                  disabled={togglingRows.has(original.id)}
                  aria-label={`${isActive ? "Pause" : "Activate"} ${original.name || original.id}`}
                  onCheckedChange={() => handleStatusToggle(original.id, original.status)}
                />
              </span>
              <div className="min-w-0 font-medium text-foreground">{text}</div>
            </div>
          )
        },
      }
    })
    // handleStatusToggle closes over activeTab, which is already a dependency.
  }, [columnSpecs, activeTab, tabRows, selectedIds, togglingRows])

  const tableColumnOrder = useMemo(() => columnSpecs.map((s) => s.id), [columnSpecs])

  // Dragging a header onto another moves it there, within the unlocked
  // columns. The order is the visible list, saved debounced like the gallery's.
  const reorderColumn = useCallback((fromId, toId) => {
    const ids = tableColumnOrder
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0 || lockedColumns.includes(fromId) || lockedColumns.includes(toId)) return
    const moved = ids.filter((id) => id !== fromId)
    moved.splice(moved.indexOf(toId) + (from < to ? 1 : 0), 0, fromId)
    handleColumnOrderChange(moved)
    // handleColumnOrderChange is rebuilt every render but only reads activeTab.
  }, [tableColumnOrder, lockedColumns, activeTab])

  const [sortingByTab, setSortingByTab] = useState({
    campaigns: SPEND_FIRST, adsets: SPEND_FIRST, ads: SPEND_FIRST, leads: [],
  })
  // Paging is held here so a new search, level tab or drill-down can send the
  // table back to page 1 without remounting it (which would drop the search box's focus).
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: TABLE_PAGE_SIZE })
  const resetKey = [
    activeTab, searchTerm, selectedCampaign?.id, selectedAdSet?.id, selectedAd?.id,
    [...selectedCampaignIds].join(), [...selectedAdSetIds].join(), [...selectedAdIds].join(),
  ].join("|")
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [resetKey])

  const tableState = useMemo(
    () => ({ sorting: sortingByTab[activeTab], columnOrder: tableColumnOrder, pagination }),
    [sortingByTab, activeTab, tableColumnOrder, pagination]
  )

  // ── Hero row: metric tabs over the chart, and Birdy's read ───────────────
  // The six figures are the chart's tabs. Only the four with a daily series
  // are selectable: a tab that does nothing when clicked reads as broken.
  // Active campaigns and CTR have no daily series, so they are left to the
  // table and the briefing.
  //
  // A metric with no comparable previous period renders without a pill rather
  // than with a zero: an unknown delta is not a flat one.
  const heroMetrics = useMemo(() => {
    const tabs = kpis
      .filter((k) => Boolean(chartMetrics[k.key]))
      .map(({ key, label, value, polarity, direction, delta }) => ({
        key, label, value, polarity, direction, delta,
      }))

    return fromPortfolioTabs({ tabs, activeKey: chartMetric, chart: null, comparison: "vs previous period" }).map((m) => {
      const source = chartMetrics[m.key]
      const decimals = source.decimals ?? 0
      const pointValues = (source.values ?? []).map(
        (v) =>
          `${source.valuePrefix ?? ""}${Number(v).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })}`
      )
      return {
        ...m,
        series: toTrendSeries({ ...source, pointValues }),
        points: source.values?.length ?? 0,
      }
    })
  }, [kpis, chartMetrics, chartMetric])

  // Guards against a selection that has no series to show — spend always has
  // one, so it is the tab the chart falls back to.
  const activeChartMetric = chartMetrics[chartMetric] ? chartMetric : "spend"
  const activeMetric = heroMetrics.find((m) => m.key === activeChartMetric)
  const activeSource = chartMetrics[activeChartMetric]

  // Where the line covers less than the figure, or is shaped rather than
  // counted, the plot says so — the note would otherwise be lost now that the
  // headline lives in the tab above.
  const plottedNote = activeSource?.coverage ?? activeSource?.estimateNote

  const readRows = useMemo(
    () => (insight ? toLeadFindings(insight.segments, findings) : []),
    [insight, findings]
  )
  const briefingPrompt = useMemo(
    () => (insight ? marketingInsightPrompt(insight.segments) : undefined),
    [insight]
  )

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

  const sectionTabs = SECTION_TABS.map(({ key, label, icon: Icon }) => {
    const badge = tabBadge(key)
    return {
      value: key,
      label: (
        <>
          <Icon aria-hidden className="size-3.5" />
          {label}
        </>
      ),
      count: badge ?? undefined,
    }
  })

  // ── Landing-page funnel ───────────────────────────────────────────────────
  // Only ever for one client. The funnel's stages are a single page's visits,
  // starts and opt-ins; summing them across an agency's whole portfolio would
  // average a client whose page converts at 14% with one who has no page at
  // all, and the result describes neither. Null means the card draws nothing.
  const funnelGroupId = useMemo(() => {
    if (selectedClientGroup && selectedClientGroup !== ALL_GROUPS) return selectedClientGroup
    // The embedded case — the client workspace's Marketing tab passes one
    // group and hides the picker, so there is nothing to select.
    if (clientGroups?.length === 1) return clientGroups[0]?.id ?? null
    return null
  }, [selectedClientGroup, clientGroups])

  const {
    funnel: landingFunnel,
    loading: landingFunnelLoading,
    error: landingFunnelError,
  } = useLandingFunnel(funnelGroupId, datePreset)

  // ── Top bar ───────────────────────────────────────────────────────────────
  // The page's own title is in the PageHeader below; the top bar only names
  // the page. `showHeader` is false where MarketingContent is embedded inside
  // the client detail page; that copy must not claim the top bar out from
  // under the route that owns it.
  const topBar = useMemo(() => (showHeader ? { title: "Marketing Hub" } : null), [showHeader])
  usePageHeader(topBar)

  // ── Toolbar: search, layout switch, columns ───────────────────────────────
  const hasSearch = searchTerm !== ""
  const toolbar = (
    <>
      <Input
        type="search"
        placeholder={`Search ${activeTab}…`}
        aria-label={`Search ${activeTab}`}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="h-control-sm w-full sm:w-56"
      />
      {hasSearch && (
        <Button variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
          <X aria-hidden />
          Clear
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        {/* Table/gallery switch — Ads tab only. */}
        {activeTab === "ads" && <AdsViewSwitch value={adsView} onChange={setAdsView} />}
        <ColumnsMenu
          columns={columnCatalogue}
          visibleColumns={getCurrentVisibleColumns()}
          onChange={setTabColumns}
          defaultColumns={DEFAULT_VISIBLE_COLUMNS[activeTab]}
          views={pageViews}
          onSaveDefault={saveDefaultColumns}
          lockedColumnIds={lockedColumns}
        />
      </div>
    </>
  )

  const selectedGroup = selectedClientGroup && selectedClientGroup !== ALL_GROUPS
    ? clientGroups.find(g => g.id === selectedClientGroup)
    : null
  // Inactive clients aren't being actively managed, so a lapsed Meta token or a
  // missing lead source there isn't worth surfacing — only check clients that
  // are currently active.
  const selectedActiveGroup =
    selectedGroup && String(selectedGroup.client_status || "").toLowerCase() === "active" ? selectedGroup : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // Width comes from the container, the way every other hub screen takes it.
    <div className="flex min-w-0 flex-col gap-6">
      {showHeader && (
        <PageHeader
          title="Marketing Hub"
          description="Campaign performance across all connected ad accounts"
          period={setDatePreset ? <PeriodControl value={datePreset} onChange={setDatePreset} /> : undefined}
          actions={
            <>
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger size="sm" aria-label="Chart granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {GRANULARITIES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showGroupFilter && clientGroups.length > 0 && (
                <ClientGroupSelect
                  clientGroups={clientGroups}
                  value={selectedClientGroup}
                  onChange={setSelectedClientGroup}
                />
              )}
            </>
          }
        />
      )}

      {/* The prop was accepted and then dropped, so a failed client-groups
          fetch rendered as an empty account list and zeroed totals — a
          silent failure that looked like a quiet month. */}
      {groupsError && (
        <ErrorState
          title="Couldn't load your client data"
          description={`${String(groupsError).replace(/\.+$/, "")}. The figures here are missing, not zero.`}
          onRetry={onCacheInvalidate}
        />
      )}

      {/* Meta reconnect banner — only for a single selected client group with a connection problem, never on "All Groups" */}
      {selectedActiveGroup?.meta_token_error && (
        <Notice
          tone="warning"
          action={
            <Button asChild size="sm">
              <a href="/settings?tab=integrations">Reconnect Meta</a>
            </Button>
          }
        >
          Your Meta connection has expired or lost permissions. Please reconnect to continue seeing campaign data.
        </Notice>
      )}

      {/* No lead source at all — spend with nothing to show for it.
          Gated the same way as the reconnect banner above: one selected
          client, active only, never on "All Groups".

          This exists because a zero in the leads column is ambiguous. It can
          mean the ads genuinely produced nothing, or it can mean the client
          runs their own landing page and nothing on it reports a lead back —
          which is a setup gap, not a performance one. Those two need
          opposite reactions from a media buyer, so the number alone is worse
          than useless. */}
      {(() => {
        const group = selectedActiveGroup
        if (!group) return null
        // A reconnect banner is already showing, and it is the more urgent
        // of the two — don't stack them.
        if (group.meta_token_error) return null

        const spend = Number(group.facebook?.metrics?.insights?.spend || 0)
        if (spend <= 0) return null

        const leadSource = group.facebook?.lead_source || "none"
        if (leadSource !== "none" && leadSource !== "pixel") return null

        // Two different situations, and they need opposite reactions.
        const message = leadSource === "pixel" ? (
          <>
            <span className="font-medium">These lead counts come from this client&apos;s Meta pixel.</span>{" "}
            Meta reports how many conversions each ad produced, but never who they were —
            so the counts and CPL above are real, and the Leads tab has no rows behind them.
            Contact details would need the lead to reach GoHighLevel.
          </>
        ) : (
          <>
            <span className="font-medium">No leads are reaching Birdy for this client.</span>{" "}
            Their ads are spending, but nothing is reporting a lead back — not a Meta
            instant form, not GoHighLevel&apos;s own ad attribution, not even a pixel
            conversion. If their ads point at a landing page, that page needs to pass the
            ad through before leads and CPL can be counted here.
          </>
        )

        return (
          <Notice tone="info" className="items-start">
            <span className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{message}</span>
            </span>
          </Notice>
        )
      })()}

      {/* ── Hero row: metric tabs over the chart · Birdy's read ───────────
          The figures are the chart's tabs, so each number appears once and is
          one click from its own curve; there is no separate tile grid and no
          separate metric picker. Beside it, Birdy's read of the period. */}
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-2">
          <MetricTabsChart
            metrics={heroMetrics}
            value={activeChartMetric}
            onValueChange={setChartMetric}
            xLabel={`${activeMetric?.label ?? "Metric"} over ${dateRangeLabel}`}
            loading={groupsLoading}
            plotLoading={groupsLoading || seriesLoading}
            emptyMessage={
              activeMetric?.points === 1
                ? "Pick 7 days or longer to see a trend."
                : CHART_EMPTY[activeChartMetric]
            }
          />
          {plottedNote && <p className="px-1 text-xs text-muted-foreground">{plottedNote}</p>}
        </div>

        {/* Copy is generated per period from the rows below it — the headline
            movement, the single campaign worth acting on, then the bullets the
            rows support beyond that. Until there is spend in the window the
            card says what it is waiting for, with no link. */}
        <BirdyRead
          findings={readRows}
          empty={insight ? undefined : BRIEFING_WAITING}
          prompt={briefingPrompt}
        />
      </div>

      {/* ── Landing page funnel ──────────────────────────────────────────
          Between the hero and the tables on purpose: it is the step the
          tables cannot show. Spend, clicks and CPL above describe getting
          people to the page; the campaign rows below describe what each ad
          produced. What happened on the page in between has never been on
          this screen, and for a client running their own landing page it is
          usually where the money goes. */}
      <LandingFunnel
        funnel={landingFunnel}
        loading={landingFunnelLoading}
        error={landingFunnelError}
        groupId={funnelGroupId}
      />

      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0 max-w-full">
          <SegmentedTabs
            ariaLabel="Marketing Hub section"
            value={activeTab}
            onValueChange={setActiveTab}
            items={sectionTabs}
            panelId={TABLE_PANEL_ID}
          />
        </div>

        <div
          role="tabpanel"
          id={TABLE_PANEL_ID}
          aria-labelledby={`${TABLE_PANEL_ID}-tab-${activeTab}`}
          className="flex min-w-0 flex-col gap-3"
        >
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

          {error ? (
            <ErrorState
              title="Couldn't load this data"
              description={`${error}. Try again in a moment.`}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          ) : activeTab === "ads" && adsView === "gallery" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
              <AdsGallery
                rows={tabRows}
                columns={columnSpecs}
                onOrderChange={handleColumnOrderChange}
                onStatusToggle={handleStatusToggle}
                togglingRows={togglingRows}
                isLoading={isLoading || groupsLoading}
                resetKey={resetKey}
              />
            </>
          ) : (
            <DataTable
              key={activeTab}
              columns={tableColumns}
              data={tabRows}
              loading={isLoading}
              toolbar={toolbar}
              state={tableState}
              onStateChange={(next) => {
                setSortingByTab((prev) => ({ ...prev, [activeTab]: next.sorting }))
                setPagination(next.pagination)
              }}
              onColumnReorder={reorderColumn}
              lockedColumnIds={lockedColumns}
              stickyFirstColumn
              pageSize={TABLE_PAGE_SIZE}
              getRowId={(row, index) => row.id ?? `${activeTab}-${index}`}
              // Drill-down: campaigns/adsets/ads rows are clickable; leads are not
              onRowClick={activeTab !== "leads" ? handleRowClick : undefined}
              empty={
                activeTab === "leads" && datePreset === "last_year" ? (
                  <EmptyState
                    title="We currently don't hold your last year lead data"
                    description="Last year lead data is not available at this time"
                  />
                ) : hasSearch ? (
                  <EmptyState
                    title={`No ${activeTab === "adsets" ? "ad sets" : activeTab} match`}
                    description="Nothing fits the current search."
                    action={<Button size="sm" onClick={() => setSearchTerm("")}>Clear search</Button>}
                  />
                ) : (
                  <EmptyState
                    title={`No ${activeTab === "adsets" ? "ad sets" : activeTab} to show`}
                    description="Try adjusting your client group or date range."
                  />
                )
              }
            />
          )}

          {/* The campaigns tab is the only one whose rows are meant to
              reconcile against the spend tile, and Meta's campaigns edge
              drops deleted and archived campaigns — so the rows can sum to
              less than the account did without either being wrong. Say so
              once, under the rows, rather than leaving the two figures to
              look like a lost total. */}
          {activeTab === "campaigns" && unlistedSpend && !isLoading && (
            <p className="text-xs text-muted-foreground">
              {unlistedSpend.formatted} of this period&apos;s spend sits on campaigns Meta
              no longer lists — deleted or archived — so it counts towards the
              total above but has no row here.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
