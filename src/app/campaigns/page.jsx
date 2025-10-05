"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

const Campaigns = () => {
  const [adAccounts, setAdAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(null)
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
    campaigns: ["name", "spend", "leads", "cpl", "impressions", "clicks"],
    adsets: ["name", "spend", "leads", "cpl", "impressions", "clicks"],
    ads: ["name", "spend", "leads", "cpl", "impressions", "clicks"],
    leads: ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform"],
  })

  const fetchAdAccounts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("http://localhost:5000/api/facebook/adaccounts", { credentials: "include" })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP ${response.status}: ${errorData.detail || "Failed to fetch ad accounts"}`)
      }
      const data = await response.json()
      const adAccountData = data.data.data.map((account) => ({
        id: account.id,
        name: account.name || "Unknown Account",
        currency: account.currency || "Unknown",
        created_time: account.created_time || "",
        owner: account.owner || "",
      }))
      setAdAccounts(adAccountData)
    } catch (error) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAccountData = async (accountId) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:5000/api/facebook/adaccounts/${accountId}/data`, {
        credentials: "include",
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP ${response.status}: ${errorData.detail || "Failed to fetch account data"}`)
      }
      const data = await response.json()

      const campaignData = (data.data?.data || []).map((campaign) => {
        const insights = campaign.insights?.data?.[0] || {}
        const leadAction = insights.actions?.find((a) => a.action_type === "onsite_conversion.lead_grouped") || {}
        const costPerResult =
          insights.cost_per_result?.find((r) => r.indicator === "actions:onsite_conversion.lead_grouped") || {}
        return {
          id: campaign.id || "unknown",
          accountId: accountId,
          name: campaign.name || "Unknown Campaign",
          businessName: insights.account_name || "Unknown Business",
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
        }
      })

      const adSetData = (data.data?.data || []).flatMap((campaign) =>
        (campaign.adsets?.data || []).map((adset) => {
          const insights = adset.insights?.data?.[0] || {}
          const leadAction = insights.actions?.find((a) => a.action_type === "onsite_conversion.lead_grouped") || {}
          const costPerResult =
            insights.cost_per_result?.find((r) => r.indicator === "actions:onsite_conversion.lead_grouped") || {}
          return {
            id: adset.id || "unknown",
            accountId: accountId,
            campaignId: campaign.id || "unknown",
            name: adset.name || "Unknown Ad Set",
            businessName: insights.account_name || "Unknown Business",
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
          }
        }),
      )

      const adData = (data.data?.data || []).flatMap((campaign) =>
        (campaign.ads?.data || []).map((ad) => {
          const insights = ad.insights?.data?.[0] || {}
          const leadAction = insights.actions?.find((a) => a.action_type === "onsite_conversion.lead_grouped") || {}
          const costPerResult =
            insights.cost_per_result?.find((r) => r.indicator === "actions:onsite_conversion.lead_grouped") || {}
          return {
            id: ad.id || "unknown",
            accountId: accountId,
            campaignId: campaign.id || "unknown",
            adSetId: insights.adset_id || ad.adset_id || "unknown",
            name: ad.name || "Unknown Ad",
            businessName: insights.account_name || "Unknown Business",
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
            qualityRanking: insights.quality_ranking || "UNKNOWN",
            engagementRateRanking: insights.engagement_rate_ranking || "UNKNOWN",
            conversionRateRanking: insights.conversion_rate_ranking || "UNKNOWN",
          }
        }),
      )

      setCampaigns(campaignData)
      setAllAdSets(adSetData)
      setAllAds(adData)
    } catch (error) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLeads = async (accountId) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:5000/api/facebook/adaccounts/${accountId}/leads`, {
        credentials: "include",
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`HTTP ${response.status}: ${errorData.detail || "Failed to fetch leads"}`)
      }
      const data = await response.json()
      setLeads(data.data || [])
    } catch (error) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAdAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccountId) {
      fetchAccountData(selectedAccountId)
      fetchLeads(selectedAccountId)
    } else {
      setCampaigns([])
      setAllAdSets([])
      setAllAds([])
      setLeads([])
    }
  }, [selectedAccountId])

  const applyFilters = (data) => {
    let filteredData = [...data]
    const searchTermLower = searchTerm.toLowerCase()

    if (searchTerm) {
      filteredData = filteredData.filter((item) => {
        if (activeTab === "leads") {
          return (
            item.full_name?.toLowerCase().includes(searchTermLower) ||
            item.email?.toLowerCase().includes(searchTermLower) ||
            item.phone_number?.toLowerCase().includes(searchTermLower) ||
            item.ad_name?.toLowerCase().includes(searchTermLower) ||
            item.campaign_name?.toLowerCase().includes(searchTermLower)
          )
        }
        return (
          item.name?.toLowerCase().includes(searchTermLower) ||
          item.businessName?.toLowerCase().includes(searchTermLower)
        )
      })
    }

    filterConditions.forEach((condition) => {
      filteredData = filteredData.filter((item) => {
        const value = item[condition.field]
        const filterValue = condition.value

        if (typeof value === "string") {
          if (condition.operator === "equals") {
            return value.toLowerCase() === String(filterValue).toLowerCase()
          } else if (condition.operator === "contains") {
            return value.toLowerCase().includes(String(filterValue).toLowerCase())
          }
        } else if (typeof value === "number") {
          const numFilterValue = Number(filterValue)
          if (isNaN(numFilterValue)) return true
          if (condition.operator === "equals") {
            return value === numFilterValue
          } else if (condition.operator === "greaterThan") {
            return value > numFilterValue
          } else if (condition.operator === "lessThan") {
            return value < numFilterValue
          }
        }
        return true
      })
    })

    return filteredData
  }

  const getFilteredDataForTab = () => {
    if (activeTab === "campaigns") {
      return applyFilters(campaigns)
    } else if (activeTab === "adsets") {
      return applyFilters(allAdSets)
    } else if (activeTab === "ads") {
      return applyFilters(allAds)
    } else if (activeTab === "leads") {
      return applyFilters(leads)
    }
    return []
  }

  const addFilterCondition = () => {
    setFilterConditions((prev) => [
      ...prev,
      { field: activeTab === "leads" ? "full_name" : "name", operator: "contains", value: "" },
    ])
  }

  const updateFilterCondition = (index, field, value) => {
    setFilterConditions((prev) =>
      prev.map((condition, i) => (i === index ? { ...condition, [field]: value } : condition)),
    )
  }

  const removeFilterCondition = (index) => {
    setFilterConditions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClearFilters = () => {
    setFilterConditions([])
    setSearchTerm("")
  }

  // Calculate metrics for charts
  const calculateMetrics = () => {
    const data = getFilteredDataForTab()
    const totalSpend = data.reduce((sum, item) => sum + (item.spend || 0), 0)
    const totalLeads = data.reduce((sum, item) => sum + (item.leads || 0), 0)
    const totalClicks = data.reduce((sum, item) => sum + (item.clicks || 0), 0)
    const totalImpressions = data.reduce((sum, item) => sum + (item.impressions || 0), 0)
    const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

    return { totalSpend, totalLeads, totalClicks, totalImpressions, avgCPL, avgCTR }
  }

  const metrics = calculateMetrics()

  // Prepare chart data
  const getChartData = () => {
    const data = getFilteredDataForTab()
    return data.slice(0, 10).map((item) => ({
      name: item.name?.substring(0, 20) || "Unknown",
      spend: item.spend || 0,
      leads: item.leads || 0,
      cpl: item.cpl || 0,
      clicks: item.clicks || 0,
    }))
  }

  const chartData = getChartData()

  const getAvailableColumns = () => {
    if (activeTab === "leads") {
      return ["full_name", "email", "phone_number", "ad_name", "campaign_name", "platform"]
    }
    return ["name", "spend", "leads", "cpl", "impressions", "clicks", "cpc", "reach", "ctr"]
  }

  const getCurrentVisibleColumns = () => {
    return visibleColumns[activeTab] || []
  }

  const toggleColumn = (col) => {
    setVisibleColumns((prev) => {
      const currentCols = prev[activeTab] || []
      const newCols = currentCols.includes(col) ? currentCols.filter((c) => c !== col) : [...currentCols, col]
      return { ...prev, [activeTab]: newCols }
    })
  }

  return (
    <div className="min-h-dvh bg-background rounded-tl-2xl ring-1 ring-purple-100">

      <div className="flex flex-col gap-8 p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Marketing Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage and analyze your advertising campaigns</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedAccountId || ""} onValueChange={(value) => setSelectedAccountId(value || null)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select an ad account" />
              </SelectTrigger>
              <SelectContent className={"bg-white"}>
                {adAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedAccountId && (
          <>
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${metrics.totalSpend.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Across all {activeTab}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalLeads}</div>
                  <p className="text-xs text-muted-foreground">Conversions generated</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg CPL</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${metrics.avgCPL.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Cost per lead</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg CTR</CardTitle>
                  <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.avgCTR.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground">Click-through rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            {/* <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Spend & Leads Overview</CardTitle>
                  <CardDescription>Top 10 {activeTab} by performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="spend" fill="hsl(var(--chart-1))" name="Spend ($)" />
                      <Bar yAxisId="right" dataKey="leads" fill="hsl(var(--chart-2))" name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost Per Lead Trend</CardTitle>
                  <CardDescription>CPL across top performers</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="cpl" stroke="hsl(var(--chart-3))" name="CPL ($)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div> */}

            {/* Tabs */}
            <Tabs defaultValue="campaigns" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start bg-muted/100 p-1">
                <TabsTrigger value="campaigns" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Campaigns
                </TabsTrigger>
                <TabsTrigger value="adsets" className="gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Ad Sets
                </TabsTrigger>
                <TabsTrigger value="ads" className="gap-2">
                  <FileBarChart className="h-4 w-4" />
                  Ads
                </TabsTrigger>
                <TabsTrigger value="leads" className="gap-2">
                  <Users className="h-4 w-4" />
                  Leads
                </TabsTrigger>
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
                          className="w-full md:w-[320px] pl-9 bg-background"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <Button variant="outline" size="sm" onClick={addFilterCondition} className="gap-2 ">
                        <SlidersHorizontal className="h-4 w-4" />
                        Add Filter
                      </Button>
                      {(filterConditions.length > 0 || searchTerm) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearFilters}
                          className="gap-2 "
                        >
                          <X className="h-4 w-4" />
                          Clear
                        </Button>
                      )}
                    </div>

                    <DropdownMenu className="">
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 ">
                          <SlidersHorizontal className="h-4 w-4" />
                          Columns
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
                            {col
                              .split("_")
                              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(" ")}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilterConditions([])}
                          className="h-8 text-xs"
                        >
                          Clear all
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {filterConditions.map((condition, index) => (
                          <div key={index} className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border">
                            <Select
                              value={condition.field}
                              onValueChange={(value) => updateFilterCondition(index, "field", value)}
                            >
                              <SelectTrigger className="w-[160px] h-9 bg-background">
                                <SelectValue placeholder="Select field" />
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
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <Select
                              value={condition.operator}
                              onValueChange={(value) => updateFilterCondition(index, "operator", value)}
                            >
                              <SelectTrigger className="w-[140px] h-9 bg-background">
                                <SelectValue placeholder="Operator" />
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
                              value={condition.value}
                              onChange={(e) => updateFilterCondition(index, "value", e.target.value)}
                              className="flex-1 h-9 bg-background"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFilterCondition(index)}
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
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                    <p className="text-sm text-muted-foreground">Loading {activeTab}...</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-16">
                    <div className="rounded-full bg-destructive/10 p-3 mb-4">
                      <X className="h-6 w-6 text-destructive" />
                    </div>
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
                                {col
                                  .split("_")
                                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                                  .join(" ")}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {getFilteredDataForTab().map((item, index) => (
                            <tr key={index} className="hover:bg-muted/50 transition-colors">
                              {getCurrentVisibleColumns().map((col) => (
                                <td key={col} className="px-4 py-3 text-sm">
                                  {col === "status" ? (
                                    <Badge variant={item[col] === "ACTIVE" ? "default" : "secondary"}>
                                      {item[col]}
                                    </Badge>
                                  ) : col === "platform" ? (
                                    <Badge variant="outline">{item[col]?.toUpperCase() || "-"}</Badge>
                                  ) : col === "spend" || col === "cpl" || col === "cpc" || col === "cpm" ? (
                                    `$${(item[col] || 0).toFixed(2)}`
                                  ) : col === "ctr" ? (
                                    `${(item[col] || 0).toFixed(2)}%`
                                  ) : (
                                    item[col] || "-"
                                  )}
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
          </>
        )}

        {!selectedAccountId && (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-12">
            <div className="rounded-full bg-white p-3 mb-4">
              <LayoutGrid className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No ad account selected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Please select an ad account from the dropdown above to view your campaigns and analytics data
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Campaigns
