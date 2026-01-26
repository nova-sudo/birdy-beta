"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadCustomMetrics, evaluateFormula, formatMetricValue } from "@/lib/metrics"
import Image from "next/image"
// import  loadCustomMetrics  from "../../lib/load-custom-metrics"
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
  CalendarIcon,
  ChevronDown,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import metaa from "../../../public/meta-icon-DH8jUhnM.png"
import lab from "../../../public/lab.png"
import { getMetricDisplayName } from "@/lib/metrics"
import StyledTable from "@/components/ui/table-container" // Or the correct path; assuming it's default exported
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"

const Campaigns = () => {
  const [customMetrics, setCustomMetrics] = useState([])
  const [clientGroups, setClientGroups] = useState([])
  const [selectedClientGroup, setSelectedClientGroup] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [allAdSets, setAllAdSets] = useState([])
  const [allAds, setAllAds] = useState([])
  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("campaigns")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterConditions, setFilterConditions] = useState([])
  const [visibleColumns, setVisibleColumns] = useState({
    campaigns: ["name", "spend", "cpl", "impressions", "clicks"],
    adsets: ["name", "spend", "cpl", "impressions", "clicks"],
    ads: ["name", "spend", "cpl", "impressions", "clicks"],
    leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name"],
  })
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsSearch, setColumnsSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Load custom metrics
  useEffect(() => {
    const metrics = loadCustomMetrics().filter((m) => m.enabled && m.dashboard === "Campaigns")
    setCustomMetrics(metrics)
    console.log("Loaded custom metrics:", metrics)
  }, [])

  // Sync visibility when new custom metrics appear
  useEffect(() => {
    const customIds = customMetrics.map((m) => m.id)
    setVisibleColumns((prev) => {
      const updated = { ...prev }
      ;["campaigns", "adsets", "ads"].forEach((tab) => {
        const existing = new Set(updated[tab] || [])
        customIds.forEach((id) => {
          if (!existing.has(id)) {
            updated[tab] = [...updated[tab], id]
          }
        })
      })
      return updated
    })
  }, [customMetrics])

  const enhanceWithCustomMetrics = (item) => {
  const base = { ...item }
  // Load custom metrics directly here instead of using state
  const customMetricsForDashboard = loadCustomMetrics().filter((m) => m.enabled && m.dashboard === "Campaigns")
  
  customMetricsForDashboard.forEach((metric) => {
    if (metric.formulaParts) {
      base[metric.id] = evaluateFormula(metric.formulaParts, base)
    }
  })
  return base
}


  const fetchAllData = async (signal) => {
    setIsLoading(true)
    setError(null)

    const timeoutId = setTimeout(() => signal?.abort(), 45_000)

    try {
      // Fetch client groups (includes campaigns, ads, adsets under facebook)
      const groupsResponse = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
        credentials: "include",
        signal: signal,
      })

      if (!groupsResponse.ok) {
        throw new Error(`Failed to load client groups: ${groupsResponse.status}`)
      }

      const groupsData = await groupsResponse.json()
      const clientGroupsData = groupsData.client_groups || []

      if (!clientGroupsData || clientGroupsData.length === 0) {
        setClientGroups([])
        setIsLoading(false)
        return
      }

      setClientGroups(clientGroupsData)

      // Extract campaigns, ads, and adsets from client groups
      const allCampaigns = []
      const allAdSets = []
      const allAds = []

      clientGroupsData.forEach((group) => {
        const facebookData = group.facebook || {}
        const clientGroupName = group.name
        const adAccountName = facebookData.name || "Unknown"

        // Process campaigns
        ;(facebookData.campaigns || []).forEach((campaign) => {
          allCampaigns.push(
            enhanceWithCustomMetrics({
              id: campaign.id,
              name: campaign.name || "Unknown Campaign",
              clientGroup: clientGroupName,
              adAccount: adAccountName,
              spend: Number.parseFloat(campaign.spend || "0"),
              cpl: Number.parseFloat(campaign.cpl || "0"),
              impressions: Number.parseInt(campaign.impressions || "0"),
              clicks: Number.parseInt(campaign.clicks || "0"),
              cpc: Number.parseFloat(campaign.cpc || "0"),
              reach: Number.parseInt(campaign.reach || "0"),
              frequency: Number.parseFloat(campaign.frequency || "0"),
              cpm: Number.parseFloat(campaign.cpm || "0"),
              ctr: Number.parseFloat(campaign.ctr || "0"),
              _groupId: group.id,
            }),
          )
        })

        // Process adsets
        ;(facebookData.adsets || []).forEach((adset) => {
          allAdSets.push(
            enhanceWithCustomMetrics({
              id: adset.id,
              name: adset.name || "Unknown Ad Set",
              clientGroup: clientGroupName,
              adAccount: adAccountName,
              spend: Number.parseFloat(adset.spend || "0"),
              leads: Number.parseInt(adset.leads || "0"),
              cpl: Number.parseFloat(adset.cpl || "0"),
              impressions: Number.parseInt(adset.impressions || "0"),
              clicks: Number.parseInt(adset.clicks || "0"),
              cpc: Number.parseFloat(adset.cpc || "0"),
              reach: Number.parseInt(adset.reach || "0"),
              frequency: Number.parseFloat(adset.frequency || "0"),
              cpm: Number.parseFloat(adset.cpm || "0"),
              ctr: Number.parseFloat(adset.ctr || "0"),
              _groupId: group.id,
            }),
          )
        })

        // Process ads
        ;(facebookData.ads || []).forEach((ad) => {
          allAds.push(
            enhanceWithCustomMetrics({
              id: ad.id,
              name: ad.name || "Unknown Ad",
              clientGroup: clientGroupName,
              adAccount: adAccountName,
              spend: Number.parseFloat(ad.spend || "0"),
              leads: Number.parseInt(ad.leads || "0"),
              cpl: Number.parseFloat(ad.cpl || "0"),
              impressions: Number.parseInt(ad.impressions || "0"),
              clicks: Number.parseInt(ad.clicks || "0"),
              cpc: Number.parseFloat(ad.cpc || "0"),
              reach: Number.parseInt(ad.reach || "0"),
              frequency: Number.parseFloat(ad.frequency || "0"),
              cpm: Number.parseFloat(ad.cpm || "0"),
              ctr: Number.parseFloat(ad.ctr || "0"),
              _groupId: group.id,
            }),
          )
        })
      })

      setCampaigns(allCampaigns)
      setAllAdSets(allAdSets)
      setAllAds(allAds)

      // Set first client group as default
      if (clientGroupsData.length > 0) {
        setSelectedClientGroup(clientGroupsData[0].id)
      }

      // Fetch leads separately
      const leadsResponse = await fetch("https://birdy-backend.vercel.app/api/leads", {
        credentials: "include",
        signal: signal,
      })

      if (leadsResponse.ok) {
        const leadsData = await leadsResponse.json()
        const allLeads = (leadsData.leads || []).map((lead) => ({
          ...lead,
          _groupId: clientGroupsData.find((g) => g.name === lead.clientGroup)?.id,
        }))
        setLeads(allLeads)
      }
    } catch (err) {
      // Ignore errors from cancelled requests (React Strict Mode in dev)
      if (err.name === "AbortError") {
        console.log("Request was aborted (likely due to React Strict Mode)")
        return // Don't set error state for aborted requests
      }
      
      setError(err.message || "Failed to load marketing data")
      console.error("fetchAllData error:", err)
      // Don't clear existing data on error - keep what we have
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Create abort controller for cleanup
    const controller = new AbortController()
    
    const loadData = async () => {
      await fetchAllData(controller.signal)
    }
    
    loadData()
    
    // Cleanup: abort any pending requests when component unmounts
    return () => {
      controller.abort()
    }
  }, [])

  const applyFilters = (data) => {
    let filtered = [...data]

    // Filter by selected client group
    if (selectedClientGroup) {
      filtered = filtered.filter((i) => i._groupId === selectedClientGroup)
    }

    const lower = searchTerm.toLowerCase()

    if (searchTerm) {
      filtered = filtered.filter(
        (i) =>
          i.name?.toLowerCase().includes(lower) ||
          i.clientGroup?.toLowerCase().includes(lower) ||
          i.adAccount?.toLowerCase().includes(lower) ||
          (activeTab === "leads" &&
            (i.full_name?.toLowerCase().includes(lower) ||
              i.email?.toLowerCase().includes(lower) ||
              i.phone_number?.toLowerCase().includes(lower) ||
              i.ad_name?.toLowerCase().includes(lower) ||
              i.campaign_name?.toLowerCase().includes(lower))),
      )
    }

    filterConditions.forEach((c) => {
      filtered = filtered.filter((i) => {
        const val = i[c.field]
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
  

  const baseColumns = [
    "adAccount",
    "spend",
    "cpl",
    "impressions",
    "clicks",
    "cpc",
    "reach",
    "ctr",
  ]
  const getAvailableColumns = () => {
    if (activeTab === "leads") return ["full_name", "email", "phone_number", "ad_name", "campaign_name", "clientGroup"]
    return ["name", "clientGroup", ...baseColumns, ...customMetrics.map((m) => m.id)]
  }

  const categories = [
  { id: "all", label: "All" },
  { id: "meta", label: "Meta" },
  { id: "custom", label: "Custom" },
  ]

  const toggleableColumns = getAvailableColumns().filter((col) => col !== "name")

  const metaCount = toggleableColumns.filter(col => baseColumns.includes(col)).length
  const customCount = toggleableColumns.length - metaCount

  const categoryCounts = {
  all: toggleableColumns.length,
  meta: metaCount,
  custom: customCount,
}

const allColumnsForDropdown = toggleableColumns.map((col) => ({
  id: col,
  label: getMetricDisplayName(col),
  visible: (visibleColumns[activeTab] || []).includes(col),
  type: baseColumns.includes(col) ? "meta" : "custom",
}))

const filteredColumns = allColumnsForDropdown.filter((col) => {
  const matchesCategory =
    selectedCategory === "all" || col.type === selectedCategory

  const matchesSearch = col.label
    .toLowerCase()
    .includes(columnsSearch.toLowerCase())

  return matchesCategory && matchesSearch
})

const columnVisibility = Object.fromEntries(
  allColumnsForDropdown.map((c) => [
    c.id,
    (visibleColumns[activeTab] || []).includes(c.id)
  ])
)

const toggleColumnVisibility = (colId) => {
  toggleColumn(colId)
}

const selectAll = () => {
  setVisibleColumns((prev) => ({
    ...prev,
    [activeTab]: getAvailableColumns(),
  }))
}

const clearAll = () => {
  setVisibleColumns((prev) => ({
    ...prev,
    [activeTab]: activeTab === "leads" ? [] : ["name"],
  }))
}

const saveView = () => {
  setColumnsOpen(false)
}

const getIcon = (col) => {
  if (col.id === "clientGroup" || col.id === "name") return lab
  return metaa
}

  const getCurrentVisibleColumns = () => visibleColumns[activeTab] || []

  const tableTitle = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Overview`;
const tableDescription = `Showing ${getFilteredDataForTab().length} ${activeTab}`;
const tableColumns = getCurrentVisibleColumns().map((col) => ({
  key: col,
  header: () => (
    <div className="flex items-center justify-between min-w-[200px]">
      <span>{getMetricDisplayName(col)}</span>
      {col === "clientGroup" || col === "name" ? (
        <Image src={lab} alt="Lab" className="w-4 h-4 ml-2" />
      ) : (
        <Image src={metaa} alt="Meta" className="w-4 h-4 ml-2" />
      )}
    </div>
  ),
  render: (value) => formatCellValue(value, col),
}));

  const toggleColumn = (col) => {
    setVisibleColumns((prev) => {
      const cur = prev[activeTab] || []
      const updated = cur.includes(col) ? cur.filter((c) => c !== col) : [...cur, col]
      return { ...prev, [activeTab]: updated }
    })
  }

  const calculateMetrics = () => {
    const data = getFilteredDataForTab()
    const totalSpend = data.reduce((s, i) => s + (i.spend || 0), 0)
    const totalLeads = data.reduce((s, i) => s + (i.leads || 0), 0)
    const totalClicks = data.reduce((s, i) => s + (i.clicks || 0), 0)
    const totalImpressions = data.reduce((s, i) => s + (i.impressions || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    return { totalSpend, totalLeads, totalClicks, totalImpressions, avgCPL, avgCTR }
  }
  const metrics = calculateMetrics()

  const formatCellValue = (value, col) => {
    if (value === null || value === undefined) return "-"
    if (customMetrics.some((m) => m.id === col)) return formatMetricValue(value, col)
    if (["spend", "cpl", "cpc", "cpm"].includes(col)) return `$${Number(value).toFixed(2)}`
    if (col === "ctr") return `${Number(value).toFixed(2)}%`
    if (typeof value === "number") return value.toLocaleString()
    return value
  }

  const addFilterCondition = () => {
    setFilterConditions((prev) => [
      ...prev,
      { field: activeTab === "leads" ? "full_name" : "name", operator: "contains", value: "" },
    ])
  }
  const updateFilterCondition = (idx, field, val) => {
    setFilterConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c)))
  }
  const removeFilterCondition = (idx) => {
    setFilterConditions((prev) => prev.filter((_, i) => i !== idx))
  }
  const handleClearFilters = () => {
    setFilterConditions([])
    setSearchTerm("")
  }

  return (
    <div className="min-h-dvh w-[calc(100dvw-30px)] md:w-[calc(100dvw-100px)]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select a client group" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    {clientGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border padding-4px rounded-lg py-1 px-1">
            <Input
              type="search"
              placeholder={`Search ${activeTab}...`}
              className="h-10 bg-white w-40"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={addFilterCondition}
              className="gap-2 h-10 bg-white font-semibold md:px-2 lg:px-3"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2 md:mr-0 lg:mr-2" />
              <span className="hidden lg:inline">Add Filter</span>
            </Button>

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
              toggleColumnVisibility={toggleColumnVisibility}

              getIcon={getIcon}

              selectAll={selectAll}
              clearAll={clearAll}
              save={saveView}
            />

            {/* date filter */}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date"
                  className="w-35 justify-between font-semibold bg-white"
                  placeholder="Select date"
                >
                  <CalendarIcon />
                  {date ? date.toLocaleDateString() : "Select date"}
                  <ChevronDown />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0 bg-white" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  captionLayout="dropdown"
                  onSelect={(date) => {
                    setDate(date)
                    setOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
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
                  <c.icon className="h-5 w-5 text-muted-foreground text-purple-500" />
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
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 gap-4 md:gap-0 shadow-sm overflow-x-auto">
            <TabsTrigger
              value="campaigns"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              <LayoutGrid className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger
              value="adsets"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              <Grid3X3 className="h-4 w-4" />
              Ad Sets
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              <FileBarChart className="h-4 w-4" />
              Ads
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              <Users className="h-4 w-4" />
              Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Filters */}
              <div className="flex flex-col space-y-0 md:flex-row md:items-center md:justify-between md:space-y-0">
              
              {/* Active Filters */}
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
                      <div key={idx} className="flex items-center gap-2 p-3  bg-muted/50 border-t">
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
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
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
               <div className="flex justify-end items-center gap-3 flex-1">
                  {(filterConditions.length > 0 || searchTerm) && (
                    <Button variant="outline" size="sm" onClick={handleClearFilters} className="gap-2 bg-transparent">
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <loading />
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
                {/* <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b border-r whitespace-nowrap">
                      <tr>
                        {getCurrentVisibleColumns().map((col) => (
                          <th key={col} className="border-r px-4 py-3 text-left text-sm font-medium text-foreground">
                            <div className="flex items-center justify-between min-w-[200px]">
                              <span>
                                {getMetricDisplayName(col)}
                              </span>
                              
                              {col === "clientGroup" || col === "name" ? (
                                <Image src={lab} alt="Lab" className="w-4 h-4 ml-2" />
                              ) : (
                                <Image src={metaa} alt="Meta" className="w-4 h-4 ml-2" />
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
                </div> */}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-16">
                <div className="rounded-full bg-muted p-3 mb-4">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  No data matches your current filters. Try adjusting your search criteria.
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