"use client"
import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, DollarSign, Clock, Trash2, AlertTriangle, Loader2, Settings } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { useDashboardData } from "@/app/dashboard/useDashboardData"
import { ActivityItem } from "@/components/activity/ActivityItem"
import { useClientGroups } from "@/lib/useClientGroups"
import { useCurrency } from "@/hooks/useCurrency"
import getSymbolFromCurrency from "currency-symbol-map"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { MarketingContent } from "@/components/campaigns/MarketingContent"
import { LeadsContent } from "@/components/contacts/LeadsContent"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import IntegrationsContent from "@/components/integrations/IntegrationsContent"
import { ClientAskBirdy } from "@/components/clients/ClientAskBirdy"
import { CallCentreOverview } from "@/components/saleshub/CallCentreOverview"
import { LeadHubOverview } from "@/components/contacts/LeadHubOverview"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { HealthPill, DEFAULT_CLIENT_HEALTH } from "@/components/clients/HealthPill"
import { usePageHeader } from "@/components/page-header"
import { pdFontClass } from "@/lib/pd-fonts"
import { GoalsStrip } from "@/components/clients/GoalsStrip"
import { ClientTargetsForm } from "@/components/clients/ClientTargetsForm"
import { DiagnosticsFunnel } from "@/components/clients/DiagnosticsFunnel"
import { HistoryBook } from "@/components/clients/HistoryBook"
import { ClientTrendChart } from "@/components/clients/ClientTrendChart"
import { InsightCard, SidePanel } from "@/components/portfolio"
import { buildClientInsight, clientInsightPrompt } from "@/lib/client-insight"
import { buildFunnelStages } from "@/lib/client-funnel"
import { buildClientGoals } from "@/lib/client-goals"

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

// ── Stat Cards Skeleton ──────────────────────────────────────────────────────
function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="bg-white">
          <CardContent className="pt-0">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Alerts Skeleton ──────────────────────────────────────────────────────────
function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="p-4 border rounded-lg space-y-2">
          <div className="flex justify-between items-start">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ── Activity Skeleton ────────────────────────────────────────────────────────
// ── Tab trigger style ────────────────────────────────────────────────────────
const tabTriggerClass = ""

export default function ClientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = decodeURIComponent(params?.id || "")

  // ── Overview data ──────────────────────────────────────────────────────────
  const [clientData, setClientData] = useState(null)
  const [clientLoading, setClientLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  // Controlled so the Birdy Insights card can send the reader into the
  // Ask Birdy tab with its question already asked.
  const [activeTab, setActiveTab] = useState("overview")
  const [askPrompt, setAskPrompt] = useState(null)

  // ── Currency: user's default, overridden by the ad account's own currency ──
  const { currency: userCurrency } = useCurrency()

  // ── Client status (used in Integrations tab) ──────────────────────────────
  const [clientStatus, setClientStatus] = useState(null)
  // Derived weekly from the monthly closes goal — see services/client_health.py.
  const [clientHealth, setClientHealth] = useState(DEFAULT_CLIENT_HEALTH)
  const [healthDetail, setHealthDetail] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // ── History Book: dashboard activity feed, filtered to this client ────────
  const { activity, loading: activityLoading } = useDashboardData()
  const groupNameForActivity = clientData?.group_info?.name
  const clientActivity = useMemo(
    () => activity.filter((a) => a.client === groupNameForActivity),
    [activity, groupNameForActivity]
  )

  // ── History book: hand-written notes, alongside the generated activity ────
  const [notes, setNotes] = useState([])
  const [notesLoading, setNotesLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    apiRequest(`/api/client-groups/${clientId}/notes`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) setNotes(data.notes || [])
      })
      .catch((err) => console.warn("[client] Could not load notes:", err))
      .finally(() => { if (!cancelled) setNotesLoading(false) })
    return () => { cancelled = true }
  }, [clientId])

  const handleAddNote = async (body) => {
    try {
      const res = await apiRequest(`/api/client-groups/${clientId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const note = await res.json()
      setNotes((prev) => [note, ...prev])   // newest first, as the API returns them
      return true
    } catch (err) {
      console.error("[client] Could not save note:", err)
      return false
    }
  }

  const handleDeleteNote = async (noteId) => {
    try {
      const res = await apiRequest(
        `/api/client-groups/${clientId}/notes/${noteId}`, { method: "DELETE" }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      return true
    } catch (err) {
      console.error("[client] Could not delete note:", err)
      return false
    }
  }

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

  // Spend is reported by Meta in the ad account's own currency — never converted —
  // so label it with that currency and only fall back to the user's default.
  const currencySymbol = useMemo(() => {
    const code =
      matchingGroup?.facebook?.currency ||
      matchingGroup?.ad_account_currency ||
      userCurrency
    return getSymbolFromCurrency(code) || "$"
  }, [matchingGroup, userCurrency])

  // ── Goals: live figures against the client's monthly targets ──────────────
  const goals = useMemo(
    () => (matchingGroup ? buildClientGoals(matchingGroup) : []),
    [matchingGroup]
  )

  const insight = useMemo(
    () => (matchingGroup ? buildClientInsight(matchingGroup, goals, currencySymbol) : []),
    [matchingGroup, goals, currencySymbol]
  )

  const [railPanel, setRailPanel] = useState("suggestions")
  const railPanels = useMemo(() => [
    {
      key: "suggestions",
      label: "Suggestions",
      badge: 0,
      badgeClassName: "bg-pd-primary-tint text-pd-primary",
      isEmpty: true,
      // Suggestions are generated per user, not per client, and nothing scopes
      // them to one group yet — so this says so rather than showing another
      // client's.
      emptyMessage: "Client-scoped suggestions are not available yet",
      render: () => null,
    },
    {
      key: "activity",
      label: "Activity",
      badge: clientActivity.length,
      badgeClassName: "bg-pd-divider text-pd-muted",
      isEmpty: clientActivity.length === 0,
      emptyMessage: "No activity for this client yet",
      render: () => (
        <div className="space-y-4">
          {clientActivity.map((a) => <ActivityItem key={a.id} {...a} />)}
        </div>
      ),
    },
  ], [clientActivity])

  const funnelStages = useMemo(
    () => (matchingGroup ? buildFunnelStages(matchingGroup) : null),
    [matchingGroup]
  )

  // ── Derived metrics for Overview stat cards ────────────────────────────────
  const metrics = useMemo(() => {
    const campaigns = matchingGroup?.facebook?.campaigns || []
    const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0)
    const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0)
    const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0)
    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0"
    const totalTalkMin = matchingGroup?.hotprospector?.call_stats?.total_talk_min ?? 0
    return { totalSpend, totalClicks, totalImpressions, avgCtr, totalTalkMin }
  }, [matchingGroup])

  // ── Fetch client details ────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    ;(async () => {
      try {
        setClientLoading(true)
        const response = await apiRequest(`/api/client-groups/${clientId}`)
        if (!response.ok) throw new Error("Failed to fetch client details")
        const result = await response.json()
        setClientData(result.data)
        setClientStatus(result.data?.group_info?.client_status ?? "Active")
        setClientHealth(result.data?.group_info?.health ?? DEFAULT_CLIENT_HEALTH)
        setHealthDetail(result.data?.group_info?.health_detail ?? null)
      } catch {
        toast.error("Failed to load client details")
      } finally {
        setClientLoading(false)
      }
    })()
  }, [clientId])

  // ── Fetch alerts for this client ───────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    ;(async () => {
      try {
        setAlertsLoading(true)
        const res = await apiRequest("/api/alerts")
        if (!res.ok) return
        const data = await res.json()
        const all = [...(data.active || []), ...(data.triggered || []), ...(data.paused || [])]
        setAlerts(all.filter((a) => (a.target_group_ids || []).includes(clientId)))
      } catch {
        // Alerts are non-critical — silently fail
      } finally {
        setAlertsLoading(false)
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

  // ── Toggle client status (used in Integrations tab) ────────────────────────
  const handleToggleStatus = async () => {
    const newStatus = clientStatus === "Active" ? "Inactive" : "Active"
    setStatusLoading(true)
    try {
      const res = await apiRequest(`/api/client-groups/${clientId}/client-status`, {
        method: "PATCH",
        body: JSON.stringify({ client_status: newStatus }),
      })
      if (res.ok) {
        setClientStatus(newStatus)
        toast.success(`Client marked as ${newStatus}`)
        invalidate()
      } else {
        toast.error("Failed to update status")
      }
    } catch {
      toast.error("Failed to update status")
    } finally {
      setStatusLoading(false)
    }
  }

  // ── Delete group ───────────────────────────────────────────────────────────
  const handleDeleteGroup = async () => {
    if (deleteInput.trim() !== groupName?.trim()) {
      setDeleteError("Name does not match. Please try again.")
      return
    }
    try {
      setDeleteLoading(true)
      const res = await apiRequest(`/api/client-groups/${clientId}`, { method: "DELETE" })
      localStorage.removeItem(`clientGroups_last_7d`)
      if (res.ok) {
        toast.success("Client group deleted")
        router.push("/clients")
      } else {
        toast.error("Failed to delete client group")
      }
    } catch {
      toast.error("Failed to delete client group")
    } finally {
      setDeleteLoading(false)
    }
  }

  const groupName = clientData?.group_info?.name || "Client"

  // The design's sub-line reads "Emma T. · client since Mar 2025". There is no
  // primary-contact field on a client group, so only the half that exists is
  // rendered rather than inventing a name.
  const clientSubline = useMemo(() => {
    const since = clientData?.group_info?.created_at
    if (!since) return null
    const d = new Date(since)
    if (Number.isNaN(d.getTime())) return null
    return `Client since ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
  }, [clientData])

  // Identity and filters belong in the global top bar, where the design puts
  // them — in place of the Birdy wordmark, and beside the bell. Declared above
  // the early return below, because a hook after a conditional return breaks
  // the Rules of Hooks the moment that branch is taken.
  const pageHeader = useMemo(
    () => ({
      title: (
        <div className={`${pdFontClass} flex min-w-0 items-center gap-2.5`}>
          <button
            onClick={() => router.push("/clients")}
            aria-label="Back to Client Hub"
            className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-pd-divider text-pd-body hover:bg-pd-border"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
                {clientLoading ? "…" : groupName}
              </h1>
              {!clientLoading && <HealthPill health={clientHealth} />}
            </div>
            {clientSubline && (
              <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">
                {clientSubline}
              </p>
            )}
          </div>
        </div>
      ),
      controls: (
        <div className="hidden items-center gap-2 md:flex">
          <DateRangeSelect value={datePreset} onChange={setDatePreset} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIntegrationsOpen(true)}
            title="Client settings"
            aria-label="Client settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      ),
    }),
    [groupName, clientLoading, clientHealth, clientSubline, datePreset, setDatePreset, router]
  )
  usePageHeader(pageHeader)

  // ── Error state (only shown if client data fails entirely) ─────────────────
  if (!clientLoading && !clientData) {
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

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className={tabTriggerClass}>Overview</TabsTrigger>
          <TabsTrigger value="ask-birdy" className={tabTriggerClass}>Ask Birdy</TabsTrigger>
          <TabsTrigger value="marketing" className={tabTriggerClass}>Marketing</TabsTrigger>
          <TabsTrigger value="call-centre" className={tabTriggerClass}>Call Centre</TabsTrigger>
          <TabsTrigger value="leads" className={tabTriggerClass}>Leads</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Goals — each metric against the target set in Settings. The same
              monthly-closes target drives the health pill in the header. */}
          <GoalsStrip
            goals={goals}
            currencySymbol={currencySymbol}
            loading={groupsLoading}
          />

          {/* Chart left, Birdy's read of the period right — the design's two
              columns, with the rail fixed at 340px. */}
          <div className="flex flex-col items-stretch gap-[18px] lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col">
              <ClientTrendChart
                group={matchingGroup}
                datePreset={datePreset}
                currencySymbol={currencySymbol}
                loading={groupsLoading}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-[14px] lg:w-[340px] lg:shrink-0">
              <InsightCard
                segments={insight}
                onAsk={() => {
                  setAskPrompt(clientInsightPrompt(matchingGroup, goals))
                  setActiveTab("ask-birdy")
                }}
              />
              <SidePanel
                panels={railPanels}
                active={railPanel}
                onChange={setRailPanel}
                label="Client panel"
                id="client-side-panel"
                className="min-h-[280px] w-full rounded-2xl border border-pd-border"
              />
            </div>
          </div>

          {/* Stat Cards */}
          {groupsLoading ? (
            <StatCardsSkeleton />
          ) : (
            <div className="grid gap-4 md:grid-cols-5">
              <Card className="bg-white border-purple-100">
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Total Spend</p>
                      <h3 className="text-2xl font-bold mt-1">{currencySymbol}{metrics.totalSpend.toFixed(2)}</h3>
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

              <Card className="bg-white border-teal-100">
                <CardContent className="pt-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-muted-foreground text-sm text-[#71658B]">Talk Time (min)</p>
                      <h3 className="text-2xl font-bold mt-1">{metrics.totalTalkMin.toLocaleString()}</h3>
                    </div>
                    <div className="h-7 w-7 bg-teal-100 rounded-md flex items-center justify-center">
                      <Clock className="h-4 w-4 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Alerts keep their own row — they predate this design and 1d has
              no equivalent. */}
          <div className="grid gap-6">
            {/* Client Alerts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Client Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <AlertsSkeleton />
                ) : alerts.length === 0 ? (
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

          </div>

          {/* History book beside diagnostics — the design's 1.35 / 0.65 split. */}
          <div className="grid gap-6 md:grid-cols-[1.35fr_0.65fr] md:items-start">
            <HistoryBook
              clientName={groupName}
              notes={notes}
              activity={clientActivity}
              loading={clientLoading || activityLoading || notesLoading}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
            />

            <DiagnosticsFunnel stages={funnelStages} loading={groupsLoading} />
          </div>
        </TabsContent>

        {/* ── Ask Birdy Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="ask-birdy" className="mt-6">
          <ClientAskBirdy
            clientId={matchingGroup?.id}
            clientName={matchingGroup?.name}
            initialMessage={askPrompt}
          />
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
            onCacheInvalidate={invalidate}
          />
        </TabsContent>

        {/* ── Call Centre Tab ───────────────────────────────────────────────── */}
        <TabsContent value="call-centre" className="mt-4">
          {/* Same chart + insight + KPI row the Sales Hub draws, scoped to
              this client — the tab used to open straight onto a bare table. */}
          <CallCentreOverview
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            datePreset={datePreset}
            selectedClientGroup={matchingGroup?.id ?? "all"}
          />
          <CallCentreContent
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            datePreset={datePreset}
            showGroupFilter={false}
            showStatCards={false}
          />
        </TabsContent>

        {/* ── Leads Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="leads" className="mt-4">
          {/* Same row the Lead Hub draws, scoped to this client. */}
          <LeadHubOverview
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            datePreset={datePreset}
            selectedClientGroup={matchingGroup?.id ?? "all"}
          />
          <LeadsContent
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            datePreset={datePreset}
            showStatCards={false}
            // Scoped explicitly. Left uncontrolled it defaults to "all", which
            // sends an empty `groups` param — and the API reads that as "no
            // group filter", returning every client's leads on a page that is
            // supposed to be about one.
            selectedClientGroup={matchingGroup?.id}
          />
        </TabsContent>

      </Tabs>

      {/* ── Integrations & Settings Dialog ───────────────────────────────────── */}
      <Dialog open={integrationsOpen} onOpenChange={setIntegrationsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{groupName} settings</DialogTitle>
            <DialogDescription>
              Details, monthly targets and connected integrations for {groupName}.
            </DialogDescription>
          </DialogHeader>

          {/* The design splits this modal into Details / Targets / Integrations
              rather than one long scroll. */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="targets">Targets</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-6">
            <Card>
              <CardContent >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                      clientStatus === "Active" ? "bg-[#DCFCE7]" : "bg-[#FEF9C3]"
                    }`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        clientStatus === "Active" ? "bg-[#15803D]" : "bg-[#A16207]"
                      }`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Client Status</p>
                      <p className="text-xs text-muted-foreground">
                        {clientStatus === "Active"
                          ? "This client is currently active and receiving data"
                          : "This client is paused — data refresh is suspended"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleStatus}
                    disabled={statusLoading || clientLoading}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                      clientStatus === "Active" ? "bg-[#713CDD]" : "bg-gray-300"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                      clientStatus === "Active" ? "translate-x-[22px]" : "translate-x-[4px]"
                    }`} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* ── Client health ─────────────────────────────────────────────────
                Derived, not chosen: recomputed every Monday from this client's
                monthly closes goal. Shown with the figures behind it so the
                band can be checked rather than just believed. */}
            <Card>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Client Health</p>
                    <p className="text-xs text-muted-foreground">
                      {healthDetail?.reason
                        ? `${healthDetail.reason}${
                            healthDetail.pace != null
                              ? ` · ${Math.round(healthDetail.pace * 100)}% of pace`
                              : ""
                          }`
                        : "Set a monthly closes target to track health."}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Recalculated every Monday from the monthly closes goal.
                    </p>
                  </div>
                  <HealthPill health={clientHealth} className="shrink-0" />
                </div>
              </CardContent>
            </Card>

            {/* ── Danger Zone ───────────────────────────────────────────────────── */}
            <Card className="border-red-200 bg-red-50/40">
              <CardHeader>
                <CardTitle className="text-base text-red-700">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Remove Client Group</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Permanently delete this client group and all associated GHL contacts. This cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0 gap-2"
                    onClick={() => {
                      setDeleteInput("")
                      setDeleteError("")
                      setDeleteModalOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove Client Group
                  </Button>
                </div>
              </CardContent>
            </Card>
            </TabsContent>

            <TabsContent value="targets" className="mt-4">
              <ClientTargetsForm
                clientId={clientId}
                targets={matchingGroup?.targets}
                currencySymbol={currencySymbol}
                onSaved={() => invalidate()}
              />
            </TabsContent>

            <TabsContent value="integrations" className="mt-4">
              <IntegrationsContent
                group={matchingGroup}
                onRefreshComplete={invalidate}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      <Dialog open={deleteModalOpen} onOpenChange={(v) => { if (!deleteLoading) setDeleteModalOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle className="text-xl">Delete Client Group</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              This action is <span className="font-semibold text-foreground">permanent and irreversible</span>. It will delete:
            </DialogDescription>
          </DialogHeader>

          <ul className="text-sm text-muted-foreground space-y-1.5 pl-4 list-disc">
            <li>All <span className="text-foreground font-medium">GHL contacts</span> linked to this group</li>
            <li>The <span className="text-foreground font-medium">client group</span> and all its configuration</li>
          </ul>

          <div className="space-y-2 pt-1">
            <p className="text-sm">
              Type{" "}
              <span className="font-mono text-xs font-semibold bg-muted px-1 py-0.5 rounded">{groupName}</span>
              {" "}to confirm:
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => { setDeleteInput(e.target.value); setDeleteError("") }}
              placeholder={groupName}
              className={`font-mono text-sm ${deleteError ? "border-red-400" : ""}`}
              disabled={deleteLoading}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteGroup() }}
              autoComplete="off"
            />
            {deleteError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {deleteError}
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deleteInput.trim() !== groupName?.trim() || deleteLoading}
              className="flex-1 gap-2"
            >
              {deleteLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                : <><Trash2 className="h-4 w-4" /> Delete Group</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}