"use client"
import { useEffect, useState, useMemo } from "react"
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
import { Building2, Plus, Check, ChevronRight, Users, DollarSign, UserCheck, Target, Search } from "lucide-react"
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

import { STORAGE_KEYS } from "@/lib/constants"
import { getCachedData, clearCache } from "@/lib/cache"
import { apiRequest, API_BASE_URL } from "@/lib/api"

const STORAGE_KEY = STORAGE_KEYS.DEFAULT_CURRENCY

export default function ClientsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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
  const [isRefreshing, setIsRefreshing] = useState(false)

  // ── 🔥 DATE RANGE STATE ──────────────────────────────────────────────────
  const [selectedDateRange, setSelectedDateRange] = useState("maximum")

  const [progress, setProgress] = useState(0)
  const [isOpen, setIsOpen] = useState(false);
  const [customMetrics, setCustomMetrics] = useState([]);
  const [clientLimitDialogOpen, setClientLimitDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateGroupName, setDuplicateGroupName] = useState("")
  const [userCurrency, setUserCurrency] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) ?? null; } catch { return null; }
  });
  const [currencyLoading, setCurrencyLoading] = useState(true);
  const { savedColumns, saveView: saveToDB, viewsLoaded } = useColumnViews("clients")

  // Build dynamic columns when clientGroups changes
  const columns = useMemo(() => {
    console.log("🔄 Rebuilding columns with", clientGroups.length, "client groups");

    // Build dynamic columns including tags from client groups data
    const dynamicColumns = buildDynamicColumns(clientGroups);
    console.log("📊 Dynamic columns built:", dynamicColumns.length, "total columns");

    // Add custom formula metrics
    const custom = customMetrics
      .filter((m) => m.enabled && m.dashboard === "Clients")
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
  }, [customMetrics, clientGroups]);

  const [columnVisibility, setColumnVisibility] = useState(() => {
    const map = {};
    columns.forEach((c) => (map[c.id] = c.visible));
    return map;
  });
  useEffect(() => {
    if (!viewsLoaded || !savedColumns) return
    setColumnVisibility(prev => {
      const updated = { ...prev }
      Object.keys(updated).forEach(k => { updated[k] = false })
      savedColumns.forEach(id => { updated[id] = true })
      return updated
    })
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
    localStorage.setItem('clients-columnVisibility', JSON.stringify(columnVisibility))
    const visibleIds = Object.entries(columnVisibility)
      .filter(([, v]) => v)
      .map(([k]) => k)
    await saveToDB(visibleIds)
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
    fetchClientGroups(false, selectedDateRange)
  }, [selectedDateRange])

  // Removed mount-time progress animation

  useEffect(() => {
    if (wizardOpen && wizardStep > 1) {
      if (wizardStep === 2) fetchGhlLocations()
      if (wizardStep === 3) fetchMetaAdAccounts()
    }
  }, [wizardOpen, wizardStep])

  // ── 🔥 fetchClientGroups accepts an optional datePreset override ─────────
  const fetchClientGroups = async (forceRefresh = false, datePreset = selectedDateRange) => {
    try {
      setLoading(true)
      setError("")

      const response = await apiRequest(`/api/client-groups?date_preset=${datePreset || "maximum"}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch client groups: ${response.status}`)
      }
      const data = await response.json()
      const groups = (data.client_groups || []).map(group => ({
        ...group,
        _isPending: group.status === "pending",
        _isCreating: group.status === "creating",
      }))

      setClientGroups(groups)
      console.log("📥 Fetched client groups:", groups.length, "| preset:", datePreset);

      if (forceRefresh) {
        toast.success("Client groups refreshed")
      }
    } catch (err) {
      console.error("[v0] Error fetching client groups:", err)
      setError(err.message)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

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
    clearCache("clientGroups")
    fetchClientGroups(true, selectedDateRange)
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

    if (wizardStep < 3) {
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
          ad_account_currency: selectedMetaAdAccount?.currency || null,  // Add this; fallback to null if unavailable
          notes: "",  // Add this; use empty string or a dynamic value if needed
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
        clearCache("clientGroups")
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

  const calculateStats = () => {
    const activeClients = clientGroups.length

    const totalSpend = clientGroups.reduce((sum, group) => {
      const spend = parseFloat(group.facebook?.metrics?.insights?.spend) || 0
      return sum + spend
    }, 0)

    // ← Read Meta leads, not GHL contacts
    const totalLeads = clientGroups.reduce((sum, group) => {
      const leads = parseInt(group.facebook?.metrics?.insights?.total_leads) || 0
      return sum + leads
    }, 0)

    // ← Read pre-calculated CPL from backend instead of dividing manually
    const totalCPL = clientGroups.reduce((sum, group) => {
      const cpl = parseFloat(group.facebook?.metrics?.insights?.cost_per_result) || 0
      return sum + cpl
    }, 0)
    const averageCPL = clientGroups.length > 0 ? totalCPL / clientGroups.filter(g => g.facebook?.metrics?.insights?.cost_per_result > 0).length : 0

    return {
      activeClients,
      totalSpend,
      totalLeads,
      averageCPL
    }
  }

  const stats = calculateStats()

  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto bg-[#f6f8fa] gap-6">
      <div className="bg-[#f6f8fa]">
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
          }
        }}
      >
        {/* Add client */}
        <DialogContent className="sm:max-w-2xl bg-zinc-50 p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-white">Client Linking Wizard</DialogTitle>
                <p className="text-purple-100 text-sm">
                  Step {wizardStep} of 3:{" "}
                  {
                    [
                      "Name your client group",
                      "Select or add GHL subaccount",
                      "Select Meta ad account",
                      "Select Hot Prospector group",
                    ][wizardStep - 1]
                  }
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="h-auto bg-white">
            {wizardStep === 1 && (
              <div className="space-y-2 p-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Client Group Name</label>
                  <Input
                    type="text"
                    placeholder="Enter client group name"
                    value={clientGroupName}
                    onChange={(e) => setClientGroupName(e.target.value)}
                    className="mt-1"
                    autoFocus
                  />
                </div>
              </div>
            )}
            {wizardStep === 2 && (
              <div className="space-y-4 p-4 ">
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
                              className={`text-xs font-mono ${selectedGhlLocation?.locationId === location.locationId
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
              <div className="space-y-2 p-4">
                <div className="relative ">
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
                              className={`text-xs font-mono ${selectedMetaAdAccount?.id === account.id
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
            {/* {wizardStep === 4 && (
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                          <Input
                            type="text"
                            placeholder="Search Hot Prospector groups by name or ID..."
                            value={hotProspectorSearchQuery}
                            onChange={(e) => setHotProspectorSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-3"
                          />
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {filteredHotProspectorGroups.length > 0 ? (
                            filteredHotProspectorGroups.map((group) => (
                              <div
                                key={group.id}
                                onClick={() => setSelectedHotProspectorGroup(group)}
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group ${
                                  selectedHotProspectorGroup?.id === group.id
                                    ? "border-purple-500 bg-purple-50 shadow-md"
                                    : "border-border hover:border-muted-foreground bg-card"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3
                                        className={`font-semibold truncate ${
                                          selectedHotProspectorGroup?.id === group.id
                                            ? "text-purple-900"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {group.name || "Unnamed Group"}
                                      </h3>
                                    </div>
                                    <p
                                      className={`text-xs font-mono ${
                                        selectedHotProspectorGroup?.id === group.id
                                          ? "text-purple-600"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      ID: {group.id}
                                    </p>
                                  </div>
                                  <div
                                    className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                      selectedHotProspectorGroup?.id === group.id
                                        ? "bg-purple-600 border-purple-600"
                                        : "border-border group-hover:border-muted-foreground"
                                    }`}
                                  >
                                    {selectedHotProspectorGroup?.id === group.id && (
                                      <Check className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-12 text-muted-foreground">
                              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted" />
                              <p>No Hot Prospector groups found</p>
                              <p className="text-sm">Try adjusting your search terms</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )} */}
          </div>
          <div className="bg-muted/50 p-4 flex items-center justify-between border-t border-border">
            <p className="text-sm text-muted-foreground">
              {wizardStep === 2 &&
                `${filteredGhlLocations.length} location${filteredGhlLocations.length !== 1 ? "s" : ""} available`}
              {wizardStep === 3 &&
                `${filteredMetaAdAccounts.length} ad account${filteredMetaAdAccounts.length !== 1 ? "s" : ""} available`}
              {/* {wizardStep === 4 &&
                        `${filteredHotProspectorGroups.length} group${filteredHotProspectorGroups.length !== 1 ? "s" : ""} available`} */}
            </p>
            <div className="flex items-center ">
              {wizardStep > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setWizardStep(wizardStep - 1)}
                  className="text-muted-foreground hover:bg-muted"
                >
                  Back
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setWizardOpen(false)}
                disabled={addingClientGroup}
                className="text-muted-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateClientGroup}
                disabled={addingClientGroup || (wizardStep === 1 && !clientGroupName)}
                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
              >
                {addingClientGroup ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : wizardStep < 3 ? (
                  <>
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Next
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Client Group
                  </>
                )}
              </Button>
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
                <p className="text-xs text-[#71658B] text-muted-foreground ">
                  <span className="text-green-500 text-[0.75rem] leading-4">+8%</span>
                  <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
                </p>
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
              <p className="text-xs text-[#71658B] text-muted-foreground ">
                <span className="text-green-500 text-[0.75rem] leading-4">+15%</span>
                <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
              </p>
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
                  {getSymbolFromCurrency(userCurrency)}{stats.totalLeads.toLocaleString('en-US',{ minimumFractionDigits:2,maximumFractionDigits:2})}
                  </div>
              )}
              <p className="text-xs text-[#71658B] text-muted-foreground ">
                <span className="text-green-500 text-[0.75rem] leading-4">+12%</span>
                <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
              </p>
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
              <p className="text-xs text-[#71658B] text-muted-foreground ">
                <span className="text-green-500 text-[0.75rem] leading-4">-5%</span>
                <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 🔥 KEY FIX: Pass getTagCount function to StyledTable */}
        <StyledTable
          data={clientGroups}
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
        />
      </div>

    </div>
  )
}