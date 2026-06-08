"use client"
import { Fragment, useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DateRangeSelect } from "@/components/DateRangeSelect"
import { ErrorBanner } from "@/components/ErrorBanner"
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, ArrowRight, Building2, Plus, Check, ChevronRight, Users, DollarSign, UserCheck, Target, Search } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { useColumnViews } from "@/lib/useColumnViews"

import {
  ENHANCED_CLIENT_COLUMNS,
  ENHANCED_CATEGORIES,
  COLUMN_PRESETS,
  buildDynamicColumns,
  getTagCount
} from '@/lib/enhanced-columns-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ghlIcon as ghl, metaIcon as metaa, hpIcon as HP } from "@/lib/icons"
import { Progress } from "@/components/ui/progress"
import { flaskIcon as Flask } from "@/lib/icons"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import Image from "next/image"
import { Loading } from "@/components/ui/loader"
import StyledTable from "@/components/ui/table-container"
import ColumnVisibilityDropdown from "@/components/ui/Columns-filter"
import getSymbolFromCurrency from "currency-symbol-map";
import { Skeleton } from "@/components/ui/skeleton"

import { STORAGE_KEYS, DEFAULT_DATE_PRESET } from "@/lib/constants"
import { getCachedData, clearCache } from "@/lib/cache"
import { apiRequest, API_BASE_URL } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

const STORAGE_KEY = STORAGE_KEYS.DEFAULT_CURRENCY

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
  } = useClientGroups(DEFAULT_DATE_PRESET)
  const [error, setError] = useState("")
  const [clientGroups, setClientGroups] = useState([])
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [clientGroupName, setClientGroupName] = useState("")
  const [ghlLocations, setGhlLocations] = useState([])
  const [metaAdAccounts, setMetaAdAccounts] = useState([])
  const [hotProspectorGroups, setHotProspectorGroups] = useState([])
  const [selectedGhlLocation, setSelectedGhlLocation] = useState(null)
  const [newGhlLocationId, setNewGhlLocationId] = useState("")
  const [selectedMetaAdAccount, setSelectedMetaAdAccount] = useState(null)
  const [selectedHotProspectorGroup, setSelectedHotProspectorGroup] = useState(null)
  const [locationSearchQuery, setLocationSearchQuery] = useState("")
  const [metaSearchQuery, setMetaSearchQuery] = useState("")
  const [hotProspectorSearchQuery, setHotProspectorSearchQuery] = useState("")
  const [addingClientGroup, setAddingClientGroup] = useState(false)
  // ── Step 4: call log provider ────────────────────────────────────────────
  // Credentials are account-wide and live in Settings → Integrations; the wizard
  // only records which provider feeds this client's call logs.
  const [callLogProvider, setCallLogProvider] = useState(null) // null | "ghl" | "hotprospector"
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [togglingRows, setTogglingRows] = useState(new Set())

  // ── Status filter ─────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState("all")

  // Sync hook data → local state (local state allows optimistic updates)
  useEffect(() => {
    if (fetchError) setError(fetchError)
    const groups = fetchedGroups.map(group => ({
      ...group,
      _isPending: group.status === "pending",
      _isCreating: group.status === "creating",
    }))
    setClientGroups(groups)
  }, [fetchedGroups, fetchError])

  const [progress, setProgress] = useState(0)
  const [isOpen, setIsOpen] = useState(false);
  const [customMetrics, setCustomMetrics] = useState([]);
  useEffect(() => {
    apiRequest("/api/custom-metrics").then(async res => {
      if (!res.ok) return
      const data = await res.json()
      setCustomMetrics((data.custom_metrics || []).map(m => ({
        id: m.id, name: m.name, description: m.description || "",
        source: "Custom Formula", dashboard: (m.dashboards || []).join(", "),
        dashboards: m.dashboards || [], formula: m.formula_display || "",
        formulaParts: m.formula_parts || [], formatType: m.format_type || "integer",
        displayOnDashboard: true, category: "custom", enabled: true,
      })))
    }).catch(() => {})
  }, [])
  const [clientLimitDialogOpen, setClientLimitDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateGroupName, setDuplicateGroupName] = useState("")
  const [userCurrency, setUserCurrency] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? null; } catch { return null; }
  });
  const [currencyLoading, setCurrencyLoading] = useState(true);
  const { savedColumns, saveView: saveToDB, saveViewDebounced, viewsLoaded } = useColumnViews("clients")

  // ── Filter groups by status ───────────────────────────────────────────────
  const filteredByStatus = useMemo(() => {
    if (statusFilter === "all") return clientGroups
    return clientGroups.filter(g => (g.client_status ?? "Active") === statusFilter)
  }, [clientGroups, statusFilter])

  // ── Status counts for filter badges ───────────────────────────────────────
  const statusCounts = useMemo(() => {
    const all = clientGroups.length
    const active = clientGroups.filter(g => (g.client_status ?? "Active") === "Active").length
    const inactive = all - active
    return { all, active, inactive }
  }, [clientGroups])

  // Build dynamic columns when filteredByStatus changes
  const columns = useMemo(() => {
    console.log("🔄 Rebuilding columns with", filteredByStatus.length, "client groups");

    const dynamicColumns = buildDynamicColumns(filteredByStatus);
    console.log("📊 Dynamic columns built:", dynamicColumns.length, "total columns");

    // Add custom formula metrics
    const custom = customMetrics
      .filter((m) => m.enabled && (m.dashboards?.includes("clients") || m.dashboard === "Clients"))
      .map((m) => ({
        id: m.id,
        label: m.name,
        visible: true,
        sortable: true,
        category: 'formulas',
        type: 'formula',
        icons: Flask,
      }));

    // Combine and deduplicate
    const seen = new Set();
    const all = [...dynamicColumns, ...custom];
    const deduplicated = all.filter((col) => {
      if (seen.has(col.id)) return false;
      seen.add(col.id);
      return true;
    });

    console.log("✅ Final columns:", deduplicated.length);
    return deduplicated;
  }, [customMetrics, filteredByStatus]);

  const [columnVisibility, setColumnVisibility] = useState(() => {
    const map = {};
    columns.forEach((c) => (map[c.id] = c.visible));
    return map;
  });
  // The saved view is a flat ordered array — its sequence implies BOTH which
  // columns are visible (those present) AND the order they should render in.
  const [columnOrder, setColumnOrder] = useState([])

  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setColumnVisibility(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(k => { updated[k] = false })
      savedColumns.forEach(id => { updated[id] = true })
      return updated
    })
    // Hydrate column order from the saved sequence
    if (Array.isArray(savedColumns) && savedColumns.length > 0) {
      setColumnOrder(savedColumns)
    }
  }, [viewsLoaded, savedColumns])

  useEffect(() => {
    setColumnVisibility((prev) => {
      const updated = { ...prev };
      columns.forEach((col) => {
        if (!(col.id in updated)) {
          updated[col.id] = col.visible;
        }
      });
      return updated;
    });
  }, [columns]);

  const categories = [
    { id: 'all', label: 'All Metrics' },
    { id: 'gohighlevel', label: 'GoHighLevel' },
    { id: 'metaads', label: 'Meta Ads' },
    { id: 'hotprospector', label: 'HotProspector' },
    { id: 'tags', label: 'Lead Tags' },
    { id: 'formulas', label: 'Formulas' },
  ];

  const categoryCounts = useMemo(() => {
    const counts = columns.reduce((acc, col) => {
      if (col.id === 'name') return acc;
      const cat = col.category || 'unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});
    counts['all'] = Object.values(counts).reduce((a, b) => a + b, 0) || 0;
    return counts;
  }, [columns]);

  const getIcon = (col) => {
    return (col.icons) ? col.icons : null;
  };

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredColumns = useMemo(() => columns.filter((col) => {
    if (col.id === 'name') return false;
    if (selectedCategory !== 'all' && col.category !== selectedCategory) return false;
    if (searchTerm && !col.label.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  }), [columns, selectedCategory, searchTerm]);

  const selectAll = () => {
    const newVisibility = {};
    filteredColumns.forEach(col => { newVisibility[col.id] = true; });
    setColumnVisibility(prev => ({ ...prev, ...newVisibility }));
  };

  const clearAll = () => {
    const newVisibility = {};
    filteredColumns.forEach(col => { newVisibility[col.id] = false; });
    setColumnVisibility(prev => ({ ...prev, ...newVisibility }));
  };

  const save = async () => {
    // Save as an ordered list. The order is derived from the user's
    // drag-reordered columnOrder when present, otherwise from the natural
    // columns sequence. Hidden columns are excluded.
    const visibleSet = new Set(
      Object.entries(columnVisibility).filter(([, v]) => v).map(([k]) => k)
    )
    let orderedIds
    if (columnOrder && columnOrder.length > 0) {
      // Start from the user-defined order, then append any newly-visible
      // columns the order list doesn't yet know about.
      const known = new Set(columnOrder)
      const tail = [...visibleSet].filter(id => !known.has(id))
      orderedIds = [...columnOrder.filter(id => visibleSet.has(id)), ...tail]
    } else {
      orderedIds = columns.filter(c => visibleSet.has(c.id)).map(c => c.id)
    }
    await saveToDB(orderedIds)
    setIsOpen(false)
  }

  const [searchQuery, setSearchQuery] = useState("")

  const toggleColumnVisibility = (columnId) => {
    if (columnId === "name") return;
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !(prev[columnId] ?? true),
    }));
  };

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
          console.log("[v0] Using cached GHL locations:", cached.length)
          return
        }
      }

      const response = await apiRequest("/api/subaccount/locations")

      if (response.ok) {
        const data = await response.json()
        const locations = data.locations || []
        setGhlLocations(locations)
        console.log("[v0] Fetched fresh GHL locations:", locations.length)
        if (locations.length === 0) {
          toast.warning("No GHL locations found. Please enter a location ID or skip this step.")
        }
      } else {
        const errorData = await response.json()
        toast.error(errorData.detail || "Failed to fetch GHL locations")
      }
    } catch (err) {
      console.error("[v0] Error fetching GHL locations:", err)
      toast.error("Failed to fetch GHL locations")
    }
  }

  const fetchMetaAdAccounts = async (forceRefresh = false) => {
    try {
      const response = await apiRequest("/api/facebook/adaccounts")

      if (response.ok) {
        const data = await response.json()
        const accounts = data.data?.data || []
        setMetaAdAccounts(accounts)
        console.log("[v0] Fetched fresh Meta ad accounts:", accounts.length)
      } else {
        toast.error("Failed to fetch Meta ad accounts")
      }
    } catch (err) {
      console.error("[v0] Error fetching Meta ad accounts:", err)
      toast.error("Failed to fetch Meta ad accounts")
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    invalidateClientGroups()
    toast.success("Client groups refreshed")
    setIsRefreshing(false)
  }

  // ── Status toggle handler ────────────────────────────────────────────────
  const handleStatusToggle = async (groupId, currentStatus) => {
    const newStatus = String(currentStatus).toLowerCase() === "active" ? "Inactive" : "Active"

    setTogglingRows(prev => new Set(prev).add(groupId))

    try {
      const res = await apiRequest(`/api/client-groups/${groupId}/client-status`, {
        method: "PATCH",
        body: JSON.stringify({ client_status: newStatus }),
      })

      if (res.ok) {
        setClientGroups(prev => prev.map(g =>
          g.id === groupId ? { ...g, client_status: newStatus } : g
        ))
        toast.success(`Client marked as ${newStatus}`)
      } else {
        toast.error("Failed to update client status")
      }
    } catch {
      toast.error("Failed to update client status")
    } finally {
      setTogglingRows(prev => {
        const next = new Set(prev)
        next.delete(groupId)
        return next
      })
    }
  }

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
    if (wizardStep === 4 && !callLogProvider) {
      toast.error("Please choose a call log provider (GoHighLevel or Hot Prospector)")
      return
    }

    if (wizardStep < 4) {
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
    setSelectedHotProspectorGroup(null)
    setLocationSearchQuery("")
    setMetaSearchQuery("")
    setHotProspectorSearchQuery("")
    setCallLogProvider(null)

    toast.info(`Creating "${creatingGroupName}"...`)

    setAddingClientGroup(true)
    setProgress(10)
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev >= 95 ? prev : prev + 5))
    }, 500)

    try {
      const response = await apiRequest("/api/client-groups", {
        method: "POST",
        body: JSON.stringify({
          name: creatingGroupName,
          ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId || null,
          meta_ad_account_id: selectedMetaAdAccount?.id || null,
          hotprospector_group_id: selectedHotProspectorGroup?.id || null,
          ad_account_currency: selectedMetaAdAccount?.currency || null,
          call_log_provider: callLogProvider || "ghl",
          notes: "",
        }),
      });

      clearInterval(progressInterval)
      setProgress(100)

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
        invalidateClientGroups()
        clearCache("ghlLocations")
      } else {
        const data = await response.json()

        setClientGroups(prev => prev.filter(group => group.id !== tempId))

        if (response.status === 402 && data.detail?.code === "CLIENT_LIMIT_REACHED") {
          setClientLimitDialogOpen(true)
        } else if (response.status === 409) {
          const detail = typeof data.detail === "string" ? data.detail : ""
          const nameMatch = detail.match(/^A client group named "([^"]+)"/)
          setDuplicateGroupName(nameMatch ? nameMatch[1] : "another client group")
          setDuplicateDialogOpen(true)
        } else {
          toast.error(data.detail || "Failed to create client group")
        }
      }
    } catch (err) {
      clearInterval(progressInterval)
      console.error("[v0] Error creating client group:", err)

      setClientGroups(prev => prev.filter(group => group.id !== tempId))

      toast.error("Failed to create client group")
    } finally {
      setTimeout(() => setAddingClientGroup(false), 500)
    }
  }

  const handleClientGroupClick = (group) => {
    router.push(`/clients/${group.id}`)
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

  const filteredHotProspectorGroups = hotProspectorGroups.filter(
    (group) =>
      group.name?.toLowerCase().includes(hotProspectorSearchQuery.toLowerCase()) ||
      String(group.id).toLowerCase().includes(hotProspectorSearchQuery.toLowerCase()),
  )

  // ── Calculate stats from ALL groups (unfiltered) ──────────────────────────
  const calculateStats = () => {
    const activeClients = clientGroups.filter(g => (g.client_status ?? "Active") === "Active").length

    const activeGroups = clientGroups.filter(g => (g.client_status ?? "Active") === "Active")
    const totalSpend = activeGroups.reduce((sum, group) => {
      const spend = parseFloat(group.facebook?.metrics?.insights?.spend) || 0
      return sum + spend
    }, 0)

    // Use results from insights, fallback to summing campaign results, then total_leads
    const totalLeads = activeGroups.reduce((sum, group) => {
      let results = parseInt(group.facebook?.metrics?.insights?.results) || 0
      if (!results && group.facebook?.campaigns?.length) {
        results = group.facebook.campaigns.reduce((s, c) => s + (c.results || 0), 0)
      }
      if (!results) results = parseInt(group.facebook?.metrics?.insights?.total_leads) || 0
      return sum + results
    }, 0)

    // CPL = total spend / total results
    const averageCPL = totalLeads > 0 ? totalSpend / totalLeads : 0

    return {
      activeClients,
      totalSpend,
      totalLeads,
      averageCPL
    }
  }

  const stats = calculateStats()

  // ── Filter tab config ─────────────────────────────────────────────────────
  const filterTabs = [
    { key: "Active", label: "Active", count: statusCounts.active },
    { key: "Inactive", label: "Inactive", count: statusCounts.inactive },
    { key: "all", label: "All Clients", count: statusCounts.all },
  ]

  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto gap-6">
      <div className="">
        <div className="h-auto mx-auto">
          <div className="flex flex-col sm:flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex gap-4 flex flex-col py-2 md:py-0 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">
                  Client Hub
                </h1>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg
            py-1 px-1 flex-nowrap overflow-x-auto md:gap-1 md:py-1 md:px-1 w-fit mx-auto md:mx-0">
              <div className="flex items-center gap-1">
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className=" bg-white h-10 text-thin text-sm font-medium"
                />

                <DateRangeSelect value={selectedDateRange} onChange={setSelectedDateRange} />

                <ColumnVisibilityDropdown
                  isOpen={isOpen}
                  setIsOpen={setIsOpen}
                  categories={categories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  categoryCounts={categoryCounts}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filteredColumns={filteredColumns}
                  columnVisibility={columnVisibility}
                  toggleColumnVisibility={toggleColumnVisibility}
                  getIcon={getIcon}
                  selectAll={selectAll}
                  clearAll={clearAll}
                  save={save}
                />
              </div>
              <Button
                onClick={() => setWizardOpen(true)}
                className="bg-[#713CDD] inline-flex items-center justify-center h-10 px-4 py-2 text-white rounded-lg gap-2"
              >
                <Plus className="h-4 w-4 border rounded-full border-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add client dialog */}
      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open)
          if (!open) {
            setWizardStep(1)
            setClientGroupName("")
            setSelectedGhlLocation(null)
            setNewGhlLocationId("")
            setSelectedMetaAdAccount(null)
            setSelectedHotProspectorGroup(null)
            setLocationSearchQuery("")
            setMetaSearchQuery("")
            setHotProspectorSearchQuery("")
            setCallLogProvider(null)
            setHpApiUid("")
            setHpApiKey("")
            setHpTestStatus("idle")
            setHpTestError("")
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto overflow-x-hidden p-4 md:p-6">
          {/* sr-only title so Radix Dialog has accessible labelling */}
          <DialogHeader className="sr-only">
            <DialogTitle>Birdy Linking Wizard</DialogTitle>
          </DialogHeader>

          <div className="w-full py-2">
            <div className="w-full max-w-xl mx-auto space-y-6 flex flex-col">
              {/* ── Top stepper (responsive) ────────────────────── */}
              <div className="w-full overflow-hidden">
                <div className="flex items-start gap-1 sm:gap-2 w-full">
                  {[
                    { num: 1, short: "Name", full: "Client Name" },
                    { num: 2, short: "GHL", full: "GHL" },
                    { num: 3, short: "Meta", full: "Meta" },
                    { num: 4, short: "Calls", full: "Sales Calls" },
                  ].map((s, i, arr) => (
                    <Fragment key={s.num}>
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300 ${wizardStep > s.num
                            ? "stepper-completed"
                            : wizardStep === s.num
                              ? "stepper-active"
                              : "stepper-pending"
                            }`}
                        >
                          {wizardStep > s.num
                            ? <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                            : <span>{s.num}</span>}
                        </div>
                        <div className="mt-2 text-center px-1">
                          <div
                            className={`text-[10px] sm:text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${wizardStep > s.num
                              ? "text-success"
                              : wizardStep === s.num
                                ? "text-primary"
                                : "text-muted-foreground"
                              }`}
                          >
                            <span className="sm:hidden">{s.short}</span>
                            <span className="hidden sm:inline">{s.full}</span>
                          </div>
                        </div>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="flex-1 min-w-[8px] mt-[14px] sm:mt-5">
                          <div
                            className={`h-0.5 rounded-full transition-all duration-500 ${wizardStep > s.num ? "bg-success" : "bg-border"
                              }`}
                          />
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* ── Card-wrapped step content ──────────────────── */}
              <div
                key={wizardStep}
                className="rounded-lg bg-card text-card-foreground card-gradient border-0 shadow-card animate-slide-in"
              >
                <div className="p-6 md:p-8 space-y-6">
                  {/* === Step 1: Client name === */}
                  {wizardStep === 1 && (
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">Name your client group</h2>
                        <p className="text-muted-foreground">A short label you'll use to find this client later.</p>
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-sm font-medium leading-none" htmlFor="client-group-name">Client Group Name</label>
                        <Input
                          id="client-group-name"
                          type="text"
                          placeholder="e.g. Acme Dental"
                          value={clientGroupName}
                          onChange={(e) => setClientGroupName(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                  )}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Link a GoHighLevel subaccount</h2>
                  <p className="text-muted-foreground">Pick the GHL location for this client&apos;s contacts &amp; opportunities.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4  " />
                  <Input
                    type="text"
                    placeholder="Search GHL locations by name or ID..."
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-3"
                  />
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredGhlLocations.length > 0 ? (
                    filteredGhlLocations.map((location) => (
                      <div
                        key={location.locationId}
                        onClick={() => {
                          setSelectedGhlLocation(location)
                          setNewGhlLocationId("")
                        }}
                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group ${selectedGhlLocation?.locationId === location.locationId
                          ? "border-purple-500 bg-purple-50 shadow-md"
                          : "border-border hover:border-muted-foreground bg-card"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3
                                className={`font-semibold truncate ${selectedGhlLocation?.locationId === location.locationId
                                  ? "text-purple-900"
                                  : "text-foreground"
                                  }`}
                              >
                                {location.name || "Unnamed Location"}
                              </h3>
                            </div>
                            <p
                              className={`text-xs font-mono truncate ${selectedGhlLocation?.locationId === location.locationId
                                ? "text-purple-600"
                                : "text-muted-foreground"
                                }`}
                            >
                              ID: {location.locationId}
                            </p>
                          </div>
                          <div
                            className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${selectedGhlLocation?.locationId === location.locationId
                              ? "bg-purple-600 border-purple-600"
                              : "border-border group-hover:border-muted-foreground"
                              }`}
                          >
                            {selectedGhlLocation?.locationId === location.locationId && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <div class="flex items-center justify-center h-fit">
                        <Empty className="w-full">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Spinner />
                            </EmptyMedia>
                            <EmptyTitle>Loading GHL Locations</EmptyTitle>
                            <EmptyDescription>
                              Please wait while we process your request. Do not refresh the page.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </div>
                    </div>
                  )}
                </div>
                {(selectedGhlLocation || newGhlLocationId) && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">
                        Selected: {selectedGhlLocation?.name || newGhlLocationId || "Unnamed Location"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Link a Meta ad account</h2>
                  <p className="text-muted-foreground">Pick the ad account for this client&apos;s campaigns &amp; spend.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search Meta ad accounts by name or ID..."
                    value={metaSearchQuery}
                    onChange={(e) => setMetaSearchQuery(e.target.value)}
                    className="pl-10 pr py-3"
                  />
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto ">
                  {filteredMetaAdAccounts.length > 0 ? (
                    filteredMetaAdAccounts.map((account) => (
                      <div
                        key={account.id}
                        onClick={() => setSelectedMetaAdAccount(account)}
                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group ${selectedMetaAdAccount?.id === account.id
                          ? "border-purple-500 bg-purple-50 shadow-md"
                          : "border-border hover:border-muted-foreground bg-card"
                          }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3
                                className={`font-semibold truncate ${selectedMetaAdAccount?.id === account.id
                                  ? "text-purple-900"
                                  : "text-foreground"
                                  }`}
                              >
                                {account.name || "Unnamed Ad Account"}
                              </h3>
                            </div>
                            <p
                              className={`text-xs font-mono truncate ${selectedMetaAdAccount?.id === account.id
                                ? "text-purple-600"
                                : "text-muted-foreground"
                                }`}
                            >
                              ID: {account.id}
                            </p>
                          </div>
                          <div
                            className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${selectedMetaAdAccount?.id === account.id
                              ? "bg-purple-600 border-purple-600"
                              : "border-border group-hover:border-muted-foreground"
                              }`}
                          >
                            {selectedMetaAdAccount?.id === account.id && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <div class="flex items-center justify-center h-fit">
                        <Empty className="w-full">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Spinner />
                            </EmptyMedia>
                            <EmptyTitle>Loading Meta Adaccounts</EmptyTitle>
                            <EmptyDescription>
                              Please wait while we process your request. Do not refresh the page.
                            </EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </div>
                    </div>
                  )}
                </div>
                {selectedMetaAdAccount && (
                  <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">
                        Selected: {selectedMetaAdAccount.name || "Unnamed Ad Account"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* === Step 4: Call log provider === */}
            {wizardStep === 4 && (
              <div className="max-w-md mx-auto space-y-6">
                {!callLogProvider && (
                  <>
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">Where do calls come from?</h2>
                      <p className="text-muted-foreground">Pick which provider feeds this client&apos;s Sales Hub call logs.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCallLogProvider("ghl")}
                        className="p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                      >
                        <div className="font-semibold text-foreground mb-1">GoHighLevel</div>
                        <div className="text-xs text-muted-foreground">Uses your GHL workflow webhook.</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallLogProvider("hotprospector")}
                        className="p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                      >
                        <div className="font-semibold text-foreground mb-1">Hot Prospector</div>
                        <div className="text-xs text-muted-foreground">Calls sync from your account&apos;s Hot Prospector connection.</div>
                      </button>
                    </div>
                  </>
                )}

                {callLogProvider === "ghl" && (
                  <>
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">Using GoHighLevel</h2>
                      <p className="text-muted-foreground">Calls will arrive via your GHL workflow webhook on the linked subaccount.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3">
                      <Check className="w-5 h-5 text-success shrink-0" />
                      <span className="text-sm text-foreground">Ready &mdash; no extra setup needed at this step.</span>
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setCallLogProvider(null)}
                        className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                      >
                        Change provider
                      </button>
                    </div>
                  </>
                )}

                {callLogProvider === "hotprospector" && (
                  <>
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-bold text-foreground">Using Hot Prospector</h2>
                      <p className="text-muted-foreground">Calls for this client sync automatically from your account&apos;s Hot Prospector connection.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3">
                      <Check className="w-5 h-5 text-success shrink-0" />
                      <span className="text-sm text-foreground">Account-wide credentials power every client — nothing to enter here.</span>
                    </div>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setCallLogProvider(null)}
                        className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                      >
                        Change provider
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
                </div>
              </div>

              {/* ── Footer: Back / Next-or-Create ──────────────── */}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={wizardStep === 1 || addingClientGroup}
                  onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateClientGroup}
                  disabled={
                    addingClientGroup
                    || (wizardStep === 1 && !clientGroupName)
                    || (wizardStep === 4 && !callLogProvider)
                  }
                  className="btn-gradient gap-2 h-10 px-4 rounded-md min-w-[160px] justify-center"
                >
                  {addingClientGroup ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : wizardStep < 4 ? (
                    <>Next <ArrowRight className="w-4 h-4" /></>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create Client Group</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Limit Reached Dialog */}
      <AlertDialog open={clientLimitDialogOpen} onOpenChange={setClientLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Client Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              You've reached your client limit (25). Add extra client slots ($10/mo each)
              from the Billing page to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => { setClientLimitDialogOpen(false); router.push("/billing") }}
            >
              Go to Billing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Integration Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Integration Already in Use</AlertDialogTitle>
            <AlertDialogDescription>
              The selected GHL location or Meta ad account is already linked to{" "}
              <span className="font-semibold text-foreground">
                &ldquo;{duplicateGroupName}&rdquo;
              </span>
              . Each integration can only be connected to one client group at a time.
              Please choose a different account, or remove it from the existing group first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setDuplicateDialogOpen(false)}
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="w-full mx-auto py-6 space-y-6">
        <ErrorBanner error={error} />

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground font-normal text-sm">Total Active Clients</CardTitle>
                <div className="h-7 w-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Users className="h-4 w-4 text-purple-600 font-bold" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="w-full py-4">
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="text-2xl font-bold">{stats.activeClients}</div>
                )}
                <p className="text-xs text-[#71658B] mt-1">Connected client groups across all integrations</p>
              </CardContent>
          </Card>

          <Card className="border rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-muted-foreground font-normal text-sm">Total Ad Spend</CardTitle>
              <div className="h-7 w-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-purple-600 font-bold" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="w-full py-4">
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  {getSymbolFromCurrency(userCurrency)}{stats.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-[#71658B] mt-1">Combined Meta ad spend across all clients</p>
            </CardContent>
          </Card>

          <Card className="border rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-muted-foreground font-normal text-sm">Total Leads</CardTitle>
              <div className="h-7 w-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-purple-600 font-bold" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="w-full py-4">
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                 {stats.totalLeads}
                  </div>
              )}
              <p className="text-xs text-[#71658B] mt-1">Total results from all active Meta campaigns</p>
            </CardContent>
          </Card>

          <Card className="border rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-muted-foreground font-normal text-sm">Average CPL</CardTitle>
              <div className="h-7 w-8 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                <Target className="h-4 w-4 text-purple-600 font-bold" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="w-full py-4">
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <div className="text-2xl font-bold">
                  {getSymbolFromCurrency(userCurrency)}{stats.averageCPL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <p className="text-xs text-[#71658B] mt-1">Average cost per lead across all clients</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Status Filter Bar: All Clients | Active | Inactive ────────── */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
          <TabsList className="flex-1 justify-start overflow-x-auto w-full">
            {filterTabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
              >
                {tab.label}
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {tab.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* StyledTable — receives filtered data */}
        <StyledTable
          data={filteredByStatus}
          onRowClick={handleClientGroupClick}
          columns={columns}
          searchQuery={searchQuery}
          columnVisibility={columnVisibility}
          customMetrics={customMetrics}
          setCustomMetrics={setCustomMetrics}
          enableEnhancedExtraction={true}
          getTagCount={getTagCount}
          isLoading={loading}
          isRowLoading={(row) => row._isPending || row._isCreating}
          initialColumnOrder={columnOrder}
          onColumnOrderChange={(newOrder) => {
            setColumnOrder(newOrder)
            // Auto-persist column order so a drag-reorder survives a refresh
            // without the user having to click "Save View". Debounced inside
            // the hook so a flurry of drags collapses to a single API call.
            saveViewDebounced(newOrder)
          }}
          enableStatusToggle={true}
          onStatusToggle={handleStatusToggle}
          togglingRows={togglingRows}
        />
      </div>

    </div>
  )
}