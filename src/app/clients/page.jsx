"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog"
import { Search, AlertCircle, ArrowLeft, Building2, MapPin, Facebook, Plus, Check, ChevronRight, Users } from "lucide-react"
import { toast } from "sonner"

export default function ClientsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [clientGroups, setClientGroups] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
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

  useEffect(() => {
    fetchClientGroups()
  }, [])

  useEffect(() => {
    if (wizardOpen && wizardStep > 1) {
      if (wizardStep === 2) fetchGhlLocations()
      if (wizardStep === 3) fetchMetaAdAccounts()
      if (wizardStep === 4) fetchHotProspectorGroups()
    }
  }, [wizardOpen, wizardStep])

  const fetchClientGroups = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
        credentials: "include",
      })
      if (response.status === 401) {
        router.push("/login")
        return
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch client groups: ${response.status}`)
      }
      const data = await response.json()
      setClientGroups(data.client_groups || [])
    } catch (err) {
      console.error("[v0] Error fetching client groups:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchGhlLocations = async () => {
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/subaccount/locations", {
        credentials: "include",
      })
      if (response.status === 401) {
        router.push("/login")
        return
      }
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] GHL Locations Response:", data)
        const locations = data.locations || []
        setGhlLocations(locations)
        if (locations.length === 0) {
          toast({
            title: "Warning",
            description: "No GHL locations found. Please enter a location ID or skip this step.",
            variant: "warning",
          })
        }
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.detail || "Failed to fetch GHL locations",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("[v0] Error fetching GHL locations:", err)
      toast({
        title: "Error",
        description: "Failed to fetch GHL locations",
        variant: "destructive",
      })
    }
  }

  const fetchMetaAdAccounts = async () => {
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/facebook/adaccounts", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setMetaAdAccounts(data.data?.data || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch Meta ad accounts",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("[v0] Error fetching Meta ad accounts:", err)
      toast({
        title: "Error",
        description: "Failed to fetch Meta ad accounts",
        variant: "destructive",
      })
    }
  }

  const fetchHotProspectorGroups = async () => {
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/hotprospector/groups", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        const normalizedGroups = (data.data || []).map(group => ({
          id: group.GroupId,
          name: group.GroupTitle,
          teamId: group.TeamId,
          addedBy: group.Added_by
        }))
        setHotProspectorGroups(normalizedGroups)
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch Hot Prospector groups",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("[v0] Error fetching Hot Prospector groups:", err)
      toast({
        title: "Error",
        description: "Failed to fetch Hot Prospector groups",
        variant: "destructive",
      })
    }
  }

  const handleCreateClientGroup = async () => {
    if (!clientGroupName) {
      toast({
        title: "Error",
        description: "Please enter a client group name",
        variant: "destructive",
      })
      return
    }
    if (wizardStep === 2 && !selectedGhlLocation && !newGhlLocationId && ghlLocations.length > 0) {
      toast({
        title: "Error",
        description: "Please select a GHL location, enter a location ID, or skip this step",
        variant: "destructive",
      })
      return
    }
    if (wizardStep === 3 && !selectedMetaAdAccount && metaAdAccounts.length > 0) {
      toast({
        title: "Error",
        description: "Please select a Meta ad account or skip this step",
        variant: "destructive",
      })
      return
    }
    if (wizardStep === 4 && !selectedHotProspectorGroup && hotProspectorGroups.length > 0) {
      toast({
        title: "Error",
        description: "Please select a Hot Prospector group or skip this step",
        variant: "destructive",
      })
      return
    }

    if (wizardStep < 4) {
      setWizardStep(wizardStep + 1)
      return
    }

    console.log("[v0] Creating client group with:", {
      clientGroupName,
      ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId,
      meta_ad_account_id: selectedMetaAdAccount?.id,
      hotprospector_group_id: selectedHotProspectorGroup?.id
    })

    setAddingClientGroup(true)
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/client-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: clientGroupName,
          ghl_location_id: newGhlLocationId || selectedGhlLocation?.locationId || null,
          meta_ad_account_id: selectedMetaAdAccount?.id || null,
          hotprospector_group_id: selectedHotProspectorGroup?.id || null,
        }),
      })
      if (response.ok) {
        toast({
          title: "Success",
          description: "Client group created successfully",
        })
        setWizardOpen(false)
        setWizardStep(1)
        setClientGroupName("")
        setSelectedGhlLocation(null)
        setNewGhlLocationId("")
        setSelectedMetaAdAccount(null)
        setSelectedHotProspectorGroup(null)
        setLocationSearchQuery("")
        setMetaSearchQuery("")
        setHotProspectorSearchQuery("")
        fetchClientGroups()
        fetchGhlLocations() // Refresh locations to include new subaccount
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.detail || "Failed to create client group",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("[v0] Error creating client group:", err)
      toast({
        title: "Error",
        description: "Failed to create client group",
        variant: "destructive",
      })
    } finally {
      setAddingClientGroup(false)
    }
  }

  const filterClientGroups = (groups) => {
    if (!searchQuery) return groups
    const query = searchQuery.toLowerCase()
    return groups.filter((group) => group.name?.toLowerCase().includes(query))
  }

  const filteredClientGroups = filterClientGroups(clientGroups)

  const handleClientGroupClick = (group) => {
    console.log("[v0] Navigating to client group:", group.id)
    router.push(`/contacts/group-${group.id}`)
  }

  const renderClientGroupCard = (group) => (
    <Card
      key={`group-${group.id}`}
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
      onClick={() => handleClientGroupClick(group)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Building2 className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{group.name || "Unnamed Group"}</CardTitle>
              <CardDescription className="text-xs font-mono mt-1">{group.id}</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {group.ghl_location_id && <Badge variant="secondary">GHL</Badge>}
            {group.meta_ad_account_id && <Badge variant="default">Meta</Badge>}
            {group.hotprospector_group_id && <Badge variant="outline">Hot Prospector</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          {group.ghl_location_id && (
            <p className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              GHL Location: {group.ghl_location_name || group.ghl_location_id}
            </p>
          )}
          {group.meta_ad_account_id && (
            <p className="flex items-center gap-2">
              <Facebook className="w-4 h-4" />
              Meta Ad Account: {group.meta_ad_account_name || group.meta_ad_account_id}
            </p>
          )}
          {group.hotprospector_group_id && (
            <p className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Hot Prospector Group: {group.hotprospector_group_name || group.hotprospector_group_id}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const filteredGhlLocations = ghlLocations.filter(
    (loc) =>
      loc.name?.toLowerCase().includes(locationSearchQuery.toLowerCase()) ||
      loc.locationId?.toLowerCase().includes(locationSearchQuery.toLowerCase())
  )

  const filteredMetaAdAccounts = metaAdAccounts.filter(
    (acc) =>
      acc.name?.toLowerCase().includes(metaSearchQuery.toLowerCase()) ||
      acc.id?.toLowerCase().includes(metaSearchQuery.toLowerCase())
  )

  const filteredHotProspectorGroups = hotProspectorGroups.filter(
    (group) =>
      group.name?.toLowerCase().includes(hotProspectorSearchQuery.toLowerCase()) ||
      String(group.id).toLowerCase().includes(hotProspectorSearchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <div className="bg-card">
        <div className="w-full mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold  text-foreground">Clients Dashboard</h1>
                <p className="text-muted-foreground mt-1">Manage client groups</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={wizardOpen} onOpenChange={(open) => {
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
              }}>
                <Button onClick={() => setWizardOpen(true)} className="bg-purple-900 text-white rounded-lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
                <DialogContent className="sm:max-w-2xl bg-zinc-50 p-0 overflow-hidden border-0 shadow-2xl">
                  <DialogHeader className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-semibold text-white">Client Linking Wizard</DialogTitle>
                        <p className="text-purple-100 text-sm">Step {wizardStep} of 4: {[
                          "Name your client group",
                          "Select or add GHL subaccount",
                          "Select Meta ad account",
                          "Select Hot Prospector group"
                        ][wizardStep - 1]}</p>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="p-6">
                    {wizardStep === 1 && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-foreground">Client Group Name</label>
                          <Input
                            type="text"
                            placeholder="Enter client group name"
                            value={clientGroupName}
                            onChange={(e) => setClientGroupName(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                    {wizardStep === 2 && (
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                          <Input
                            type="text"
                            placeholder="Search GHL locations by name or ID..."
                            value={locationSearchQuery}
                            onChange={(e) => setLocationSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-3"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-foreground">Or enter new GHL Location ID</label>
                          <Input
                            type="text"
                            placeholder="Enter new GHL location ID"
                            value={newGhlLocationId}
                            onChange={(e) => setNewGhlLocationId(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {filteredGhlLocations.length > 0 ? (
                            filteredGhlLocations.map((location) => (
                              <div
                                key={location.locationId}
                                onClick={() => {
                                  setSelectedGhlLocation(location)
                                  setNewGhlLocationId("") // Clear manual input if selecting existing
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
                                      <MapPin
                                        className={`w-4 h-4 flex-shrink-0 ${
                                          selectedGhlLocation?.locationId === location.locationId
                                            ? "text-purple-600"
                                            : "text-muted-foreground"
                                        }`}
                                      />
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
                              <Building2 className="w-12 h-12 mx-auto mb-3 text-muted" />
                              <p>No GHL locations found</p>
                              <p className="text-sm">Enter a new location ID or skip this step</p>
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
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                          <Input
                            type="text"
                            placeholder="Search Meta ad accounts by name or ID..."
                            value={metaSearchQuery}
                            onChange={(e) => setMetaSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-3"
                          />
                        </div>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
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
                                      <Facebook
                                        className={`w-4 h-4 flex-shrink-0 ${
                                          selectedMetaAdAccount?.id === account.id
                                            ? "text-purple-600"
                                            : "text-muted-foreground"
                                        }`}
                                      />
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
                              <Facebook className="w-12 h-12 mx-auto mb-3 text-muted" />
                              <p>No Meta ad accounts found</p>
                              <p className="text-sm">Try adjusting your search terms</p>
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
                    {wizardStep === 4 && (
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
                                      <Users
                                        className={`w-4 h-4 flex-shrink-0 ${
                                          selectedHotProspectorGroup?.id === group.id
                                            ? "text-purple-600"
                                            : "text-muted-foreground"
                                        }`}
                                      />
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
                              <Users className="w-12 h-12 mx-auto mb-3 text-muted" />
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
                    )}
                  </div>
                  <div className="bg-muted/50 px-6 py-4 flex items-center justify-between border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      {wizardStep === 2 && `${filteredGhlLocations.length} location${filteredGhlLocations.length !== 1 ? "s" : ""} available`}
                      {wizardStep === 3 && `${filteredMetaAdAccounts.length} ad account${filteredMetaAdAccounts.length !== 1 ? "s" : ""} available`}
                      {wizardStep === 4 && `${filteredHotProspectorGroups.length} group${filteredHotProspectorGroups.length !== 1 ? "s" : ""} available`}
                    </p>
                    <div className="flex items-center gap-3">
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
                        ) : wizardStep < 4 ? (
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
              <Button variant="outline" onClick={fetchClientGroups}>
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Client Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{clientGroups.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All groups</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Client Groups</CardTitle>
            <CardDescription>Find client groups by name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="all">All Client Groups ({filteredClientGroups.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {filteredClientGroups.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">No client groups found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchQuery ? "Try adjusting your search" : "Create a client group to get started"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredClientGroups.map((group) => renderClientGroupCard(group))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}