"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadCustomMetrics, evaluateFormula, formatMetricValue } from "@/lib/metrics"
import Image from "next/image"
import Calendar05 from "@/components/calendar-05"
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
import StyledTable from "@/components/ui/table-container" 
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import { format, subDays } from "date-fns"

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
  
  // Date range state - default to last 7 days
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 7),
    to: new Date(),
  })
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [tempDateRange, setTempDateRange] = useState(dateRange)
  
  const [visibleColumns, setVisibleColumns] = useState({
    campaigns: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
    adsets: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
    ads: ["name", "spend", "impressions", "reach", "clicks", "ctr"],
    leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name"],
  })
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
    // Format dates for API
    const startDate = format(dateRange.from, 'yyyy-MM-dd')
    const endDate = format(dateRange.to, 'yyyy-MM-dd')

    console.log('🔍 Fetching data for date range:', { startDate, endDate })

    // Fetch client groups first (for metadata only)
    const groupsResponse = await fetch("http://localhost:3005/api/client-groups", {
      credentials: "include",
      signal: signal,
    })

    if (!groupsResponse.ok) {
      throw new Error(`Failed to load client groups: ${groupsResponse.status}`)
    }

    const groupsData = await groupsResponse.json()
    const clientGroupsData = groupsData.client_groups || []

    console.log('📊 Client Groups:', clientGroupsData.length)

    if (!clientGroupsData || clientGroupsData.length === 0) {
      setClientGroups([])
      setIsLoading(false)
      return
    }

    setClientGroups(clientGroupsData)

    // Set first client group as default
    if (clientGroupsData.length > 0 && !selectedClientGroup) {
      setSelectedClientGroup(clientGroupsData[0].id)
    }

    // Build group IDs param
    const groupIds = clientGroupsData.map(g => g.id).join(',')
    console.log('🔍 Fetching insights for groups:', groupIds)

    // ============================================
    // 🔥 Fetch campaigns
    // ============================================
    const campaignsUrl = `http://localhost:3005/api/campaign-insights?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}`
    console.log('📡 Campaigns URL:', campaignsUrl)
    
    const campaignsResponse = await fetch(campaignsUrl, {
      credentials: "include",
      signal: signal,
    })

    // ============================================
    // 🔥 Fetch adsets
    // ============================================
    const adsetsUrl = `http://localhost:3005/api/adset-insights?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}`
    console.log('📡 Adsets URL:', adsetsUrl)
    
    const adsetsResponse = await fetch(adsetsUrl, {
      credentials: "include",
      signal: signal,
    })

    // ============================================
    // 🔥 Fetch ads
    // ============================================
    const adsUrl = `http://localhost:3005/api/ad-insights?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}`
    console.log('📡 Ads URL:', adsUrl)
    
    const adsResponse = await fetch(adsUrl, {
      credentials: "include",
      signal: signal,
    })

    // ============================================
    // 🔥 Fetch leads
    // ============================================
    const leadsResponse = await fetch(
      `http://localhost:3005/api/facebook-leads/filtered?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}&limit=5000`,
      {
        credentials: "include",
        signal: signal,
      }
    )

    // Process responses
    const [campaignsData, adsetsData, adsData, leadsData] = await Promise.all([
      campaignsResponse.ok ? campaignsResponse.json() : { insights: [] },
      adsetsResponse.ok ? adsetsResponse.json() : { insights: [] },
      adsResponse.ok ? adsResponse.json() : { insights: [] },
      leadsResponse.ok ? leadsResponse.json() : { leads: [] }
    ])

    console.log('📊 RAW DATA RECEIVED:')
    console.log('  - Campaigns insights:', campaignsData.insights?.length || 0)
    console.log('  - Adsets insights:', adsetsData.insights?.length || 0)
    console.log('  - Ads insights:', adsData.insights?.length || 0)
    console.log('  - Leads:', leadsData.leads?.length || 0)

    // Log first few items for inspection
    if (adsetsData.insights?.length > 0) {
      console.log('🔍 First adset insight:', adsetsData.insights[0])
    }
    if (adsData.insights?.length > 0) {
      console.log('🔍 First ad insight:', adsData.insights[0])
    }

    // ============================================
    // 🔥 AGGREGATE CAMPAIGNS BY NAME
    // ============================================
    const campaignAggregation = {}
    
    ;(campaignsData.insights || []).forEach(insight => {
      const data = insight.insight_data || {}
      const campaignKey = `${data.campaign_id}_${insight.client_group_id}`
      
      if (!campaignAggregation[campaignKey]) {
        campaignAggregation[campaignKey] = {
          id: data.campaign_id,
          name: data.campaign_name || 'Unknown Campaign',
          _groupId: insight.client_group_id,
          clientGroup: insight.client_group_name || 'Unknown',
          adAccount: insight.ad_account_id || '',
          spend: 0,
          social_spend: 0, // NEW: Add social spend
          impressions: 0,
          clicks: 0,
          reach: 0,
          leads: 0,
          account_currency: data.account_currency || 'USD', // NEW: Add currency
          conversion_rate_ranking: data.conversion_rate_ranking || 'UNKNOWN',
        }
      }
      
      const agg = campaignAggregation[campaignKey]
      agg.spend += Number.parseFloat(data.spend || "0")
      agg.social_spend += Number.parseFloat(data.social_spend || "0") // NEW: Aggregate social spend
      agg.impressions += Number.parseInt(data.impressions || "0", 10)
      agg.clicks += Number.parseInt(data.clicks || "0", 10)
      agg.reach += Number.parseInt(data.reach || "0", 10)
      agg.leads += Number.parseInt(data.leads || "0", 10)
      if (data.conversion_rate_ranking && data.conversion_rate_ranking !== 'UNKNOWN') {
        agg.conversion_rate_ranking = data.conversion_rate_ranking
      }
    })
    
    const processedCampaigns = Object.values(campaignAggregation).map(campaign => {
      campaign.ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions * 100) : 0
      campaign.cpc = campaign.clicks > 0 ? (campaign.spend / campaign.clicks) : 0
      campaign.cpm = campaign.impressions > 0 ? (campaign.spend / campaign.impressions * 1000) : 0
      campaign.cpp = campaign.reach > 0 ? (campaign.spend / campaign.reach) : 0 // NEW: Calculate CPP
      campaign.frequency = campaign.reach > 0 ? (campaign.impressions / campaign.reach) : 0
      return enhanceWithCustomMetrics(campaign)
    })

    console.log('✅ Processed campaigns:', processedCampaigns.length)

    // ============================================
    // 🔥 AGGREGATE ADSETS BY NAME
    // ============================================
    const adsetAggregation = {}
    
    console.log('🔍 Processing adsets, raw insights count:', adsetsData.insights?.length || 0)
    
    ;(adsetsData.insights || []).forEach((insight, index) => {
      const data = insight.insight_data || {}
      
      console.log(`🔍 Adset insight ${index}:`, {
        adset_id: data.adset_id,
        adset_name: data.adset_name,
        spend: data.spend,
        impressions: data.impressions,
        clicks: data.clicks
      })
      
      const adsetKey = `${data.adset_id}_${insight.client_group_id}`
      
      if (!adsetAggregation[adsetKey]) {
        adsetAggregation[adsetKey] = {
          id: data.adset_id,
          name: data.adset_name || 'Unknown AdSet',
          campaign_name: data.campaign_name || 'Unknown Campaign',
          _groupId: insight.client_group_id,
          clientGroup: insight.client_group_name || 'Unknown',
          adAccount: insight.ad_account_id || '',
          spend: 0,
          social_spend: 0, // NEW
          impressions: 0,
          clicks: 0,
          reach: 0,
          leads: 0,
          account_currency: data.account_currency || 'USD', // NEW
          conversion_rate_ranking: data.conversion_rate_ranking || 'UNKNOWN', // NEW
        }
      }
      
      const agg = adsetAggregation[adsetKey]
      agg.spend += Number.parseFloat(data.spend || "0")
      agg.social_spend += Number.parseFloat(data.social_spend || "0") 
      agg.impressions += Number.parseInt(data.impressions || "0", 10)
      agg.clicks += Number.parseInt(data.clicks || "0", 10)
      agg.reach += Number.parseInt(data.reach || "0", 10)
      agg.leads += Number.parseInt(data.leads || "0", 10)
      if (data.conversion_rate_ranking && data.conversion_rate_ranking !== 'UNKNOWN') {
      agg.conversion_rate_ranking = data.conversion_rate_ranking
    }
    })

    
    console.log('🔍 Adset aggregation keys:', Object.keys(adsetAggregation))
    console.log('🔍 Adset aggregation sample:', Object.values(adsetAggregation)[0])
    
    const processedAdsets = Object.values(adsetAggregation).map(adset => {
      adset.ctr = adset.impressions > 0 ? (adset.clicks / adset.impressions * 100) : 0
      adset.cpc = adset.clicks > 0 ? (adset.spend / adset.clicks) : 0
      adset.cpm = adset.impressions > 0 ? (adset.spend / adset.impressions * 1000) : 0
      adset.cpp = adset.reach > 0 ? (adset.spend / adset.reach) : 0 // NEW
      adset.frequency = adset.reach > 0 ? (adset.impressions / adset.reach) : 0
      return enhanceWithCustomMetrics(adset)
    })

    console.log('✅ Processed adsets:', processedAdsets.length)
    console.log('✅ First processed adset:', processedAdsets[0])

    // ============================================
    // 🔥 AGGREGATE ADS BY NAME
    // ============================================
    const adAggregation = {}
    
    console.log('🔍 Processing ads, raw insights count:', adsData.insights?.length || 0)
    
    ;(adsData.insights || []).forEach((insight, index) => {
      const data = insight.insight_data || {}
      
      console.log(`🔍 Ad insight ${index}:`, {
        ad_id: data.ad_id,
        ad_name: data.ad_name,
        spend: data.spend,
        impressions: data.impressions,
        clicks: data.clicks
      })
      
      const adKey = `${data.ad_id}_${insight.client_group_id}`
      
      if (!adAggregation[adKey]) {
        adAggregation[adKey] = {
          id: data.ad_id,
          name: data.ad_name || 'Unknown Ad',
          campaign_name: data.campaign_name || 'Unknown Campaign',
          adset_name: data.adset_name || 'Unknown AdSet',
          _groupId: insight.client_group_id,
          clientGroup: insight.client_group_name || 'Unknown',
          adAccount: insight.ad_account_id || '',
          spend: 0,
          social_spend: 0, // NEW
          impressions: 0,
          clicks: 0,
          reach: 0,
          leads: 0,
          account_currency: data.account_currency || 'USD', // NEW
          conversion_rate_ranking: data.conversion_rate_ranking || 'UNKNOWN', // NEW    
        }
      }
      
      const agg = adAggregation[adKey]
      agg.spend += Number.parseFloat(data.spend || "0")
      agg.social_spend += Number.parseFloat(data.social_spend || "0") // NEW
      agg.impressions += Number.parseInt(data.impressions || "0", 10)
      agg.clicks += Number.parseInt(data.clicks || "0", 10)
      agg.reach += Number.parseInt(data.reach || "0", 10)
      agg.leads += Number.parseInt(data.leads || "0", 10)
      if (data.conversion_rate_ranking && data.conversion_rate_ranking !== 'UNKNOWN') {
      agg.conversion_rate_ranking = data.conversion_rate_ranking
    }
    })
    
    console.log('🔍 Ad aggregation keys:', Object.keys(adAggregation))
    console.log('🔍 Ad aggregation sample:', Object.values(adAggregation)[0])
    
    const processedAds = Object.values(adAggregation).map(ad => {
      ad.ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions * 100) : 0
      ad.cpc = ad.clicks > 0 ? (ad.spend / ad.clicks) : 0
      ad.cpm = ad.impressions > 0 ? (ad.spend / ad.impressions * 1000) : 0
      ad.cpp = ad.reach > 0 ? (ad.spend / ad.reach) : 0 // NEW
      ad.frequency = ad.reach > 0 ? (ad.impressions / ad.reach) : 0
      return enhanceWithCustomMetrics(ad)
    })

    console.log('✅ Processed ads:', processedAds.length)
    console.log('✅ First processed ad:', processedAds[0])

    setCampaigns(processedCampaigns)
    setAllAdSets(processedAdsets)
    setAllAds(processedAds)
    setLeads(leadsData.leads || [])

    console.log(`✅ Loaded data for ${startDate} to ${endDate}:`, {
      campaigns: processedCampaigns.length,
      adsets: processedAdsets.length,
      ads: processedAds.length,
      leads: (leadsData.leads || []).length
    })

  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Request was aborted (likely due to React Strict Mode)")
      return
    }
    
    console.error('❌ fetchAllData error:', err)
    setError(err.message || "Failed to load marketing data")
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
  }, []) // Only load once on mount

  // Reload data when date range changes
  useEffect(() => {
    const controller = new AbortController()
    
    if (dateRange.from && dateRange.to) {
      fetchAllData(controller.signal)
    }
    
    return () => {
      controller.abort()
    }
  }, [dateRange])

  const applyFilters = (data) => {
    let filtered = [...data]

    // Filter by selected client group
    if (selectedClientGroup) {
      if (activeTab === "leads") {
        // For leads, match by group_name since leads don't have _groupId
        const selectedGroup = clientGroups.find(g => g.id === selectedClientGroup)
        if (selectedGroup) {
          filtered = filtered.filter((i) => i.group_name === selectedGroup.name)
        }
      } else {
        filtered = filtered.filter((i) => i._groupId === selectedClientGroup)
      }
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
              i.campaign_name?.toLowerCase().includes(lower) ||
              i.group_name?.toLowerCase().includes(lower))),
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
  let data = []
  if (activeTab === "campaigns") data = campaigns
  if (activeTab === "adsets") data = allAdSets
  if (activeTab === "ads") data = allAds
  if (activeTab === "leads") data = leads
  
  console.log(`🔍 getFilteredDataForTab (${activeTab}):`, {
    rawCount: data.length,
    filtered: applyFilters(data).length
  })
  
  return applyFilters(data)
}
  
  const baseColumns = [
  "adAccount",
  "spend",
  "social_spend", // NEW
  "impressions",
  "clicks",
  "cpc",
  "cpp", // NEW
  "reach",
  "ctr",
  "cpm",
  "frequency",
  "conversion_rate_ranking", // NEW
  "account_currency", // NEW
  ]
  
  const getAvailableColumns = () => {
    if (activeTab === "leads") return ["full_name", "email", "phone_number", "ad_name", "campaign_name", "group_name", "created_time"]
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
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    return { totalSpend, totalLeads, totalClicks, totalImpressions, avgCTR }
  }
  const metrics = calculateMetrics()

  const formatCellValue = (value, col) => {
    if (value === null || value === undefined) return "-"
    if (customMetrics.some((m) => m.id === col)) return formatMetricValue(value, col)
    if (["spend", "cpc", "cpm", "cpp", "social_spend"].includes(col)) return `$${Number(value).toFixed(2)}`
    if (col === "ctr") return `${Number(value).toFixed(2)}%`
    if (col === "account_currency") return value.toUpperCase()
    if (col === "conversion_rate_ranking") return value.replace(/_/g, ' ')
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

  // Date range preset handlers
  const handleDateRangePreset = (days) => {
    const newRange = {
      from: subDays(new Date(), days),
      to: new Date(),
    }
    setTempDateRange(newRange)
  }

  const applyDateRange = () => {
    setDateRange(tempDateRange)
    setDatePickerOpen(false)
  }

  const resetDateRange = () => {
    const defaultRange = {
      from: subDays(new Date(), 7),
      to: new Date(),
    }
    setTempDateRange(defaultRange)
    setDateRange(defaultRange)
    setDatePickerOpen(false)
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

            {/* Enhanced Date Range Picker */}
        {/* Enhanced Date Range Picker */}
<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      className="w-auto justify-between font-semibold bg-white gap-2 px-3"
    >
      <CalendarIcon className="h-4 w-4" />
      <span className="hidden md:inline">
        {dateRange.from && dateRange.to
          ? `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
          : "Select date range"}
      </span>
      <ChevronDown className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0 bg-white" align="end">
    <div className="p-3">
      <Calendar
        mode="range"
        defaultMonth={tempDateRange?.from}
        selected={tempDateRange}
        onSelect={(range) => {
          if (range?.from && range?.to) {
            setTempDateRange({ from: range.from, to: range.to })
          } else if (range?.from) {
            setTempDateRange({ from: range.from, to: range.from })
          }
        }}
        numberOfMonths={2}
        captionLayout="dropdown-buttons"
        fromYear={2020}
        toYear={new Date().getFullYear()}
        disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
        className="rounded-lg border shadow-sm"
      />

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-3 border-t mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={resetDateRange}
        >
          Reset
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDatePickerOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={applyDateRange}
            disabled={!tempDateRange.from || !tempDateRange.to}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  </PopoverContent>
</Popover>
          </div>
        </div>

        {/* Date Range Indicator */}
        {dateRange.from && dateRange.to && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>
              Showing data from {format(dateRange.from, "MMM dd, yyyy")} to {format(dateRange.to, "MMM dd, yyyy")}
              ({Math.ceil((dateRange.to - dateRange.from) / (1000 * 60 * 60 * 24))} days)
            </span>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Spend", icon: DollarSign, value: `$${metrics.totalSpend.toFixed(2)}` },
            { label: "Total Leads", icon: Target, value: metrics.totalLeads },
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
              <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700 mb-4"></div>
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
                  No data matches your current filters. Try adjusting your search criteria or date range.
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