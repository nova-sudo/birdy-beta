"use client"
import { Fragment, useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Plus, Check, Search, Download } from "lucide-react"
import { toast } from "sonner"
import {
  Button,
  DataTable,
  DataTableColumnHeader,
  Delta,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  MoneyCell,
  PageHeader,
  SegmentedTabs,
  Skeleton,
  StatusCell,
  TwoLineCell,
} from "@/components/ds"
import { PeriodControl } from "@/app/dashboard/PeriodControl"
import {
  activeGroups as selectActive,
  isActive,
  matchesStatusFilter,
  matchesHealthFilter,
  statusCounts as countByStatus,
  healthCounts as countByHealth,
  HEALTH_VALUES,
} from "@/lib/client-status"
import { usePageHeader } from "@/components/page-header"
import { useCurrency } from "@/hooks/useCurrency"
import getSymbolFromCurrency from "currency-symbol-map"
import { useColumnViews } from "@/lib/useColumnViews"
import { DEFAULT_DATE_PRESET } from "@/lib/constants"
import { getCachedData, clearCache } from "@/lib/cache"
import { apiRequest } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useClientGroups } from "@/lib/useClientGroups"
import { isAwaitingFirstData, isBeingCreated } from "@/lib/client-loading"
import BulkImportDialog from "@/components/clients/BulkImportDialog"
import { MetaCampaignPicker } from "@/components/clients/MetaCampaignPicker"
import { MetaCampaignsDialog } from "@/components/clients/MetaCampaignsDialog"
import { sharesMetaAccount, remainderOwner, unassignedText } from "@/lib/meta-scope"
import { LEAD_SOURCE_OPTIONS, LEAD_SOURCE_UNKNOWN } from "@/lib/lead-sources"
import { HEALTH_TONE, clientRows, statusOf } from "./presentation"
import { DEFAULT_VISIBLE, catalogueColumns, catalogueValues, formatCell, readSavedView } from "./catalogue"
import { usePreviousClientGroups } from "./usePreviousClientGroups"

// The same question the bulk-import review step asks per row, kept in the same
// order and wording so the two paths don't describe the same choice
// differently. "unknown" leads deliberately: it is the default, and picking it
// leaves the client behaving exactly as an unconfigured client always has.
const LEAD_SOURCES = [LEAD_SOURCE_UNKNOWN, ...LEAD_SOURCE_OPTIONS]

const WIZARD_STEPS = [
  { num: 1, short: "Name", full: "Client Name" },
  { num: 2, short: "GHL", full: "GHL" },
  { num: 3, short: "Meta", full: "Meta" },
  { num: 4, short: "Calls", full: "Sales Calls" },
  { num: 5, short: "Leads", full: "Lead Source" },
]

// A selectable card in the wizard: white on the muted step panel, primary edge
// and tint when chosen.
const choiceClass = (selected) =>
  cn(
    "w-full rounded-surface border-2 p-4 text-left shadow-surface outline-none transition-colors focus-visible:shadow-control-focus",
    selected ? "border-primary bg-primary-soft" : "border-transparent bg-background hover:border-border"
  )

const numericHeader = (title) =>
  function NumericHeader({ column }) {
    return (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title={title} className="-mr-2" />
      </div>
    )
  }

const dash = <span className="num block text-right text-sm text-muted-foreground">—</span>

export default function ClientsPage() {
  const router = useRouter()
  const {
    clientGroups: fetchedGroups,
    loading,
    error: fetchError,
    datePreset: selectedDateRange,
    setDatePreset: setSelectedDateRange,
    invalidate: invalidateClientGroups,
    refresh: refreshClientGroups,
    // Opts OUT of the per-day series: this page shows totals, never a trend
    // chart, and the three daily arrays are 6.38 MB of the response.
  } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false })
  const [clientGroups, setClientGroups] = useState([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  // The client whose unassigned Meta campaigns the list's "Assign" opened.
  const [assignGroup, setAssignGroup] = useState(null)
  const [wizardStep, setWizardStep] = useState(1)
  // Defaults to "unknown" rather than guessing. A wrong guess here silently
  // mis-configures the client's tracking, and "Ask later" costs nothing —
  // it behaves exactly as a client with no answer always has.
  const [leadSource, setLeadSource] = useState("unknown")
  const [clientGroupName, setClientGroupName] = useState("")
  const [ghlLocations, setGhlLocations] = useState([])
  const [metaAdAccounts, setMetaAdAccounts] = useState([])
  const [selectedGhlLocation, setSelectedGhlLocation] = useState(null)
  const [newGhlLocationId, setNewGhlLocationId] = useState("")
  const [selectedMetaAdAccount, setSelectedMetaAdAccount] = useState(null)
  // null = all campaigns; an array = only those. Reset whenever the account
  // changes, and required (no "All campaigns") when another client already
  // uses the account.
  const [metaCampaignIds, setMetaCampaignIds] = useState(null)
  const [selectedHotProspectorGroup, setSelectedHotProspectorGroup] = useState(null)
  const [locationSearchQuery, setLocationSearchQuery] = useState("")
  const [metaSearchQuery, setMetaSearchQuery] = useState("")
  const [addingClientGroup, setAddingClientGroup] = useState(false)
  // ── Step 4: call log provider ────────────────────────────────────────────
  // Credentials are account-wide and live in Settings → Integrations; the wizard
  // only records which provider feeds this client's call logs.
  const [callLogProvider, setCallLogProvider] = useState(null) // null | "ghl" | "hotprospector"

  // ── Status filter ─────────────────────────────────────────────────────────
  // Opens on Active: the clients being worked on are what the hub is for, and
  // paused ones are a tab away.
  const [statusFilter, setStatusFilter] = useState("Active")

  // Sync hook data → local state (local state allows optimistic updates)
  useEffect(() => {
    const groups = fetchedGroups.map(group => ({
      ...group,
      _isPending: group.status === "pending",
      _isCreating: group.status === "creating",
      // Distinct from the two above: the client exists and can be opened, but
      // none of its integrations has finished a first refresh, so its figures
      // are not yet measurements. Without this a bulk import filled the table
      // with rows reporting a confident 0 for everything.
      _isSyncing: isAwaitingFirstData(group),
    }))
    setClientGroups(groups)
  }, [fetchedGroups])

  const [clientLimitDialogOpen, setClientLimitDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateGroupName, setDuplicateGroupName] = useState("")
  const { currency: userCurrency } = useCurrency("GBP")

  // The agency's own formulas (shown on the Clients dashboard) are extra columns.
  const [customMetrics, setCustomMetrics] = useState([])
  useEffect(() => {
    apiRequest("/api/custom-metrics").then(async res => {
      if (!res.ok) return
      const data = await res.json()
      const metrics = (data.custom_metrics || []).map(m => ({
        id: m.id, name: m.name, dashboards: m.dashboards || [],
        formulaParts: m.formula_parts || [], formatType: m.format_type || "integer",
        enabled: true,
      }))
      // Nothing to add is not a change: a new empty array would rebuild the columns.
      if (metrics.length > 0) setCustomMetrics(metrics)
    }).catch(() => {})
  }, [])

  // The per-user column layout: a flat ordered list of ids, read here and
  // written only when "Save columns" is pressed.
  const { savedColumns, saveView, viewsLoaded } = useColumnViews("clients")
  const savedView = useMemo(() => (viewsLoaded ? readSavedView(savedColumns) : null), [viewsLoaded, savedColumns])
  // Choices made since the page opened; they sit on top of the saved view or the default.
  const [visibilityChoices, setVisibilityChoices] = useState({})

  // ── Filter groups by status ───────────────────────────────────────────────
  // The six tabs mix two axes — Active/Inactive are status, and
  // Healthy/Warning/Critical are health — so one selection resolves against
  // whichever axis the chosen tab belongs to. The health tabs read as a
  // breakdown of the Active tab, so they only ever consider active clients:
  // an inactive client's health says nothing about a live account.
  const inTab = useCallback(
    (g) =>
      HEALTH_VALUES.includes(statusFilter)
        ? isActive(g) && matchesHealthFilter(g, statusFilter)
        : matchesStatusFilter(g, statusFilter),
    [statusFilter],
  )

  // ── Status counts for filter badges ───────────────────────────────────────
  const statusCounts = useMemo(() => countByStatus(clientGroups), [clientGroups])
  const healthCounts = useMemo(
    () => countByHealth(selectActive(clientGroups)),
    [clientGroups],
  )

  // ── Table rows ────────────────────────────────────────────────────────────
  const { groups: previousGroups, comparison } = usePreviousClientGroups(selectedDateRange)
  // Extra columns on offer: the catalogue, a column per GHL tag, the agency's formulas.
  const extraColumns = useMemo(() => catalogueColumns(clientGroups, customMetrics), [clientGroups, customMetrics])
  const symbol = getSymbolFromCurrency(userCurrency) || "$"

  // Every client, once; the tab only decides which of them show. Keeping the
  // data (and so the columns) stable across tabs keeps sort and paging intact.
  const allRows = useMemo(
    () =>
      clientRows(clientGroups, previousGroups, comparison)
        // Biggest spenders first, which is how the table has always opened.
        .sort((a, b) => (b.spend ?? -1) - (a.spend ?? -1))
        .map((row) => ({ ...row, values: catalogueValues(row.group, extraColumns) })),
    [clientGroups, previousGroups, comparison, extraColumns],
  )
  const rows = useMemo(() => allRows.filter((row) => inTab(row.group)), [allRows, inTab])

  const columns = useMemo(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Client",
        enableHiding: false,
        meta: { label: "Clients", variant: "text" },
        cell: ({ row }) => {
          const { name, group } = row.original
          // Beside the name: campaigns of a shared Meta account no client owns yet.
          const nudge = unassignedText(group?.meta_scope)
          return (
            <TwoLineCell
              primary={name}
              secondary={
                nudge ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setAssignGroup(group) }}
                    title={nudge}
                    aria-label={`${nudge} · Assign`}
                    className="whitespace-nowrap rounded-sm bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-ink outline-none hover:underline focus-visible:shadow-control-focus"
                  >
                    {group.meta_scope.unassigned.length} unassigned · <span className="font-semibold text-primary">Assign</span>
                  </button>
                ) : undefined
              }
            />
          )
        },
      },
      {
        id: "status",
        accessorFn: (row) => statusOf(row).label,
        header: "Status",
        meta: { label: "Status" },
        cell: ({ row }) => {
          const { label, tone } = statusOf(row.original)
          return <StatusCell label={label} tone={tone} />
        },
      },
      {
        id: "health",
        accessorKey: "health",
        header: "Health",
        meta: { label: "Health" },
        cell: ({ row }) => <StatusCell label={row.original.health} tone={HEALTH_TONE[row.original.health]} />,
      },
      {
        id: "leads",
        accessorFn: (row) => row.leads ?? undefined,
        header: numericHeader("Leads"),
        meta: { label: "Leads" },
        cell: ({ row }) =>
          row.original.leads == null ? dash : (
            <span className="num block text-right text-sm text-foreground">
              {Math.round(row.original.leads).toLocaleString("en-GB")}
            </span>
          ),
      },
      {
        id: "cpl",
        accessorFn: (row) => row.cpl ?? undefined,
        header: numericHeader("Cost per lead"),
        meta: { label: "Cost per lead" },
        cell: ({ row }) => {
          const { cpl, cplDelta, currency } = row.original
          if (cpl == null) return dash
          return (
            <MoneyCell
              value={cpl}
              currency={currency || userCurrency}
              sub={cplDelta != null ? <Delta value={cplDelta} invert className="text-xs" /> : undefined}
            />
          )
        },
      },
      {
        id: "spend",
        accessorFn: (row) => row.spend ?? undefined,
        header: numericHeader("Ad spend"),
        meta: { label: "Ad spend" },
        cell: ({ row }) =>
          row.original.spend == null ? dash : (
            <MoneyCell value={row.original.spend} currency={row.original.currency || userCurrency} />
          ),
      },
      ...extraColumns.map((col) => {
        const numeric = !col.text
        return {
          id: col.id,
          accessorFn: (row) => row.values?.[col.id] ?? undefined,
          header: numeric ? numericHeader(col.label) : col.label,
          meta: { label: col.label },
          enableSorting: col.sortable,
          cell: ({ row }) => {
            const text = formatCell(col.id, row.original.values?.[col.id], { symbol, custom: col.custom })
            return numeric ? <span className="num block text-right text-sm text-foreground">{text}</span> : <span className="text-sm text-foreground">{text}</span>
          },
        }
      }),
    ],
    [userCurrency, symbol, extraColumns],
  )

  // Saved order first (the name column always leads), the rest as catalogued.
  const orderedColumns = useMemo(() => {
    if (!savedView) return columns
    const rank = new Map(["name", ...savedView.order].map((id, i) => [id, i]))
    return [...columns].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
  }, [columns, savedView])

  // Every column gets an explicit answer: the table would show an unknown one.
  const columnVisibility = useMemo(() => {
    const base = (id) => (savedView ? savedView.visible.has(id) : DEFAULT_VISIBLE.includes(id))
    return Object.fromEntries(orderedColumns.map((c) => [c.id, c.id === "name" ? true : visibilityChoices[c.id] ?? base(c.id)]))
  }, [orderedColumns, savedView, visibilityChoices])

  const saveColumns = useCallback(
    () => saveView(orderedColumns.filter((c) => columnVisibility[c.id]).map((c) => c.id)),
    [saveView, orderedColumns, columnVisibility],
  )

  useEffect(() => {
    if (wizardOpen && wizardStep > 1) {
      if (wizardStep === 2) fetchGhlLocations()
      if (wizardStep === 3) fetchMetaAdAccounts()
    }
  }, [wizardOpen, wizardStep])


  const fetchGhlLocations = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = getCachedData("ghlLocations")
        if (cached) {
          setGhlLocations(cached)
          return
        }
      }

      const response = await apiRequest("/api/subaccount/locations")

      if (response.ok) {
        const data = await response.json()
        const locations = data.locations || []
        setGhlLocations(locations)
        if (locations.length === 0) {
          toast.warning("No GHL locations found. Please enter a location ID or skip this step.")
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || "Failed to fetch GHL locations")
      }
    } catch (err) {
      console.error("Error fetching GHL locations:", err)
      toast.error("Failed to fetch GHL locations")
    }
  }

  const fetchMetaAdAccounts = async () => {
    try {
      const response = await apiRequest("/api/facebook/adaccounts")

      if (response.ok) {
        const data = await response.json()
        const accounts = data.data?.data || []
        setMetaAdAccounts(accounts)
      } else {
        toast.error("Failed to fetch Meta ad accounts")
      }
    } catch (err) {
      console.error("Error fetching Meta ad accounts:", err)
      toast.error("Failed to fetch Meta ad accounts")
    }
  }

  const metaAccountShared = !!selectedMetaAdAccount && sharesMetaAccount(clientGroups, selectedMetaAdAccount.id)
  const metaRemainderOwner = selectedMetaAdAccount ? remainderOwner(clientGroups, selectedMetaAdAccount.id) : null
  // A shared account needs its own campaigns, and a list must not be empty.
  const metaCampaignsMissing = !!selectedMetaAdAccount
    && (metaAccountShared || Array.isArray(metaCampaignIds))
    && !(Array.isArray(metaCampaignIds) && metaCampaignIds.length > 0)

  const handleCreateClientGroup = async () => {
    if (!clientGroupName) {
      toast.error("Please enter a client group name")
      return
    }
    if (wizardStep === 2 && !selectedGhlLocation && !newGhlLocationId && ghlLocations.length > 0) {
      toast.error("Please select a GHL location, enter a location ID, or skip this step")
      return
    }
    if (wizardStep === 3 && !selectedMetaAdAccount && metaAdAccounts.length > 0) {
      toast.error("Please select a Meta ad account or skip this step")
      return
    }
    if (wizardStep >= 3 && metaCampaignsMissing) {
      setWizardStep(3)
      toast.error("Pick at least one campaign for this client")
      return
    }
    if (wizardStep === 4 && !callLogProvider) {
      toast.error("Please choose a call log provider (GoHighLevel or Hot Prospector)")
      return
    }

    if (wizardStep < 5) {
      setWizardStep(wizardStep + 1)
      return
    }

    const tempId = `temp_${Date.now()}`

    const optimisticGroup = {
      id: tempId,
      name: clientGroupName,
      ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId || null,
      meta_ad_account_id: selectedMetaAdAccount?.id || null,
      notes: "",
      created_at: new Date().toISOString(),
      status: "pending",
      client_status: "Active",
      _isPending: true,
      gohighlevel: {},
      facebook: {},
      hotprospector: {}
    }

    setClientGroups(prev => [optimisticGroup, ...prev])
    setWizardOpen(false)
    setWizardStep(1)
    const creatingGroupName = clientGroupName
    setClientGroupName("")
    setSelectedGhlLocation(null)
    setNewGhlLocationId("")
    setSelectedMetaAdAccount(null)
    const creatingMetaCampaignIds = selectedMetaAdAccount ? metaCampaignIds : null
    setMetaCampaignIds(null)
    setSelectedHotProspectorGroup(null)
    setLocationSearchQuery("")
    setMetaSearchQuery("")
    setCallLogProvider(null)
    const creatingLeadSource = leadSource
    setLeadSource("unknown")

    toast.info(`Creating "${creatingGroupName}"...`)

    setAddingClientGroup(true)

    try {
      const response = await apiRequest("/api/client-groups", {
        method: "POST",
        body: JSON.stringify({
          name: creatingGroupName,
          ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId || null,
          meta_ad_account_id: selectedMetaAdAccount?.id || null,
          hotprospector_group_id: selectedHotProspectorGroup?.id || null,
          ad_account_currency: selectedMetaAdAccount?.currency || null,
          meta_campaign_ids: creatingMetaCampaignIds,
          call_log_provider: callLogProvider || "ghl",
          lead_collection_method: creatingLeadSource,
          notes: "",
        }),
      });

      if (response.ok) {
        const data = await response.json()

        setClientGroups(prev =>
          prev.map(group =>
            group.id === tempId
              ? { ...data.client_group, _isCreating: false, _isPending: false }
              : group
          )
        )

        toast.success(`"${creatingGroupName}" created successfully!`)
        for (const g of data.converted || []) {
          toast.info(`${g.name} now keeps the remaining campaigns`)
        }
        invalidateClientGroups()
        clearCache("ghlLocations")
      } else {
        const data = await response.json()

        setClientGroups(prev => prev.filter(group => group.id !== tempId))

        if (response.status === 402 && data.detail?.code === "CLIENT_LIMIT_REACHED") {
          setClientLimitDialogOpen(true)
        } else if (
          response.status === 409
          && /^A client group named "/.test(typeof data.detail === "string" ? data.detail : "")
        ) {
          const nameMatch = data.detail.match(/^A client group named "([^"]+)"/)
          setDuplicateGroupName(nameMatch[1])
          setDuplicateDialogOpen(true)
        } else {
          toast.error(data.detail || "Failed to create client group")
        }
      }
    } catch (err) {
      console.error("Error creating client group:", err)

      setClientGroups(prev => prev.filter(group => group.id !== tempId))

      toast.error("Failed to create client group")
    } finally {
      setTimeout(() => setAddingClientGroup(false), 500)
    }
  }

  const handleClientGroupClick = (row) => {
    // A client still being wired up has nothing to open yet.
    if (isBeingCreated(row.group)) return
    router.push(`/clients/${row.id}`)
  }

  const filteredGhlLocations = ghlLocations.filter(
    (loc) =>
      loc.name?.toLowerCase().includes(locationSearchQuery.toLowerCase()) ||
      loc.locationId?.toLowerCase().includes(locationSearchQuery.toLowerCase()),
  )

  const filteredMetaAdAccounts = metaAdAccounts.filter(
    (acc) =>
      acc.name?.toLowerCase().includes(metaSearchQuery.toLowerCase()) ||
      acc.id?.toLowerCase().includes(metaSearchQuery.toLowerCase()),
  )

  // The page's own title is in the PageHeader below; the top bar only names the page.
  const topBar = useMemo(() => ({ title: "Clients" }), [])
  usePageHeader(topBar)

  const filterTabs = [
    { value: "Active", label: "Active", count: statusCounts.active },
    { value: "Healthy", label: "Healthy", count: healthCounts.healthy },
    { value: "Warning", label: "Warning", count: healthCounts.warning },
    { value: "Critical", label: "Critical", count: healthCounts.critical },
    { value: "Inactive", label: "Inactive", count: statusCounts.inactive },
    { value: "all", label: "All Clients", count: statusCounts.all },
  ]

  const openAddClient = useCallback(() => setWizardOpen(true), [])
  const tabLabel = filterTabs.find((t) => t.value === statusFilter)?.label ?? "matching"

  const addClientButton = (
    <Button variant="primary" onClick={openAddClient}>
      <Plus />
      Add client
    </Button>
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Health and performance across every connected client"
        period={<PeriodControl value={selectedDateRange} onChange={setSelectedDateRange} />}
        actions={
          <>
            {/* Bulk import stays available after onboarding. Agencies win
                clients continuously, and adding five of them one at a time
                through the five-step wizard means re-picking the same GHL and
                Meta accounts by hand five times. */}
            <Button onClick={() => setBulkImportOpen(true)} aria-label="Import clients from GoHighLevel">
              <Download />
              <span className="hidden sm:inline">Import</span>
            </Button>
            {addClientButton}
          </>
        }
      />

      {/* Add client dialog */}
      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open)
          if (!open) {
            setWizardStep(1)
            setClientGroupName("")
            setLeadSource("unknown")
            setSelectedGhlLocation(null)
            setNewGhlLocationId("")
            setSelectedMetaAdAccount(null)
            setMetaCampaignIds(null)
            setSelectedHotProspectorGroup(null)
            setLocationSearchQuery("")
            setMetaSearchQuery("")
            setCallLogProvider(null)
          }
        }}
      >
        <DialogContent className="max-h-[95vh] overflow-y-auto overflow-x-hidden p-4 sm:max-w-2xl md:p-6">
          {/* sr-only title so Radix Dialog has accessible labelling */}
          <DialogHeader className="sr-only">
            <DialogTitle>Birdy Linking Wizard</DialogTitle>
            <DialogDescription>Link a new client to GoHighLevel, Meta and your call provider.</DialogDescription>
          </DialogHeader>

          <div className="w-full py-2">
            <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
              {/* ── Top stepper (responsive) ────────────────────── */}
              <div className="w-full overflow-hidden">
                <div className="flex w-full items-start gap-1 sm:gap-2">
                  {WIZARD_STEPS.map((s, i, arr) => (
                    <Fragment key={s.num}>
                      <div className="flex shrink-0 flex-col items-center">
                        <div
                          className={cn(
                            "num flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors duration-300 sm:size-10",
                            wizardStep > s.num
                              ? "bg-success-soft text-success-ink"
                              : wizardStep === s.num
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {wizardStep > s.num ? <Check className="size-4 sm:size-5" /> : <span>{s.num}</span>}
                        </div>
                        <div className="mt-2 px-1 text-center">
                          <div
                            className={cn(
                              "whitespace-nowrap text-xs font-medium transition-colors sm:text-sm",
                              wizardStep > s.num
                                ? "text-success-ink"
                                : wizardStep === s.num
                                  ? "text-primary"
                                  : "text-muted-foreground"
                            )}
                          >
                            <span className="sm:hidden">{s.short}</span>
                            <span className="hidden sm:inline">{s.full}</span>
                          </div>
                        </div>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="mt-4 min-w-2 flex-1 sm:mt-5">
                          <div
                            className={cn(
                              "h-0.5 rounded-full transition-colors duration-500",
                              wizardStep > s.num ? "bg-success" : "bg-border"
                            )}
                          />
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* ── Step content ──────────────────── */}
              <div key={wizardStep} className="rounded-frame bg-muted text-foreground">
                <div className="flex flex-col gap-6 p-6 md:p-8">
                  {/* === Step 1: Client name === */}
                  {wizardStep === 1 && (
                    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                      <div className="flex flex-col gap-2 text-center">
                        <h2 className="text-xl font-semibold">Name your client group</h2>
                        <p className="text-muted-foreground">A short label you&apos;ll use to find this client later.</p>
                      </div>
                      <div className="flex flex-col gap-2 text-left">
                        <Label htmlFor="client-group-name">Client Group Name</Label>
                        <Input
                          id="client-group-name"
                          type="text"
                          placeholder="e.g. Acme Dental"
                          value={clientGroupName}
                          onChange={(e) => setClientGroupName(e.target.value)}
                          autoFocus
                        />
                      </div>

                      {/* The way out of this wizard, offered at the point
                          someone realises they have more than one client to
                          add. Adding five here means walking five steps five
                          times and re-picking the same GHL and Meta accounts
                          by hand; the import table does all five at once. */}
                      <button
                        type="button"
                        onClick={() => {
                          setWizardOpen(false)
                          setBulkImportOpen(true)
                        }}
                        className={cn(choiceClass(false), "flex items-center gap-3")}
                      >
                        <Download className="size-4 shrink-0 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">Adding more than one?</span>
                          <span className="block text-xs text-muted-foreground">Import them together from GoHighLevel.</span>
                        </span>
                      </button>
                    </div>
                  )}

                  {wizardStep === 2 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2 text-center">
                        <h2 className="text-xl font-semibold">Link a GoHighLevel subaccount</h2>
                        <p className="text-muted-foreground">Pick the GHL location for this client&apos;s contacts &amp; opportunities.</p>
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          type="text"
                          placeholder="Search GHL locations by name or ID..."
                          aria-label="Search GHL locations"
                          value={locationSearchQuery}
                          onChange={(e) => setLocationSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-1">
                        {filteredGhlLocations.length > 0 ? (
                          filteredGhlLocations.map((location) => {
                            const selected = selectedGhlLocation?.locationId === location.locationId
                            return (
                              <button
                                type="button"
                                key={location.locationId}
                                aria-pressed={selected}
                                onClick={() => {
                                  setSelectedGhlLocation(location)
                                  setNewGhlLocationId("")
                                }}
                                className={cn(choiceClass(selected), "flex items-start justify-between gap-3")}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className={cn("block truncate font-semibold", selected && "text-primary")}>
                                    {location.name || "Unnamed Location"}
                                  </span>
                                  <span className={cn("mt-1 block truncate font-mono text-xs", selected ? "text-primary" : "text-muted-foreground")}>
                                    ID: {location.locationId}
                                  </span>
                                </span>
                                <span
                                  className={cn(
                                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                                  )}
                                >
                                  {selected && <Check className="size-3" />}
                                </span>
                              </button>
                            )
                          })
                        ) : (
                          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading GHL Locations">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} className="flex items-start justify-between rounded-surface bg-background p-4 shadow-surface">
                                <div className="flex flex-1 flex-col gap-2">
                                  <Skeleton className="h-4 w-1/2" />
                                  <Skeleton className="h-3 w-1/3" />
                                </div>
                                <Skeleton className="ml-3 size-5 rounded-full" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {(selectedGhlLocation || newGhlLocationId) && (
                        <div className="flex items-center gap-2 rounded-control bg-primary-soft p-3">
                          <Check className="size-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            Selected: {selectedGhlLocation?.name || newGhlLocationId || "Unnamed Location"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {wizardStep === 3 && (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2 text-center">
                        <h2 className="text-xl font-semibold">Link a Meta ad account</h2>
                        <p className="text-muted-foreground">Pick the ad account for this client&apos;s campaigns &amp; spend.</p>
                      </div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input
                          type="text"
                          placeholder="Search Meta ad accounts by name or ID..."
                          aria-label="Search Meta ad accounts"
                          value={metaSearchQuery}
                          onChange={(e) => setMetaSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-1">
                        {filteredMetaAdAccounts.length > 0 ? (
                          filteredMetaAdAccounts.map((account) => {
                            const selected = selectedMetaAdAccount?.id === account.id
                            return (
                              <button
                                type="button"
                                key={account.id}
                                aria-pressed={selected}
                                onClick={() => {
                                  if (selected) return
                                  setSelectedMetaAdAccount(account)
                                  setMetaCampaignIds(sharesMetaAccount(clientGroups, account.id) ? [] : null)
                                }}
                                className={cn(choiceClass(selected), "flex items-start justify-between gap-3")}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className={cn("block truncate font-semibold", selected && "text-primary")}>
                                    {account.name || "Unnamed Ad Account"}
                                  </span>
                                  <span className={cn("mt-1 block truncate font-mono text-xs", selected ? "text-primary" : "text-muted-foreground")}>
                                    ID: {account.id}
                                  </span>
                                </span>
                                <span
                                  className={cn(
                                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                                  )}
                                >
                                  {selected && <Check className="size-3" />}
                                </span>
                              </button>
                            )
                          })
                        ) : (
                          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading Meta Adaccounts">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div key={i} className="flex items-start justify-between rounded-surface bg-background p-4 shadow-surface">
                                <div className="flex flex-1 flex-col gap-2">
                                  <Skeleton className="h-4 w-1/2" />
                                  <Skeleton className="h-3 w-1/3" />
                                </div>
                                <Skeleton className="ml-3 size-5 rounded-full" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedMetaAdAccount && (
                        <div className="flex items-center gap-2 rounded-control bg-primary-soft p-3">
                          <Check className="size-4 text-primary" />
                          <span className="text-sm font-medium text-primary">
                            Selected: {selectedMetaAdAccount.name || "Unnamed Ad Account"}
                          </span>
                        </div>
                      )}
                      {selectedMetaAdAccount && (
                        <div className="flex flex-col gap-2 pt-2">
                          <h3 className="text-sm font-semibold">Campaigns</h3>
                          {metaAccountShared && (
                            <p className="text-xs text-muted-foreground">
                              Another client already uses this ad account. Pick the campaigns that belong to this one.
                            </p>
                          )}
                          <MetaCampaignPicker
                            adAccountId={selectedMetaAdAccount.id}
                            value={metaCampaignIds}
                            onChange={setMetaCampaignIds}
                            required={metaAccountShared}
                            shareNote={
                              metaAccountShared && metaRemainderOwner
                                ? `The rest stay with ${metaRemainderOwner}`
                                : null
                            }
                          />
                          {metaCampaignsMissing && (
                            <p className="text-xs text-warning-ink">Pick at least one campaign to continue.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* === Step 4: Call log provider === */}
                  {wizardStep === 4 && (
                    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                      {!callLogProvider && (
                        <>
                          <div className="flex flex-col gap-2 text-center">
                            <h2 className="text-xl font-semibold">Where do calls come from?</h2>
                            <p className="text-muted-foreground">Pick which provider feeds this client&apos;s Sales Hub call logs.</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button type="button" onClick={() => setCallLogProvider("ghl")} className={choiceClass(false)}>
                              <div className="mb-1 font-semibold">GoHighLevel</div>
                              <div className="text-xs text-muted-foreground">Uses your GHL workflow webhook.</div>
                            </button>
                            <button type="button" onClick={() => setCallLogProvider("hotprospector")} className={choiceClass(false)}>
                              <div className="mb-1 font-semibold">Hot Prospector</div>
                              <div className="text-xs text-muted-foreground">Calls sync from your account&apos;s Hot Prospector connection.</div>
                            </button>
                          </div>
                        </>
                      )}

                      {callLogProvider === "ghl" && (
                        <>
                          <div className="flex flex-col gap-2 text-center">
                            <h2 className="text-xl font-semibold">Using GoHighLevel</h2>
                            <p className="text-muted-foreground">Calls will arrive via your GHL workflow webhook on the linked subaccount.</p>
                          </div>
                          <div className="flex items-center gap-3 rounded-control bg-success-soft p-4">
                            <Check className="size-5 shrink-0 text-success-ink" />
                            <span className="text-sm text-foreground">Ready &mdash; no extra setup needed at this step.</span>
                          </div>
                          <div className="text-center">
                            <Button variant="link" onClick={() => setCallLogProvider(null)}>Change provider</Button>
                          </div>
                        </>
                      )}

                      {callLogProvider === "hotprospector" && (
                        <>
                          <div className="flex flex-col gap-2 text-center">
                            <h2 className="text-xl font-semibold">Using Hot Prospector</h2>
                            <p className="text-muted-foreground">Calls for this client sync automatically from your account&apos;s Hot Prospector connection.</p>
                          </div>
                          <div className="flex items-center gap-3 rounded-control bg-success-soft p-4">
                            <Check className="size-5 shrink-0 text-success-ink" />
                            <span className="text-sm text-foreground">Account-wide credentials power every client — nothing to enter here.</span>
                          </div>
                          <div className="text-center">
                            <Button variant="link" onClick={() => setCallLogProvider(null)}>Change provider</Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {wizardStep === 5 && (
                    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                      <div className="flex flex-col gap-2 text-center">
                        <h2 className="text-xl font-semibold">How does this client get leads?</h2>
                        <p className="text-muted-foreground">
                          Meta Instant Forms and form tools that send to GoHighLevel need nothing
                          set up. Only a client&apos;s own landing page needs the Birdy pixel —
                          we&apos;ll walk you through it after.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {LEAD_SOURCES.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            aria-pressed={leadSource === option.key}
                            onClick={() => setLeadSource(option.key)}
                            className={choiceClass(leadSource === option.key)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="mb-1 font-semibold">{option.label}</div>
                                <div className="text-xs text-muted-foreground">{option.hint}</div>
                              </div>
                              {leadSource === option.key && <Check className="size-5 shrink-0 text-primary" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Footer: Back / Next-or-Create ──────────────── */}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  disabled={wizardStep === 1 || addingClientGroup}
                  onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
                >
                  <ArrowLeft /> Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCreateClientGroup}
                  loading={addingClientGroup}
                  disabled={
                    addingClientGroup
                    || (wizardStep === 1 && !clientGroupName)
                    || (wizardStep === 4 && !callLogProvider)
                    || (wizardStep >= 3 && metaCampaignsMissing)
                  }
                  className="min-w-40"
                >
                  {wizardStep < 5 ? (
                    <>Next <ArrowRight /></>
                  ) : (
                    <><Plus /> Create Client Group</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Limit Reached Dialog */}
      <Dialog open={clientLimitDialogOpen} onOpenChange={setClientLimitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client Limit Reached</DialogTitle>
            <DialogDescription>
              You&apos;ve reached your client limit (25). Add extra client slots ($10/mo each)
              from the Billing page to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setClientLimitDialogOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => { setClientLimitDialogOpen(false); router.push("/billing") }}
            >
              Go to Billing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Integration Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integration Already in Use</DialogTitle>
            <DialogDescription>
              The selected GHL location or Meta ad account is already linked to{" "}
              <span className="font-semibold text-foreground">
                &ldquo;{duplicateGroupName}&rdquo;
              </span>
              . Each integration can only be connected to one client group at a time.
              Please choose a different account, or remove it from the existing group first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="primary" onClick={() => setDuplicateDialogOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImported={() => {
          // Freshly imported clients have no figures yet; invalidate so the
          // table picks them up as syncing rows rather than leaving the user
          // on a list that doesn't show what they just imported.
          invalidateClientGroups?.()
          refreshClientGroups?.()
        }}
      />

      <MetaCampaignsDialog
        open={!!assignGroup}
        onOpenChange={(o) => { if (!o) setAssignGroup(null) }}
        group={assignGroup}
        onSaved={() => { invalidateClientGroups?.(); refreshClientGroups?.() }}
      />

      {fetchError ? (
        <ErrorState
          title="Couldn't load your client data"
          description={`${String(fetchError).replace(/\.+$/, "")}. Nothing here is out of date — we just couldn't reach your clients.`}
          onRetry={() => refreshClientGroups?.()}
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {/* Status and health, with counts. Search and column choice sit in the table's own toolbar. */}
          <div className="max-w-full overflow-x-auto">
            <SegmentedTabs
              ariaLabel="Filter clients by status"
              value={statusFilter}
              onValueChange={setStatusFilter}
              items={filterTabs}
            />
          </div>

          <DataTable
            columns={orderedColumns}
            data={rows}
            state={{ columnVisibility }}
            onStateChange={(next) => setVisibilityChoices(next.columnVisibility)}
            toolbar={
              <Button variant="ghost" size="sm" onClick={saveColumns}>
                Save columns
              </Button>
            }
            loading={loading}
            getRowId={(row) => row.id}
            onRowClick={handleClientGroupClick}
            pageSize={20}
            empty={
              clientGroups.length === 0 ? (
                <EmptyState
                  title="No clients yet"
                  description="Link a client's GoHighLevel and Meta accounts to see its leads and spend here."
                  action={addClientButton}
                />
              ) : (
                <EmptyState
                  title={`No ${tabLabel.toLowerCase()} clients`}
                  description="Pick another tab to see the rest of your clients."
                />
              )
            }
          />
        </div>
      )}
    </div>
  )
}
