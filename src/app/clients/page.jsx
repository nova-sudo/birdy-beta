"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Search, AlertCircle, ArrowLeft, Building2, MapPin, Facebook, Plus, Check } from "lucide-react"
import {toast} from "sonner"
export default function ClientsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [ghlClients, setGhlClients] = useState([])
  const [metaClients, setMetaClients] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [availableLocations, setAvailableLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState("")
  const [locationSearchQuery, setLocationSearchQuery] = useState("")
  const [addingClient, setAddingClient] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [])

  useEffect(() => {
    if (addDialogOpen) {
      fetchAvailableLocations()
    }
  }, [addDialogOpen])

  const fetchClients = async () => {
    setLoading(true)
    setError("")

    try {
      // Fetch GHL locations
      const ghlResponse = await fetch("https://birdy-backend.vercel.app/api/location-data", {
        credentials: "include",
      })

      if (ghlResponse.status === 401) {
        router.push("/login")
        return
      }

      let ghlData = []
      if (ghlResponse.ok) {
        const data = await ghlResponse.json()
        console.log("[v0] GHL locations response:", data)
        ghlData = data.locations || []
      }

      // Fetch Meta ad accounts
      const metaResponse = await fetch("https://birdy-backend.vercel.app/api/facebook/adaccounts", {
        credentials: "include",
      })

      let metaData = []
      if (metaResponse.ok) {
        const data = await metaResponse.json()
        console.log("[v0] Meta ad accounts response:", data)
        metaData = data.data?.data || []
      }

      setGhlClients(ghlData)
      setMetaClients(metaData)
    } catch (err) {
      console.error("[v0] Error fetching clients:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableLocations = async () => {
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/subaccount/locations", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setAvailableLocations(data.locations || [])
      }
    } catch (err) {
      console.error("[v0] Error fetching available locations:", err)
      toast({
        title: "Error",
        description: "Failed to fetch available locations",
        variant: "destructive",
      })
    }
  }

  const handleAddClient = async () => {
    if (!selectedLocationId) {
      toast({
        title: "Error",
        description: "Please select a location",
        variant: "destructive",
      })
      return
    }

    setAddingClient(true)
    try {
      const response = await fetch("https://birdy-backend.vercel.app/api/add-subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ location_id: selectedLocationId }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "GHL location added successfully",
        })
        setAddDialogOpen(false)
        setSelectedLocationId("")
        setLocationSearchQuery("")
        fetchClients()
      } else {
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to add location",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("[v0] Error adding client:", err)
      toast({
        title: "Error",
        description: "Failed to add location",
        variant: "destructive",
      })
    } finally {
      setAddingClient(false)
    }
  }

  const filterClients = (clients, type) => {
    if (!searchQuery) return clients

    const query = searchQuery.toLowerCase()
    return clients.filter((client) => {
      if (type === "ghl") {
        return (
          client.name?.toLowerCase().includes(query) ||
          client.location_id?.toLowerCase().includes(query) ||
          client.address?.toLowerCase().includes(query)
        )
      } else {
        return client.name?.toLowerCase().includes(query) || client.id?.toLowerCase().includes(query)
      }
    })
  }

  const filteredGhlClients = filterClients(ghlClients, "ghl")
  const filteredMetaClients = filterClients(metaClients, "meta")
  const allClients = [...filteredGhlClients, ...filteredMetaClients]

  const handleClientClick = (client, type) => {
    if (type === "ghl") {
      console.log("[v0] Navigating to GHL location:", client.location_id)
      router.push(`/contacts/ghl-${client.location_id}`)
    } else {
      console.log("[v0] Navigating to Meta ad account:", client.id)
      router.push(`/contacts/meta-${client.id}`)
    }
  }

  const renderClientCard = (client, type) => {
    const isGhl = type === "ghl"
    const clientId = isGhl ? client.location_id : client.id

    return (
      <Card
        key={`${type}-${clientId}`}
        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
        onClick={() => handleClientClick(client, type)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isGhl ? "bg-muted" : "bg-muted"}`}>
                {isGhl ? (
                  <MapPin className="w-5 h-5 text-foreground" />
                ) : (
                  <Facebook className="w-5 h-5 text-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">{client.name || "Unnamed Client"}</CardTitle>
                <CardDescription className="text-xs font-mono mt-1">
                  {isGhl ? client.location_id : client.id}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isGhl ? "secondary" : "default"}>{isGhl ? "GHL" : "Meta"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isGhl ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              {client.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {client.address}
                </p>
              )}
              {client.trial && (
                <Badge variant={client.trial.active ? "secondary" : "default"}>
                  {client.trial.active ? "Trial" : "Active"}
                </Badge>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              {client.currency && <p>Currency: {client.currency}</p>}
              {client.created_time && (
                <p className="text-xs">Created: {new Date(client.created_time).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const filteredAvailableLocations = availableLocations.filter(
    (loc) =>
      loc.name?.toLowerCase().includes(locationSearchQuery.toLowerCase()) ||
      loc.locationId?.toLowerCase().includes(locationSearchQuery.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="min-h-screen  p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-32" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh ">
      <div className=" bg-card">
        <div className="w-full mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Clients Dashboard</h1>
                <p className="text-muted-foreground mt-1">GHL locations and Meta ad accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Updated dialog with enhanced design */}
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <Button onClick={() => setAddDialogOpen(true)} className="bg-purple-900 text-white rounded-lg" > 
                  <Plus className="h-4 w-4 mr-2" />
                  Add GHL Location
                </Button>
                <DialogContent className="sm:max-w-2xl bg-zinc-50 p-0 overflow-hidden border-0 shadow-2xl">
                  {/* Header with purple gradient */}
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-semibold text-white">Add New Client</DialogTitle>
                        <p className="text-purple-100 text-sm">Select a location to create a new client account</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 ">
                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Search locations by name or ID..."
                        value={locationSearchQuery}
                        onChange={(e) => setLocationSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-3 border-input focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-muted/50 focus:"
                      />
                    </div>

                    {/* Location List */}
                    <div className="space-y-2 max-h-80 overflow-y-auto  ">
                      {filteredAvailableLocations.length > 0 ? (
                        filteredAvailableLocations.map((location) => (
                          <div
                            key={location.locationId}
                            onClick={() => setSelectedLocationId(location.locationId)}
                            className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group ${
                              selectedLocationId === location.locationId
                                ? "border-purple-500 bg-purple-50 shadow-md"
                                : "border-border hover:border-muted-foreground bg-card"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <MapPin
                                    className={`w-4 h-4 flex-shrink-0 ${
                                      selectedLocationId === location.locationId
                                        ? "text-purple-600"
                                        : "text-muted-foreground"
                                    }`}
                                  />
                                  <h3
                                    className={`font-semibold truncate ${
                                      selectedLocationId === location.locationId ? "text-purple-900" : "text-foreground"
                                    }`}
                                  >
                                    {location.name || "Unnamed Location"}
                                  </h3>
                                </div>
                                <p
                                  className={`text-xs font-mono ${
                                    selectedLocationId === location.locationId
                                      ? "text-purple-600"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  ID: {location.locationId}
                                </p>
                              </div>

                              {/* Selection Indicator */}
                              <div
                                className={`ml-3 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                                  selectedLocationId === location.locationId
                                    ? "bg-purple-600 border-purple-600"
                                    : "border-border group-hover:border-muted-foreground"
                                }`}
                              >
                                {selectedLocationId === location.locationId && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted" />
                          <p>No locations found matching your search</p>
                          <p className="text-sm">Try adjusting your search terms</p>
                        </div>
                      )}
                    </div>

                    {/* Selection Summary */}
                    {selectedLocationId && (
                      <div className="mt-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-900">
                            Selected:{" "}
                            {filteredAvailableLocations.find((loc) => loc.locationId === selectedLocationId)?.name ||
                              "Unknown"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="bg-muted/50 px-6 py-4 flex items-center justify-between border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      {filteredAvailableLocations.length} location{filteredAvailableLocations.length !== 1 ? "s" : ""}{" "}
                      available
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setAddDialogOpen(false)
                          setSelectedLocationId("")
                          setLocationSearchQuery("")
                        }}
                        disabled={addingClient}
                        className="text-muted-foreground hover:bg-muted"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddClient}
                        disabled={!selectedLocationId || addingClient}
                        className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px]"
                      >
                        {addingClient ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Client
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" onClick={fetchClients}>
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

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{ghlClients.length + metaClients.length}</div>
              <p className="text-xs text-muted-foreground mt-1">All integrations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">GHL Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{ghlClients.length}</div>
              <p className="text-xs text-muted-foreground mt-1">GoHighLevel</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meta Ad Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metaClients.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Facebook</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Clients</CardTitle>
            <CardDescription>Find clients by name or ID</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs for All/GHL/Meta */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Clients ({allClients.length})</TabsTrigger>
            <TabsTrigger value="ghl">GHL ({filteredGhlClients.length})</TabsTrigger>
            <TabsTrigger value="meta">Meta ({filteredMetaClients.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {allClients.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">No clients found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchQuery ? "Try adjusting your search" : "Connect your integrations to see clients"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredGhlClients.map((client) => renderClientCard(client, "ghl"))}
                {filteredMetaClients.map((client) => renderClientCard(client, "meta"))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ghl" className="mt-6">
            {filteredGhlClients.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <MapPin className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">No GHL locations found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchQuery ? "Try adjusting your search" : "Connect GoHighLevel in Settings"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredGhlClients.map((client) => renderClientCard(client, "ghl"))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="meta" className="mt-6">
            {filteredMetaClients.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Facebook className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">No Meta ad accounts found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchQuery ? "Try adjusting your search" : "Connect Meta in Settings"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMetaClients.map((client) => renderClientCard(client, "meta"))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
