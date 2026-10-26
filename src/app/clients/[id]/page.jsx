"use client"
import { useCallback, useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ArrowLeft,
  AlertTriangle,
  Trash2,
  Settings,
  LayoutGrid,
  Sparkles,
  Megaphone,
  Phone,
  UserCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  Badge,
  BirdyRead,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Notice,
  PageHeader,
  SegmentedTabs,
  Skeleton,
  Spinner,
  Surface,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { useDashboardData } from "@/app/dashboard/useDashboardData"
import { PeriodControl } from "@/app/dashboard/PeriodControl"
import { isFeedActivity } from "@/components/activity/ActivityItem"
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"
import { useCurrency } from "@/hooks/useCurrency"
import getSymbolFromCurrency from "currency-symbol-map"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { MarketingContent } from "@/components/campaigns/MarketingContent"
import { LeadsContent } from "@/components/contacts/LeadsContent"
import { CallCentreContent } from "@/components/callcenter/CallCentreContent"
import IntegrationsContent from "@/components/integrations/IntegrationsContent"
import { ClientAskBirdy } from "@/components/clients/ClientAskBirdy"
import { CallCentreOverview } from "@/components/saleshub/CallCentreOverview"
import { LeadHubOverview } from "@/components/contacts/LeadHubOverview"
import { HealthPill, DEFAULT_CLIENT_HEALTH } from "@/components/clients/HealthPill"
import { usePageHeader } from "@/components/page-header"
import { GoalsStrip } from "@/components/clients/GoalsStrip"
import { ClientTargetsForm } from "@/components/clients/ClientTargetsForm"
import { DiagnosticsFunnel } from "@/components/clients/DiagnosticsFunnel"
import { LandingFunnel } from "@/components/attribution/LandingFunnel"
import { HistoryBook } from "@/components/clients/HistoryBook"
import { ClientTrendChart } from "@/components/clients/ClientTrendChart"
import { clientInsightPrompt } from "@/lib/client-insight"
import { buildFunnelStages, buildPreviousFunnel } from "@/lib/client-funnel"
import { buildClientGoals } from "@/lib/client-goals"
import { diagnoseFunnel } from "@/lib/portfolio-metrics"
import { PREVIOUS_PERIOD } from "@/lib/portfolio-series"
import { useLandingFunnel } from "@/lib/useLandingFunnel"
import { leadSourceOption, normalizeLeadSource } from "@/lib/lead-sources"
import { metaTabState, scopeChipLabel } from "@/lib/meta-scope"
import { SYNCING_MESSAGE } from "@/lib/client-loading"
import { clientFindings } from "./presentation"

// The handoff's five workspace tabs (section 3), with the leading icons it
// names: grid, sparkle, megaphone, phone, user-check.
const CLIENT_TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "ask-birdy", label: "Ask Birdy", icon: Sparkles },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "call-centre", label: "Call Centre", icon: Phone },
  { key: "leads", label: "Leads", icon: UserCheck },
]

// The settings dialog's sections: a segmented control, as the handoff calls for.
const SETTINGS_TABS = [
  { value: "details", label: "Details" },
  { value: "targets", label: "Targets" },
  { value: "integrations", label: "Integrations" },
  { value: "tracking", label: "Tracking" },
]

// grid-cols-1 keeps the single column shrinkable below lg; the implicit column
// would size to its widest content and push the funnel past the screen.
const BODY_GRID = "grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.35fr_1fr]"

export default function ClientDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = decodeURIComponent(params?.id || "")

  // ── Overview data ──────────────────────────────────────────────────────────
  const [clientData, setClientData] = useState(null)
  const [clientLoading, setClientLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [integrationsOpen, setIntegrationsOpen] = useState(false)
  // Controlled so the settings modal's segmented control can drive it. The
  // handoff opens on Details.
  const [settingsTab, setSettingsTab] = useState("details")
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
    error: groupsError,
    refresh,
    datePreset,
    setDatePreset,
    invalidate,
  } = useClientGroupsWithSeries(DEFAULT_DATE_PRESET)

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

  // ── Diagnostics: the previous window, for the per-stage deltas ─────────────
  // Only some presets have a previous period expressible as another preset —
  // "last 7 days" against "last 14 days" minus itself. Elsewhere there is no
  // comparison and the card says so instead of inventing movement.
  const comparison = PREVIOUS_PERIOD[datePreset]
  const [enclosingFunnel, setEnclosingFunnel] = useState(null)

  useEffect(() => {
    if (!clientId || !comparison) {
      setEnclosingFunnel(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest(`/api/client-groups?date_preset=${comparison.preset}`)
        if (!res.ok) throw new Error(`client-groups ${comparison.preset} → ${res.status}`)
        const data = await res.json()
        const group = (data.client_groups ?? []).find((g) => g.id === clientId)
        if (!cancelled) setEnclosingFunnel(group?.gohighlevel?.metrics?.funnel ?? null)
      } catch {
        // No comparison is a fine outcome — the deltas just don't render.
        if (!cancelled) setEnclosingFunnel(null)
      }
    })()
    return () => { cancelled = true }
  }, [clientId, comparison])

  const previousFunnel = useMemo(
    () =>
      buildPreviousFunnel(
        matchingGroup?.gohighlevel?.metrics?.funnel ?? null,
        enclosingFunnel,
        comparison ?? {}
      ),
    [matchingGroup, enclosingFunnel, comparison]
  )

  const funnelStages = useMemo(
    () => (matchingGroup ? buildFunnelStages(matchingGroup, previousFunnel) : null),
    [matchingGroup, previousFunnel]
  )

  // The verdict under the funnel — the same rule the Portfolio Dashboard reads.
  const diagnosis = useMemo(() => diagnoseFunnel(funnelStages ?? []), [funnelStages])

  // The step above all four of those, for clients whose ads point at a landing
  // page of their own: how many of the people the ads sent ever opted in. The
  // hook answers `applicable: false` for everyone else — a client on Meta
  // Instant Forms has no page of ours to measure — and the card draws nothing.
  const { funnel: landingFunnel, loading: landingLoading, error: landingError } =
    useLandingFunnel(clientId, datePreset)

  // ── Fetch client details ────────────────────────────────────────────────────
  // `quiet` re-fetches behind what is on screen (after a campaign change)
  // instead of blanking the header back to its loading state.
  const loadClient = useCallback(async ({ quiet = false } = {}) => {
    if (!clientId) return
    try {
      if (!quiet) setClientLoading(true)
      const response = await apiRequest(`/api/client-groups/${clientId}`)
      if (!response.ok) throw new Error("Failed to fetch client details")
      const result = await response.json()
      setClientData(result.data)
      setClientStatus(result.data?.group_info?.client_status ?? "Active")
      setClientHealth(result.data?.group_info?.health ?? DEFAULT_CLIENT_HEALTH)
      setHealthDetail(result.data?.group_info?.health_detail ?? null)
    } catch {
      if (!quiet) toast.error("Failed to load client details")
    } finally {
      if (!quiet) setClientLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadClient()
  }, [loadClient])

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

  // The client's own document is a slow request. Everything the header and the
  // history book need is already on the list row, so they paint from that and
  // the detail fills in the rest (settings, health reason) when it lands.
  const groupName = clientData?.group_info?.name || matchingGroup?.name || "Client"
  const headerLoading = clientLoading && !matchingGroup
  const shownHealth = clientData ? clientHealth : matchingGroup?.health || DEFAULT_CLIENT_HEALTH

  const clientActivity = useMemo(
    () => activity.filter((a) => a.client === groupName && isFeedActivity(a)),
    [activity, groupName]
  )

  // Meta campaign scope. A group sharing an ad account owns only some of its
  // campaigns; right after a change its Meta cache is empty while it re-syncs.
  const metaScope = clientData?.group_info?.meta_scope ?? matchingGroup?.meta_scope ?? null
  const metaChip = scopeChipLabel(metaScope)
  const metaState = metaTabState({
    campaignIds: clientData?.group_info?.meta_campaign_ids,
    syncing: !!clientData?.meta_data?.syncing,
    refreshStatus: clientData?.group_info?.meta_refresh_status,
  })
  const metaSyncing = metaState === "syncing"
  const metaRefreshError = clientData?.group_info?.meta_refresh_error
  const handleCampaignsSaved = useCallback(() => {
    invalidate()
    loadClient({ quiet: true })
  }, [invalidate, loadClient])
  // While the scoped cache refills, re-ask quietly so the Marketing tab moves
  // off its syncing state on its own; refresh the list once it lands. A
  // failed refresh (meta_refresh_status "error") stops the polling.
  useEffect(() => {
    if (!metaSyncing) return
    const t = setInterval(() => loadClient({ quiet: true }), 15_000)
    return () => {
      clearInterval(t)
      invalidate()
    }
  }, [metaSyncing, loadClient, invalidate])

  // The design's sub-line reads "Emma T. · client since Mar 2025". There is no
  // primary-contact field on a client group, so only the half that exists is
  // rendered rather than inventing a name.
  const clientSubline = useMemo(() => {
    const since = clientData?.group_info?.created_at ?? matchingGroup?.created_at
    if (!since) return null
    const d = new Date(since)
    if (Number.isNaN(d.getTime())) return null
    return `Client since ${d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
  }, [clientData, matchingGroup])

  // The top bar names the page; the client's own name is the PageHeader's title.
  const topBar = useMemo(() => ({ title: "Clients" }), [])
  usePageHeader(topBar)

  // The funnel verdict is a finding in Birdy's read; dismissing it hides it for
  // the visit rather than persisting a preference.
  const [verdictDismissed, setVerdictDismissed] = useState(false)
  const findings = useMemo(
    () =>
      clientFindings({
        group: matchingGroup,
        goals,
        diagnosis: verdictDismissed ? null : diagnosis,
        hasComparison: previousFunnel != null,
        currencySymbol,
        onViewCalls: () => setActiveTab("call-centre"),
        onDismissDiagnosis: () => setVerdictDismissed(true),
      }),
    [matchingGroup, goals, diagnosis, verdictDismissed, previousFunnel, currencySymbol]
  )

  const openSettings = (tab) => {
    if (tab) setSettingsTab(tab)
    setIntegrationsOpen(true)
  }

  const backToClients = (
    <button
      type="button"
      onClick={() => router.push("/clients")}
      aria-label="Back to Clients"
      className="-ml-1 inline-flex items-center gap-1 rounded-sm px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-control-focus"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Clients
    </button>
  )

  // ── Error state (only shown if client data fails entirely) ─────────────────
  if (!clientLoading && !clientData && !groupsLoading && !matchingGroup) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow={backToClients} title="Client" />
        <EmptyState
          title="Client not found"
          description="It may have been removed, or the link is out of date."
          action={
            <Button variant="primary" onClick={() => router.push("/clients")}>
              <ArrowLeft /> Back to Clients
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow={backToClients}
        title={headerLoading ? "…" : groupName}
        description={
          !headerLoading ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {clientSubline}
              <HealthPill health={shownHealth} />
              {metaChip && <Badge tone="neutral">{metaChip}</Badge>}
            </span>
          ) : undefined
        }
        period={<PeriodControl value={datePreset} onChange={setDatePreset} />}
        actions={
          <Button size="icon" onClick={() => openSettings()} title="Client settings" aria-label="Client settings">
            <Settings />
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
        <TabsList variant="underline" aria-label="Client workspace">
          {CLIENT_TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key}>
              <Icon aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="pt-6">
          <div className="flex min-w-0 flex-col gap-6">
            {/* Goals — each metric against the target set in Settings. The same
                monthly-closes target drives the health pill in the header. */}
            <GoalsStrip goals={goals} currencySymbol={currencySymbol} loading={groupsLoading} />

            <ClientTrendChart
              group={matchingGroup}
              datePreset={datePreset}
              currencySymbol={currencySymbol}
              loading={groupsLoading}
            />

            <div className={BODY_GRID}>
              <div className="flex min-w-0 flex-col gap-6">
                <DiagnosticsFunnel
                  stages={funnelStages}
                  loading={groupsLoading}
                  hasComparison={previousFunnel != null}
                />

                {/* Beside the diagnostics funnel rather than inside it, because it
                    is a different cohort: the four stages above start at leads, and
                    this one counts everyone who reached the page and never became
                    one. Drawing them as eight stages of a single funnel would put a
                    CRM-sync percentage next to a page-visit percentage and imply the
                    two are comparable. */}
                <LandingFunnel
                  funnel={landingFunnel}
                  loading={landingLoading}
                  error={landingError}
                  groupId={clientId}
                />
              </div>

              <BirdyRead
                findings={findings}
                prompt={matchingGroup ? clientInsightPrompt(matchingGroup, goals) : undefined}
                onAsk={(prompt) => {
                  setAskPrompt(prompt)
                  setActiveTab("ask-birdy")
                }}
              />
            </div>

            <HistoryBook
              clientName={groupName}
              notes={notes}
              activity={clientActivity}
              loading={activityLoading || notesLoading}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>
        </TabsContent>

        {/* ── Ask Birdy Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="ask-birdy" className="pt-6">
          <ClientAskBirdy
            clientId={matchingGroup?.id}
            clientName={matchingGroup?.name}
            initialMessage={askPrompt}
          />
        </TabsContent>

        {/* ── Marketing Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="marketing" className="pt-6">
          {metaState === "none-selected" ? (
            <EmptyState
              title="No campaigns selected"
              description="This client shares its Meta ad account. Choose the campaigns that belong to it to see its spend and results."
              action={<Button onClick={() => openSettings("integrations")}>Choose campaigns</Button>}
            />
          ) : metaState === "error" ? (
            <Notice
              tone="danger"
              title="Refresh failed"
              action={<Button size="sm" onClick={() => openSettings("integrations")}>Open integrations</Button>}
            >
              {metaRefreshError || "Meta data for this client could not be loaded."}
            </Notice>
          ) : metaSyncing ? (
            <Notice tone="info">
              <span className="flex items-center gap-2">
                <Spinner />
                {SYNCING_MESSAGE}
              </span>
            </Notice>
          ) : (
            <MarketingContent
              clientGroups={singleGroupArray}
              groupsLoading={groupsLoading}
              groupsError={groupsError}
              datePreset={datePreset}
              setDatePreset={setDatePreset}
              showGroupFilter={false}
              showHeader={false}
              onCacheInvalidate={invalidate}
            />
          )}
        </TabsContent>

        {/* ── Call Centre Tab ───────────────────────────────────────────────── */}
        <TabsContent value="call-centre" className="pt-6">
          {/* Same chart + insight + KPI row the Sales Hub draws, scoped to
              this client — the tab used to open straight onto a bare table. */}
          <CallCentreOverview
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            groupsError={groupsError}
            onRetry={refresh}
            datePreset={datePreset}
            selectedClientGroup={matchingGroup?.id ?? "all"}
          />
          <CallCentreContent
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            datePreset={datePreset}
            showGroupFilter={false}
            showStatCards={false}
            onCallCentreChanged={refresh}
          />
        </TabsContent>

        {/* ── Leads Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="leads" className="pt-6">
          {/* Same row the Lead Hub draws, scoped to this client. */}
          <LeadHubOverview
            clientGroups={singleGroupArray}
            groupsLoading={groupsLoading}
            groupsError={groupsError}
            onRetry={refresh}
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
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{groupName} settings</DialogTitle>
            <DialogDescription>
              Details, monthly targets and connected integrations for {groupName}.
            </DialogDescription>
          </DialogHeader>

          {/* The design splits this modal into Details / Targets / Integrations
              rather than one long scroll. */}
          <div className="min-w-0 max-w-full">
            <SegmentedTabs
              ariaLabel="Client settings section"
              value={settingsTab}
              onValueChange={setSettingsTab}
              items={SETTINGS_TABS}
            />
          </div>

          {settingsTab === "details" && (
            <div className="flex flex-col gap-4">
              <Surface className="flex items-center justify-between gap-4 bg-muted shadow-none">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex size-9 items-center justify-center rounded-full ${
                      clientStatus === "Active" ? "bg-success-soft" : "bg-warning-soft"
                    }`}
                  >
                    <span
                      className={`size-2.5 rounded-full ${clientStatus === "Active" ? "bg-success" : "bg-warning"}`}
                    />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Client Status</p>
                    <p className="text-sm text-muted-foreground">
                      {clientStatus === "Active"
                        ? "This client is currently active and receiving data"
                        : "This client is paused — data refresh is suspended"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={clientStatus === "Active"}
                  onCheckedChange={handleToggleStatus}
                  disabled={statusLoading || clientLoading}
                  aria-label="Client active"
                />
              </Surface>

              {/* ── Client health ─────────────────────────────────────────────
                  Derived, not chosen: recomputed every Monday from this client's
                  monthly closes goal. Shown with the figures behind it so the
                  band can be checked rather than just believed. */}
              <Surface className="flex items-center justify-between gap-4 bg-muted shadow-none">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Client Health</p>
                  <p className="text-sm text-muted-foreground">
                    {healthDetail?.reason
                      ? `${healthDetail.reason}${
                          healthDetail.pace != null
                            ? ` · ${Math.round(healthDetail.pace * 100)}% of pace`
                            : ""
                        }`
                      : "Set a monthly closes target to track health."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recalculated every Monday from the monthly closes goal.
                  </p>
                </div>
                <HealthPill health={clientHealth} className="shrink-0" />
              </Surface>

              {/* ── Danger Zone ───────────────────────────────────────────────── */}
              <Surface className="bg-danger-soft shadow-none">
                <h3 className="text-base font-semibold text-danger-ink">Danger Zone</h3>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Remove Client Group</p>
                    <p className="mt-0.5 text-sm text-body">
                      Permanently delete this client group and all associated GHL contacts. This cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    className="shrink-0"
                    onClick={() => {
                      setDeleteInput("")
                      setDeleteError("")
                      setDeleteModalOpen(true)
                    }}
                  >
                    <Trash2 />
                    Remove Client Group
                  </Button>
                </div>
              </Surface>
            </div>
          )}

          {settingsTab === "targets" && (
            <ClientTargetsForm
              clientId={clientId}
              targets={matchingGroup?.targets}
              currencySymbol={currencySymbol}
              onSaved={() => invalidate()}
            />
          )}

          {settingsTab === "integrations" && (
            <IntegrationsContent
              group={matchingGroup}
              onRefreshComplete={invalidate}
              onCampaignsSaved={handleCampaignsSaved}
            />
          )}

          {/* A pointer, not the thing itself. Setting tracking up is a guided
              flow with five steps and three strings to copy, which does not
              belong in a dialog — and its URL gets forwarded to colleagues,
              which a dialog cannot be. */}
          {settingsTab === "tracking" && <TrackingSummaryCard clientId={clientId} />}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      <Dialog open={deleteModalOpen} onOpenChange={(v) => { if (!deleteLoading) setDeleteModalOpen(v) }}>
        <DialogContent size="sm">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
                <AlertTriangle className="size-5" />
              </span>
              <DialogTitle className="text-xl">Delete Client Group</DialogTitle>
            </div>
            <DialogDescription className="leading-relaxed">
              This action is <span className="font-semibold text-foreground">permanent and irreversible</span>. It will delete:
            </DialogDescription>
          </DialogHeader>

          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-muted-foreground">
            <li>All <span className="font-medium text-foreground">GHL contacts</span> linked to this group</li>
            <li>The <span className="font-medium text-foreground">client group</span> and all its configuration</li>
          </ul>

          <div className="flex flex-col gap-2 pt-1">
            <p className="text-sm">
              Type{" "}
              <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{groupName}</span>
              {" "}to confirm:
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => { setDeleteInput(e.target.value); setDeleteError("") }}
              placeholder={groupName}
              className="font-mono"
              aria-invalid={deleteError ? true : undefined}
              disabled={deleteLoading}
              onKeyDown={(e) => { if (e.key === "Enter") handleDeleteGroup() }}
              autoComplete="off"
            />
            {deleteError && (
              <p className="flex items-center gap-1 text-xs text-danger-ink">
                <AlertTriangle className="size-3" /> {deleteError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deleteInput.trim() !== groupName?.trim()}
              loading={deleteLoading}
              className="flex-1"
            >
              <Trash2 />
              {deleteLoading ? "Deleting…" : "Delete Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Where a client's lead tracking stands, and the way through to set it up.
function TrackingSummaryCard({ clientId }) {
  const router = useRouter()
  const [state, setState] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiRequest(`/attribution/diagnostics/${clientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setState(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clientId])

  const isFormToGhl = normalizeLeadSource(state?.method) === "form_to_ghl"

  return (
    <Surface className="bg-muted shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Lead tracking</p>
          {state === null ? (
            <div className="mt-2 flex flex-col gap-1.5" aria-busy="true" aria-label="Checking lead tracking">
              <Skeleton className="h-3 w-72 max-w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          ) : (
            <p className="mt-1 text-sm leading-normal text-body">
              {!state.applicable
                ? "This client's leads come from Meta Instant Forms, so there is nothing to install."
                : isFormToGhl
                  ? state.complete
                    ? "Working — the form tool sends each lead to GoHighLevel with the ad it came from, and Birdy attributes it from there."
                    : "Nothing to install, but leads aren't reaching GoHighLevel with the ad they came from yet. Check the form tool sends attribution to GoHighLevel."
                  : state.complete
                    ? "Working — landing-page leads are being counted against the ads that produced them."
                    : "Not finished. Leads from this client's landing pages aren't being tied to ads yet."}
            </p>
          )}
          {state?.method && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Leads from: {leadSourceOption(state.method).label}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push(`/clients/${clientId}/tracking`)}
          className="shrink-0"
        >
          {state && state.applicable && !state.complete ? "Finish setup" : "Open setup"}
        </Button>
      </div>
    </Surface>
  )
}
