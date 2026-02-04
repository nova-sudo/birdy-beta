"use client"

import { useState, useEffect } from "react"
import { saveToCache, getFromCache, clearCache } from "@/utils/cacheHelper"
import { Loading } from "@/components/ui/loader"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Users,
  Phone,
  Eye,
  Settings2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Building2,
  Clock,
  Play,
  Download,
  User,
  Mail,
  Construction
} from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import ghl from "../../../public/ghl.png";
import HP from "../../../public/hp_icon.png";

// Call Logs Dialog Component
function CallLogsDialog({ lead }) {
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent hover:bg-muted/50 transition-colors">
          <Phone className="h-4 w-4" />
          {lead.call_logs_count} {lead.call_logs_count === 1 ? "call" : "calls"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white from-background via-background to-muted/10">
        {/* Header Section */}
        <div className="pb-6 border-b">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-2xl font-bold text-foreground">{lead.name}</DialogTitle>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-purple-500" />
                <span>{lead.email}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 text-purple-500" />
                <span>{lead.phone}</span>
              </div>
            </div>
            <div className="pt-2 flex items-center gap-2">
              <Badge
                className={`${
                  lead.call_logs_count > 0
                    ? "bg-purple-50/80 text-purple-700 border-purple-200"
                    : "bg-gray-100/80 text-gray-700 border-gray-200"
                } border text-xs font-medium`}
                variant="outline"
              >
                {lead.call_logs_count > 0
                  ? `${lead.call_logs_count} ${lead.call_logs_count === 1 ? "call" : "calls"}`
                  : "No calls"}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Main Content */}
        {lead.call_logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Call Logs Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              No recorded calls for this lead. Once calls are made, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-6">
            {lead.call_logs.map((callLog, index) => (
              <div
                key={index}
                className="group relative p-5 rounded-lg border border-border bg-card hover:border-purple-200 hover:shadow-md hover:bg-card/95 transition-all duration-200"
              >
                {/* Call Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-purple-100/80 flex items-center justify-center">
                      <User className="h-5 w-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{callLog.caller_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {callLog.call_time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      className={`${
                        callLog.call_status === "outbound"
                          ? "bg-blue-100/80 text-blue-700 border-blue-200"
                          : "bg-green-100/80 text-green-700 border-green-200"
                      } border text-xs font-medium`}
                      variant="outline"
                    >
                      {callLog.call_status === "outbound" ? "📤 Outbound" : "📥 Inbound"}
                    </Badge>
                    {callLog.transfer && (
                      <Badge
                        variant="outline"
                        className="bg-amber-100/80 text-amber-700 border-amber-200 text-xs font-medium"
                      >
                        ↗ Transferred
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Call Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</p>
                    <p className="text-sm font-semibold text-foreground">{formatDuration(callLog.duration)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Speed to Lead</p>
                    <p className="text-sm font-semibold text-foreground">{formatDuration(callLog.speed_to_lead)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Group</p>
                    <p className="text-sm font-semibold text-foreground">{callLog.group}</p>
                  </div>
                  <div className="space-y-1 col-span-2 md:col-span-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location</p>
                    <p className="text-sm font-semibold text-foreground truncate">{callLog.location_name}</p>
                  </div>
                </div>

                {/* Phone Numbers */}
                <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">From</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{callLog.from_number}</p>
                  </div>
                  <div className="text-muted-foreground/30">→</div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">To</p>
                    <p className="font-mono text-sm font-semibold text-foreground">{callLog.to_number}</p>
                  </div>
                </div>

                {/* Recording Controls */}
                {callLog.recording_url && (
                  <div className="flex gap-2 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors bg-transparent"
                    >
                      <a href={callLog.recording_url} target="_blank" rel="noopener noreferrer">
                        <Play className="h-4 w-4 mr-2" />
                        Play Recording
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex-1 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors bg-transparent"
                    >
                      <a href={callLog.recording_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function CallCenterPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("leads")
  const [leads, setLeads] = useState([])
  const [members, setMembers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(13)
  const [error, setError] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
    client: true,
    ghlLocation: true,
    name: true,
    email: true,
    phone: true,
    company: true,
    location: true,
    calls: true,
    status: true,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const [leadsPerPage] = useState(100)
  const [locationStats, setLocationStats] = useState({})

  // Fetch leads on mount
  useEffect(() => {
    fetchAllLeads()
    fetchMembers()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500)
    return () => clearTimeout(timer)
  }, [])

  // Save active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("activeTab", activeTab)
  }, [activeTab])




const fetchAllLeads = async (page = 1, forceRefresh = false) => {
  try {
    setIsLoading(true)
    setError(null)

    // ❌ REMOVE: No more client-side cache checking
    // const cacheKey = `hotprospector-leads-page-${page}`
    // const cachedData = getFromCache(cacheKey)

    const skip = (page - 1) * leadsPerPage

    if (page === 1) {
      toast.loading("Loading leads from server...", { id: "fetch-leads" })
    }

    // ✅ ALWAYS fetch from server - it handles cache internally
    const endpoint = forceRefresh
      ? "https://birdy-backend.vercel.app/api/hotprospector/leads/refresh"
      : `https://birdy-backend.vercel.app/api/hotprospector/leads?skip=${skip}&limit=${leadsPerPage}&include_call_logs=true`

    const response = await fetch(endpoint, {
      credentials: "include",
    })

    if (!response.ok) {
      throw new Error("Failed to fetch leads")
    }

    const data = await response.json()

    // Transform the lead data
    const mappedLeads = (data.data || []).map((lead) => ({
      id: lead.id,
      client: lead.client_name || "Unknown Client",
      ghlLocation: lead.ghl_location_name || "Unknown Location",
      ghlLocationId: lead.ghl_location_id,
      name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A",
      email: lead.email || "N/A",
      phone:
        lead.phone || lead.mobile 
          ? `${lead.country_code || ""}${lead.mobile || lead.phone || ""}`.trim() 
          : "N/A",
      company: lead.company || "N/A",
      location: [lead.city, lead.state, lead.country_code].filter(Boolean).join(", ") || "N/A",
      tags: lead.tags || [],
      status: "Active",
      call_logs_count: lead.call_logs_count || 0,
      call_logs: lead.call_logs || [],
    }))

    // ❌ REMOVE: No more client-side caching
    // saveToCache(cacheKey, { leads: mappedLeads, total: data.meta?.total || 0 })

    setLeads(mappedLeads)
    setTotalLeads(data.meta?.total || 0)
    setCurrentPage(page)
    setLocationStats(data.meta?.location_stats || {})

    const totalCalls = data.meta?.total_calls || 0
    const cacheStatus = data.meta?.cache_status || "unknown"
    const freshFromCache = data.meta?.fresh_from_cache || 0
    const fetchedFresh = data.meta?.fetched_fresh || 0

    // Show cache info in toast
    let toastMessage = ""
    if (forceRefresh) {
      toastMessage = `Refreshed ${mappedLeads.length} leads with ${totalCalls} calls`
    } else {
      if (cacheStatus === "full_cache") {
        toastMessage = `✨ Loaded ${mappedLeads.length} leads from cache (instant)`
      } else if (cacheStatus === "partial_cache") {
        toastMessage = `Loaded ${mappedLeads.length} leads (${freshFromCache} cached, ${fetchedFresh} fresh)`
      } else {
        toastMessage = `Loaded ${mappedLeads.length} fresh leads with ${totalCalls} calls`
      }
    }

    toast.success(toastMessage, { id: "fetch-leads" })

    console.log("[HotProspector] Fetched leads:", {
      page,
      returned: mappedLeads.length,
      total: data.meta?.total,
      cacheStatus,
      freshFromCache,
      fetchedFresh,
      responseTime: data.meta?.response_time_ms,
    })

  } catch (err) {
    console.error("Error fetching leads:", err)
    setError(err.message)
    toast.error("Failed to fetch leads. Please check your HotProspector connection.", { 
      id: "fetch-leads" 
    })
  } finally {
    setIsLoading(false)
    setIsRefreshing(false)
  }
}

// ❌ REMOVE: prefetchRemainingPages function entirely
// We don't need client-side prefetching anymore

const fetchMembers = async (forceRefresh = false) => {
  try {
    // ❌ REMOVE: Client cache check
    // const cachedMembers = getFromCache('hotprospector-members')

    const response = await fetch(
      "https://birdy-backend.vercel.app/api/hotprospector/members", 
      { credentials: "include" }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch members")
    }

    const data = await response.json()
    const mappedMembers = (data.data || []).map((member) => ({
      id: member.memberId,
      name: `${member.first_name} ${member.last_name}`.trim(),
      email: member.email,
      phone: member.mobile || member.inbound_phone || "N/A",
      extension: member.phone_extension,
      status: member.member_status,
      title: member.title,
      company: member.company,
      country: member.country,
    }))

    // ❌ REMOVE: Client cache save
    // saveToCache('hotprospector-members', mappedMembers)

    setMembers(mappedMembers)

    if (forceRefresh) {
      toast.success("Members refreshed")
    }

    console.log("[HotProspector] Fetched members:", mappedMembers.length)
  } catch (err) {
    console.error("Error fetching members:", err)
    if (forceRefresh) {
      toast.error("Failed to refresh members")
    }
  }
}

const handleRefresh = () => {
  setIsRefreshing(true)

  if (activeTab === "leads") {
    // Force API refresh (bypasses server cache)
    fetchAllLeads(1, true)
  } else if (activeTab === "members") {
    fetchMembers(true)
  }
}



  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1
      fetchAllLeads(newPage)
    }
  }

  const handleNextPage = () => {
    if (currentPage * leadsPerPage < totalLeads) {
      const newPage = currentPage + 1
      fetchAllLeads(newPage)
    }
  }

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.ghlLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredMembers = members.filter(
    (member) =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalPages = Math.ceil(totalLeads / leadsPerPage)
  const hasMoreLeads = currentPage * leadsPerPage < totalLeads

  // Calculate total clients
  const totalClients = Object.keys(locationStats).length

  // Calculate total calls across all leads
  const totalCalls = leads.reduce((sum, lead) => sum + lead.call_logs_count, 0)

  const UnderConstruction = ({ title, message }) => (
    <Card className="border-dashed border-2 py-24 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
      <Construction className="w-12 h-12 mb-4 opacity-20" />
      <h3 className="font-semibold text-lg text-foreground">{title}</h3>
      <p className="text-sm max-w-xs text-center">{message}</p>
    </Card>
  )

  return (
    <div className="w-[calc(100dvw-30px)] md:w-[calc(100dvw-80px)]">
      <UnderConstruction 
              title="Call Center Dashboard"
              message="This section will feature live call tracking, recording playback, and agent performance metrics."
            />
            <div className="invisible">
              <div>
        <div className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between ">

            <div className="flex  gap-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl md:text-3xl lg:text-3xl py-2 md:py-0 font-bold text-foreground text-center md:text-left whitespace-nowrap">Call Center Hub</h1>
                <p className="text-sm text-muted-foreground mt-1 text-center md:text-left">
                  Manage leads and team members from HotProspector
                </p>
              </div>
            </div>

          <div className="flex items-center justify-between gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border rounded-lg
           py-1 px-1 flex-nowrap overflow-x-auto md:gap-1 md:py-1 md:px-1">
              
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white h-10"
                />
            <div className="flex gap-1 bg-[#F3F1F9] py-1 px-1 flex-nowrap overflow-x-auto md:gap-2 lg:overflow-x-visible md:py-1  md:px-1 md:flex-nowrap">
                {activeTab === "leads" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-white h-10 font-semibold md:px-2 lg:px-3" variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2 md:mr-0 lg:mr-2" />
                        <span className="inline md:hidden lg:inline">Columns</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white">
                      {Object.keys(visibleColumns).map((column) => (
                        <DropdownMenuCheckboxItem
                          key={column}
                          checked={visibleColumns[column]}
                          onCheckedChange={(checked) => setVisibleColumns((prev) => ({ ...prev, [column]: checked }))}
                        >
                          {column === "ghlLocation"
                            ? "GHL Location"
                            : column === "calls"
                              ? "Call Logs"
                              : column.charAt(0).toUpperCase() + column.slice(1)}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                
              {/* <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="bg-white font-semibold h-10 md:px-2 lg:px-3"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 md:mr-0 lg:mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="inline md:hidden lg:inline">Refresh</span>
                </Button> */}
                <Button
                  className="bg-white font-semibold h-10 md:px-2 lg:px-3"
                  variant="outline"
                  onClick={() => router.push("/settings?tab=integrations")}
                >
                  <Settings2 className="h-4 w-4 mr-2 md:mr-0 lg:mr-2" />
                  <span className="inline md:hidden lg:inline">Settings</span>
                </Button></div>
                
              
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="bg-card rounded-lg mt-6 mb-12 ">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border rounded-lg shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-[#71658B] font-medium">Total Clients</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalClients}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground mt-1">GHL locations connected</p>
              </CardContent>
            </Card>
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-[#71658B] font-medium">Total Leads</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Phone className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalLeads}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground mt-1">Across all clients</p>
              </CardContent>
            </Card>
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-[#71658B] font-medium">Total Calls</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Phone className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCalls}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground mt-1">Call logs recorded</p>
              </CardContent>
            </Card>
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-[#71658B] font-medium">Team Members</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{members.length}</div>
                <p className="text-xs text-[#71658B] text-muted-foreground mt-1">Active call center agents</p>
              </CardContent>
            </Card>
          </div>

          {error && (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}


          <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-6 w-full">
              <TabsList className="inline-flex h-13 items-center w-full justify-start  p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
                <TabsTrigger value="leads"
                  className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white
                  data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm
                  data-[state=active]:border-r-0
                  data-[state=active]:rounded-md
                  data-[state=active]:border-b-2
                  data-[state=active]:border-b-purple-700" >
                  <Phone className="h-4 w-4 mr-2" />
                  Leads
                </TabsTrigger>
                <TabsTrigger value="members" className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white
                  data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm
                  data-[state=active]:border-r-0
                  data-[state=active]:rounded-md
                  data-[state=active]:border-b-2
                  data-[state=active]:border-b-purple-700" >
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </TabsTrigger>
              </TabsList>
            <TabsContent value="leads" className="mt-0">
            

              {isLoading ? (
                <Loading progress={progress}/>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No leads found. Make sure you have HotProspector connected and GHL locations configured.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 bg-transparent"
                    onClick={() => router.push("/settings?tab=integrations")}
                  >
                    Go to Settings
                  </Button>
                </div>
              ) : (
                <>
                  <div className="border rounded-md mt-3">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 border-r border-border">
                          {visibleColumns.name && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Name</span>
                            <Image src={HP} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                          {visibleColumns.client && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Client</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                          {visibleColumns.email && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Email</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                          {visibleColumns.phone && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Phone</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                          </div>
                          </TableHead>}
                          {visibleColumns.company && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Company</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                          {visibleColumns.location && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Location</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                          {visibleColumns.calls && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Call Logs</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                          {visibleColumns.status && <TableHead className="border-r border-border">
                            <div className="flex items-center justify-between w-full">
                            <span>Status</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                            </TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.map((lead, index) => (
                          <TableRow
                            key={lead.id || index}
                            className="hover:bg-muted/50 even:bg-white odd:bg-[#F4F3F9] h-12"
                          >
                            {visibleColumns.name && (
                              <TableCell className="font-medium">
                                {lead.name === "N/A" ? "-" : lead.name || "-"}
                              </TableCell>
                            )}

                            {visibleColumns.client && (
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {lead.client === "N/A" ? "-" : lead.client || "-"}
                                </div>
                              </TableCell>
                            )}

                            {visibleColumns.email && (
                              <TableCell>{lead.email === "N/A" ? "-" : lead.email || "-"}</TableCell>
                            )}

                            {visibleColumns.phone && (
                              <TableCell>{lead.phone === "N/A" ? "-" : lead.phone || "-"}</TableCell>
                            )}

                            {visibleColumns.company && (
                              <TableCell>{lead.company === "N/A" ? "-" : lead.company || "-"}</TableCell>
                            )}

                            {visibleColumns.location && (
                              <TableCell>{lead.location === "N/A" ? "-" : lead.location || "-"}
                              </TableCell>
                            )}

                            {visibleColumns.calls && (
                              <TableCell>
                                {lead.call_logs_count > 0 ? (
                                  <CallLogsDialog lead={lead} />
                                ) : (
                                  <span className="text-sm text-muted-foreground">No calls</span>
                                )}
                              </TableCell>
                            )}

                            {visibleColumns.status && (
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    `
                                      border-0 rounded-full font-semibold
                                      ${lead.status === "Inactive"
                                        ? "bg-[#FEE2E2] text-[#991B1B]"   // Red for inactive
                                        : "bg-[#DCFCE7] text-[#166534]"}  // Green for active
                                    `
                                  }
                                >
                                  {lead.status || "Active"}
                                </Badge>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>

                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center justify-center p-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1 || isLoading}
                        className="hover:bg-purple-200 gap-2"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="text-sm font-medium px-4">
                        Page {currentPage} of {totalPages}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!hasMoreLeads || isLoading}
                        className="hover:bg-purple-200 gap-2"
                      >
                        {isLoading ? (
                          <Progress value={33} />
                        ) : (
                          <>
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="members" className="mt-5">
              {isLoading ? (
                <Loading progress={progress}/>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No team members found</p>
                </div>
              ) : (
                <div className=" border rounded-md ">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="border-r border-border">
                          <div className="flex items-center justify-between w-full">
                            <span>Name</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                        </TableHead>
                        <TableHead className="border-r border-border">
                          <div className="flex items-center justify-between w-full">
                            <span>Email</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                        </TableHead>
                        <TableHead className="border-r border-border">
                          <div className="flex items-center justify-between w-full">
                            <span>phone</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                        </TableHead>
                        <TableHead className="border-r border-border">
                          <div className="flex items-center justify-between w-full">
                            <span>Extension</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                        </TableHead>
                        <TableHead className="border-r border-border">
                          <div className="flex items-center justify-between w-full">
                            <span>Status</span>
                            <img src={HP.src} alt="hp logo" className="w-4 h-4" />
                            </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow key={member.id} className="hover:bg-muted/50 even:bg-white odd:bg-[#F4F3F9] h-12">
                          <TableCell className="font-medium">{member.name === "N/A" ? "-" : member.name || "-"}</TableCell>
                          <TableCell>{member.email === "N/A" ? "-" : member.email || "-"}</TableCell>
                          <TableCell>{member.phone === "N/A" ? "-" : member.phone || "-"}</TableCell>
                          <TableCell>{member.extension === "N/A" ? "-" : member.extension || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={member.status === "Active" ? "default" : "secondary"} 
                            className={`
                                  border-0 rounded-full font-semibold
                                  ${member.status === "Inactive"
                                    ? "bg-[#FEE2E2] text-[#991B1B]"   // Red for inactive
                                    : "bg-[#DCFCE7] text-[#166534]"}  // Green for active
                                `
                              }>
                              {member.status === "N/A" ? "-" : member.status || "-"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
            </div>
      
    </div>
  )
}
