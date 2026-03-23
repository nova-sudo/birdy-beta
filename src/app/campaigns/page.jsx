"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadCustomMetrics, evaluateFormula, formatMetricValue } from "@/lib/metrics"
import { useColumnViews } from "@/lib/useColumnViews"
import { ViewLoading } from "@/components/ui/ViewLoading"
import {
  Search,
  LayoutGrid,
  Grid3X3,
  FileBarChart,
  Users,
  X,
  TrendingUp,
  DollarSign,
  Target,
  MousePointerClick,
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

// ── Same date presets as the Clients page ───────────────────────────────────
const DATE_PRESETS = [
  { value: "maximum",             label: "All Time" },
  { value: "today",               label: "Today" },
  { value: "yesterday",           label: "Yesterday" },
  { value: "this_week_mon_today", label: "This Week" },
  { value: "last_7d",             label: "Last 7 Days" },
  { value: "last_14d",            label: "Last 14 Days" },
  { value: "last_30d",            label: "Last 30 Days" },
  { value: "this_month",          label: "This Month" },
  { value: "last_month",          label: "Last Month" },
  { value: "this_quarter",        label: "This Quarter" },
  { value: "last_quarter",        label: "Last Quarter" },
  { value: "this_year",           label: "This Year" },
  { value: "last_year",           label: "Last Year" },
]

const userCurrency = localStorage.getItem("user_default_currency")

const Campaigns = () => {
  const [customMetrics, setCustomMetrics]           = useState([])
  const [clientGroups, setClientGroups]             = useState([])
  const [selectedClientGroup, setSelectedClientGroup] = useState(null)
  const [campaigns, setCampaigns]                   = useState([])
  const [allAdSets, setAllAdSets]                   = useState([])
  const [allAds, setAllAds]                         = useState([])
  const [leads, setLeads]                           = useState([])
  const [isLoading, setIsLoading]                   = useState(false)
  const [error, setError]                           = useState(null)
  const [activeTab, setActiveTab]                   = useState("campaigns")
  const [searchTerm, setSearchTerm]                 = useState("")
  const [filterConditions, setFilterConditions]     = useState([])
  const [selectedDatePreset, setSelectedDatePreset] = useState("last_7d")

  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("campaigns")

  const [visibleColumns, setVisibleColumns] = useState({
    campaigns: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
    adsets:    ["name", "spend", "impressions", "reach", "clicks", "ctr"],
    ads:       ["name", "spend", "impressions", "reach", "clicks", "ctr"],
    leads: [
      "full_name", "email", "phone_number",
      "ad_name", "adset_name", "campaign_name",
      "ad_id", "adset_id", "campaign_id",
      "form_id", "platform", "is_organic", "created_time",
    ],
  })

  // Apply saved column view
  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setVisibleColumns(prev => ({ ...prev, ...savedColumns }))
  }, [viewsLoaded, savedColumns])

  const [columnsOpen, setColumnsOpen]       = useState(false)
  const [columnsSearch, setColumnsSearch]   = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // ── Load custom metrics ────────────────────────────────────────────────────
  useEffect(() => {
    const metrics = loadCustomMetrics().filter(m => m.enabled && m.dashboard === "Campaigns")
    setCustomMetrics(metrics)
  }, [])

  // Sync visibility when new custom metrics appear
  useEffect(() => {
    const customIds = customMetrics.map(m => m.id)
    setVisibleColumns(prev => {
      const updated = { ...prev }
      ;["campaigns", "adsets", "ads"].forEach(tab => {
        const existing = new Set(updated[tab] || [])
        customIds.forEach(id => { if (!existing.has(id)) updated[tab] = [...updated[tab], id] })
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

  // ── Main data fetch — single endpoint, date_preset ────────────────────────
  const fetchAllData = async (signal) => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Fetch client groups with Meta data already embedded (preset-aware)
      const groupsRes = await fetch(
        `https://birdy-backend.vercel.app/api/client-groups?date_preset=${selectedDatePreset}`,
        { credentials: "include", signal }
      )
      if (!groupsRes.ok) throw new Error(`Failed to load client groups: ${groupsRes.status}`)

      const groupsData   = await groupsRes.json()
      const groups       = groupsData.client_groups || []

      if (!groups.length) {
        setClientGroups([])
        setCampaigns([])
        setAllAdSets([])
        setAllAds([])
        setLeads([])
        return
      }

      setClientGroups(groups)
      if (!selectedClientGroup) setSelectedClientGroup(groups[0].id)

      // 2. Flatten campaigns / adsets / ads out of each group's facebook cache
      const processedCampaigns = []
      const processedAdsets    = []
      const processedAds       = []

      for (const group of groups) {
        const fb = group.facebook || {}
        const groupMeta = {
          _groupId:    group.id,
          clientGroup: group.name,
          adAccount:   fb.ad_account_id || "",
          account_currency: fb.currency || "USD",
        }

        // Campaigns
        for (const c of (fb.campaigns || [])) {
          const row = {
            ...groupMeta,
            id:          c.id,
            name:        c.name,
            spend:       c.spend       || 0,
            impressions: c.impressions || 0,
            clicks:      c.clicks      || 0,
            reach:       c.reach       || 0,
            leads:       c.results     || 0,
            ctr:         c.ctr         || 0,
            cpc:         c.cpc         || 0,
            cpm:         c.cpm         || 0,
            cpp:         c.reach > 0 ? (c.spend / c.reach) : 0,
            frequency:   c.reach > 0 ? (c.impressions / c.reach) : 0,
          }
          processedCampaigns.push(enhanceWithCustomMetrics(row))
        }

        // Adsets
        for (const a of (fb.adsets || [])) {
          const row = {
            ...groupMeta,
            id:            a.id,
            name:          a.name,
            campaign_name: a.campaign_id || "",   // backend returns campaign_id; name not always present
            spend:         a.spend       || 0,
            impressions:   a.impressions || 0,
            clicks:        a.clicks      || 0,
            reach:         a.reach       || 0,
            leads:         a.results     || 0,
            ctr:           a.ctr         || 0,
            cpc:           a.cpc         || 0,
            cpm:           a.cpm         || 0,
            cpp:           a.reach > 0 ? (a.spend / a.reach) : 0,
            frequency:     a.reach > 0 ? (a.impressions / a.reach) : 0,
          }
          processedAdsets.push(enhanceWithCustomMetrics(row))
        }

        // Ads
        for (const ad of (fb.ads || [])) {
          const row = {
            ...groupMeta,
            id:            ad.id,
            name:          ad.name,
            campaign_name: ad.campaign_id || "",
            spend:         ad.spend       || 0,
            impressions:   ad.impressions || 0,
            clicks:        ad.clicks      || 0,
            reach:         ad.reach       || 0,
            leads:         ad.results     || 0,
            ctr:           ad.ctr         || 0,
            cpc:           ad.cpc         || 0,
            cpm:           ad.cpm         || 0,
            cpp:           ad.reach > 0 ? (ad.spend / ad.reach) : 0,
            frequency:     ad.reach > 0 ? (ad.impressions / ad.reach) : 0,
          }
          processedAds.push(enhanceWithCustomMetrics(row))
        }
      }

      setCampaigns(processedCampaigns)
      setAllAdSets(processedAdsets)
      setAllAds(processedAds)

      // 3. Leads — still fetched separately (stored in facebook_leads collection)
      //    Pass group IDs as before; no date filtering needed since preset already
      //    scopes the other data, but we keep it consistent.
      const groupIds  = groups.map(g => g.id).join(",")
      const leadsRes  = await fetch(
        `https://birdy-backend.vercel.app/api/facebook-leads/filtered?groups=${groupIds}&limit=5000`,
        { credentials: "include", signal }
      )
      const leadsData = leadsRes.ok ? await leadsRes.json() : { leads: [] }
      setLeads(leadsData.leads || [])

    } catch (err) {
      if (err.name === "AbortError") return
      console.error("fetchAllData error:", err)
      setError(err.message || "Failed to load marketing data")
    } finally {
      setIsLoading(false)
    }
  }

  // Re-fetch whenever the preset changes
  useEffect(() => {
    const controller = new AbortController()
    fetchAllData(controller.signal)
    return () => controller.abort()
  }, [selectedDatePreset])

  // ── Filtering ──────────────────────────────────────────────────────────────
  const applyFilters = (data) => {
    let filtered = [...data]

    if (selectedClientGroup) {
      if (activeTab === "leads") {
        const selectedGroup = clientGroups.find(g => g.id === selectedClientGroup)
        if (selectedGroup) filtered = filtered.filter(i => i.group_name === selectedGroup.name)
      } else {
        filtered = filtered.filter(i => i._groupId === selectedClientGroup)
      }
    }

    const lower = searchTerm.toLowerCase()
    if (searchTerm) {
      filtered = filtered.filter(i =>
        i.name?.toLowerCase().includes(lower) ||
        i.clientGroup?.toLowerCase().includes(lower) ||
        i.adAccount?.toLowerCase().includes(lower) ||
        (activeTab === "leads" && (
          i.full_name?.toLowerCase().includes(lower) ||
          i.email?.toLowerCase().includes(lower) ||
          i.phone_number?.toLowerCase().includes(lower) ||
          i.ad_name?.toLowerCase().includes(lower) ||
          i.adset_name?.toLowerCase().includes(lower) ||
          i.campaign_name?.toLowerCase().includes(lower) ||
          i.group_name?.toLowerCase().includes(lower) ||
          i.platform?.toLowerCase().includes(lower)
        ))
      )
    }

    filterConditions.forEach(c => {
      filtered = filtered.filter(i => {
        const val = i[c.field]
        if (typeof val === "string") {
          if (c.operator === "equals")   return val.toLowerCase() === String(c.value).toLowerCase()
          if (c.operator === "contains") return val.toLowerCase().includes(String(c.value).toLowerCase())
        } else if (typeof val === "number") {
          const n = Number(c.value)
          if (isNaN(n)) return true
          if (c.operator === "equals")      return val === n
          if (c.operator === "greaterThan") return val > n
          if (c.operator === "lessThan")    return val < n
        }
        return true
      })
    })

    return filtered
  }

  const getFilteredDataForTab = () => {
    let data = []
    if (activeTab === "campaigns") data = campaigns
    if (activeTab === "adsets")    data = allAdSets
    if (activeTab === "ads")       data = allAds
    if (activeTab === "leads")     data = leads
    return applyFilters(data)
  }

  // ── Column definitions ─────────────────────────────────────────────────────
  const baseColumns = [
    "adAccount", "spend", "social_spend", "impressions", "clicks",
    "cpc", "cpp", "reach", "ctr", "cpm", "frequency",
    "conversion_rate_ranking", "account_currency",
  ]

  const getAvailableColumns = () => {
    if (activeTab === "leads") {
      return [
        "full_name", "email", "phone_number",
        "ad_name", "adset_name", "campaign_name",
        "ad_id", "adset_id", "campaign_id",
        "form_id", "platform", "is_organic", "created_time", "group_name",
      ]
    }
    return ["name", "clientGroup", ...baseColumns, ...customMetrics.map(m => m.id)]
  }

  const categories = [
    { id: "all",    label: "All" },
    { id: "meta",   label: "Meta" },
    { id: "custom", label: "Custom" },
  ]

  const toggleableColumns    = getAvailableColumns().filter(col => col !== "name")
  const metaCount            = toggleableColumns.filter(col => baseColumns.includes(col)).length
  const customCount          = toggleableColumns.length - metaCount
  const categoryCounts       = { all: toggleableColumns.length, meta: metaCount, custom: customCount }

  const allColumnsForDropdown = toggleableColumns.map(col => ({
    id:      col,
    label:   getMetricDisplayName(col),
    visible: (visibleColumns[activeTab] || []).includes(col),
    type:    baseColumns.includes(col) ? "meta" : "custom",
  }))

  const filteredColumns = allColumnsForDropdown.filter(col => {
    const matchesCategory = selectedCategory === "all" || col.type === selectedCategory
    const matchesSearch   = col.label.toLowerCase().includes(columnsSearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const columnVisibility = Object.fromEntries(
    allColumnsForDropdown.map(c => [c.id, (visibleColumns[activeTab] || []).includes(c.id)])
  )

  const toggleColumn = (col) => {
    setVisibleColumns(prev => {
      const cur     = prev[activeTab] || []
      const updated = cur.includes(col) ? cur.filter(c => c !== col) : [...cur, col]
      return { ...prev, [activeTab]: updated }
    })
  }

  const selectAll = () => setVisibleColumns(prev => ({ ...prev, [activeTab]: getAvailableColumns() }))
  const clearAll  = () => setVisibleColumns(prev => ({ ...prev, [activeTab]: activeTab === "leads" ? [] : ["name"] }))
  const saveView  = async () => { await saveToDB(visibleColumns); setColumnsOpen(false) }

  if (!viewsLoaded) return <ViewLoading />

  const getIcon                  = (col) => (col.id === "clientGroup" || col.id === "name" ? Flask : metaa)
  const getCurrentVisibleColumns = () => visibleColumns[activeTab] || []

  const tableColumns = getCurrentVisibleColumns().map(col => ({
    key:    col,
    header: getMetricDisplayName(col),
    label:  getMetricDisplayName(col),
    icons:  col === "clientGroup" || col === "name" ? Flask : metaa,
    render: (value) => formatCellValue(value, col),
  }))

  const formatCellValue = (value, col) => {
    if (value === null || value === undefined) return "-"
    if (customMetrics.some(m => m.id === col))                    return formatMetricValue(value, col)
    if (["spend", "cpc", "cpm", "cpp", "social_spend"].includes(col))
      return `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(2)}`
    if (col === "ctr")                  return `${Number(value).toFixed(2)}%`
    if (col === "account_currency")     return value.toUpperCase()
    if (col === "conversion_rate_ranking") return value.replace(/_/g, " ")
    if (col === "is_organic")           return value ? "Yes" : "No"
    if (typeof value === "number")      return value.toLocaleString()
    return value
  }

  // ── Summary metrics ────────────────────────────────────────────────────────
  const calculateMetrics = () => {
    const data            = getFilteredDataForTab()
    const totalSpend      = data.reduce((s, i) => s + (i.spend      || 0), 0)
    const totalLeads      = data.reduce((s, i) => s + (i.leads      || 0), 0)
    const totalClicks     = data.reduce((s, i) => s + (i.clicks     || 0), 0)
    const totalImpressions= data.reduce((s, i) => s + (i.impressions|| 0), 0)
    const avgCTR          = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    return { totalSpend, totalLeads, totalClicks, totalImpressions, avgCTR }
  }
  const metrics = calculateMetrics()

  // ── Filter condition helpers ───────────────────────────────────────────────
  const addFilterCondition    = () => setFilterConditions(prev => [
    ...prev, { field: activeTab === "leads" ? "full_name" : "name", operator: "contains", value: "" }
  ])
  const updateFilterCondition = (idx, field, val) =>
    setFilterConditions(prev => prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c)))
  const removeFilterCondition = (idx) =>
    setFilterConditions(prev => prev.filter((_, i) => i !== idx))
  const handleClearFilters    = () => { setFilterConditions([]); setSearchTerm("") }

  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] mx-auto md:w-[calc(100dvw-130px)]">
      <div className="flex flex-col gap-6">

        {/* ── Header ── */}
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
                <Select value={selectedClientGroup || ""} onValueChange={setSelectedClientGroup}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Select a client group" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {clientGroups.map(group => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 w-fit">
            <Input
              type="search"
              placeholder={`Search ${activeTab}...`}
              className="h-10 bg-white w-fit md:w-65 rounded-md text-sm font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-1 overflow-x-auto lg:overflow-x-hidden">

              <ColumnVisibilityDropdown
                isOpen={columnsOpen}
                setIsOpen={setColumnsOpen}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                categoryCounts={categoryCounts}
                searchTerm={columnsSearch}
                setSearchTerm={setColumnsSearch}
                filteredColumns={filteredColumns}
                columnVisibility={columnVisibility}
                toggleColumnVisibility={toggleColumn}
                getIcon={getIcon}
                selectAll={selectAll}
                clearAll={clearAll}
                save={saveView}
              />

              {/* ── Date preset selector (replaces the old calendar picker) ── */}
              <Select value={selectedDatePreset} onValueChange={setSelectedDatePreset}>
                <SelectTrigger className="flex items-center gap-1 md:gap-2 px-2 hover:bg-purple-200 font-semibold md:px-4 bg-white h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

            </div>
          </div>
        </div>

        {/* ── Summary cards ── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Spend",  icon: DollarSign,      value: `${getSymbolFromCurrency(userCurrency)}${metrics.totalSpend.toFixed(2)}` },
            { label: "Total Leads",  icon: Target,           value: metrics.totalLeads },
            { label: "Avg CTR",      icon: MousePointerClick,value: `${metrics.avgCTR.toFixed(2)}%` },
            { label: "Avg CPL",      icon: TrendingUp,       value: metrics.totalLeads > 0 ? `${getSymbolFromCurrency(userCurrency)}${(metrics.totalSpend / metrics.totalLeads).toFixed(2)}` : "-" },
          ].map((c, i) => (
            <Card key={i} className="border shadow-sm rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground font-normal text-sm">{c.label}</CardTitle>
                <div className="h-7 w-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <c.icon className="h-4 w-4 text-muted-foreground text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground">Across all {activeTab}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 gap-4 md:gap-0 shadow-sm overflow-x-auto">
            {[
              { value: "campaigns", icon: LayoutGrid,  label: "Campaigns" },
              { value: "adsets",    icon: Grid3X3,     label: "Ad Sets" },
              { value: "ads",       icon: FileBarChart, label: "Ads" },
              { value: "leads",     icon: Users,        label: "Leads" },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-600"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* ── Active filters ── */}
            {filterConditions.length > 0 && (
              <div className="border rounded-lg my-3 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm px-4 mt-2 font-semibold text-foreground">Active Filters</h3>
                  <Button variant="ghost" size="sm" onClick={() => setFilterConditions([])} className="h-8 px-4 mt-2 text-xs">
                    Clear all
                  </Button>
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
                              {customMetrics.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
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

                      <Input
                        type="text"
                        placeholder="Value"
                        value={c.value}
                        onChange={e => updateFilterCondition(idx, "value", e.target.value)}
                        className="flex-1 h-9"
                      />
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
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>

            {/* ── Table / states ── */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mb-4" />
                <p className="text-sm text-muted-foreground">Loading {activeTab}...</p>
              </div>
            ) : error && getFilteredDataForTab().length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                <div className="rounded-full bg-destructive/10 p-3 mb-4">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Error loading data</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">{error}</p>
              </div>
            ) : getFilteredDataForTab().length > 0 ? (
              <div className="rounded-lg border bg-card overflow-hidden">
                <StyledTable columns={tableColumns} data={getFilteredDataForTab()} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-16">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  No data matches your current filters. Try adjusting your search or date range.
                </p>
                {(filterConditions.length > 0 || searchTerm) && (
                  <Button variant="outline" size="sm" onClick={handleClearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Campaigns