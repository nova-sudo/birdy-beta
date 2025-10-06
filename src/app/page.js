"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Users, Building2, TrendingUp, Target, AlertCircle, ArrowRight } from "lucide-react"

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [dashboardData, setDashboardData] = useState({
    totalClients: 0,
    ghlContactsCount: 0,
    metaLeadsCount: 0,
    ghlLocations: [],
    metaAdAccounts: [],
    sourceDistribution: [],
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError("")

    try {
      // Fetch clients data
      const clientsRes = await fetch("https://birdy-backend.vercel.app/api/get_all_clients", {
        credentials: "include",
      })

      if (clientsRes.status === 401) {
        router.push("/login")
        return
      }

      if (!clientsRes.ok) {
        throw new Error("Failed to fetch clients data")
      }

      const clientsData = await clientsRes.json()

      // Fetch GHL locations
      const locationsRes = await fetch("https://birdy-backend.vercel.app/api/location-data", {
        credentials: "include",
      })
      const locationsData = locationsRes.ok ? await locationsRes.json() : { locations: [] }

      // Fetch Meta ad accounts
      const adAccountsRes = await fetch("https://birdy-backend.vercel.app/api/facebook/adaccounts", {
        credentials: "include",
      })
      const adAccountsData = adAccountsRes.ok ? await adAccountsRes.json() : { data: { data: [] } }

      // Calculate source distribution
      const sourceCount = { GHL: 0, Meta: 0, Both: 0 }
      clientsData.clients.forEach((client) => {
        if (client.source.includes(",")) {
          sourceCount.Both++
        } else if (client.source === "GHL") {
          sourceCount.GHL++
        } else if (client.source === "Meta") {
          sourceCount.Meta++
        }
      })

      const sourceDistribution = [
        { name: "GHL Only", value: sourceCount.GHL, color: "#10b981" },
        { name: "Meta Only", value: sourceCount.Meta, color: "#3b82f6" },
        { name: "Both", value: sourceCount.Both, color: "#8b5cf6" },
      ]

      setDashboardData({
        totalClients: clientsData.meta.total_clients,
        ghlContactsCount: clientsData.meta.ghl_contacts_count,
        metaLeadsCount: clientsData.meta.meta_leads_count,
        ghlLocations: locationsData.locations || [],
        metaAdAccounts: adAccountsData.data?.data || [],
        sourceDistribution,
      })
    } catch (err) {
      console.error("[v0] Error fetching dashboard data:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen  p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen ">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Overview of all your integrations</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/settings")}>
                Settings
              </Button>
              <Button onClick={() => router.push("/clients")}>
                View All Clients
                <ArrowRight className="ml-2 h-4 w-4" />
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

        {/* Metric Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{dashboardData.totalClients}</div>
              <p className="text-xs text-muted-foreground mt-1">Deduplicated across all sources</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">GHL Contacts</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{dashboardData.ghlContactsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">From {dashboardData.ghlLocations.length} locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Meta Leads</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{dashboardData.metaLeadsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {dashboardData.metaAdAccounts.length} ad accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Integrations</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {(dashboardData.ghlLocations.length > 0 ? 1 : 0) + (dashboardData.metaAdAccounts.length > 0 ? 1 : 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active connections</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Source Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Client Source Distribution</CardTitle>
              <CardDescription>Breakdown of clients by integration source</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardData.sourceDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dashboardData.sourceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Integration Status */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
              <CardDescription>Connected services and their status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">GoHighLevel</p>
                    <p className="text-sm text-muted-foreground">{dashboardData.ghlLocations.length} locations</p>
                  </div>
                </div>
                <Badge variant={dashboardData.ghlLocations.length > 0 ? "default" : "secondary"}>
                  {dashboardData.ghlLocations.length > 0 ? "Connected" : "Not Connected"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Meta (Facebook)</p>
                    <p className="text-sm text-muted-foreground">{dashboardData.metaAdAccounts.length} ad accounts</p>
                  </div>
                </div>
                <Badge variant={dashboardData.metaAdAccounts.length > 0 ? "default" : "secondary"}>
                  {dashboardData.metaAdAccounts.length > 0 ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* GHL Locations */}
        {dashboardData.ghlLocations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>GoHighLevel Locations</CardTitle>
              <CardDescription>Your connected GHL subaccounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dashboardData.ghlLocations.map((location) => (
                  <div key={location.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-foreground">{location.name}</h3>
                      <Badge variant={location.token_expired ? "destructive" : "default"} className="text-xs">
                        {location.token_expired ? "Expired" : "Active"}
                      </Badge>
                    </div>
                    {location.address && <p className="text-sm text-muted-foreground">{location.address}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meta Ad Accounts */}
        {dashboardData.metaAdAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Meta Ad Accounts</CardTitle>
              <CardDescription>Your connected Facebook ad accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dashboardData.metaAdAccounts.map((account) => (
                  <div key={account.id} className="p-4 border rounded-lg space-y-2">
                    <h3 className="font-medium text-foreground">{account.name}</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Currency:</span>
                      <span className="font-medium text-foreground">{account.currency}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 bg-transparent"
                      onClick={() => router.push(`/campaigns?account=${account.id}`)}
                    >
                      View Campaigns
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Navigate to key sections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <Button variant="outline" onClick={() => router.push("/clients")} className="justify-start">
                <Users className="mr-2 h-4 w-4" />
                View All Clients
              </Button>
              <Button variant="outline" onClick={() => router.push("/campaigns")} className="justify-start">
                <Target className="mr-2 h-4 w-4" />
                View Campaigns
              </Button>
              <Button variant="outline" onClick={() => router.push("/settings")} className="justify-start">
                <Building2 className="mr-2 h-4 w-4" />
                Manage Integrations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
