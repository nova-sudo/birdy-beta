"use client"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadCustomMetrics, evaluateFormula, formatMetricValue } from "@/lib/metrics"
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
  ChevronRight,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import metaa from "../../../public/meta-icon-DH8jUhnM.png"
import Flask from "../../../public/Flask.png"
import { getMetricDisplayName } from "@/lib/metrics"
import StyledTable from "@/components/ui/table-container"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import getSymbolFromCurrency from "currency-symbol-map"
import { Skeleton } from "@/components/ui/skeleton"

// ── Date presets ─────────────────────────────────────────────────────────────
const DATE_PRESETS = [
  { value: "maximum", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week_mon_today", label: "This Week" },
  { value: "last_7d", label: "Last 7 Days" },
  { value: "last_14d", label: "Last 14 Days" },
  { value: "last_30d", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
]

const getDateRangeFromPreset = (preset) => {
  const now = new Date()
  let start = new Date()
  let end = new Date()

  switch (preset) {
    case "today": break
    case "yesterday":
      start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); break
    case "last_7d": start.setDate(now.getDate() - 7); break
    case "last_14d": start.setDate(now.getDate() - 14); break
    case "last_30d": start.setDate(now.getDate() - 30); break
    case "this_month": start.setDate(1); break
    case "this_week_mon_today": {
      const day = now.getDay()
      start.setDate(now.getDate() - day + (day === 0 ? -6 : 1)); break
    }
    case "last_month":
      start.setMonth(now.getMonth() - 1); start.setDate(1); end.setDate(0); break
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3)
      start.setMonth(q * 3); start.setDate(1); break
    }
    case "last_quarter": {
      const cq = Math.floor(now.getMonth() / 3)
      start.setMonth((cq - 1) * 3); start.setDate(1)
      end.setMonth(cq * 3); end.setDate(0); break
    }
    case "this_year": start.setMonth(0); start.setDate(1); break
    case "last_year":
      start.setFullYear(now.getFullYear() - 1); start.setMonth(0); start.setDate(1)
      end.setFullYear(now.getFullYear() - 1); end.setMonth(11); end.setDate(31); break
    case "maximum":
      return { start: "2010-01-01", end: now.toISOString().split("T")[0] }
    default:
      start.setDate(now.getDate() - 7)
  }

  const fmt = (d) => d.toISOString().split("T")[0]
  return { start: fmt(start), end: fmt(end) }
}

// FIX: currency inside component, not at module level (avoids SSR crash)
const getUserCurrency = () =>
  typeof window !== "undefined" ? (localStorage.getItem("user_default_currency") ?? "USD") : "USD"

// FIX: non-empty defaults so skeletons always have columns
const DEFAULT_VISIBLE_COLUMNS = {
  campaigns: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
  adsets: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
  ads: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
  leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform", "created_time", "group_name"],
}

// ── Breadcrumb bar component ──────────────────────────────────────────────────
// Displays the active campaign → adset → ad selection chain.
// Each pill is clickable to jump back to that tab; the × clears from that level down.
const DrillDownBreadcrumb = ({
  selectedCampaign, selectedAdSet, selectedAd,
  onClearCampaign, onClearAdSet, onClearAd,
  onTabChange,
}) => {
  if (!selectedCampaign) return null

  const Pill = ({ color, icon: Icon, label, onClick, onClear }) => (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      <button onClick={onClick} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
        <Icon className="h-3 w-3" />
        <span className="max-w-[160px] truncate">{label}</span>
      </button>
      <button onClick={onClear} className="ml-0.5 hover:opacity-60 transition-opacity">
        <X className="h-3 w-3" />
      </button>
    </span>
  )

  return (
    <div className="flex items-center flex-wrap gap-1.5 mb-3 px-1 py-2 bg-muted/40 rounded-lg border border-border/30">
      <span className="text-xs font-medium text-muted-foreground mr-1">Filtering by:</span>

      <Pill
        color="bg-purple-100 text-purple-800"
        icon={LayoutGrid}
        label={selectedCampaign.name}
        onClick={() => onTabChange("campaigns")}
        onClear={onClearCampaign}
      />

      {selectedAdSet && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Pill
            color="bg-blue-100 text-blue-800"
            icon={Grid3X3}
            label={selectedAdSet.name}
            onClick={() => onTabChange("adsets")}
            onClear={onClearAdSet}
          />
        </>
      )}

      {selectedAd && (
        <>
          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Pill
            color="bg-emerald-100 text-emerald-800"
            icon={FileBarChart}
            label={selectedAd.name}
            onClick={() => onTabChange("ads")}
            onClear={onClearAd}
          />
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const Campaigns = () => {
  const userCurrency = getUserCurrency()

  const [customMetrics, setCustomMetrics] = useState([])
  const [clientGroups, setClientGroups] = useState([])
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
  const [selectedDatePreset, setSelectedDatePreset] = useState("last_7d")

  // ── Drill-down state: each holds the full row object for name display ──────
  const [selectedCampaign, setSelectedCampaign] = useState(null)  // campaign row
  const [selectedAdSet, setSelectedAdSet] = useState(null)  // adset row
  const [selectedAd, setSelectedAd] = useState(null)  // ad row

  // ── Multi-row checkbox selection (per-tab) ────────────────────────────────
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(new Set())
  const [selectedAdSetIds, setSelectedAdSetIds] = useState(new Set())
  const [selectedAdIds, setSelectedAdIds] = useState(new Set())

  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("campaigns")
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS)

  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setVisibleColumns(prev => {
      const merged = { ...prev, ...savedColumns }
      Object.keys(DEFAULT_VISIBLE_COLUMNS).forEach(tab => {
        if (!merged[tab] || merged[tab].length === 0) merged[tab] = DEFAULT_VISIBLE_COLUMNS[tab]
      })
      return merged
    })
  }, [viewsLoaded, savedColumns])

  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsSearch, setColumnsSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // ── Custom metrics ────────────────────────────────────────────────────────
  useEffect(() => {
    setCustomMetrics(loadCustomMetrics().filter(m => m.enabled && m.dashboard === "Campaigns"))
  }, [])

  useEffect(() => {
    const ids = customMetrics.map(m => m.id)
    setVisibleColumns(prev => {
      const updated = { ...prev }
        ;["campaigns", "adsets", "ads"].forEach(tab => {
          const existing = new Set(updated[tab] || [])
          ids.forEach(id => { if (!existing.has(id)) updated[tab] = [...(updated[tab] || []), id] })
        })
      return updated
    })
  }, [customMetrics])

  const enhanceWithCustomMetrics = (item) => {
    const base = { ...item }
    loadCustomMetrics()
      .filter(m => m.enabled && m.dashboard === "Campaigns")
      .forEach(metric => {
        if (metric.formulaParts) base[metric.id] = evaluateFormula(metric.formulaParts, base)
      })
    return base
  }

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchAllData = async (signal) => {
    setIsLoading(true)
    setError(null)
    try {
      const groupsRes = await fetch(
        `https://birdy-backend.vercel.app/api/client-groups?date_preset=${selectedDatePreset}`,
        { credentials: "include", signal }
      )
      if (!groupsRes.ok) throw new Error(`Failed to load client groups: ${groupsRes.status}`)

      const groupsData = await groupsRes.json()
      const groups = groupsData.client_groups || []

      if (!groups.length) {
        setClientGroups([]); setCampaigns([]); setAllAdSets([]); setAllAds([]); setLeads([])
        return
      }

      setClientGroups(groups)

      const processedCampaigns = []
      const processedAdsets = []
      const processedAds = []

      for (const group of groups) {
        const fb = group.facebook || {}
        const groupMeta = {
          _groupId: group.id,
          clientGroup: group.name,
          adAccount: fb.ad_account_id || "",
          account_currency: fb.currency || "USD",
        }

        // Campaigns
        for (const c of (fb.campaigns || [])) {
          processedCampaigns.push(enhanceWithCustomMetrics({
            ...groupMeta,
            id: c.id,
            name: c.name,
            status: (c.status || "inactive").toLowerCase(),
            spend: c.spend || 0,
            impressions: c.impressions || 0,
            clicks: c.clicks || 0,
            reach: c.reach || 0,
            leads: c.results || 0,
            ctr: c.ctr || 0,
            cpc: c.cpc || 0,
            cpm: c.cpm || 0,
            cpp: c.reach > 0 ? c.spend / c.reach : 0,
            frequency: c.reach > 0 ? c.impressions / c.reach : 0,
          }))
        }

        // Ad sets — store _campaignId for drill-down filtering
        for (const a of (fb.adsets || [])) {
          processedAdsets.push(enhanceWithCustomMetrics({
            ...groupMeta,
            id: a.id,
            name: a.name,
            status: (a.status || "inactive").toLowerCase(),
            _campaignId: a.campaign_id || "",   // ← parent campaign id
            campaign_name: a.campaign_id || "",
            spend: a.spend || 0,
            impressions: a.impressions || 0,
            clicks: a.clicks || 0,
            reach: a.reach || 0,
            leads: a.results || 0,
            ctr: a.ctr || 0,
            cpc: a.cpc || 0,
            cpm: a.cpm || 0,
            cpp: a.reach > 0 ? a.spend / a.reach : 0,
            frequency: a.reach > 0 ? a.impressions / a.reach : 0,
          }))
        }

        // Ads — store _campaignId and _adsetId for drill-down filtering
        for (const ad of (fb.ads || [])) {
          processedAds.push(enhanceWithCustomMetrics({
            ...groupMeta,
            id: ad.id,
            name: ad.name,
            status: (ad.status || "inactive").toLowerCase(),
            _campaignId: ad.campaign_id || "",  // ← parent campaign id
            _adsetId: ad.adset_id || "",         // ← parent adset id
            campaign_name: ad.campaign_id || "",
            spend: ad.spend || 0,
            impressions: ad.impressions || 0,
            clicks: ad.clicks || 0,
            reach: ad.reach || 0,
            leads: ad.results || 0,
            ctr: ad.ctr || 0,
            cpc: ad.cpc || 0,
            cpm: ad.cpm || 0,
            cpp: ad.reach > 0 ? ad.spend / ad.reach : 0,
            frequency: ad.reach > 0 ? ad.impressions / ad.reach : 0,
          }))
        }
      }

      setCampaigns(processedCampaigns)
      setAllAdSets(processedAdsets)
      setAllAds(processedAds)

      // Leads
      const groupIds = groups.map(g => g.id).join(",")
      const { start, end } = getDateRangeFromPreset(selectedDatePreset)
      const leadsRes = await fetch(
        `https://birdy-backend.vercel.app/api/facebook-leads/filtered?groups=${groupIds}&limit=5000&start_date=${start}&end_date=${end}`,
        { credentials: "include", signal }
      )
      const leadsData = leadsRes.ok ? await leadsRes.json() : { leads: [] }
      setLeads(leadsData.leads || [])

    } catch (err) {
      if (err.name === "AbortError") return
      console.error("fetchAllData error:", err)
      setError(err.message || "Failed to load marketing data")
      setIsLoading(false)
    } finally {
      if (!signal.aborted) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    const ctrl = new AbortController()
    fetchAllData(ctrl.signal)
    return () => ctrl.abort()
  }, [selectedDatePreset])

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
  const isAllZerosRow = (item) => {
    if (activeTab === "leads") return false
    const fields = ["spend", "impressions", "clicks", "reach", "leads", "ctr", "cpc", "cpm", "cpp", "frequency"]
    return !fields.some(f => { const v = item[f]; return v !== undefined && v !== null && Number(v) !== 0 })
  }

  const applyFilters = (data) => {
    let filtered = data.filter(item => !isAllZerosRow(item))

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
    if (activeTab === "campaigns") return applyFilters(campaigns)
    if (activeTab === "adsets") return applyFilters(allAdSets)
    if (activeTab === "ads") return applyFilters(allAds)
    if (activeTab === "leads") return applyFilters(leads)
    return []
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const baseColumns = [
    "adAccount", "spend", "social_spend", "impressions", "clicks",
    "cpc", "cpp", "reach", "ctr", "cpm", "frequency",
    "conversion_rate_ranking", "account_currency",
  ]

  const getAvailableColumns = () =>
    activeTab === "leads"
      ? ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform", "created_time", "group_name"]
      : ["name", "clientGroup", ...baseColumns, ...customMetrics.map(m => m.id)]

  const categories = [{ id: "all", label: "All" }, { id: "meta", label: "Meta" }, { id: "custom", label: "Custom" }]
  const toggleableColumns = getAvailableColumns().filter(col => col !== "name")
  const metaCount = toggleableColumns.filter(col => baseColumns.includes(col)).length
  const customCount = toggleableColumns.length - metaCount
  const categoryCounts = { all: toggleableColumns.length, meta: metaCount, custom: customCount }

  const allColumnsForDropdown = toggleableColumns.map(col => ({
    id: col,
    label: getMetricDisplayName(col),
    visible: (visibleColumns[activeTab] || []).includes(col),
    type: baseColumns.includes(col) ? "meta" : "custom",
  }))

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
  const saveView = async () => { await saveToDB(visibleColumns); setColumnsOpen(false) }
  const getIcon = (col) => (col.id === "clientGroup" || col.id === "name" ? Flask : metaa)

  const formatCellValue = (value, col, row) => {
    if (col === "full_name") {
      value = value || row?.field_data?.["full name"] || row?.field_data?.full_name ||
        row?.full_name || row?.fullName || row?.name ||
        (row?.first_name || row?.last_name ? `${row?.first_name || ""} ${row?.last_name || ""}`.trim() : null)
    }
    if (value === null || value === undefined || value === "") return "-"
    if (customMetrics.some(m => m.id === col)) return formatMetricValue(value, col)
    if (["spend", "cpc", "cpm", "cpp", "social_spend"].includes(col))
      return `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(2)}`
    if (col === "ctr") return `${Number(value).toFixed(2)}%`
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
    return effectiveCols.map(col => ({
      id: col, key: col,
      header: getMetricDisplayName(col),
      label: getMetricDisplayName(col),
      icons: col === "clientGroup" || col === "name" ? Flask : metaa,
      render: (value, row) => formatCellValue(value, col, row),
    }))
  }, [visibleColumns, activeTab, customMetrics, userCurrency])

  // ── Summary cards ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    let base = campaigns
    if (selectedClientGroup && selectedClientGroup !== "all")
      base = campaigns.filter(i => i._groupId === selectedClientGroup)
    const totalSpend = base.reduce((s, i) => s + (i.spend || 0), 0)
    const totalLeads = base.reduce((s, i) => s + (i.leads || 0), 0)
    const activeCampaigns = base.filter(i => String(i.status).toLowerCase() === "active").length
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    return { totalSpend, totalLeads, activeCampaigns, avgCPL }
  }, [campaigns, selectedClientGroup])

  // ── Filter condition helpers ──────────────────────────────────────────────
  const addFilterCondition = () => setFilterConditions(prev => [...prev, { field: activeTab === "leads" ? "full_name" : "name", operator: "contains", value: "" }])
  const updateFilterCondition = (idx, field, val) => setFilterConditions(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  const removeFilterCondition = (idx) => setFilterConditions(prev => prev.filter((_, i) => i !== idx))
  const handleClearFilters = () => { setFilterConditions([]); setSearchTerm("") }

  // ── Tab count badges (shown when a drill-down is active) ──────────────────
  const tabBadge = (tab) => {
    if (tab === "adsets" && selectedCampaign)
      return allAdSets.filter(a => a._campaignId === selectedCampaign.id).length
    if (tab === "ads" && selectedAdSet)
      return allAds.filter(a => a._adsetId === selectedAdSet.id).length
    if (tab === "ads" && selectedCampaign)
      return allAds.filter(a => a._campaignId === selectedCampaign.id).length
    return null
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] mx-auto md:w-[calc(100dvw-130px)]">
      <div className="flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-4 flex-col md:flex-row md:items-center md:justify-between w-full">
            <div className="whitespace-nowrap">
              <h1 className="text-2xl md:text-3xl lg:text-4xl py-2 md:py-0 font-bold text-foreground text-center md:text-left whitespace-nowrap">
                Marketing Hub
              </h1>
            </div>

            {clientGroups.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold whitespace-nowrap">Client Group:</Label>
                <Select value={selectedClientGroup || "all"} onValueChange={setSelectedClientGroup}>
                  <SelectTrigger className="w-48 bg-white"><SelectValue placeholder="Select a client group" /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">All Groups</SelectItem>
                    {clientGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 w-fit">
            <Input
              type="search"
              placeholder={`Search ${activeTab}...`}
              className="h-10 bg-white w-fit md:w-55 rounded-md text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
              <Select value={selectedDatePreset} onValueChange={setSelectedDatePreset}>
                <SelectTrigger className="flex items-center gap-1 md:gap-2 px-2 hover:bg-purple-200 font-semibold md:px-4 bg-white h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
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

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Campaigns", icon: LayoutGrid, value: metrics.activeCampaigns },
            { label: "Total Ad Spend", icon: DollarSign, value: `${getSymbolFromCurrency(userCurrency)}${metrics.totalSpend.toFixed(2)}` },
            { label: "Total Leads", icon: Target, value: metrics.totalLeads },
            { label: "Average CPL", icon: TrendingUp, value: metrics.avgCPL > 0 ? `${getSymbolFromCurrency(userCurrency)}${metrics.avgCPL.toFixed(2)}` : "-" },
          ].map((c, i) => (
            <Card key={i} className="border shadow-sm rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground font-normal text-sm">{c.label}</CardTitle>
                <div className="h-7 w-8 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                  <c.icon className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading
                  ? <div className="w-full py-4"><Skeleton className="h-4 w-1/2" /></div>
                  : <div className="text-2xl font-bold">{c.value}</div>
                }
                <p className="text-xs text-[#71658B] text-muted-foreground">Across all {activeTab}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 gap-4 md:gap-0 shadow-sm overflow-x-auto">
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
                  className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-600"
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {badge !== null && (
                    <span className="ml-1 bg-purple-100 text-purple-700 rounded-full px-1.5 text-[10px] font-semibold leading-4">
                      {badge}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

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
              <div className="rounded-lg border bg-card overflow-hidden">
                <StyledTable
                  columns={tableColumns}
                  data={getFilteredDataForTab()}
                  columnVisibility={columnVisibility}
                  isLoading={isLoading}
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
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Campaigns