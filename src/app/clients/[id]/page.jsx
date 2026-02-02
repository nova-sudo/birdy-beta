"use client"
import { Progress } from "@/components/ui/progress"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Save, DollarSign, Construction } from "lucide-react"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"

export default function ClientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = decodeURIComponent(params?.id || "")
  const [progress, setProgress] = useState(10)
  const [loading, setLoading] = useState(true)
  const [clientData, setClientData] = useState(null)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (clientId) {
      fetchClientDetails()
    }
  }, [clientId])

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress((prev) => {
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
      const response = await fetch(`http://localhost:3005/api/client-groups/${clientId}`, { credentials: "include" })

      if (!response.ok) {
        throw new Error("Failed to fetch client details")
      }

      const result = await response.json()
      console.log("[v0] API Response received:", result)
      setClientData(result.data)
      setNotes(result.data?.group_info?.notes || "")
      setProgress(100)
    } catch (err) {
      console.error("[v0] Error fetching client:", err)
      toast.error("Failed to load client details")
    } finally {
      setTimeout(() => setLoading(false), 300)
    }
  }

  const handleSaveNotes = async () => {
    try {
      const response = await fetch(`http://localhost:3005/api/client-groups/${clientId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      })

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
    // ... bird loading animation ...
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="flex flex-col items-center gap-8 w-full px-6">
          <div className="w-16 h-16 flex items-center justify-center">
            {/* ... bird svg ... */}
            <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <g className="bird-body">
                <circle cx="50" cy="45" r="12" fill="currentColor" className="text-purple-700" />
                <circle cx="50" cy="32" r="10" fill="currentColor" className="text-purple-700" />
                <circle cx="53" cy="30" r="2" fill="white" />
                <polygon points="60,30 65,29 60,31" fill="currentColor" className="text-purple-700" />
                <polygon points="38,50 28,55 30,48" fill="currentColor" className="text-purple-700/70" />
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
            <div className="w-1/3 mx-auto">
              <Progress value={progress} className="w-full h-2" />
            </div>
            <p className="text-xs text-muted-foreground text-center font-medium">{Math.round(progress)}% complete</p>
          </div>
        </div>
      </div>
    )
  }

  if (!clientData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
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
  const facebookData = groupInfo.facebook_cache || {}
  const ghlData = groupInfo.gohighlevel_cache || {}
  const campaigns = facebookData.campaigns || []
  const adsets = facebookData.adsets || []
  const ads = facebookData.ads || []

  // Metrics calculation
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0)
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0)
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0)

  // Chart data extraction
  const budgetByStatus = campaigns.reduce((acc, c) => {
    const existing = acc.find((item) => item.name === c.status)
    if (existing) {
      existing.value += c.spend
    } else {
      acc.push({ name: c.status, value: c.spend, fill: c.status === "Active" ? "#713CDD" : "#a78bde" })
    }
    return acc
  }, [])

  const topCampaignsBySpend = campaigns
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6)
    .map((c) => ({
      name: c.name?.substring(0, 12) + (c.name?.length > 12 ? "..." : ""),
      spend: c.spend,
    }))

  const campaignPerformance = campaigns
    .filter((c) => c.spend > 0 || c.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5)
    .map((c) => ({
      name: c.name?.substring(0, 15) + (c.name?.length > 15 ? "..." : ""),
      spend: Number(c.spend.toFixed(2)),
      impressions: c.impressions || 0,
    }))

  const reachConversionData = campaigns
    .filter((c) => c.reach > 0)
    .sort((a, b) => b.clicks / (b.reach || 1) - a.clicks / (a.reach || 1))
    .slice(0, 6)
    .map((c) => ({
      name: c.name?.substring(0, 12) + (c.name?.length > 12 ? "..." : ""),
      reach: c.reach || 0,
      clicks: c.clicks || 0,
    }))

  const purpleColor = "#713CDD"
  const purpleLightColor = "#a78bde"
  const purpleDarkColor = "#5a2ba3"

  const TableContainer = ({ children, title, description }) => (
    <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 border-b border-border/30">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs text-muted-foreground mt-1">{description}</CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
    </Card>
  )

  const StyledTable = ({ columns, data }) => (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-muted/50 border-b border-border/30">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border/20">
        {data.map((row, idx) => (
          <tr key={idx} className="hover:bg-muted/30 transition-colors">
            {columns.map((col) => (
              <td key={col.key} className="px-4 py-3 text-foreground/80">
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )

  const UnderConstruction = ({ title, message }) => (
    <Card className="border-dashed border-2 py-24 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
      <Construction className="w-12 h-12 mb-4 opacity-20" />
      <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      <p className="text-sm max-w-xs text-center">{message}</p>
    </Card>
  )

  return (
    <div className="min-h-dvh w-full pb-2 flex flex-col overflow-hidden px-4 md:px-8">
      {/* Header */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/clients")} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight truncate max-w-md">
              {groupInfo.name || "Unnamed Client"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 bg-transparent">
              Export Data
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex-1 flex w-full flex-col overflow-hidden min-h-0 mt-6">
        <Tabs defaultValue="marketing" className="flex-1 flex flex-col overflow-hidden min-h-0">
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
            <TabsTrigger
              value="overview"
              className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="marketing"
              className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              Marketing
            </TabsTrigger>
            <TabsTrigger
              value="call-center"
              className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              Call Center
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
            >
              Analytics
            </TabsTrigger>
          </TabsList>

                    {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-6 overflow-y-auto space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-white border-purple-100">
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Total Spend</p>
                      <h3 className="text-2xl font-bold mt-1">${totalSpend.toFixed(2)}</h3>
                      <p className="text-xs text-green-600 mt-1">↑ 12% vs last period</p>
                    </div>
                    <div className="h-7 w-7 bg-[#713CDD1A] rounded-md flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-blue-100">
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Total Impressions</p>
                      <h3 className="text-2xl font-bold mt-1">{totalImpressions.toLocaleString()}</h3>
                      <p className="text-xs text-green-600 mt-1">↑ 8% vs last period</p>
                    </div>
                    <div className="h-7 w-7 bg-blue-100 rounded-md flex items-center justify-center">
                      <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-green-100">
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Total Clicks</p>
                      <h3 className="text-2xl font-bold mt-1">{totalClicks.toLocaleString()}</h3>
                      <p className="text-xs text-green-600 mt-1">↑ 15% vs last period</p>
                    </div>
                    <div className="h-7 w-7 bg-green-100 rounded-md flex items-center justify-center">
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-orange-100">
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Avg CTR</p>
                      <h3 className="text-2xl font-bold mt-1">
                        {totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%
                      </h3>
                      <p className="text-xs text-green-600 mt-1">↑ 5% vs last period</p>
                    </div>
                    <div className="h-7 w-7 bg-orange-100 rounded-md flex items-center justify-center">
                      <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Client History Notes - Keep existing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Client History Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    className="min-h-[150px] resize-none bg-muted/20"
                    placeholder="Enter strategic notes about this client..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <Button onClick={handleSaveNotes} className="w-full text-white bg-[#713CDD]">
                    <Save className=" text-white mr-2 h-4 w-4" />
                    Save Updates
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="m-0 space-y-4">
            {/* Top Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-purple-600 to-purple-700 text-white border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-purple-100">Best CTR</p>
                      <span className="px-2 py-1 bg-white/20 rounded text-xs font-bold">TOP</span>
                    </div>
                    <h3 className="text-3xl font-bold">
                      {Math.max(...ads.map(a => a.ctr || 0)).toFixed(2)}%
                    </h3>
                    <p className="text-xs text-purple-100 truncate">
                      {ads.sort((a, b) => (b.ctr || 0) - (a.ctr || 0))[0]?.name?.substring(0, 25) || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-green-100">Lowest CPC</p>
                      <span className="px-2 py-1 bg-white/20 rounded text-xs font-bold">BEST</span>
                    </div>
                    <h3 className="text-3xl font-bold">
                      ${Math.min(...campaigns.filter(c => c.cpc > 0).map(c => c.cpc || Infinity)).toFixed(2)}
                    </h3>
                    <p className="text-xs text-green-100 truncate">
                      {campaigns.sort((a, b) => (a.cpc || Infinity) - (b.cpc || Infinity))[0]?.name?.substring(0, 25) || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-blue-100">Highest Reach</p>
                      <span className="px-2 py-1 bg-white/20 rounded text-xs font-bold">MAX</span>
                    </div>
                    <h3 className="text-3xl font-bold">
                      {Math.max(...campaigns.map(c => c.reach || 0)).toLocaleString()}
                    </h3>
                    <p className="text-xs text-blue-100 truncate">
                      {campaigns.sort((a, b) => (b.reach || 0) - (a.reach || 0))[0]?.name?.substring(0, 25) || 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-600 to-orange-700 text-white border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-orange-100">Conversion Rate</p>
                      <span className="px-2 py-1 bg-white/20 rounded text-xs font-bold">AVG</span>
                    </div>
                    <h3 className="text-3xl font-bold">
                      {totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%
                    </h3>
                    <p className="text-xs text-orange-100">Click-through performance</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Ads by CTR */}
            <Card className="border border-border/40 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/30">
                <CardTitle className="text-base font-semibold">Top 10 Ads by CTR</CardTitle>
                <CardDescription className="text-xs">Best performing creative by engagement rate</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={ads
                      .filter(a => a.ctr > 0)
                      .sort((a, b) => b.ctr - a.ctr)
                      .slice(0, 10)
                      .map(a => ({
                        name: a.name.substring(0, 20) + '...',
                        ctr: a.ctr,
                        spend: a.spend
                      }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" fontSize={9} axisLine={false} tickLine={false} width={150} />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'CTR') return `${value}%`;
                        if (name === 'Spend') return `$${value.toFixed(2)}`;
                        return value;
                      }}
                    />
                    <Bar dataKey="ctr" fill={purpleColor} radius={[0, 4, 4, 0]} name="CTR" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Campaign Efficiency Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Campaign Efficiency Metrics</CardTitle>
                  <CardDescription className="text-xs">CPM, CPC, CTR comparison</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campaigns.filter(c => c.spend > 0).slice(0, 6).map(c => ({
                      name: c.name.substring(0, 15) + '...',
                      CPM: c.cpm,
                      CPC: c.cpc,
                      'CTR (x10)': c.ctr * 10
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={80} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="CPM" fill={purpleDarkColor} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="CPC" fill={purpleColor} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="CTR (x10)" fill={purpleLightColor} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Engagement Funnel</CardTitle>
                  <CardDescription className="text-xs">From impressions to clicks</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Funnel visualization */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Impressions</span>
                        <span className="text-sm font-bold">{totalImpressions.toLocaleString()}</span>
                      </div>
                      <div className="h-16 bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold">
                        100%
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <svg className="w-8 h-8 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Clicks</span>
                        <span className="text-sm font-bold">{totalClicks.toLocaleString()}</span>
                      </div>
                      <div 
                        className="h-12 bg-gradient-to-r from-purple-500 to-purple-400 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ width: `${totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0}%` }}
                      >
                        {totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : 0}%
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/30">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Avg CPM</p>
                          <p className="text-lg font-bold text-purple-700">
                            ${(totalSpend / (totalImpressions / 1000)).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg CPC</p>
                          <p className="text-lg font-bold text-purple-700">
                            ${(totalSpend / totalClicks).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg CTR</p>
                          <p className="text-lg font-bold text-purple-700">
                            {totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border border-border/40 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Campaign Status</CardTitle>
                  <CardDescription className="text-xs">Active vs Paused</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie
                        data={[
                          { name: 'Active', value: campaigns.filter(c => c.status === 'Active').length, fill: '#10b981' },
                          { name: 'Paused', value: campaigns.filter(c => c.status === 'Paused').length, fill: '#f59e0b' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border border-border/40 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/30">
                  <CardTitle className="text-base font-semibold">Top 5 Campaigns by Budget</CardTitle>
                  <CardDescription className="text-xs">Highest spend campaigns</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCampaignsBySpend.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="name" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                      <Bar dataKey="spend" fill={purpleColor} radius={[4, 4, 0, 0]}>
                        {topCampaignsBySpend.slice(0, 5).map((entry, index) => (
                          <cell key={`cell-${index}`} fill={index === 0 ? purpleDarkColor : index === 1 ? purpleColor : purpleLightColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Performance Table */}
            <Card className="border border-border/40 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/30">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-base font-semibold">Complete Campaign Analytics</CardTitle>
                    <CardDescription className="text-xs">Sortable performance data</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" className="h-8">
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border/30">
                    <tr>
                      {['Campaign', 'Status', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPM', 'CPC', 'Reach'].map(header => (
                        <th key={header} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:bg-muted/70">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {campaigns.map((campaign, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium max-w-[200px]">
                          <div className="truncate" title={campaign.name}>{campaign.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${campaign.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-purple-700">${campaign.spend.toFixed(2)}</td>
                        <td className="px-4 py-3">{campaign.impressions.toLocaleString()}</td>
                        <td className="px-4 py-3">{campaign.clicks.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${campaign.ctr > 3 ? 'text-green-600' : campaign.ctr > 1.5 ? 'text-orange-600' : 'text-red-600'}`}>
                            {campaign.ctr.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">${campaign.cpm.toFixed(2)}</td>
                        <td className="px-4 py-3">${campaign.cpc.toFixed(2)}</td>
                        <td className="px-4 py-3">{campaign.reach.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MARKETING SECTION (NESTED TABS) */}
          <TabsContent value="marketing" className="flex-1 flex flex-col overflow-hidden mt-6">
            <div className="flex-1 flex flex-col overflow-hidden">
              <Tabs defaultValue="campaigns" className="flex-1 flex flex-col overflow-hidden">
                <div className="overflow-x-auto md:overflow-x-visible">
                  <TabsList className="w-fit h-9 bg-muted/30 p-1 mb-4 ">
                    <TabsTrigger value="campaigns" className="text-xs px-4">
                      Campaigns
                    </TabsTrigger>
                    <TabsTrigger value="adsets" className="text-xs px-4">
                      Adsets
                    </TabsTrigger>
                    <TabsTrigger value="ads" className="text-xs px-4">
                      Ads
                    </TabsTrigger>
                    <TabsTrigger value="leads" className="text-xs px-4">
                      Leads
                    </TabsTrigger>
                    <TabsTrigger value="performance" className="text-xs px-4">
                      Performance
                    </TabsTrigger>
                  </TabsList>
                </div>
              

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-6">
                {/* Campaigns */}
                <TabsContent value="campaigns" className="m-0 space-y-4">
  {/* Quick Stats Bar */}
  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
    <div className="bg-white rounded-lg border p-3 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">Active Campaigns</p>
      <p className="text-2xl font-bold text-green-600">
        {campaigns.filter(c => c.status === 'Active').length}
      </p>
      <p className="text-xs text-green-600 mt-1">
        {((campaigns.filter(c => c.status === 'Active').length / campaigns.length) * 100).toFixed(0)}% of total
      </p>
    </div>

    <div className="bg-white rounded-lg border p-3 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">Paused Campaigns</p>
      <p className="text-2xl font-bold text-yellow-600">
        {campaigns.filter(c => c.status === 'Paused').length}
      </p>
      <p className="text-xs text-yellow-600 mt-1">
        {((campaigns.filter(c => c.status === 'Paused').length / campaigns.length) * 100).toFixed(0)}% of total
      </p>
    </div>

    <div className="bg-white rounded-lg border p-3 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
      <p className="text-2xl font-bold text-purple-600">
        ${totalSpend.toFixed(0)}
      </p>
      <p className="text-xs text-purple-600 mt-1">
        Across {campaigns.length} campaigns
      </p>
    </div>

    <div className="bg-white rounded-lg border p-3 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">Average CTR</p>
      <p className="text-2xl font-bold text-blue-600">
        {campaigns.length > 0 ? (campaigns.reduce((sum, c) => sum + c.ctr, 0) / campaigns.length).toFixed(2) : 0}%
      </p>
      <p className="text-xs text-blue-600 mt-1">
        Industry avg: 2.5%
      </p>
    </div>

    <div className="bg-white rounded-lg border p-3 shadow-sm">
      <p className="text-xs text-muted-foreground mb-1">Total Reach</p>
      <p className="text-2xl font-bold text-orange-600">
        {campaigns.reduce((sum, c) => sum + c.reach, 0).toLocaleString()}
      </p>
      <p className="text-xs text-orange-600 mt-1">
        Unique users reached
      </p>
    </div>
  </div>

  {/* Main Charts Section */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    {/* Budget Distribution */}
    <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-semibold">Budget Distribution</CardTitle>
            <CardDescription className="text-xs">Spend allocation by campaign status</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-purple-700">${totalSpend.toFixed(2)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip 
              formatter={(value) => `$${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Pie
              data={budgetByStatus}
              cx="50%"
              cy="45%"
              labelLine={false}
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={90}
              fill={purpleColor}
              dataKey="value"
              strokeWidth={2}
              stroke="#fff"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    {/* Top Campaigns by Spend */}
    <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 border-b border-border/30">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base font-semibold">Top 6 Campaigns by Spend</CardTitle>
            <CardDescription className="text-xs">Highest investment campaigns</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={topCampaignsBySpend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20, 15, 15, 0.05)" />
            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis fontSize={10} axisLine={false} tickLine={false} />
            <Tooltip 
              formatter={(value) => `$${value.toFixed(2)}`}
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            <Bar dataKey="spend" radius={[6, 6, 0, 0]}>
              {topCampaignsBySpend.map((entry, index) => (
                <cell 
                  key={`cell-${index}`} 
                  fill={index === 0 ? '#5a2ba3' : index === 1 ? '#713CDD' : index === 2 ? '#8b5cf6' : '#a78bde'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  </div>

  {/* Campaign Performance Comparison */}
  <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow">
    <CardHeader className="pb-3 border-b border-border/30">
      <CardTitle className="text-base font-semibold">Campaign Performance Comparison</CardTitle>
      <CardDescription className="text-xs">Spend vs Results across active campaigns</CardDescription>
    </CardHeader>
    <CardContent className="pt-6 h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={campaignPerformance}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
          <XAxis 
            dataKey="name" 
            fontSize={10} 
            axisLine={false} 
            tickLine={false}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis fontSize={10} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <Legend />
          <Bar dataKey="spend" name="Spend ($)" fill={purpleColor} radius={[4, 4, 0, 0]} />
          <Bar dataKey="impressions" name="Impressions" fill={purpleLightColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>

  {/* CTR Performance Analysis */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/30">
        <CardTitle className="text-base font-semibold text-green-700">High Performers</CardTitle>
        <CardDescription className="text-xs">CTR above 3%</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {campaigns
            .filter(c => c.ctr > 3)
            .slice(0, 3)
            .map((c, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={c.name}>{c.name.substring(0, 25)}...</p>
                  <p className="text-xs text-muted-foreground">CTR: {c.ctr.toFixed(2)}%</p>
                </div>
                <div className="ml-2 px-2 py-1 bg-green-600 text-white rounded text-xs font-bold">
                  🔥 TOP
                </div>
              </div>
            ))}
          {campaigns.filter(c => c.ctr > 3).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No high performers yet</p>
          )}
        </div>
      </CardContent>
    </Card>

    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/30">
        <CardTitle className="text-base font-semibold text-orange-700">Average Performers</CardTitle>
        <CardDescription className="text-xs">CTR between 1.5% - 3%</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {campaigns
            .filter(c => c.ctr >= 1.5 && c.ctr <= 3)
            .slice(0, 3)
            .map((c, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={c.name}>{c.name.substring(0, 25)}...</p>
                  <p className="text-xs text-muted-foreground">CTR: {c.ctr.toFixed(2)}%</p>
                </div>
                <div className="ml-2 px-2 py-1 bg-orange-500 text-white rounded text-xs font-bold">
                  ⚡ AVG
                </div>
              </div>
            ))}
          {campaigns.filter(c => c.ctr >= 1.5 && c.ctr <= 3).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No average performers</p>
          )}
        </div>
      </CardContent>
    </Card>

    <Card className="border border-border/40 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/30">
        <CardTitle className="text-base font-semibold text-red-700">Needs Attention</CardTitle>
        <CardDescription className="text-xs">CTR below 1.5%</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {campaigns
            .filter(c => c.ctr < 1.5 && c.ctr > 0)
            .slice(0, 3)
            .map((c, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={c.name}>{c.name.substring(0, 25)}...</p>
                  <p className="text-xs text-muted-foreground">CTR: {c.ctr.toFixed(2)}%</p>
                </div>
                <div className="ml-2 px-2 py-1 bg-red-600 text-white rounded text-xs font-bold">
                  ⚠️ LOW
                </div>
              </div>
            ))}
          {campaigns.filter(c => c.ctr < 1.5 && c.ctr > 0).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">All campaigns performing well!</p>
          )}
        </div>
      </CardContent>
    </Card>
  </div>

  {/* Detailed Campaign Table */}
  <TableContainer
    title="Complete Campaign Performance"
    description="Real-time campaign status, delivery metrics, and efficiency indicators"
  >
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/50 border-b border-border/30">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center gap-2">
                Campaign Name
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center gap-2">
                Spend
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Impressions</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clicks</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center gap-2">
                CTR
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">CPM</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">CPC</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reach</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/20">
          {campaigns.map((campaign, idx) => (
            <tr key={idx} className="hover:bg-muted/30 transition-colors group">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${campaign.status === 'Active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="font-medium max-w-[200px] truncate" title={campaign.name}>
                    {campaign.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    campaign.status === "Active" 
                      ? "bg-green-100 text-green-700 border border-green-200" 
                      : "bg-yellow-100 text-yellow-700 border border-yellow-200"
                  }`}
                >
                  {campaign.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div>
                  <span className="font-semibold text-purple-700">${campaign.spend.toFixed(2)}</span>
                  <div className="w-full bg-purple-100 h-1 rounded-full mt-1">
                    <div 
                      className="bg-purple-600 h-1 rounded-full" 
                      style={{ width: `${(campaign.spend / Math.max(...campaigns.map(c => c.spend))) * 100}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-foreground/80">{campaign.impressions.toLocaleString()}</td>
              <td className="px-4 py-3 text-foreground/80">{campaign.clicks.toLocaleString()}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${
                    campaign.ctr > 3 ? 'text-green-600' : 
                    campaign.ctr > 1.5 ? 'text-orange-600' : 
                    'text-red-600'
                  }`}>
                    {campaign.ctr.toFixed(2)}%
                  </span>
                  {campaign.ctr > 3 && <span className="text-xs">🔥</span>}
                  {campaign.ctr < 1.5 && campaign.ctr > 0 && <span className="text-xs">⚠️</span>}
                </div>
              </td>
              <td className="px-4 py-3 text-foreground/80">${campaign.cpm.toFixed(2)}</td>
              <td className="px-4 py-3 text-foreground/80">${campaign.cpc.toFixed(2)}</td>
              <td className="px-4 py-3 text-foreground/80">{campaign.reach.toLocaleString()}</td>
              <td className="px-4 py-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  View Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </TableContainer>

  {/* Campaign Insights Footer */}
  <Card className="border border-border/40 bg-gradient-to-r from-purple-50 to-blue-50">
    <CardContent className="pt-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Best Performing Campaign</p>
          <p className="text-lg font-bold text-purple-700 truncate px-2">
            {campaigns.sort((a, b) => b.ctr - a.ctr)[0]?.name?.substring(0, 30) || 'N/A'}
          </p>
          <p className="text-sm text-green-600 mt-1">
            CTR: {campaigns.sort((a, b) => b.ctr - a.ctr)[0]?.ctr.toFixed(2)}%
          </p>
        </div>
        <div className="text-center border-x border-border/30">
          <p className="text-sm text-muted-foreground mb-2">Most Cost Efficient</p>
          <p className="text-lg font-bold text-purple-700 truncate px-2">
            {campaigns.filter(c => c.cpc > 0).sort((a, b) => a.cpc - b.cpc)[0]?.name?.substring(0, 30) || 'N/A'}
          </p>
          <p className="text-sm text-green-600 mt-1">
            CPC: ${campaigns.filter(c => c.cpc > 0).sort((a, b) => a.cpc - b.cpc)[0]?.cpc.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Highest Budget</p>
          <p className="text-lg font-bold text-purple-700 truncate px-2">
            {campaigns.sort((a, b) => b.spend - a.spend)[0]?.name?.substring(0, 30) || 'N/A'}
          </p>
          <p className="text-sm text-purple-600 mt-1">
            Spend: ${campaigns.sort((a, b) => b.spend - a.spend)[0]?.spend.toFixed(2)}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</TabsContent>

                {/* Adsets */}
                <TabsContent value="adsets" className="m-0 space-y-4">
                  <TableContainer
                    title="Ad Sets Breakdown"
                    description="Audience-level performance and delivery status"
                  >
                    <StyledTable
                      columns={[
                        { key: "name", label: "Ad Set Name" },
                        {
                          key: "status",
                          label: "Status",
                          render: (v) => (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v === "Active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                            >
                              {v}
                            </span>
                          ),
                        },
                        { key: "spend", label: "Spend", render: (v) => `$${v.toFixed(2)}` },
                        { key: "impressions", label: "Impressions", render: (v) => v.toLocaleString() },
                        { key: "clicks", label: "Clicks", render: (v) => v.toLocaleString() },
                        { key: "cpc", label: "CPC", render: (v) => `$${v.toFixed(2)}` },
                      ]}
                      data={adsets}
                    />
                  </TableContainer>
                </TabsContent>

                {/* Ads */}
                <TabsContent value="ads" className="m-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {ads.map((ad) => (
                      <Card
                        key={ad.id}
                        className="overflow-hidden border border-border/40 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-video bg-muted relative group">
                          {ad.creative_image ? (
                            <img
                              src={ad.creative_image || "/placeholder.svg"}
                              alt={ad.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 italic text-xs">
                              No Creative Preview
                            </div>
                          )}
                          <div
                            className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold backdrop-blur-md ${ad.status === "Active" ? "bg-green-500/80 text-white" : "bg-yellow-500/80 text-white"}`}
                          >
                            {ad.status}
                          </div>
                        </div>
                        <CardHeader className="p-3">
                          <CardTitle className="text-[11px] font-bold line-clamp-1">{ad.name}</CardTitle>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                            {ad.creative_body || "No caption available"}
                          </p>
                        </CardHeader>
                        <div className="px-3 pb-3 pt-0 flex justify-between items-center text-[10px]">
                          <div className="font-semibold text-purple-700">${ad.spend.toFixed(2)} Spend</div>
                          <div className="text-muted-foreground">{ad.clicks} Clicks</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Leads (Under Construction) */}
                <TabsContent value="leads" className="m-0">
                  <UnderConstruction
                    title="Leads Integration"
                    message="We are currently building the CRM bridge to sync your GHL and Meta leads directly into this view."
                  />
                </TabsContent>

                {/* Performance (Moved from Main) */}
                <TabsContent value="performance" className="m-0 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="border border-border/40 shadow-sm">
                      <CardHeader className="pb-3 border-b border-border/30">
                        <CardTitle className="text-base font-semibold">Spend vs Impressions</CardTitle>
                        <CardDescription className="text-xs">Efficiency analysis across campaigns</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={campaignPerformance}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="spend" name="Spend ($)" fill={purpleColor} radius={[4, 4, 0, 0]} />
                            <Bar
                              dataKey="impressions"
                              name="Impressions"
                              fill={purpleLightColor}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="border border-border/40 shadow-sm">
                      <CardHeader className="pb-3 border-b border-border/30">
                        <CardTitle className="text-base font-semibold">Reach Conversion</CardTitle>
                        <CardDescription className="text-xs">Campaign reach to click performance</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reachConversionData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="reach" name="Reach" fill={purpleDarkColor} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="clicks" name="Clicks" fill={purpleColor} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </div>
              </Tabs>
            </div>
          </TabsContent>

          {/* CALL CENTER SECTION (UNDER CONSTRUCTION) */}
          <TabsContent value="call-center" className="mt-6 flex-1">
            <UnderConstruction
              title="Call Center Dashboard"
              message="This section will feature live call tracking, recording playback, and agent performance metrics."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
