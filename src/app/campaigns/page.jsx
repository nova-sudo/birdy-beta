"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { loadCustomMetrics, evaluateFormula, formatMetricValue } from "@/lib/metrics"
import Image from "next/image"
import Calendar05 from "@/components/calendar-05"
import { useColumnViews } from "@/lib/useColumnViews"
import { ViewLoading } from "@/components/ui/ViewLoading"
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
import Flask from "../../../public/Flask.png"
import { getMetricDisplayName } from "@/lib/metrics"
import StyledTable from "@/components/ui/table-container"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import { format, subDays } from "date-fns"
import getSymbolFromCurrency from "currency-symbol-map";

const userCurrency = localStorage.getItem("user_default_currency");

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
  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("campaigns")


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
    // 🔥 UPDATED: All new lead fields are visible by default
    leads: [
      "full_name",
      "email",
      "phone_number",
      "ad_name",
      "adset_name",
      "campaign_name",
      "ad_id",
      "adset_id",
      "campaign_id",
      "form_id",
      "platform",
      "is_organic",
      "created_time",
    ],
  })
  // ③ apply saved view
  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setVisibleColumns(prev => ({ ...prev, ...savedColumns }))
  }, [viewsLoaded, savedColumns])
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
      const startDate = format(dateRange.from, 'yyyy-MM-dd')
      const endDate = format(dateRange.to, 'yyyy-MM-dd')

      console.log('🔍 Fetching data for date range:', { startDate, endDate })

      const groupsResponse = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
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

      if (clientGroupsData.length > 0 && !selectedClientGroup) {
        setSelectedClientGroup(clientGroupsData[0].id)
      }

      const groupIds = clientGroupsData.map(g => g.id).join(',')
      console.log('🔍 Fetching insights for groups:', groupIds)

      const campaignsUrl = `https://birdy-backend.vercel.app/api/campaign-insights?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}`
      console.log('📡 Campaigns URL:', campaignsUrl)

      const campaignsResponse = await fetch(campaignsUrl, {
        credentials: "include",
        signal: signal,
      })

      const adsetsUrl = `https://birdy-backend.vercel.app/api/adset-insights?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}`
      console.log('📡 Adsets URL:', adsetsUrl)

      const adsetsResponse = await fetch(adsetsUrl, {
        credentials: "include",
        signal: signal,
      })

      const adsUrl = `https://birdy-backend.vercel.app/api/ad-insights?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}`
      console.log('📡 Ads URL:', adsUrl)

      const adsResponse = await fetch(adsUrl, {
        credentials: "include",
        signal: signal,
      })

      const leadsResponse = await fetch(
        `https://birdy-backend.vercel.app/api/facebook-leads/filtered?start_date=${startDate}&end_date=${endDate}&groups=${groupIds}&limit=5000`,
        {
          credentials: "include",
          signal: signal,
        }
      )

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

      if (adsetsData.insights?.length > 0) {
        console.log('🔍 First adset insight:', adsetsData.insights[0])
      }
      if (adsData.insights?.length > 0) {
        console.log('🔍 First ad insight:', adsData.insights[0])
      }

      // ============================================
      // AGGREGATE CAMPAIGNS
      // ============================================
      const campaignAggregation = {}

        ; (campaignsData.insights || []).forEach(insight => {
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
              social_spend: 0,
              impressions: 0,
              clicks: 0,
              reach: 0,
              leads: 0,
              account_currency: data.account_currency || 'USD',
              conversion_rate_ranking: data.conversion_rate_ranking || 'UNKNOWN',
            }
          }

          const agg = campaignAggregation[campaignKey]
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

      const processedCampaigns = Object.values(campaignAggregation).map(campaign => {
        campaign.ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions * 100) : 0
        campaign.cpc = campaign.clicks > 0 ? (campaign.spend / campaign.clicks) : 0
        campaign.cpm = campaign.impressions > 0 ? (campaign.spend / campaign.impressions * 1000) : 0
        campaign.cpp = campaign.reach > 0 ? (campaign.spend / campaign.reach) : 0
        campaign.frequency = campaign.reach > 0 ? (campaign.impressions / campaign.reach) : 0
        return enhanceWithCustomMetrics(campaign)
      })

      console.log('✅ Processed campaigns:', processedCampaigns.length)

      // ============================================
      // AGGREGATE ADSETS
      // ============================================
      const adsetAggregation = {}

      console.log('🔍 Processing adsets, raw insights count:', adsetsData.insights?.length || 0)

        ; (adsetsData.insights || []).forEach((insight, index) => {
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
              social_spend: 0,
              impressions: 0,
              clicks: 0,
              reach: 0,
              leads: 0,
              account_currency: data.account_currency || 'USD',
              conversion_rate_ranking: data.conversion_rate_ranking || 'UNKNOWN',
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
        adset.cpp = adset.reach > 0 ? (adset.spend / adset.reach) : 0
        adset.frequency = adset.reach > 0 ? (adset.impressions / adset.reach) : 0
        return enhanceWithCustomMetrics(adset)
      })

      console.log('✅ Processed adsets:', processedAdsets.length)
      console.log('✅ First processed adset:', processedAdsets[0])

      // ============================================
      // AGGREGATE ADS
      // ============================================
      const adAggregation = {}

      console.log('🔍 Processing ads, raw insights count:', adsData.insights?.length || 0)

        ; (adsData.insights || []).forEach((insight, index) => {
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
              social_spend: 0,
              impressions: 0,
              clicks: 0,
              reach: 0,
              leads: 0,
              account_currency: data.account_currency || 'USD',
              conversion_rate_ranking: data.conversion_rate_ranking || 'UNKNOWN',
            }
          }

          const agg = adAggregation[adKey]
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

      console.log('🔍 Ad aggregation keys:', Object.keys(adAggregation))
      console.log('🔍 Ad aggregation sample:', Object.values(adAggregation)[0])

      const processedAds = Object.values(adAggregation).map(ad => {
        ad.ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions * 100) : 0
        ad.cpc = ad.clicks > 0 ? (ad.spend / ad.clicks) : 0
        ad.cpm = ad.impressions > 0 ? (ad.spend / ad.impressions * 1000) : 0
        ad.cpp = ad.reach > 0 ? (ad.spend / ad.reach) : 0
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
    const controller = new AbortController()
    const loadData = async () => {
      await fetchAllData(controller.signal)
    }
    loadData()
    return () => {
      controller.abort()
    }
  }, [])

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

    if (selectedClientGroup) {
      if (activeTab === "leads") {
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
              i.adset_name?.toLowerCase().includes(lower) ||
              i.campaign_name?.toLowerCase().includes(lower) ||
              i.group_name?.toLowerCase().includes(lower) ||
              i.platform?.toLowerCase().includes(lower))),
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
    "social_spend",
    "impressions",
    "clicks",
    "cpc",
    "cpp",
    "reach",
    "ctr",
    "cpm",
    "frequency",
    "conversion_rate_ranking",
    "account_currency",
  ]

  const getAvailableColumns = () => {
    if (activeTab === "leads") {
      // 🔥 UPDATED: All new lead fields available
      return [
        "full_name",
        "email",
        "phone_number",
        "ad_name",
        "adset_name",
        "campaign_name",
        "ad_id",
        "adset_id",
        "campaign_id",
        "form_id",
        "platform",
        "is_organic",
        "created_time",
        "group_name",
      ]
    }
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

  const saveView = async () => {
    await saveToDB(visibleColumns)
    setColumnsOpen(false)
  }
  if (!viewsLoaded) return <ViewLoading />


  const getIcon = (col) => {
    if (col.id === "clientGroup" || col.id === "name") return Flask
    return metaa
  }

  const getCurrentVisibleColumns = () => visibleColumns[activeTab] || []

  const tableTitle = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Overview`;
  const tableDescription = `Showing ${getFilteredDataForTab().length} ${activeTab}`;
  const tableColumns = getCurrentVisibleColumns().map((col) => ({
    key: col,
    header: getMetricDisplayName(col),
    label: getMetricDisplayName(col),
    icons: col === "clientGroup" || col === "name" ? Flask : metaa,
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
    if (["spend", "cpc", "cpm", "cpp", "social_spend"].includes(col)) return `${getSymbolFromCurrency(userCurrency)}${Number(value).toFixed(2)}`
    if (col === "ctr") return `${Number(value).toFixed(2)}%`
    if (col === "account_currency") return value.toUpperCase()
    if (col === "conversion_rate_ranking") return value.replace(/_/g, ' ')
    // 🔥 NEW: Format boolean is_organic as readable text
    if (col === "is_organic") return value ? "Yes" : "No"
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
    <div className="min-h-dvh w-[calc(100dvw-70px)] mx-auto md:w-[calc(100dvw-130px)]">
      <div className="flex flex-col gap-6">
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

          <div className="flex items-center gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg py-1 px-1 w-fit">
            <Input
              type="search"
              placeholder={`Search ${activeTab}...`}
              className="h-10 bg-white w-fit md:w-65 rounded-md text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex gap-1 overflow-x-auto lg:overflow-x-hidden">
              {/* <Button
                variant="outline"
                size="sm"
                onClick={addFilterCondition}
                className="gap-2 h-10 bg-white font-semibold md:px-2 lg:px-3"
              >
                <SlidersHorizontal className="h-4 w-4 mr-2 md:mr-0 lg:mr-2" />
                <span className="hidden lg:inline">Add Filter</span>
              </Button> */}

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

              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-auto h-10 font-semibold bg-white gap-2 px-3"
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

                    <div className="flex items-center pt-3 border-t mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetDateRange}
                        className="border border-gray-300 rounded-md mr-2"
                      >
                        Reset
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDatePickerOpen(false)}
                          className="border border-gray-300 rounded-md mr-2"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={applyDateRange}
                          disabled={!tempDateRange.from || !tempDateRange.to}
                          className="rounded-md bg-purple-600 text-white font-semibold"
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
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Spend", icon: DollarSign, value: `${getSymbolFromCurrency(userCurrency)}${metrics.totalSpend.toFixed(2)}` },
            { label: "Total Leads", icon: Target, value: metrics.totalLeads },
            { label: "Avg CTR", icon: MousePointerClick, value: `${metrics.avgCTR.toFixed(2)}%` },
            { label: "Avg CPL", icon: TrendingUp, value: metrics.totalLeads > 0 ? `${getSymbolFromCurrency(userCurrency)}${(metrics.totalSpend / metrics.totalLeads).toFixed(2)}` : "-" },
          ].map((c, i) => (
            <Card key={i} className="border shadow-sm rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground font-normal text-sm ">{c.label}</CardTitle>
                <div className="h-7 w-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <c.icon className="h-4 w-4 text-muted-foreground text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground ">Across all {activeTab}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 gap-4 md:gap-0 shadow-sm overflow-x-auto">
            <TabsTrigger
              value="campaigns"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-600"
            >
              <LayoutGrid className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger
              value="adsets"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-600"
            >
              <Grid3X3 className="h-4 w-4" />
              Ad Sets
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-600"
            >
              <FileBarChart className="h-4 w-4" />
              Ads
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-r-0 data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-600"
            >
              <Users className="h-4 w-4" />
              Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Filters */}
            <div className="flex flex-col space-y-0 md:flex-row md:items-center md:justify-between md:space-y-0">

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
                                <SelectItem value="adset_name">Ad Set Name</SelectItem>
                                <SelectItem value="campaign_name">Campaign Name</SelectItem>
                                <SelectItem value="ad_id">Ad ID</SelectItem>
                                <SelectItem value="adset_id">Ad Set ID</SelectItem>
                                <SelectItem value="campaign_id">Campaign ID</SelectItem>
                                <SelectItem value="form_id">Form ID</SelectItem>
                                <SelectItem value="platform">Platform</SelectItem>
                                <SelectItem value="is_organic">Organic</SelectItem>
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