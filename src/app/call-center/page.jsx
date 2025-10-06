"use client"

import { useState, useEffect } from "react"
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
import { Loader2, Search, Users, FolderOpen, Phone, Eye, Settings2, AlertCircle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

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

  // Fetch groups on mount
  useEffect(() => {
    fetchGroups()
    fetchMembers()
  }, [])

  const fetchGroups = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("https://birdy-backend.vercel.app/api/hotprospector/groups", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error("Failed to fetch groups")
      }
      const data = await response.json()
      setGroups(data.data || [])
    } catch (err) {
      console.error("Error fetching groups:", err)
      setError(err.message)
      toast({
        title: "Error",
        description: "Failed to fetch groups. Please check your HotProspector connection.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGroupLeads = async (groupId) => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch(`https://birdy-backend.vercel.app/api/hotprospector/groups/${groupId}/leads`, {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error("Failed to fetch leads")
      }
      const data = await response.json()
      setLeads(data.data || [])
      setActiveTab("leads")
    } catch (err) {
      console.error("Error fetching leads:", err)
      setError(err.message)
      toast({
        title: "Error",
        description: "Failed to fetch leads for this group.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/hotprospector/members", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error("Failed to fetch members")
      }
      const data = await response.json()
      setMembers(data.data || [])
    } catch (err) {
      console.error("Error fetching members:", err)
    }
  }

  const handleGroupClick = (group) => {
    setSelectedGroup(group)
    fetchGroupLeads(group.id)
  }

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

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">Call Center</h1>
                <p className="text-sm text-muted-foreground">Manage your HotProspector groups and leads</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push("/settings?tab=integrations")}>
              <Settings2 className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="rounded-tl-2xl ring-1 ring-zinc-100 bg-card">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-border">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{groups.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leads.length}</div>
              </CardContent>
            </Card>
            <Card>
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
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
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
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Showing leads from: <span className="font-medium text-foreground">{selectedGroup.name}</span>
                  </p>
                </div>
              )}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {selectedGroup ? "No leads found in this group" : "Select a group to view leads"}
                  </p>
                </div>
              ) : (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMembers.map((member, index) => (
                    <Card key={member.id || index}>
                      <CardHeader>
                        <CardTitle className="text-base">{member.name || "N/A"}</CardTitle>
                        <CardDescription>{member.email || "N/A"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          {member.role && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Role:</span>
                              <Badge variant="outline">{member.role}</Badge>
                            </div>
                          )}
                          {member.phone && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Phone:</span>
                              <span>{member.phone}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
