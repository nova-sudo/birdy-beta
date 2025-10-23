"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Loader2, Search, Users, FolderOpen, Phone, Eye, Settings2, AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/loading-screen"


// ✅ CACHE UTILITY FUNCTIONS
const CACHE_DURATION = {
  groups: 60 * 60 * 1000, // 1 hour
  leads: 5 * 60 * 1000,   // 5 minutes
  members: 60 * 60 * 1000 // 1 hour
}

const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null
    
    const { data, timestamp } = JSON.parse(cached)
    const now = Date.now()
    const maxAge = CACHE_DURATION[key.split('_')[0]] || 5 * 60 * 1000
    
    if (now - timestamp < maxAge) {
      console.log(`✅ Cache hit for ${key} (age: ${Math.round((now - timestamp) / 1000)}s)`)
      return data
    }
    
    console.log(`⏰ Cache expired for ${key}`)
    localStorage.removeItem(key)
    return null
  } catch (error) {
    console.error('Cache read error:', error)
    return null
  }
}

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
    console.log(`💾 Cached ${key}`)
  } catch (error) {
    console.error('Cache write error:', error)
  }
}

const clearCache = (pattern) => {
  try {
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.includes(pattern)) {
        localStorage.removeItem(key)
      }
    })
    console.log(`🗑️ Cleared cache for pattern: ${pattern}`)
  } catch (error) {
    console.error('Cache clear error:', error)
  }
}

export default function CallCenterPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("groups")
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [leads, setLeads] = useState([])
  const [members, setMembers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
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
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // ✅ OPTIMIZED: Restore selected group from sessionStorage
  useEffect(() => {
    const savedGroup = sessionStorage.getItem('selectedGroup')
    const savedTab = sessionStorage.getItem('activeTab')
    
    if (savedGroup) {
      try {
        const group = JSON.parse(savedGroup)
        setSelectedGroup(group)
        console.log('📌 Restored selected group:', group.name)
      } catch (e) {
        console.error('Failed to restore group:', e)
      }
    }
    
    if (savedTab) {
      setActiveTab(savedTab)
    }
  }, [])

  // ✅ OPTIMIZED: Fetch groups on mount with cache
  useEffect(() => {
    fetchGroups()
    fetchMembers()
  }, [])

  // ✅ OPTIMIZED: Auto-restore leads when group is selected
  useEffect(() => {
    if (selectedGroup && activeTab === 'leads' && leads.length === 0) {
      fetchGroupLeads(selectedGroup.id, 1)
    }
  }, [selectedGroup, activeTab])

  const fetchGroups = async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = getCachedData('groups')
        if (cached) {
          setGroups(cached)
          console.log('[v0] Using cached groups:', cached.length)
          return
        }
      }

      setIsLoading(true)
      setError(null)
      
      const response = await fetch("https://birdy-backend.vercel.app/api/hotprospector/groups", {
        credentials: "include",
      })
      
      if (!response.ok) {
        throw new Error("Failed to fetch groups")
      }
      
      const data = await response.json()
      const mappedGroups = (data.data || []).map((group) => ({
        id: group.GroupId,
        name: group.GroupTitle,
        teamId: group.TeamId,
        addedBy: group.Added_by,
      }))
      
      setGroups(mappedGroups)
      setCachedData('groups', mappedGroups)
      
      if (forceRefresh) {
        toast.success('Groups refreshed')
      }
      
      console.log('[v0] Fetched fresh groups:', mappedGroups.length)
    } catch (err) {
      console.error("Error fetching groups:", err)
      setError(err.message)
      toast.error("Failed to fetch groups. Please check your HotProspector connection.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const fetchGroupLeads = async (groupId, page = 1, forceRefresh = false) => {
    try {
      const cacheKey = `leads_${groupId}_${page}`
      
      // Check cache first
      if (!forceRefresh) {
        const cached = getCachedData(cacheKey)
        if (cached) {
          if (page === 1) {
            setLeads(cached.leads)
            setTotalLeads(cached.total)
            setCurrentPage(page)
            setActiveTab("leads")
            console.log('[v0] Using cached leads:', cached.leads.length)
          } else {
            setLeads(prev => [...prev, ...cached.leads])
            setCurrentPage(page)
          }
          return
        }
      }

      setIsLoadingMore(page > 1)
      if (page === 1) {
        setIsLoading(true)
        setLeads([])
      }
      setError(null)
      
      const skip = (page - 1) * leadsPerPage
      
      // Show optimistic loading state
      if (page === 1) {
        toast.loading('Loading leads...', { id: 'fetch-leads' })
      }
      
      const response = await fetch(
        `https://birdy-backend.vercel.app/api/hotprospector/groups/${groupId}/leads?skip=${skip}&limit=${leadsPerPage}`,
        {
          credentials: "include",
        }
      )
      
      if (!response.ok) {
        throw new Error("Failed to fetch leads")
      }
      
      const data = await response.json()
      
      // Transform the lead data
      const mappedLeads = (data.data || []).map((lead) => ({
        id: lead.id,
        name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "N/A",
        email: lead.email || "N/A",
        phone: lead.phone || lead.mobile ? `${lead.country_code || ""}${lead.mobile || lead.phone || ""}`.trim() : "N/A",
        company: lead.company || "N/A",
        location: [lead.city, lead.state, lead.country_code]
          .filter(Boolean)
          .join(", ") || "N/A",
        status: "Active",
      }))
      
      // Cache the results
      setCachedData(cacheKey, {
        leads: mappedLeads,
        total: data.meta?.total || 0
      })
      
      // Update state
      if (page === 1) {
        setLeads(mappedLeads)
        setActiveTab("leads")
        toast.success(`Loaded ${mappedLeads.length} leads`, { id: 'fetch-leads' })
      } else {
        setLeads(prev => [...prev, ...mappedLeads])
        toast.success(`Loaded ${mappedLeads.length} more leads`)
      }
      
      setTotalLeads(data.meta?.total || 0)
      setCurrentPage(page)
      
      console.log('[v0] Fetched fresh leads:', {
        page,
        returned: mappedLeads.length,
        total: data.meta?.total,
        cached: data.meta?.cached
      })
    } catch (err) {
      console.error("Error fetching leads:", err)
      setError(err.message)
      toast.error("Failed to fetch leads for this group.", { id: 'fetch-leads' })
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsRefreshing(false)
    }
  }

  const fetchMembers = async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh) {
        const cached = getCachedData('members')
        if (cached) {
          setMembers(cached)
          console.log('[v0] Using cached members:', cached.length)
          return
        }
      }

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
      setCachedData('members', mappedMembers)
      
      if (forceRefresh) {
        toast.success('Members refreshed')
      }
      
      console.log('[v0] Fetched fresh members:', mappedMembers.length)
    } catch (err) {
      console.error("Error fetching members:", err)
      if (forceRefresh) {
        toast.error('Failed to refresh members')
      }
    }
  }

  const handleGroupClick = useCallback((group) => {
    setSelectedGroup(group)
    setCurrentPage(1)
    
    // Save to sessionStorage for persistence
    sessionStorage.setItem('selectedGroup', JSON.stringify(group))
    
    fetchGroupLeads(group.id, 1)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    
    if (activeTab === 'groups') {
      clearCache('groups')
      fetchGroups(true)
    } else if (activeTab === 'leads' && selectedGroup) {
      clearCache(`leads_${selectedGroup.id}`)
      fetchGroupLeads(selectedGroup.id, currentPage, true)
    } else if (activeTab === 'members') {
      clearCache('members')
      fetchMembers(true)
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 1 && selectedGroup) {
      const newPage = currentPage - 1
      fetchGroupLeads(selectedGroup.id, newPage)
    }
  }

  const handleNextPage = () => {
    if (currentPage * leadsPerPage < totalLeads && selectedGroup) {
      const newPage = currentPage + 1
      fetchGroupLeads(selectedGroup.id, newPage)
    }
  }

  // Save active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  const filteredGroups = groups.filter((group) => group.name?.toLowerCase().includes(searchQuery.toLowerCase()))

  const filteredLeads = leads.filter(
    (lead) =>
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredMembers = members.filter(
    (member) =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalPages = Math.ceil(totalLeads / leadsPerPage)
  const hasMoreLeads = currentPage * leadsPerPage < totalLeads

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Call Center</h1>
                <p className="text-sm text-muted-foreground">Manage your HotProspector groups and leads</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => router.push("/settings?tab=integrations")}>
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="bg-card rounded-lg shadow-sm border border-border">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-border">
            <Card className="border-0 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{groups.length}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalLeads || leads.length}</div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{members.length}</div>
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
                <TabsTrigger value="groups">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Groups
                </TabsTrigger>
                <TabsTrigger value="leads">
                  <Phone className="h-4 w-4 mr-2" />
                  Leads
                  {selectedGroup && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1 text-xs">
                      {selectedGroup.name.slice(0, 10)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="members">
                  <Users className="h-4 w-4 mr-2" />
                  Members
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
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

            <TabsContent value="groups" className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No groups found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGroups.map((group) => (
                    <Card
                      key={group.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedGroup?.id === group.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleGroupClick(group)}
                    >
                      <CardHeader>
                        <CardTitle className="text-base">{group.name}</CardTitle>
                        <CardDescription>ID: {group.id}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          <Eye className="h-4 w-4 mr-2" />
                          View Leads
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="leads" className="mt-0">
              {selectedGroup && (
                <div className="mb-4 p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing leads from: <span className="font-medium text-foreground">{selectedGroup.name}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({totalLeads} total leads)
                  </p>
                </div>
              )}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">Loading leads...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {selectedGroup ? "No leads found in this group" : "Select a group to view leads"}
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
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
                        disabled={currentPage === 1 || isLoadingMore}
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
                        disabled={!hasMoreLeads || isLoadingMore}
                      >
                        {isLoadingMore ? (
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