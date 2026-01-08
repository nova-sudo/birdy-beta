"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import { AlertCircle, ArrowLeft, Building2, Plus, Check, ChevronRight, RefreshCw, Users, DollarSign, UserCheck, Target } from "lucide-react"
import { toast } from "sonner"
import { ClientGroupsTable } from "@/components/client-groups-table"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react" 
import { CiCalendar } from "react-icons/ci";
import { loadCustomMetrics, evaluateFormula, formatMetricValue } from "@/lib/metrics"
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
import ghl from "../../../public/ghl_icon.png";
import metaa from "../../../public/meta-icon-DH8jUhnM.png";
import HP from "../../../public/hotprospector-icon-BwyOjGPv.png";
import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { Progress } from "@/components/ui/progress"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Loading } from "@/components/ui/loader"


const CACHE_DURATION = {
  clientGroups: 120 * 60 * 1000,
  ghlLocations: 60 * 60 * 1000,
  metaAdAccounts: 60 * 60 * 1000,
  hotProspectorGroups: 60 * 60 * 1000,
}

const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const now = Date.now()
    const maxAge = CACHE_DURATION[key] || 5 * 60 * 1000

    if (now - timestamp < maxAge) {
      console.log(`✅ Cache hit for ${key} (age: ${Math.round((now - timestamp) / 1000)}s)`)
      return data
    }

    console.log(`⏰ Cache expired for ${key}`)
    localStorage.removeItem(key)
    return null
  } catch (error) {
    console.error("Cache read error:", error)
    return null
  }
}



const clearCache = (pattern) => {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key)
      }
    })
    console.log(`🗑️ Cleared cache for pattern: ${pattern}`)
  } catch (error) {
    console.error("Cache clear error:", error)
  }
}

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
  const [selectedDateRange, setSelectedDateRange] = useState("all")
  const [progress, setProgress] = useState(13)


  
  const [customMetrics, setCustomMetrics] = useState([]);
  const DEFAULT_COLUMNS = [
    { id: "name", label: "Business Name", visible: true, sortable: true },
    { id: "ghl_contacts", label: "GHL Leads", visible: true, sortable: true, icons: ghl },
    { id: "meta_campaigns", label: "Campaigns", visible: true, sortable: true, icons: metaa },
    { id: "meta_spend", label: "Ad Spend", visible: true, sortable: true, icons: metaa },
    { id: "meta_ctr", label: "CTR", visible: true, sortable: true, icons: metaa },
    { id: "meta_cpc", label: "CPC", visible: true, sortable: true, icons: metaa },
    { id: "meta_leads", label: "Meta Leads", visible: true, sortable: true, icons: metaa },
    { id: "hp_leads", label: "HP Leads", visible: true, sortable: true, icons: HP },
    { id: "meta_impressions", label: "Impressions", visible: true, sortable: true, icons: metaa },
    { id: "meta_clicks", label: "Clicks", visible: true, sortable: true, icons: metaa },
    { id: "meta_reach", label: "Reach", visible: true, sortable: true, icons: metaa },
    { id: "meta_cpm", label: "CPM", visible: true, sortable: true, icons: metaa },
  ];
    const columns = useMemo(() => {
      const base = DEFAULT_COLUMNS.map((col) => ({ ...col }));
  
      const custom = customMetrics
        .filter((m) => m.enabled && m.dashboard === "Clients")
        .map((m) => ({
          id: m.id,
          label: m.name,
          visible: true,
          sortable: true,
        }));
  
      const seen = new Set();
      const all = [...base, ...custom];
      return all.filter((col) => {
        if (seen.has(col.id)) return false;
        seen.add(col.id);
        return true;
      });
    }, [customMetrics]);
  const [columnVisibility, setColumnVisibility] = useState(() => {
    const map = {};
    DEFAULT_COLUMNS.forEach((c) => (map[c.id] = c.visible));
    return map;
  });
  const [searchQuery, setSearchQuery] = useState("")
  const toggleColumnVisibility = (columnId) => {
    if (columnId === "name") return;
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: !(prev[columnId] ?? true),
    }));
  };
    
  
  useEffect(() => {
    fetchClientGroups()
  }, [])

   useEffect(() => {
    const intervals = [33, 50, 66, 80, 90];
    let step = 0;

    const timer = setInterval(() => {
      setProgress(intervals[step]);
      step += 1;
      if (step >= intervals.length) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (wizardOpen && wizardStep > 1) {
      if (wizardStep === 2) fetchGhlLocations()
      if (wizardStep === 3) fetchMetaAdAccounts()
    }
  }, [wizardOpen, wizardStep])

const fetchClientGroups = async (forceRefresh = false) => {
    try {
      // Remove local cache logic - always fetch from server
      // Server now uses database cache (max 1 hour old)
      
      setLoading(true)
      setError("")

      const response = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch client groups: ${response.status}`)
      }

      const data = await response.json()
      const groups = data.client_groups || []

      setClientGroups(groups)

      if (forceRefresh) {
        toast.success("Client groups refreshed")
      }

      console.log("[v0] Fetched client groups:", groups.length)
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

      const response = await fetch("https://birdy-backend.vercel.app/api/subaccount/locations", {
        credentials: "include",
      })


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
      const response = await fetch("https://birdy-backend.vercel.app/api/facebook/adaccounts", {
        credentials: "include",
      })

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
    fetchClientGroups(true)
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
    // if (wizardStep === 4 && !selectedHotProspectorGroup && hotProspectorGroups.length > 0) {
    //   toast.error("Please select a Hot Prospector group or skip this step")
    //   return
    // }

    if (wizardStep < 3) {
      setWizardStep(wizardStep + 1)
      return
    }

    // Create temporary ID for optimistic update
    const tempId = `temp_${Date.now()}`
    
    // Create optimistic group object
    const optimisticGroup = {
      id: tempId,
      name: clientGroupName,
      ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId || null,
      meta_ad_account_id: selectedMetaAdAccount?.id || null,
      notes: "",
      created_at: new Date().toISOString(),
      _isCreating: true, // Flag to show creating state
      gohighlevel: {},
      facebook: {},
      hotprospector: {}
    }

    // Add optimistic group to the list immediately
    setClientGroups(prev => [optimisticGroup, ...prev])

    // Close wizard and reset form
    setWizardOpen(false)
    setWizardStep(1)
    const creatingGroupName = clientGroupName // Save for toast
    setClientGroupName("")
    setSelectedGhlLocation(null)
    setNewGhlLocationId("")
    setSelectedMetaAdAccount(null)
    setSelectedHotProspectorGroup(null)
    setLocationSearchQuery("")
    setMetaSearchQuery("")
    setHotProspectorSearchQuery("")

    toast.info(`Creating "${creatingGroupName}"...`)

    // Make API call in background
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: creatingGroupName,
          ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId || null,
          meta_ad_account_id: selectedMetaAdAccount?.id || null,
          hotprospector_group_id: selectedHotProspectorGroup?.id || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // Replace optimistic group with real data
        setClientGroups(prev => 
          prev.map(group => 
            group.id === tempId ? { ...data.client_group, _isCreating: false } : group
          )
        )
        
        toast.success(`"${creatingGroupName}" created successfully!`)
        clearCache("clientGroups")
        clearCache("ghlLocations")
      } else {
        const data = await response.json()
        
        // Remove optimistic group on error
        setClientGroups(prev => prev.filter(group => group.id !== tempId))
        
        toast.error(data.detail || "Failed to create client group")
      }
    } catch (err) {
      console.error("[v0] Error creating client group:", err)
      
      // Remove optimistic group on error
      setClientGroups(prev => prev.filter(group => group.id !== tempId))
      
      toast.error("Failed to create client group")
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

  // Calculate statistics from clientGroups
  const calculateStats = () => {
    const activeClients = clientGroups.length
    
    const totalSpend = clientGroups.reduce((sum, group) => {
      const spend = parseFloat(group.facebook?.metrics?.insights?.spend) || 0
      return sum + spend
    }, 0)
    
    const totalLeads = clientGroups.reduce((sum, group) => {
      const metaLeads = parseInt(group.facebook?.metrics?.total_leads) || 0
      const ghlContacts = parseInt(group.gohighlevel?.metrics?.total_contacts) || 0
      const hpLeads = parseInt(group.hotprospector?.metrics?.total_leads) || 0
      return sum + metaLeads + ghlContacts + hpLeads
    }, 0)
    
    const averageCPL = totalLeads > 0 ? totalSpend / totalLeads : 0

    return {
      activeClients,
      totalSpend,
      totalLeads,
      averageCPL
    }
  }

  const stats = calculateStats()

  if (loading) {
      return (
        <Loading progress={progress} />
      )
    }

  return (
    <div className="min-h-dvh w-[calc(100dvw-30px)] md:w-[calc(100dvw-100px)] mx-auto bg-white gap-6">
      <div className="bg-card">
        <div className="h-auto mx-auto">
          <div className="flex flex-col sm:flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex gap-4 flex flex-col py-2 md:py-0 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">
                Client Hub
                </h1>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg
            py-1 px-1 flex-nowrap overflow-x-auto md:gap-1 md:py-1 md:px-1">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-gray-900 bg-white h-10 font-bold text-xs md:text-base"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-1 md:gap-2 px-2 md:px-4 font-semibold bg-white h-10 text-sm md:text-base">
                      <Eye className="h-4 w-4" />
                      <span className="hidden lg:inline">Columns</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white">
                    {columns.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.id === "name" ? true : columnVisibility[col.id] ?? col.visible}
                        onCheckedChange={() => toggleColumnVisibility(col.id)}
                        disabled={col.id === "name"}
                      >
                        {columnVisibility[col.id] ?? col.visible ? (
                          <Eye className="h-4 w-4 mr-2" />
                        ) : (
                          <EyeOff className="h-4 w-4 mr-2" />
                        )}
                        {col.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
              
              <Button variant="outline" className="flex items-center gap-1 md:gap-2 px-2 md:px-4 font-semibold bg-white h-10 text-sm md:text-base" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden lg:inline ">Refresh</span>
              </Button>
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
                 {/* Date Range Filter */}
                <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                  <SelectTrigger className="bg-white gap-1 md:gap-2 px-2 md:px-4 md:text-base font-semibold h-10">
                    <CiCalendar/>
                    <span className="hidden md:inline">
                      <SelectValue placeholder="All Time"  />
                    </span>
                  </SelectTrigger>
                <SelectContent className="bg-white">
                    <SelectItem value="all" className="hover:bg-[#E8DFFB]">All Time</SelectItem> 
                    <SelectItem value="today" className="hover:bg-[#E8DFFB]">Today</SelectItem>
                    <SelectItem value="week" className="hover:bg-[#E8DFFB]">Last 7 Days</SelectItem>
                    <SelectItem value="month" className="hover:bg-[#E8DFFB]">Last 30 Days</SelectItem>
                    <SelectItem value="year" className="hover:bg-[#E8DFFB]">Last Year</SelectItem>
                  </SelectContent>
                </Select>

                {/* Add client */}
                <Button
                  onClick={() => setWizardOpen(true)}
                  className="bg-[#713CDD] inline-flex items-center justify-center h-10 px-4 py-2 text-white rounded-lg gap-2"
                >
                   <Plus className="h-4 w-4 border rounded-full border-2" />
                </Button>
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
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group ${
                                  selectedGhlLocation?.locationId === location.locationId
                                    ? "border-purple-500 bg-purple-50 shadow-md"
                                    : "border-border hover:border-muted-foreground bg-card"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3
                                        className={`font-semibold truncate ${
                                          selectedGhlLocation?.locationId === location.locationId
                                            ? "text-purple-900"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {location.name || "Unnamed Location"}
                                      </h3>
                                    </div>
                                    <p
                                      className={`text-xs font-mono ${
                                        selectedGhlLocation?.locationId === location.locationId
                                          ? "text-purple-600"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      ID: {location.locationId}
                                    </p>
                                  </div>
                                  <div
                                    className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                      selectedGhlLocation?.locationId === location.locationId
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
                                className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group ${
                                  selectedMetaAdAccount?.id === account.id
                                    ? "border-purple-500 bg-purple-50 shadow-md"
                                    : "border-border hover:border-muted-foreground bg-card"
                                }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <h3
                                        className={`font-semibold truncate ${
                                          selectedMetaAdAccount?.id === account.id
                                            ? "text-purple-900"
                                            : "text-foreground"
                                        }`}
                                      >
                                        {account.name || "Unnamed Ad Account"}
                                      </h3>
                                    </div>
                                    <p
                                      className={`text-xs font-mono ${
                                        selectedMetaAdAccount?.id === account.id
                                          ? "text-purple-600"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      ID: {account.id}
                                    </p>
                                  </div>
                                  <div
                                    className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                      selectedMetaAdAccount?.id === account.id
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
                        {selectedHotProspectorGroup && (
                          <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                            <div className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-purple-600" />
                              <span className="text-sm font-medium text-purple-900">
                                Selected: {selectedHotProspectorGroup.name || "Unnamed Group"}
                              </span>
                            </div>
                          </div>
                        )}
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
            </div>
          </div>
        </div>
      </div>

      <div className="w-full mx-auto py-6 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Active Clients */}
          <Card className="border rounded-lg shadow-sm ">
            <CardContent className="">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm text-[#71658B]">Total Active Clients</p>
                  <h3 className="text-2xl font-bold mt-1">
                    {stats.activeClients}</h3>
                  <div className="flex items-center mt-1">
                    <span className="text-green-500 text-[0.75rem] leading-4">+8%</span>
                    <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
                  </div>
                </div>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Users className="h-4 w-4 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Ad Spend */}
          <Card>
            <CardContent className="">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm text-[#71658B]">Total Ad Spend</p>
                  <h3 className="text-2xl font-bold mt-1">
                    ${stats.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <div className="flex items-center mt-1">
                    <span className="text-green-500 text-[0.75rem] leading-4">+12%</span>
                    <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
                  </div>
                </div>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Leads */}
          <Card>
            <CardContent className="">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm text-[#71658B]">Total Leads</p>
                  <h3 className="text-2xl font-bold mt-1">{stats.totalLeads.toLocaleString()}</h3>
                  <div className="flex items-center mt-1">
                    <span className="text-green-500 text-[0.75rem] leading-4">+15%</span>
                    <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
                  </div>
                </div>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <UserCheck className="h-4 w-4 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average CPL */}
          <Card>
            <CardContent className="">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground text-sm text-[#71658B]">Average CPL</p>
                  <h3 className="text-2xl font-bold mt-1">
                    ${stats.averageCPL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h3>
                  <div className="flex items-center mt-1">
                    <span className="text-destructive text-[0.75rem] leading-4 text-[#EF4343]">-3%</span>
                    <span className="text-muted-foreground ml-1 text-[0.75rem] leading-4 text-[#71658B]">vs. last period</span>
                  </div>
                </div>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Target className="h-4 w-4 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Groups Table */}
        <ClientGroupsTable 
          data={clientGroups} 
          onRowClick={handleClientGroupClick} 
          columns={columns} 
          searchQuery={searchQuery}
          columnVisibility={columnVisibility} 
          customMetrics={customMetrics} 
          setCustomMetrics={setCustomMetrics}
        /> 

      </div>
    </div>
  )
}