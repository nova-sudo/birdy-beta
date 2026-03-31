"use client"
import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, DollarSign, Construction, Clock, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { Loading } from "@/components/ui/loader"
import { useClientGroups } from "@/lib/useClientGroups"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { MarketingContent } from "@/components/campaigns/MarketingContent"
import { LeadsContent } from "@/components/contacts/LeadsContent"
import IntegrationsContent from "@/components/integrations/IntegrationsContent"

// ── Coming Soon placeholder ──────────────────────────────────────────────────
function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
        <Clock className="h-8 w-8 text-purple-500" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">This feature is coming soon.</p>
    </div>
  )
}

// ── Tab trigger style ────────────────────────────────────────────────────────
const tabTriggerClass =
  "flex-1 text-[#71658B] font-semibold hover:bg-[#FBFAFE] data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:rounded-md data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"

export default function ClientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = decodeURIComponent(params?.id || "")

  // ── Loading state ──────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(10)
  const [loading, setLoading] = useState(true)

  // ── Overview data ──────────────────────────────────────────────────────────
  const [clientData, setClientData] = useState(null)
  const [notes, setNotes] = useState("")
  const [alerts, setAlerts] = useState([])

  // ── Shared date preset for Marketing & Leads tabs ──────────────────────────
  const {
    clientGroups: allGroups,
    loading: groupsLoading,
    datePreset,
    setDatePreset,
    invalidate,
  } = useClientGroups(DEFAULT_DATE_PRESET)

  // Find this specific group from the cached list
  const matchingGroup = useMemo(
    () => allGroups.find((g) => g.id === clientId),
    [allGroups, clientId]
  )
  const singleGroupArray = useMemo(
    () => (matchingGroup ? [matchingGroup] : []),
    [matchingGroup]
  )

  // ── Derived metrics for Overview stat cards ────────────────────────────────
  const metrics = useMemo(() => {
    const campaigns = matchingGroup?.facebook?.campaigns || []
    const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0"
    return { totalSpend, totalClicks, totalImpressions, avgCtr }
  }, [matchingGroup])

  // ── Progress animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + 10))
      }, 200)
      return () => clearInterval(interval)
    }
  }, [loading])

  // ── Fetch client details (for notes) ───────────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    ;(async () => {
      try {
        setLoading(true)
        const response = await apiRequest(`/api/client-groups/${clientId}`)
        if (!response.ok) throw new Error("Failed to fetch client details")
        const result = await response.json()
        setClientData(result.data)
        setNotes(result.data?.group_info?.notes || "")
        setProgress(100)
      } catch {
        toast.error("Failed to load client details")
      } finally {
        setTimeout(() => setLoading(false), 300)
      }
    })()
  }, [clientId])

  // ── Fetch alerts for this client ───────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    ;(async () => {
      try {
        const res = await apiRequest("/api/alerts")
        if (!res.ok) return
        const data = await res.json()
        const all = [...(data.active || []), ...(data.triggered || []), ...(data.paused || [])]
        setAlerts(all.filter((a) => (a.target_group_ids || []).includes(clientId)))
      } catch {
        // Alerts are non-critical — silently fail
      }
    })()
  }, [clientId])

  // ── Delete alert ────────────────────────────────────────────────────────────
  const handleDeleteAlert = async (alertId) => {
    try {
      const res = await apiRequest(`/api/alerts/${alertId}`, { method: "DELETE" })
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId))
        toast.success("Alert deleted")
      } else {
        toast.error("Failed to delete alert")
      }
    } catch {
      toast.error("Failed to delete alert")
    }
  }

  // ── Save notes ─────────────────────────────────────────────────────────────
  const handleSaveNotes = async () => {
    try {
      const response = await apiRequest(`/api/client-groups/${clientId}/notes`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      })
      if (response.ok) toast.success("Notes saved successfully")
      else toast.error("Failed to save notes")
    } catch {
      toast.error("Failed to save notes")
    }
  }

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) return <Loading progress={progress} />

  if (!clientData) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Client Not Found</h2>
          <Button onClick={() => router.push("/clients")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients
          </Button>
        </div>
      </div>
    )
  }

  const groupName = clientData.group_info?.name || "Client"

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/clients")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{groupName}</h1>
        </div>
        <DateRangeSelect value={datePreset} onChange={setDatePreset} />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="inline-flex h-13 items-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
          <TabsTrigger value="overview" className={tabTriggerClass}>Overview</TabsTrigger>
          <TabsTrigger value="insights" className={tabTriggerClass}>Insights</TabsTrigger>
          <TabsTrigger value="ask-birdy" className={tabTriggerClass}>Ask Birdy</TabsTrigger>
          <TabsTrigger value="marketing" className={tabTriggerClass}>Marketing</TabsTrigger>
          <TabsTrigger value="call-centre" className={tabTriggerClass}>Call Centre</TabsTrigger>
          <TabsTrigger value="leads" className={tabTriggerClass}>Leads</TabsTrigger>
          <TabsTrigger value="integrations" className={tabTriggerClass}>Integrations</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Stat Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-white border-purple-100">
              <CardContent className="pt-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-muted-foreground text-sm text-[#71658B]">Total Spend</p>
                    <h3 className="text-2xl font-bold mt-1">${metrics.totalSpend.toFixed(2)}</h3>
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
                    <h3 className="text-2xl font-bold mt-1">{metrics.totalImpressions.toLocaleString()}</h3>
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
                    <h3 className="text-2xl font-bold mt-1">{metrics.totalClicks.toLocaleString()}</h3>
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
                    <h3 className="text-2xl font-bold mt-1">{metrics.avgCtr}%</h3>
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

          {/* Alerts + History Book side by side */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Client Alerts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Client Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No alerts for now.</p>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-4 border rounded-lg ${
                          alert.status === "triggered"
                            ? "border-l-4 border-l-yellow-400"
                            : alert.status === "active"
                            ? "border-l-4 border-l-green-400"
                            : "border-l-4 border-l-gray-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{alert.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {alert.metric_label} {alert.condition_display} per {alert.condition?.period}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={alert.status === "triggered" ? "destructive" : alert.status === "active" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {alert.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600"
                              onClick={() => handleDeleteAlert(alert.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {alert.last_eval_result && (
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Current: <span className="font-semibold text-foreground">{Number(alert.current_value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Threshold: <span className="font-semibold text-foreground">{Number(alert.last_eval_result.threshold || 0).toLocaleString()}</span>
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  alert.progress_pct >= 100 ? "bg-red-500" : alert.progress_pct >= 75 ? "bg-yellow-500" : "bg-green-500"
                                }`}
                                style={{ width: `${Math.min(alert.progress_pct || 0, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">{alert.last_eval_result.message}</p>
                          </div>
                        )}

                        {alert.last_triggered_at && (
                          <p className="text-[10px] text-muted-foreground mt-2">
                            Last triggered: {new Date(alert.last_triggered_at).toLocaleDateString()} {new Date(alert.last_triggered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History Book */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">History Book</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    className="min-h-[200px] resize-none bg-muted/20"
                    placeholder="Add notes about this client..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                  <Button onClick={handleSaveNotes} className="w-full text-white bg-[#713CDD]">
                    <Save className="text-white mr-2 h-4 w-4" />
                    Save Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Insights Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="insights" className="mt-6">
          <ComingSoon title="Insights" />
        </TabsContent>

        {/* ── Ask Birdy Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="ask-birdy" className="mt-6">
          <ComingSoon title="Ask Birdy" />
        </TabsContent>

        {/* ── Marketing Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="marketing" className="mt-4">
          <MarketingContent
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            groupsError={null}
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            showGroupFilter={false}
            showHeader={false}
          />
        </TabsContent>

        {/* ── Call Centre Tab ───────────────────────────────────────────────── */}
        <TabsContent value="call-centre" className="mt-6">
          <ComingSoon title="Call Centre" />
        </TabsContent>

        {/* ── Leads Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="leads" className="mt-4">
          <LeadsContent
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            datePreset={datePreset}
            setDatePreset={setDatePreset}
            showGroupFilter={false}
            showHeader={false}
          />
        </TabsContent>

        {/* ── Integrations Tab ─────────────────────────────────────────────── */}
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsContent
            group={matchingGroup}
            onRefreshComplete={invalidate}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
