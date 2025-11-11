"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Calendar, 
  Settings, 
  TrendingUp, 
  Users, 
  ChartPie, 
  ChartNoAxesColumnIncreasing,
  Save,
  Search,
  Phone,
  Mail,
  DollarSign,
  Target,
  Eye,
  MousePointer,
  TrendingDown,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ClientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = decodeURIComponent(params?.id || "")

  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState(null)
  const [notes, setNotes] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeMarketingTab, setActiveMarketingTab] = useState("campaigns")
  const [activeCallCenterTab, setActiveCallCenterTab] = useState("overview")
  const [activeLeadsTab, setActiveLeadsTab] = useState("all")

  useEffect(() => {
    if (clientId) {
      fetchClientDetails()
    }
  }, [clientId])

  const fetchClientDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `https://birdy-backend.vercel.app/api/client-groups/${clientId}`,
        { credentials: "include" }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch client details")
      }

      const result = await response.json()
      setClientData(result.data)
      setNotes(result.data?.group_info?.notes || "")
    } catch (err) {
      console.error("Error fetching client:", err)
      toast.error("Failed to load client details")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    try {
      const response = await fetch(
        `https://birdy-backend.vercel.app/api/client-groups/${clientId}/notes`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ notes }),
        }
      )

      if (response.ok) {
        toast.success("Notes saved successfully")
      } else {
        toast.error("Failed to save notes")
      }
    } catch (err) {
      console.error("Error saving notes:", err)
      toast.error("Failed to save notes")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!clientData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Client Not Found</h2>
          <Button onClick={() => router.push("/clients")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </div>
      </div>
    )
  }

  const groupInfo = clientData.group_info || {}
  const metaData = clientData.meta_data || {}
  const ghlData = clientData.ghl_data || {}
  const hpData = clientData.hotprospector_data || {}
  const insights = clientData.insights || {}
  const leadsData = clientData.leads || {}
  const callCenterData = clientData.call_center || {}

  // Calculate metrics
  const metaSummary = metaData.summary || {}
  const metrics = {
    roas: metaSummary.total_spend > 0 ? ((leadsData.qualified_leads || 0) * 100) / metaSummary.total_spend : 0,
    costPerLead: metaSummary.cost_per_lead || 0,
    closeRate: leadsData.conversion_rate || 0,
    cac: metaSummary.cost_per_lead * (100 / (leadsData.conversion_rate || 1)),
  }

  // Prepare chart data
  const statusChartData = Object.entries(ghlData.status_breakdown || {}).map(([name, value]) => ({
    name,
    value
  }))

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1']

  const campaignPerformanceData = (metaData.campaigns || []).slice(0, 10).map(c => ({
    name: c.name?.substring(0, 20) + '...',
    spend: c.spend,
    leads: c.leads,
    cpl: c.leads > 0 ? (c.spend / c.leads) : 0
  }))

  const callVolumeData = (hpData.leads || []).reduce((acc, lead) => {
    const callCount = lead.call_logs_count || 0
    if (callCount > 0) {
      const range = callCount === 1 ? '1 call' : callCount <= 3 ? '2-3 calls' : callCount <= 5 ? '4-5 calls' : '6+ calls'
      acc[range] = (acc[range] || 0) + 1
    }
    return acc
  }, {})

  const callVolumeChartData = Object.entries(callVolumeData).map(([name, value]) => ({
    name,
    leads: value
  }))

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="space-y-4 pb-0">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/clients")}
                className="mr-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold tracking-tight">
                {groupInfo.name || "Unnamed Client"}
              </h1>
            </div>
          </div>
          <div className="flex gap-2 self-start md:self-center">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Last 30 Days
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 mt-6">
        {/* Search Bar */}
        <Card className="mb-4 flex-shrink-0 bg-accent/50">
          <CardContent className="p-6 py-4 px-6">
            <div className="w-full">
              <div className="flex flex-col md:flex-row md:items-center md:gap-4 gap-3">
                <form className="relative w-full md:w-1/3 md:min-w-[360px]">
                  <div className="relative w-full">
                    <Input
                      className="pr-20 bg-white h-[50px] py-4 text-sm"
                      placeholder={`Ask Birdy anything about ${groupInfo.name}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button
                      className="absolute top-1/2 -translate-y-1/2 right-2"
                      size="sm"
                      type="submit"
                      disabled={!searchQuery}
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </form>
                <div className="flex flex-wrap gap-2 items-center md:justify-end md:flex-1">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">Try asking:</span>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Why are bookings down this week?
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Which tag gave the best cost per booking?
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7">
                    Show ROAS breakdown by campaign
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview"  className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="mb-4 gap-1 flex-shrink-0 bg-muted/60 border border-border/50 shadow-sm w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="insights" className="flex-1">Insights</TabsTrigger>
            <TabsTrigger value="marketing" className="flex-1">Marketing</TabsTrigger>
            {/* <TabsTrigger disabled value="leads" className="flex-1 disabled:bg-black/10 disabled:text-white ">Leads</TabsTrigger> */}
            <TabsTrigger value="callcenter" className="flex-1">Call Center</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="mt-6 overflow-y-auto space-y-4">
            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="overflow-hidden relative">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm">ROAS</p>
                      <h3 className="text-2xl font-bold mt-1">{metrics.roas.toFixed(2)}x</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-[0.75rem] leading-4">+12%</span>
                        <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4">
                          vs. last month
                        </span>
                      </div>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-md">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden relative">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm">Cost Per Lead</p>
                      <h3 className="text-2xl font-bold mt-1">${metrics.costPerLead.toFixed(2)}</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-[0.75rem] leading-4">+5%</span>
                        <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4">
                          vs. last month
                        </span>
                      </div>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-md">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden relative">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm">Close Rate</p>
                      <h3 className="text-2xl font-bold mt-1">{metrics.closeRate.toFixed(2)}%</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-[0.75rem] leading-4">+8%</span>
                        <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4">
                          vs. last month
                        </span>
                      </div>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-md">
                      <ChartPie className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden relative">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm">Customer Acq. Cost</p>
                      <h3 className="text-2xl font-bold mt-1">${metrics.cac.toFixed(2)}</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-[0.75rem] leading-4">+12%</span>
                        <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4">
                          vs. last month
                        </span>
                      </div>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-md">
                      <ChartNoAxesColumnIncreasing className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* History Book */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">History Book</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    className="min-h-[200px] resize-none"
                    placeholder="Add notes about this client..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <Button onClick={handleSaveNotes} className="w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Save Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="mt-0 pt-0 overflow-y-auto space-y-4">
            {/* Key Insights Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Best Performing Tag</p>
                      <h3 className="text-xl font-bold mt-2">{insights.tag_with_best_roas?.tag_name || 'N/A'}</h3>
                      <p className="text-sm mt-1">ROAS: {insights.tag_with_best_roas?.roas?.toFixed(2) || 0}x</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.tag_with_best_roas?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <Target className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Best Booking Offer</p>
                      <h3 className="text-xl font-bold mt-2">{insights.offer_with_best_booking_rate?.offer_name || 'N/A'}</h3>
                      <p className="text-sm mt-1">Rate: {((insights.offer_with_best_booking_rate?.booking_rate || 0) * 100).toFixed(1)}%</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.offer_with_best_booking_rate?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Booking Delay</p>
                      <h3 className="text-xl font-bold mt-2">{insights.avg_booking_delay_days?.days?.toFixed(1) || 0} days</h3>
                      <p className="text-sm mt-1">Time to convert</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.avg_booking_delay_days?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <Calendar className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Bookings This Month</p>
                      <h3 className="text-xl font-bold mt-2">{insights.total_bookings_this_month?.count || 0}</h3>
                      <p className="text-sm mt-1">Total conversions</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.total_bookings_this_month?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <Users className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Campaign Performance (Top 10)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={campaignPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={10} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="spend" fill="#3b82f6" name="Spend ($)" />
                      <Bar dataKey="leads" fill="#10b981" name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Marketing Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        { stage: 'Impressions', value: metaSummary.total_impressions || 0 },
                        { stage: 'Clicks', value: metaSummary.total_clicks || 0 },
                        { stage: 'Leads', value: metaSummary.total_leads || 0 },
                        { stage: 'Conversions', value: leadsData.qualified_leads || 0 }
                      ]}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="stage" />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cost per Lead Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(metaData.campaigns || []).slice(0, 10).map(c => ({
                      name: c.name?.substring(0, 15),
                      cpl: c.leads > 0 ? (c.spend / c.leads) : 0
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={10} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="cpl" stroke="#f59e0b" strokeWidth={2} name="CPL ($)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Ad Spend</p>
                      <h3 className="text-2xl font-bold mt-1">${metaSummary.total_spend?.toFixed(2) || 0}</h3>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.total_leads || 0}</h3>
                    </div>
                    <Users className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Conversion Rate</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.conversion_rate?.toFixed(2) || 0}%</h3>
                    </div>
                    <Target className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* MARKETING TAB */}
          <TabsContent value="marketing" className="mt-0 pt-0 overflow-y-auto space-y-4">
            {/* Marketing Summary */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-primary/20" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total Spend</p>
                      <p className="text-lg font-bold">${metaSummary.total_spend?.toFixed(2) || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Eye className="h-8 w-8 text-primary/20" />
                    <div>
                      <p className="text-xs text-muted-foreground">Impressions</p>
                      <p className="text-lg font-bold">{(metaSummary.total_impressions || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <MousePointer className="h-8 w-8 text-primary/20" />
                    <div>
                      <p className="text-xs text-muted-foreground">Clicks</p>
                      <p className="text-lg font-bold">{(metaSummary.total_clicks || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-primary/20" />
                    <div>
                      <p className="text-xs text-muted-foreground">Leads</p>
                      <p className="text-lg font-bold">{metaSummary.total_leads || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Target className="h-8 w-8 text-primary/20" />
                    <div>
                      <p className="text-xs text-muted-foreground">CPL</p>
                      <p className="text-lg font-bold">${metaSummary.cost_per_lead?.toFixed(2) || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Marketing Tabs */}
            <Tabs value={activeMarketingTab} onValueChange={setActiveMarketingTab}>
              <TabsList className="w-full justify-start grid grid-cols-4 bg-muted/50">
                <TabsTrigger value="campaigns">Campaigns ({metaSummary.total_campaigns || 0})</TabsTrigger>
                <TabsTrigger value="adsets">Ad Sets ({metaSummary.total_adsets || 0})</TabsTrigger>
                <TabsTrigger value="ads">Ads ({metaSummary.total_ads || 0})</TabsTrigger>
                <TabsTrigger value="leads">Meta Leads ({metaSummary.total_leads || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="campaigns" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-right">CPC</TableHead>
                            <TableHead className="text-right">CPM</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(metaData.campaigns || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                No campaigns found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (metaData.campaigns || []).map((campaign) => (
                              <TableRow key={campaign.id}>
                                <TableCell className="font-medium">{campaign.name}</TableCell>
                                <TableCell>
                                  <Badge variant={campaign.status === 'Active' ? 'default' : 'secondary'}>
                                    {campaign.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">${campaign.spend?.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{campaign.impressions?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{campaign.clicks?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{campaign.leads || 0}</TableCell>
                                <TableCell className="text-right">{campaign.ctr?.toFixed(2)}%</TableCell>
                                <TableCell className="text-right">${campaign.cpc?.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${campaign.cpm?.toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="adsets" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ad Set</TableHead>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-right">CPC</TableHead>
                            <TableHead className="text-right">CPM</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(metaData.adsets || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                No ad sets found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (metaData.adsets || []).map((adset) => (
                              <TableRow key={adset.id}>
                                <TableCell className="font-medium">{adset.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{adset.campaign_name}</TableCell>
                                <TableCell>
                                  <Badge variant={adset.status === 'Active' ? 'default' : 'secondary'}>
                                    {adset.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">${adset.spend?.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{adset.impressions?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{adset.clicks?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{adset.ctr?.toFixed(2)}%</TableCell>
                                <TableCell className="text-right">${adset.cpc?.toFixed(2)}</TableCell>
                                <TableCell className="text-right">${adset.cpm?.toFixed(2)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ads" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ad</TableHead>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Creative</TableHead>
                            <TableHead className="text-right">Spend</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Results</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(metaData.ads || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                No ads found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (metaData.ads || []).map((ad) => (
                              <TableRow key={ad.id}>
                                <TableCell className="font-medium max-w-[200px] truncate">{ad.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{ad.campaign_name}</TableCell>
                                <TableCell>
                                  <Badge variant={ad.status === 'Active' ? 'default' : 'secondary'}>
                                    {ad.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {ad.creative_image && (
                                      <img src={ad.creative_image} alt="Ad" className="h-10 w-10 rounded object-cover" />
                                    )}
                                    <div className="max-w-[150px]">
                                      <p className="text-xs font-medium truncate">{ad.creative_title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{ad.creative_body}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">${ad.spend?.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{ad.impressions?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{ad.clicks?.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{ad.results || 0}</TableCell>
                                <TableCell className="text-right">{ad.ctr?.toFixed(2)}%</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="leads" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Campaign</TableHead>
                            <TableHead>Ad Name</TableHead>
                            <TableHead>Platform</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(metaData.leads || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No Meta leads found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (metaData.leads || []).map((lead) => (
                              <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.full_name || 'N/A'}</TableCell>
                                <TableCell>{lead.email || 'N/A'}</TableCell>
                                <TableCell>{lead.phone_number || 'N/A'}</TableCell>
                                <TableCell className="max-w-[150px] truncate">{lead.campaign_name}</TableCell>
                                <TableCell className="max-w-[150px] truncate">{lead.ad_name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{lead.platform}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {lead.created_time ? new Date(lead.created_time).toLocaleDateString() : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* LEADS TAB */}
          <TabsContent value="leads" className="mt-0 pt-0 overflow-y-auto space-y-4">
            {/* Leads Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.total_leads || 0}</h3>
                    </div>
                    <Users className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Qualified Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.qualified_leads || 0}</h3>
                    </div>
                    <Target className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Conversion Rate</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.conversion_rate?.toFixed(2) || 0}%</h3>
                    </div>
                    <ChartPie className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Open Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.status_breakdown?.Open || 0}</h3>
                    </div>
                    <AlertCircle className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Leads Tabs */}
            <Tabs value={activeLeadsTab} onValueChange={setActiveLeadsTab}>
              <TabsList className="w-full justify-start grid grid-cols-5 bg-muted/50">
                <TabsTrigger value="all">All ({leadsData.total_leads || 0})</TabsTrigger>
                <TabsTrigger value="open">Open ({leadsData.status_breakdown?.Open || 0})</TabsTrigger>
                <TabsTrigger value="won">Won ({leadsData.status_breakdown?.Won || 0})</TabsTrigger>
                <TabsTrigger value="lost">Lost ({leadsData.status_breakdown?.Lost || 0})</TabsTrigger>
                <TabsTrigger value="abandoned">Abandoned ({leadsData.status_breakdown?.Abandoned || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Calls</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Last Contact</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(leadsData.all_leads || []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                No leads found
                              </TableCell>
                            </TableRow>
                          ) : (
                            (leadsData.all_leads || []).map((lead) => (
                              <TableRow key={lead.id}>
                                <TableCell className="font-medium">{lead.name || 'N/A'}</TableCell>
                                <TableCell>{lead.email || 'N/A'}</TableCell>
                                <TableCell>{lead.phone || 'N/A'}</TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={
                                      lead.status === 'Won' ? 'default' : 
                                      lead.status === 'Open' ? 'secondary' : 
                                      'destructive'
                                    }
                                  >
                                    {lead.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{lead.source}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span>{lead.callCount || 0}</span>
                                  </div>
                                </TableCell>
                                <TableCell>${lead.value?.toFixed(2) || '0.00'}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {lead.lastContact !== 'N/A' 
                                    ? new Date(lead.lastContact).toLocaleDateString() 
                                    : 'N/A'
                                  }
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {lead.created ? new Date(lead.created).toLocaleDateString() : 'N/A'}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {['open', 'won', 'lost', 'abandoned'].map((status) => (
                <TabsContent key={status} value={status} className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Calls</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Last Contact</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(leadsData.all_leads || [])
                              .filter(lead => lead.status?.toLowerCase() === status)
                              .length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                  No {status} leads found
                                </TableCell>
                              </TableRow>
                            ) : (
                              (leadsData.all_leads || [])
                                .filter(lead => lead.status?.toLowerCase() === status)
                                .map((lead) => (
                                  <TableRow key={lead.id}>
                                    <TableCell className="font-medium">{lead.name || 'N/A'}</TableCell>
                                    <TableCell>{lead.email || 'N/A'}</TableCell>
                                    <TableCell>{lead.phone || 'N/A'}</TableCell>
                                    <TableCell className="text-sm">{lead.source}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        <span>{lead.callCount || 0}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>${lead.value?.toFixed(2) || '0.00'}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {lead.lastContact !== 'N/A' 
                                        ? new Date(lead.lastContact).toLocaleDateString() 
                                        : 'N/A'
                                      }
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {lead.created ? new Date(lead.created).toLocaleDateString() : 'N/A'}
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>

          {/* CALL CENTER TAB */}
          <TabsContent value="callcenter" className="mt-0 pt-0 overflow-y-auto space-y-4">
            {/* Call Center Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Calls</p>
                      <h3 className="text-2xl font-bold mt-1">{callCenterData.total_calls || 0}</h3>
                    </div>
                    <Phone className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Leads with Calls</p>
                      <h3 className="text-2xl font-bold mt-1">{callCenterData.leads_with_calls || 0}</h3>
                    </div>
                    <Users className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Calls/Lead</p>
                      <h3 className="text-2xl font-bold mt-1">{callCenterData.avg_calls_per_lead?.toFixed(2) || 0}</h3>
                    </div>
                    <ChartPie className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">HP Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{hpData.total_leads || 0}</h3>
                    </div>
                    <Target className="h-8 w-8 text-primary/20" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Call Volume Chart */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Leads by Call Count</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={callVolumeChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="leads" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Call Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={callVolumeChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="leads"
                      >
                        {callVolumeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Call Center Tabs */}
            <Tabs value={activeCallCenterTab} onValueChange={setActiveCallCenterTab}>
              <TabsList className="w-full justify-start grid grid-cols-2 bg-muted/50">
                <TabsTrigger value="overview">Call Overview</TabsTrigger>
                <TabsTrigger value="logs">Detailed Call Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lead Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total Calls</TableHead>
                            <TableHead>Last Contact</TableHead>
                            <TableHead>Business</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(callCenterData.leads_by_call_count || [])
                            .filter(lead => lead.callCount > 0)
                            .length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No call data available
                              </TableCell>
                            </TableRow>
                          ) : (
                            (callCenterData.leads_by_call_count || [])
                              .filter(lead => lead.callCount > 0)
                              .sort((a, b) => (b.callCount || 0) - (a.callCount || 0))
                              .map((lead) => (
                                <TableRow key={lead.id}>
                                  <TableCell className="font-medium">{lead.name || 'N/A'}</TableCell>
                                  <TableCell>{lead.email || 'N/A'}</TableCell>
                                  <TableCell>{lead.phone || 'N/A'}</TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={
                                        lead.status === 'Won' ? 'default' : 
                                        lead.status === 'Open' ? 'secondary' : 
                                        'destructive'
                                      }
                                    >
                                      {lead.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Phone className="h-3 w-3" />
                                      <span className="font-bold">{lead.callCount}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {lead.lastContact !== 'N/A' 
                                      ? new Date(lead.lastContact).toLocaleDateString() 
                                      : 'N/A'
                                    }
                                  </TableCell>
                                  <TableCell className="text-sm">{lead.businessName || 'N/A'}</TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lead Name</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Call Date</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Recording</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(hpData.leads || [])
                            .flatMap(lead => 
                              (lead.call_logs || []).map(log => ({
                                ...log,
                                leadName: lead.name || lead.email,
                                leadEmail: lead.email,
                                leadPhone: lead.phone
                              }))
                            )
                            .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                            .length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No call logs available
                              </TableCell>
                            </TableRow>
                          ) : (
                            (hpData.leads || [])
                              .flatMap(lead => 
                                (lead.call_logs || []).map(log => ({
                                  ...log,
                                  leadName: lead.name || lead.email,
                                  leadEmail: lead.email,
                                  leadPhone: lead.phone
                                }))
                              )
                              .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                              .slice(0, 100)
                              .map((log, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{log.leadName || 'N/A'}</TableCell>
                                  <TableCell>
                                    <div className="text-xs">
                                      <div>{log.leadEmail}</div>
                                      <div className="text-muted-foreground">{log.leadPhone}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {log.created_date ? new Date(log.created_date).toLocaleString() : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {log.duration ? `${Math.floor(log.duration / 60)}:${(log.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {log.direction || 'N/A'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={log.status === 'completed' ? 'default' : 'secondary'}>
                                      {log.status || 'N/A'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {log.recording_url ? (
                                      <Button variant="ghost" size="sm" asChild>
                                        <a href={log.recording_url} target="_blank" rel="noopener noreferrer">
                                          Play
                                        </a>
                                      </Button>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">No recording</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}