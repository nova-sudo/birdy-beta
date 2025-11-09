"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Users, Phone, Eye, Settings2, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, Building2 } from "lucide-react"
import { toast } from "sonner"

// ✅ NO MORE LOCAL STORAGE CACHE - Direct API calls
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
    name: true,
    email: true,
    phone: true,
    company: true,
    location: true,
    status: true,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const [leadsPerPage] = useState(100)
  const [locationStats, setLocationStats] = useState({})

  // ✅ Fetch leads on mount
  useEffect(() => {
    fetchAllLeads()
    fetchMembers()
  }, [])

  // Save active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  const fetchAllLeads = async (page = 1, forceRefresh = false) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const skip = (page - 1) * leadsPerPage
      
      if (page === 1) {
        toast.loading('Loading leads from all clients...', { id: 'fetch-leads' })
      }
      
      // Use refresh endpoint if force refresh
      const endpoint = forceRefresh 
        ? "https://birdy-backend.vercel.app/api/hotprospector/leads/refresh"
        : `https://birdy-backend.vercel.app/api/hotprospector/leads?skip=${skip}&limit=${leadsPerPage}`
      
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
        ghlLocationId: lead.ghl_location_id,
        name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A",
        email: lead.email || "N/A",
        phone: lead.phone || lead.mobile ? `${lead.country_code || ""}${lead.mobile || lead.phone || ""}`.trim() : "N/A",
        company: lead.company || "N/A",
        location: [lead.city, lead.state, lead.country_code]
          .filter(Boolean)
          .join(", ") || "N/A",
        tags: lead.tags || [],
        status: "Active",
      }))
      
      setLeads(mappedLeads)
      setTotalLeads(data.meta?.total || 0)
      setCurrentPage(page)
      setLocationStats(data.meta?.location_stats || {})
      
      if (forceRefresh) {
        toast.success(`Refreshed ${mappedLeads.length} leads from ${data.meta?.locations_processed || 0} clients`, { id: 'fetch-leads' })
      } else {
        toast.success(`Loaded ${mappedLeads.length} leads from ${data.meta?.locations_processed || 0} clients`, { id: 'fetch-leads' })
      }
      
      console.log('[HotProspector] Fetched leads:', {
        page,
        returned: mappedLeads.length,
        total: data.meta?.total,
        locations: data.meta?.locations_processed
      })
    } catch (err) {
      console.error("Error fetching leads:", err)
      setError(err.message)
      toast.error("Failed to fetch leads. Please check your HotProspector connection.", { id: 'fetch-leads' })
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
        toast.success('Members refreshed')
      }
      
      console.log('[HotProspector] Fetched fresh members:', mappedMembers.length)
    } catch (err) {
      console.error("Error fetching members:", err)
      if (forceRefresh) {
        toast.error('Failed to refresh members')
      }
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    
    if (activeTab === 'leads') {
      // Force refresh from API (clears cache)
      fetchAllLeads(1, true)
    } else if (activeTab === 'members') {
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

  return (
    <div className="">
      <div className="">
        <div className="">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Call Center Hub</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage leads and team members from HotProspector
                </p>
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
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button className="bg-white text-semibold" variant="outline" onClick={() => router.push("/settings?tab=integrations")}>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border rounded-lg shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <div className="h-7 w-7 bg-[#713CDD1A] rounded-md text-center flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground text-purple-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalClients}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  GHL locations connected
                </p>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Across all clients
                </p>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Active call center agents
                </p>
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
                          {column.charAt(0).toUpperCase() + column.slice(1)}
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
                  <h3 className="text-sm font-medium mb-2">Leads by Client:</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(locationStats).map(([locationId, stats]) => (
                      <Badge key={locationId} variant="outline" className="text-xs">
                        {stats.name}: {stats.count} leads {stats.cached && "🟢"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Loading leads from all clients...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No leads found. Make sure you have HotProspector connected and GHL locations configured.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
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
                          {visibleColumns.name && <TableHead>Name</TableHead>}
                          {visibleColumns.email && <TableHead>Email</TableHead>}
                          {visibleColumns.phone && <TableHead>Phone</TableHead>}
                          {visibleColumns.company && <TableHead>Company</TableHead>}
                          {visibleColumns.location && <TableHead>Location</TableHead>}
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
                            {visibleColumns.name && <TableCell className="font-medium">{lead.name || "N/A"}</TableCell>}
                            {visibleColumns.email && <TableCell>{lead.email || "N/A"}</TableCell>}
                            {visibleColumns.phone && <TableCell>{lead.phone || "N/A"}</TableCell>}
                            {visibleColumns.company && <TableCell>{lead.company || "N/A"}</TableCell>}
                            {visibleColumns.location && <TableCell>{lead.location || "N/A"}</TableCell>}
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
                      Showing {((currentPage - 1) * leadsPerPage) + 1} to {Math.min(currentPage * leadsPerPage, totalLeads)} of {totalLeads} leads
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