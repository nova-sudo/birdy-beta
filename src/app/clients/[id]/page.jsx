"use client"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
  Phone,
  DollarSign,
  Target,
  Eye,
  MousePointer
} from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, Pie, PieChart } from "recharts"

export default function ClientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = decodeURIComponent(params?.id || "")
  const [progress, setProgress] = useState(10)
  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState(null)
  const [notes, setNotes] = useState("")
  const [activeMarketingTab, setActiveMarketingTab] = useState("campaigns")
  const [activeCallCenterTab, setActiveCallCenterTab] = useState("overview")

  useEffect(() => {
    if (clientId) {
      fetchClientDetails()
    }
  }, [clientId])

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + 10
        })
      }, 200)
      return () => clearInterval(interval)
    }
  }, [loading])

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
      setProgress(100)
    } catch (err) {
      console.error("Error fetching client:", err)
      toast.error("Failed to load client details")
    } finally {
      setTimeout(() => setLoading(false), 300)
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
      <div className="min-h-dvh w-full flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="flex flex-col items-center gap-8 w-full max-w-md px-6">
          <div className="w-16 h-16 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <style>{`
                  @keyframes fly {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                  }
                  @keyframes wingFlap {
                    0%, 100% { transform: rotateZ(0deg); }
                    50% { transform: rotateZ(15deg); }
                  }
                  .bird-body { animation: fly 2s ease-in-out infinite; }
                  .bird-wing-left { animation: wingFlap 0.6s ease-in-out infinite; transform-origin: 35px 40px; }
                  .bird-wing-right { animation: wingFlap 0.6s ease-in-out infinite; transform-origin: 65px 40px; }
                `}</style>
              </defs>
              <g className="bird-body">
                <circle cx="50" cy="45" r="12" fill="currentColor" className="text-purple-700" />
                <circle cx="50" cy="32" r="10" fill="currentColor" className="text-purple-700" />
                <circle cx="53" cy="30" r="2" fill="white" />
                <polygon points="60,30 65,29 60,31" fill="currentColor" className="text-purple-700" />
                <polygon points="38,50 28,55 30,48" fill="currentColor" className="text-purple-700/70" />
              </g>
              <g className="bird-wing-left">
                <ellipse cx="40" cy="42" rx="8" ry="14" fill="currentColor" className="text-purple-700/80" />
              </g>
              <g className="bird-wing-right">
                <ellipse cx="60" cy="42" rx="8" ry="14" fill="currentColor" className="text-purple-700/80" />
              </g>
            </svg>
          </div>
          <div className="flex flex-col gap-3 text-center">
            <h2 className="text-2xl font-bold text-foreground">Loading your contacts</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Preparing your data. This should only take a moment.
            </p>
          </div>
          <div className="w-full flex flex-col gap-2">
            <Progress value={progress} className="w-full h-2" />
            <p className="text-xs text-muted-foreground text-center font-medium">{Math.round(progress)}% complete</p>
          </div>
          <div className="flex gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: "0.2s" }} />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/20 animate-pulse" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      </div>
    )
  }

  if (!clientData) {
    return (
      <div className="min-h-screen w-[calc(100dvw-30px)] flex items-center justify-center">
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
  const metaSummary = metaData.summary || {}

  // Calculate metrics
  const metrics = {
    roas: metaSummary.total_spend > 0 ? ((leadsData.qualified_leads || 0) * 100) / metaSummary.total_spend : 0,
    costPerLead: metaSummary.cost_per_lead || 0,
    closeRate: leadsData.conversion_rate || 0,
    cac: metaSummary.cost_per_lead * (100 / (leadsData.conversion_rate || 1)),
  }

// Chart 1: Lead Status Distribution (Insights)
  const statusChartData = Object.entries(ghlData.status_breakdown || {}).map(([name, value]) => ({
    name,
    value,
    fill: name === 'Won' ? '#9333ea' : name === 'Open' ? '#c084fc' : name === 'Lost' ? '#7c3aed' : '#a855f7'
  }))

  const statusChartConfig = {
    value: { label: "Leads" },
    Won: { label: "Won", color: "#9333ea" },
    Open: { label: "Open", color: "#c084fc" },
    Lost: { label: "Lost", color: "#7c3aed" },
    Abandoned: { label: "Abandoned", color: "#a855f7" }
  } 

  // Chart 2: Top Campaigns by Spend (Insights)
  const topCampaignsBySpend = (metaData.campaigns || [])
    .sort((a, b) => (b.spend || 0) - (a.spend || 0))
    .slice(0, 6)
    .map(c => ({
      name: c.name?.substring(0, 12) + (c.name?.length > 12 ? '...' : ''),
      spend: c.spend || 0
    }))

  const topCampaignsByImpressionsData = (metaData.campaigns || [])
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 6)
    .map(c => ({
      name: c.name?.substring(0, 12) + (c.name?.length > 12 ? '...' : ''),
      clicks: c.clicks || 0,
      spend: c.spend || 0
    }))
  
  const campaignPerformanceConfig = {
    spend: { label: "Spend", color: "#9333ea" },
    clicks: { label: "Clicks", color: "#9377fa" }
  }

  const campaignSpendConfig = {
    spend: { label: "Spend ", color: "#9333ea" }
  } 
    const topCampaignsByClicks = (metaData.campaigns || [])
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 6)
    .map(c => ({
      name: c.name?.substring(0, 12) + (c.name?.length > 12 ? '...' : ''),
      clicks: c.clicks || 0
    }))

  const campaignClicksConfig = {
    clicks: { label: "Clicks", color: "#7c3aed" }
  }

  // Chart 5: Call Volume Distribution (Call Center)
  const callVolumeData = (hpData.leads || []).reduce((acc, lead) => {
    const callCount = lead.call_logs_count || 0
    if (callCount > 0) {
      const range = callCount === 1 ? '1 call' : 
                    callCount <= 3 ? '2-3 calls' : 
                    callCount <= 5 ? '4-5 calls' : '6+ calls'
      acc[range] = (acc[range] || 0) + 1
    }
    return acc
  }, {})

  const callVolumeChartData = Object.entries(callVolumeData).map(([name, leads]) => ({
    name,
    leads,
    fill: '#9333ea'
  }))

  const callVolumeConfig = {
    leads: { label: "Leads", color: "#9333ea" }
  } 

  // Chart 6: Contact Status Distribution (Call Center)
  const contactedLeads = callCenterData.leads_with_calls || 0
  const totalHpLeads = hpData.total_leads || 0
  const pendingLeads = Math.max(0, totalHpLeads - contactedLeads)

  const contactStatusData = [
    { name: "Contacted", value: contactedLeads, fill: "#9333ea" },
    { name: "Pending Contact", value: pendingLeads, fill: "#c084fc" }
  ].filter(item => item.value > 0)

  const contactStatusConfig = {
    value: { label: "Leads" },
    contacted: { label: "Contacted", color: "#9333ea" },
    pending: { label: "Pending Contact", color: "#c084fc" }
  }

  return (
    <div className="min-h-dvh w-[calc(100dvw-30px)] md:w-[calc(100dvw-100px)] pb-2 flex flex-col overflow-hidden">
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
              <h1 className="text-3xl font-bold truncate tracking-tight">
                {groupInfo.name || "Unnamed Client"}
              </h1>
            </div>
          </div>
          <div className="flex gap-2 self-start md:self-center ml-auto">
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
      <div className="flex-1 flex flex-col overflow-hidden min-h-0  mt-6">
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
            <TabsTrigger value="overview" className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Overview
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Insights
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Marketing
            </TabsTrigger>
            <TabsTrigger value="callcenter" className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
              Call Center
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="mt-6 overflow-y-auto space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">ROAS</p>
                      <h3 className="text-2xl font-bold mt-1">{metrics.roas.toFixed(2)}x</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-xs">+12%</span>
                        <span className="text-muted-foreground ml-1 text-xs">vs. last month</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Cost Per Lead</p>
                      <h3 className="text-2xl font-bold mt-1">${metrics.costPerLead.toFixed(2)}</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-xs">+5%</span>
                        <span className="text-muted-foreground ml-1 text-xs">vs. last month</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Users className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Close Rate</p>
                      <h3 className="text-2xl font-bold mt-1">{metrics.closeRate.toFixed(2)}%</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-xs">+8%</span>
                        <span className="text-muted-foreground ml-1 text-xs">vs. last month</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <ChartPie className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Customer Acq. Cost</p>
                      <h3 className="text-2xl font-bold mt-1">${metrics.cac.toFixed(2)}</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-green-500 text-xs">+12%</span>
                        <span className="text-muted-foreground ml-1 text-xs">vs. last month</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <ChartNoAxesColumnIncreasing className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">History Book</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    className="min-h-[200px] resize-none bg-[#F9F8FC]"
                    placeholder="Add notes about this client..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <Button onClick={handleSaveNotes} className="w-full bg-[#713CDD] text-white font-semibold">
                    <Save className="mr-2 h-4 w-4" />
                    Save Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INSIGHTS TAB */}
          <TabsContent value="insights" className="mt-6 overflow-y-auto space-y-4">
            {/* Key Insights Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Best Performing Tag</p>
                      <h3 className="text-xl font-bold mt-2">{insights.tag_with_best_roas?.tag_name || 'N/A'}</h3>
                      <p className="text-sm mt-1">ROAS: {insights.tag_with_best_roas?.roas?.toFixed(2) || 0}x</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.tag_with_best_roas?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Target className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Best Booking Offer</p>
                      <h3 className="text-xl font-bold mt-2">{insights.offer_with_best_booking_rate?.offer_name || 'N/A'}</h3>
                      <p className="text-sm mt-1">Rate: {((insights.offer_with_best_booking_rate?.booking_rate || 0) * 100).toFixed(1)}%</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.offer_with_best_booking_rate?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Avg Booking Delay</p>
                      <h3 className="text-xl font-bold mt-2">{insights.avg_booking_delay_days?.days?.toFixed(1) || 0} days</h3>
                      <p className="text-sm mt-1">Time to convert</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.avg_booking_delay_days?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Bookings This Month</p>
                      <h3 className="text-xl font-bold mt-2">{insights.total_bookings_this_month?.count || 0}</h3>
                      <p className="text-sm mt-1">Total conversions</p>
                      <div className="flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                        <span className="text-xs text-green-500">+{insights.total_bookings_this_month?.change_percentage || 0}%</span>
                      </div>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts - 2 in Insights */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Chart 1: Lead Status Distribution */}
              <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                  <CardTitle>Lead Status Distribution</CardTitle>
                  <CardDescription>Current pipeline breakdown</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={statusChartConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}

                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 leading-none font-medium">
                    Total Leads: {Object.values(ghlData.status_breakdown || {}).reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-muted-foreground leading-none">
                    Last 30 days performance
                  </div>
                </CardFooter>
              </Card>

              {/* Chart 2: Top Campaigns by Spend */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Campaigns by Spend</CardTitle>
                  <CardDescription>Highest ad spend campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={campaignSpendConfig}>
                    <BarChart accessibilityLayer data={topCampaignsBySpend}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        fontSize={11}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="spend" fill="var(--color-spend)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="flex gap-2 leading-none font-medium">
                    Total Spend: ${metaSummary.total_spend?.toFixed(2) || 0}
                  </div>
                  <div className="text-muted-foreground leading-none">
                    Based on last 30 days
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Total Ad Spend</p>
                      <h3 className="text-2xl font-bold mt-1">${metaSummary.total_spend?.toFixed(2) || 0}</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Total Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.total_leads || 0}</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Users className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Conversion Rate</p>
                      <h3 className="text-2xl font-bold mt-1">{leadsData.conversion_rate?.toFixed(2) || 0}%</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Target className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* MARKETING TAB */}
          <TabsContent value="marketing" className="mt-6 overflow-y-auto space-y-4">
            {/* Marketing Summary */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground text-[#71658B]">Total Spend</p>
                      <p className="text-lg font-bold">${metaSummary.total_spend?.toFixed(2) || 0}</p>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground text-[#71658B]">Impressions</p>
                      <p className="text-lg font-bold">{(metaSummary.total_impressions || 0).toLocaleString()}</p>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Eye className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground text-[#71658B]">Clicks</p>
                      <p className="text-lg font-bold">{(metaSummary.total_clicks || 0).toLocaleString()}</p>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <MousePointer className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground text-[#71658B]">Leads</p>
                      <p className="text-lg font-bold">{metaSummary.total_leads || 0}</p>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground text-[#71658B]">CPL</p>
                      <p className="text-lg font-bold">${metaSummary.cost_per_lead?.toFixed(2) || 0}</p>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Target className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Marketing Charts - 2 charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Chart 3: Campaign Performance - Spend vs Clicks */}
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Spend and engagement metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={campaignPerformanceConfig}>
                    <BarChart accessibilityLayer data={topCampaignsByImpressionsData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        fontSize={10}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent />}
                      />
                      <Bar dataKey="spend" fill="var(--color-spend)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="clicks" fill="var(--color-clicks)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="flex gap-2 leading-none font-medium">
                    {metaSummary.total_campaigns || 0} Active Campaigns
                  </div>
                  <div className="text-muted-foreground leading-none">
                    Comparing spend vs Impressions
                  </div>
                </CardFooter>
              </Card>

              {/* Chart 4: Top Campaigns by Clicks */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Click Generators</CardTitle>
                  <CardDescription>Campaigns by Impressions volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={campaignClicksConfig}>
                    <BarChart accessibilityLayer data={topCampaignsByClicks}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        fontSize={11}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="clicks" fill="var(--color-clicks)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="flex gap-2 leading-none font-medium">
                    Avg CPC: ${metaSummary.avg_cpc?.toFixed(2) || 0}
                  </div>
                  <div className="text-muted-foreground leading-none">
                    Best performing campaigns by clicks
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Marketing Tabs */}
            <Tabs value={activeMarketingTab} onValueChange={setActiveMarketingTab}>
              <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
                <TabsTrigger value="campaigns" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
                  Campaigns ({metaSummary.total_campaigns || 0})
                </TabsTrigger>
                <TabsTrigger value="adsets" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
                  Ad Sets ({metaSummary.total_adsets || 0})
                </TabsTrigger>
                <TabsTrigger value="ads" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
                  Ads ({metaSummary.total_ads || 0})
                </TabsTrigger>
                <TabsTrigger value="leads" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
                  Meta Leads ({metaSummary.total_leads || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="campaigns" className="mt-4">
                <Card className="rounded-none p-0">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-r border-border">
                            <TableHead className="bg-muted/50 border-b border-r">Campaign</TableHead>
                            <TableHead className="bg-muted/50 border-b border-r">Status</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">Spend</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">Impressions</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">Clicks</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">Leads</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">CTR</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">CPC</TableHead>
                            <TableHead className="text-left bg-muted/50 border-b border-r">CPM</TableHead>
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
                              <TableRow 
                                key={campaign.id} 
                                className="odd:bg-[#F4F3F9] even:bg-white border-b border-border"
                              >
                                <TableCell className="font-medium">{campaign.name}</TableCell>
                                <TableCell>
                                  <Badge variant={campaign.status === 'Active' ? 'default' : 'secondary'}>
                                    {campaign.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-left">${campaign.spend?.toFixed(2)}</TableCell>
                                <TableCell className="text-left">{campaign.impressions?.toLocaleString()}</TableCell>
                                <TableCell className="text-left">{campaign.clicks?.toLocaleString()}</TableCell>
                                <TableCell className="text-left">{campaign.leads || 0}</TableCell>
                                <TableCell className="text-left">{campaign.ctr?.toFixed(2)}%</TableCell>
                                <TableCell className="text-left">${campaign.cpc?.toFixed(2)}</TableCell>
                                <TableCell className="text-left">${campaign.cpm?.toFixed(2)}</TableCell>
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
                <Card className="rounded-none p-0"> 
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-r border-border">
                            <TableHead className="border-r border-border">Ad Set</TableHead>
                            <TableHead className="border-r border-border">Campaign</TableHead>
                            <TableHead className="border-r border-border">Status</TableHead>
                            <TableHead className="text-left border-r border-border">Spend</TableHead>
                            <TableHead className="text-left border-r border-border">Impressions</TableHead>
                            <TableHead className="text-left border-r border-border">Clicks</TableHead>
                            <TableHead className="text-left border-r border-border">CTR</TableHead>
                            <TableHead className="text-left border-r border-border">CPC</TableHead>
                            <TableHead className="text-left border-r border-border">CPM</TableHead>
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
                              <TableRow 
                                key={adset.id} 
                                className="odd:bg-[#F4F3F9] even:bg-white border-b border-border"
                              >
                                <TableCell className="font-medium">{adset.name}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{adset.campaign_name}</TableCell>
                                <TableCell>
                                  <Badge variant={adset.status === 'Active' ? 'default' : 'secondary'}>
                                    {adset.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-left">${adset.spend?.toFixed(2)}</TableCell>
                                <TableCell className="text-left">{adset.impressions?.toLocaleString()}</TableCell>
                                <TableCell className="text-left">{adset.clicks?.toLocaleString()}</TableCell>
                                <TableCell className="text-left">{adset.ctr?.toFixed(2)}%</TableCell>
                                <TableCell className="text-left">${adset.cpc?.toFixed(2)}</TableCell>
                                <TableCell className="text-left">${adset.cpm?.toFixed(2)}</TableCell>
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
                <Card className="rounded-none p-0">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border-r border-border">Ad</TableHead>
                            <TableHead className="border-r border-border">Campaign</TableHead>
                            <TableHead className="border-r border-border">Status</TableHead>
                            <TableHead className="border-r border-border">Creative</TableHead>
                            <TableHead className="text-left border-r border-border">Spend</TableHead>
                            <TableHead className="text-left border-r border-border">Impressions</TableHead>
                            <TableHead className="text-left border-r border-border">Clicks</TableHead>
                            <TableHead className="text-left border-r border-border">Results</TableHead>
                            <TableHead className="text-left border-r border-border">CTR</TableHead>
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
                              <TableRow 
                                key={ad.id} 
                                className="odd:bg-[#F4F3F9] even:bg-white border-b border-border"
                              >
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
                                <TableCell className="text-left">${ad.spend?.toFixed(2)}</TableCell>
                                <TableCell className="text-left">{ad.impressions?.toLocaleString()}</TableCell>
                                <TableCell className="text-left">{ad.clicks?.toLocaleString()}</TableCell>
                                <TableCell className="text-left">{ad.results || 0}</TableCell>
                                <TableCell className="text-left">{ad.ctr?.toFixed(2)}%</TableCell>
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
                <Card className="rounded-none p-0">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-r border-border">
                            <TableHead className="border-r border-border">Name</TableHead>
                            <TableHead className="border-r border-border">Email</TableHead>
                            <TableHead className="border-r border-border">Phone</TableHead>
                            <TableHead className="border-r border-border">Campaign</TableHead>
                            <TableHead className="border-r border-border">Ad Name</TableHead>
                            <TableHead className="border-r border-border">Platform</TableHead>
                            <TableHead className="border-r border-border">Created</TableHead>
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
                              <TableRow 
                                key={lead.id} 
                                className="odd:bg-[#F4F3F9] even:bg-white border-b border-border"
                              >
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

          {/* CALL CENTER TAB */}
          <TabsContent value="callcenter" className="mt-6 overflow-y-auto space-y-4">
            {/* Call Center Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Total Calls</p>
                      <h3 className="text-2xl font-bold mt-1">{callCenterData.total_calls || 0}</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Phone className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Leads with Calls</p>
                      <h3 className="text-2xl font-bold mt-1">{callCenterData.leads_with_calls || 0}</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">Avg Calls/Lead</p>
                      <h3 className="text-2xl font-bold mt-1">{callCenterData.avg_calls_per_lead?.toFixed(2) || 0}</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <ChartPie className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground text-[#71658B]">HP Leads</p>
                      <h3 className="text-2xl font-bold mt-1">{hpData.total_leads || 0}</h3>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <Target className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Call Center Charts - 2 charts */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Chart 5: Call Volume Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Call Volume Distribution</CardTitle>
                  <CardDescription>Leads by number of calls</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={callVolumeConfig}>
                    <BarChart accessibilityLayer data={callVolumeChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar dataKey="leads" fill="var(--color-leads)" radius={8} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="flex gap-2 leading-none font-medium">
                    Avg: {callCenterData.avg_calls_per_lead?.toFixed(1) || 0} calls per lead
                  </div>
                  <div className="text-muted-foreground leading-none">
                    Distribution of call attempts
                  </div>
                </CardFooter>
              </Card>

              {/* Chart 6: Contact Status */}
              <Card className="flex flex-col">
                <CardHeader className="items-center pb-0">
                  <CardTitle>Contact Status</CardTitle>
                  <CardDescription>Lead engagement breakdown</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-0">
                  <ChartContainer
                    config={contactStatusConfig}
                    className="mx-auto aspect-square max-h-[250px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={contactStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
                <CardFooter className="flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2 leading-none font-medium">
                    Contact Rate: {totalHpLeads > 0 ? ((contactedLeads / totalHpLeads) * 100).toFixed(1) : 0}%
                  </div>
                  <div className="text-muted-foreground leading-none">
                    Based on call center activity
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Call Center Tabs */}
            <Tabs value={activeCallCenterTab} onValueChange={setActiveCallCenterTab}>
              <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
                <TabsTrigger value="overview" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
                  Call Overview
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-2 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700">
                  Detailed Call Logs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <Card className="rounded-none p-0">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left border-r border-border">Lead Name</TableHead>
                            <TableHead className="text-left border-r border-border">Email</TableHead>
                            <TableHead className="text-left border-r border-border">Phone</TableHead>
                            <TableHead className="text-left border-r border-border">Status</TableHead>
                            <TableHead className="text-left border-r border-border">Total Calls</TableHead>
                            <TableHead className="text-left border-r border-border">Last Contact</TableHead>
                            <TableHead className="text-left border-r border-border">Business</TableHead>
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
                                <TableRow key={lead.id} className="odd:bg-[#F4F3F9] even:bg-white hover:bg-muted/50 transition-colors">
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
                <Card className="rounded-none p-0">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-left border-r border-border">Lead Name</TableHead>
                            <TableHead className="text-left border-r border-border">Contact</TableHead>
                            <TableHead className="text-left border-r border-border">Call Date</TableHead>
                            <TableHead className="text-left border-r border-border">Duration</TableHead>
                            <TableHead className="text-left border-r border-border">Direction</TableHead>
                            <TableHead className="text-left border-r border-border">Status</TableHead>
                            <TableHead className="text-left border-r border-border">Recording</TableHead>
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
                                <TableRow key={idx} className="odd:bg-[#F4F3F9] even:bg-white hover:bg-muted/50 transition-colors">
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