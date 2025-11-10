"use client"

import { useState, useEffect } from "react"
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
  Loader2,
  Users,
  Phone,
  Eye,
  Settings2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Building2,
  MapPin,
  Clock,
  Play,
  Download,
  User,
  Mail,
} from "lucide-react"
import { toast } from "sonner"

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

  // Save active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("activeTab", activeTab)
  }, [activeTab])

  const fetchAllLeads = async (page = 1, forceRefresh = false) => {
    try {
      setIsLoading(true)
      setError(null)

      const skip = (page - 1) * leadsPerPage

      if (page === 1) {
        toast.loading("Loading leads with call logs from all clients...", { id: "fetch-leads" })
      }

      // Use refresh endpoint if force refresh
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
          lead.phone || lead.mobile ? `${lead.country_code || ""}${lead.mobile || lead.phone || ""}`.trim() : "N/A",
        company: lead.company || "N/A",
        location: [lead.city, lead.state, lead.country_code].filter(Boolean).join(", ") || "N/A",
        tags: lead.tags || [],
        status: "Active",
        call_logs_count: lead.call_logs_count || 0,
        call_logs: lead.call_logs || [],
      }))

      setLeads(mappedLeads)
      setTotalLeads(data.meta?.total || 0)
      setCurrentPage(page)
      setLocationStats(data.meta?.location_stats || {})

      const totalCalls = data.meta?.total_calls || 0

      if (forceRefresh) {
        toast.success(
          `Refreshed ${mappedLeads.length} leads with ${totalCalls} call logs from ${data.meta?.locations_processed || 0} locations`,
          { id: "fetch-leads" },
        )
      } else {
        toast.success(
          `Loaded ${mappedLeads.length} leads with ${totalCalls} call logs from ${data.meta?.locations_processed || 0} locations`,
          { id: "fetch-leads" },
        )
      }

      console.log("[HotProspector] Fetched leads:", {
        page,
        returned: mappedLeads.length,
        total: data.meta?.total,
        locations: data.meta?.locations_processed,
        locationStats: data.meta?.location_stats,
        totalCalls,
      })
    } catch (err) {
      console.error("Error fetching leads:", err)
      setError(err.message)
      toast.error("Failed to fetch leads. Please check your HotProspector connection.", { id: "fetch-leads" })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const fetchMembers = async (forceRefresh = false) => {
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/hotprospector/members", {
        credentials: "include",
      })

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

      setMembers(mappedMembers)

      if (forceRefresh) {
        toast.success("Members refreshed")
      }

      console.log("[HotProspector] Fetched fresh members:", mappedMembers.length)
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
      // Force refresh from API (clears cache)
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

  return (
    <div className="">
      <div className="">
        <div className="">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Call Center Hub</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage leads and team members from HotProspector</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-[#F3F1F9] ring-1 ring-inset ring-gray-100 border padding-4px rounded-lg py-1 px-1">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 bg-white"
                />
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="bg-white text-semibold"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  className="bg-white text-semibold"
                  variant="outline"
                  onClick={() => router.push("/settings?tab=integrations")}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="">
        <div className="bg-card rounded-lg mt-6 mb-12">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalClients}</div>
                <p className="text-xs text-muted-foreground mt-1">GHL locations connected</p>
              </CardContent>
            </Card>
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Phone className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all clients</p>
              </CardContent>
            </Card>
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Phone className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCalls}</div>
                <p className="text-xs text-muted-foreground mt-1">Call logs recorded</p>
              </CardContent>
            </Card>
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{members.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Active call center agents</p>
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="p-6">
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="leads">
                  <Phone className="h-4 w-4 mr-2" />
                  Leads
                  {totalLeads > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
                      {totalLeads}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="members">
                  <Users className="h-4 w-4 mr-2" />
                  Members
                  {members.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-2 text-xs">
                      {members.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                {activeTab === "leads" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
              </div>
            </div>

            <TabsContent value="leads" className="mt-0">
              {/* Client breakdown summary */}
              {Object.keys(locationStats).length > 0 && (
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">Leads by Location:</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(locationStats).map(([locationId, stats]) => (
                      <Badge key={locationId} variant="outline" className="text-xs">
                        {stats.client_group_name || stats.name}: {stats.count} leads {stats.cached && "🟢"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Loading leads with call logs from all clients...</p>
                </div>
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
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          {visibleColumns.client && <TableHead>Client</TableHead>}
                          {visibleColumns.ghlLocation && <TableHead>GHL Location</TableHead>}
                          {visibleColumns.name && <TableHead>Name</TableHead>}
                          {visibleColumns.email && <TableHead>Email</TableHead>}
                          {visibleColumns.phone && <TableHead>Phone</TableHead>}
                          {visibleColumns.company && <TableHead>Company</TableHead>}
                          {visibleColumns.location && <TableHead>Location</TableHead>}
                          {visibleColumns.calls && <TableHead>Call Logs</TableHead>}
                          {visibleColumns.status && <TableHead>Status</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLeads.map((lead, index) => (
                          <TableRow key={lead.id || index} className="hover:bg-muted/50">
                            {visibleColumns.client && (
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {lead.client || "Unknown"}
                                </div>
                              </TableCell>
                            )}
                            {visibleColumns.ghlLocation && (
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">{lead.ghlLocation || "Unknown"}</span>
                                </div>
                              </TableCell>
                            )}
                            {visibleColumns.name && <TableCell className="font-medium">{lead.name || "N/A"}</TableCell>}
                            {visibleColumns.email && <TableCell>{lead.email || "N/A"}</TableCell>}
                            {visibleColumns.phone && <TableCell>{lead.phone || "N/A"}</TableCell>}
                            {visibleColumns.company && <TableCell>{lead.company || "N/A"}</TableCell>}
                            {visibleColumns.location && <TableCell>{lead.location || "N/A"}</TableCell>}
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
                                <Badge variant="outline">{lead.status || "Active"}</Badge>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * leadsPerPage + 1} to{" "}
                      {Math.min(currentPage * leadsPerPage, totalLeads)} of {totalLeads} leads
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1 || isLoading}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <div className="text-sm font-medium px-4">
                        Page {currentPage} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={!hasMoreLeads || isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
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

            <TabsContent value="members" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No team members found</p>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Extension</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMembers.map((member) => (
                        <TableRow key={member.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell>{member.phone}</TableCell>
                          <TableCell>{member.extension}</TableCell>
                          <TableCell>
                            <Badge variant={member.status === "Active" ? "default" : "secondary"}>
                              {member.status}
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
  )
}
