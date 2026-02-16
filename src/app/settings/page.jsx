"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, Plug2, Phone } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Suspense } from "react"
import { checkAndRefreshExpiredTokens } from "@/lib/checkExpiredTokens"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://birdy-backend.vercel.app"

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") || "integrations"
  const [integrationStatus, setIntegrationStatus] = useState(null)
  const [facebookIntegrationStatus, setFacebookIntegrationStatus] = useState(null)
  const [hotprospectorStatus, setHotprospectorStatus] = useState(null)
  const [hotprospectorDialogOpen, setHotprospectorDialogOpen] = useState(false)
  const [hotprospectorCredentials, setHotprospectorCredentials] = useState({ api_uid: "", api_key: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [user] = useState(JSON.parse(localStorage.getItem("user")))

  // ── Cookie helpers ──────────────────────────────────────────────────────────
  const setCookie = (name, value, maxAge) => {
    const safeMaxAge = Number.isInteger(maxAge) && maxAge > 0 ? maxAge : 3600
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${safeMaxAge}; SameSite=Lax`
  }

  const getCookie = (name) => {
    for (const cookie of document.cookie.split(";")) {
      const [key, value] = cookie.trim().split("=")
      if (key === name) return decodeURIComponent(value)
    }
    return null
  }

  // ── localStorage helpers ────────────────────────────────────────────────────
  const saveIntegrationStatus = (integrationType, status) => {
    if (!status) return
    const key = integrationType === "gohighlevel" ? "goHighLevelIntegration" : "facebookIntegration"
    localStorage.setItem(key, JSON.stringify(status))
    if (integrationType === "gohighlevel") setIntegrationStatus(status)
    else setFacebookIntegrationStatus(status)
  }

  const clearIntegrationStatus = (integrationType) => {
    const key = integrationType === "gohighlevel" ? "goHighLevelIntegration" : "facebookIntegration"
    const cookieName = integrationType === "gohighlevel" ? "gohighlevel_tokens" : "facebook_tokens"
    localStorage.removeItem(key)
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`
    if (integrationType === "gohighlevel") setIntegrationStatus({ connected: false })
    else setFacebookIntegrationStatus({ connected: false })
  }

  // ── Main status + callback effect ──────────────────────────────────────────
  useEffect(() => {
    const checkIntegrationStatus = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const tokenData = searchParams.get("tokens")
        const status = searchParams.get("status")
        const errorMsg = searchParams.get("error")
        const errorDescription = searchParams.get("error_description")

        // ── Handle OAuth error callback ──────────────────────────────────────
        if (errorMsg && status === "error") {
          const msg = `${errorMsg}${errorDescription ? `: ${errorDescription}` : ""}`
          setError(msg)
          toast.error("Connection Failed", { description: msg })
          return
        }

        // ── Handle successful OAuth callback ─────────────────────────────────
        if (tokenData && status === "success") {
          try {
            const tokens = JSON.parse(decodeURIComponent(tokenData))
            const integrationType = tokens.scope?.includes("read_insights") ? "facebook" : "gohighlevel"
            const cookieName = integrationType === "gohighlevel" ? "gohighlevel_tokens" : "facebook_tokens"

            setCookie(
              cookieName,
              JSON.stringify(tokens),
              tokens.expires_in || (integrationType === "facebook" ? 60 * 24 * 60 * 60 : 3600),
            )
            saveIntegrationStatus(integrationType, {
              connected: true,
              expires_at: tokens.expires_at,
              token_expired: new Date(tokens.expires_at) < new Date(),
            })

            toast.success("Connection Successful", {
              description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} connected successfully.`,
            })

            // ── Check if another integration still needs refreshing ───────────
            // (e.g. GHL was just refreshed, now check if Meta also needs it)
            const storedRedirect = sessionStorage.getItem("post_integration_redirect")
            if (storedRedirect) {
              // Don't remove yet — checkAndRefreshExpiredTokens will store it
              // again if it needs to kick off another OAuth flow.
              sessionStorage.removeItem("post_integration_redirect")
              const nextPath = await checkAndRefreshExpiredTokens(storedRedirect)
              if (nextPath !== null) {
                router.push(nextPath)
              }
              // If null, another OAuth redirect was initiated — do nothing.
            }

            return
          } catch (e) {
            console.error("Error parsing OAuth callback tokens:", e)
            setError("Invalid token data received")
            toast.error("Connection Failed", { description: "Invalid token data received" })
            return
          }
        }

        // ── Normal page load: restore from localStorage ──────────────────────
        const ghlStored = localStorage.getItem("goHighLevelIntegration")
        const fbStored = localStorage.getItem("facebookIntegration")

        if (ghlStored) {
          const parsed = JSON.parse(ghlStored)
          if (parsed.connected && parsed.expires_at) setIntegrationStatus(parsed)
        }
        if (fbStored) {
          const parsed = JSON.parse(fbStored)
          if (parsed.connected && parsed.expires_at) setFacebookIntegrationStatus(parsed)
        }

        // ── Sync with backend ────────────────────────────────────────────────
        const res = await fetch(`${API_BASE}/api/status`, { credentials: "include" })
        if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`)
        const data = await res.json()

        if (data.gohighlevel?.agency?.connected) {
          saveIntegrationStatus("gohighlevel", {
            connected: true,
            expires_at: data.gohighlevel.agency.expires_at,
            token_expired: new Date(data.gohighlevel.agency.expires_at) < new Date(),
          })
        } else if (!ghlStored) {
          saveIntegrationStatus("gohighlevel", { connected: false })
        }

        if (data.facebook?.connected) {
          saveIntegrationStatus("facebook", {
            connected: true,
            expires_at: data.facebook.expires_at,
            token_expired: new Date(data.facebook.expires_at) < new Date(),
          })
        } else if (!fbStored) {
          saveIntegrationStatus("facebook", { connected: false })
        }

        // ── HotProspector ────────────────────────────────────────────────────
        const hpRes = await fetch(`${API_BASE}/api/hotprospector/status`, { credentials: "include" })
        if (hpRes.ok) setHotprospectorStatus(await hpRes.json())
      } catch (err) {
        console.error("checkIntegrationStatus error:", err)
        setError(`Failed to fetch integration status: ${err.message}`)
        toast.error("Error", { description: err.message })
      } finally {
        setIsLoading(false)
      }
    }

    checkIntegrationStatus()
  }, [searchParams])

  // ── Connect / Disconnect / Test ─────────────────────────────────────────────
  const handleConnect = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      const endpoint = integrationType === "gohighlevel" ? "/api/connect" : "/api/connect/facebook"
      const res = await fetch(`${API_BASE}${endpoint}`, { credentials: "include" })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const { auth_url } = await res.json()
      if (auth_url) window.location.href = auth_url
      else throw new Error("No auth URL returned")
    } catch (err) {
      setError(`Failed to connect: ${err.message}`)
      toast.error("Connection Failed", { description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/disconnect`, { credentials: "include" })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      clearIntegrationStatus(integrationType)
      toast.success("Disconnected", {
        description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} disconnected.`,
      })
    } catch (err) {
      setError(`Failed to disconnect: ${err.message}`)
      toast.error("Error", { description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestApi = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      const endpoint = integrationType === "gohighlevel" ? "/test" : "/test/facebook"
      const res = await fetch(`${API_BASE}${endpoint}`, { credentials: "include" })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      toast.success("Test Successful", { description: "API test passed. Check console for details." })
    } catch (err) {
      setError(`Test failed: ${err.message}`)
      toast.error("Test Failed", { description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleHotprospectorConnect = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch(`${API_BASE}/api/hotprospector/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(hotprospectorCredentials),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to connect HotProspector")
      }
      const data = await res.json()
      setHotprospectorStatus({ connected: true, api_uid: hotprospectorCredentials.api_uid })
      setHotprospectorDialogOpen(false)
      setHotprospectorCredentials({ api_uid: "", api_key: "" })
      toast.success("Connection Successful", {
        description: `HotProspector connected. Found ${data.groups_count ?? 0} groups.`,
      })
    } catch (err) {
      setError(`Failed to connect HotProspector: ${err.message}`)
      toast.error("Connection Failed", { description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-[calc(100dvw-30px)] md:w-[calc(100dvw-100px)]">
      <div className="container py-5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-center md:text-left">Settings</h1>
      </div>

      <div className="container">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="inline-flex h-13 item-center w-full justify-start p-1 bg-[#F3F1F999] border border-border/60 shadow-sm">
            {["general", "integrations", "account"].map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                  data-[state=active]:bg-white data-[state=active]:text-foreground
                  data-[state=active]:shadow-sm data-[state=active]:rounded-md
                  data-[state=active]:border-b-2 data-[state=active]:border-b-purple-700"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Manage your general application settings</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">General settings content goes here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations */}
          <TabsContent value="integrations" className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Connected Services</h2>
                <p className="text-sm text-muted-foreground">Manage your third-party service integrations</p>
              </div>

              <Separator />

              {/* GoHighLevel */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Plug2 className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">GoHighLevel</CardTitle>
                        {integrationStatus?.connected && (
                          <Badge variant={integrationStatus.token_expired ? "destructive" : "default"} className="text-xs">
                            {integrationStatus.token_expired ? (
                              <><XCircle className="h-3 w-3 mr-1" />Expired</>
                            ) : (
                              <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
                            )}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">CRM and marketing automation platform for agencies</CardDescription>
                      {integrationStatus?.connected && integrationStatus.expires_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Expires: {new Date(integrationStatus.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {integrationStatus?.connected ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleTestApi("gohighlevel")} disabled={isLoading}>
                          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Test Connection
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDisconnect("gohighlevel")} disabled={isLoading}>
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect("gohighlevel")} disabled={isLoading}>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Connect
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <a href="https://www.gohighlevel.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Meta */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">Meta (Facebook)</CardTitle>
                        {facebookIntegrationStatus?.connected && (
                          <Badge variant={facebookIntegrationStatus.token_expired ? "destructive" : "default"} className="text-xs">
                            {facebookIntegrationStatus.token_expired ? (
                              <><XCircle className="h-3 w-3 mr-1" />Expired</>
                            ) : (
                              <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
                            )}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">Access Facebook insights and marketing tools</CardDescription>
                      {facebookIntegrationStatus?.connected && facebookIntegrationStatus.expires_at && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Expires: {new Date(facebookIntegrationStatus.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {facebookIntegrationStatus?.connected ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleTestApi("facebook")} disabled={isLoading}>
                          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Test Connection
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDisconnect("facebook")} disabled={isLoading}>
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect("facebook")} disabled={isLoading}>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Connect
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* HotProspector */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">HotProspector</CardTitle>
                        {hotprospectorStatus?.connected && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Connected
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">Lead generation and call center management platform</CardDescription>
                      {hotprospectorStatus?.connected && hotprospectorStatus.api_uid && (
                        <p className="text-xs text-muted-foreground mt-2">API UID: {hotprospectorStatus.api_uid}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {hotprospectorStatus?.connected ? (
                      <Button variant="outline" size="sm" disabled>Connected</Button>
                    ) : (
                      <Dialog open={hotprospectorDialogOpen} onOpenChange={setHotprospectorDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" disabled={isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Connect
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Connect HotProspector</DialogTitle>
                            <DialogDescription>Enter your HotProspector API credentials.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="api_uid">API UID</Label>
                              <Input
                                id="api_uid"
                                placeholder="Enter your API UID"
                                value={hotprospectorCredentials.api_uid}
                                onChange={(e) =>
                                  setHotprospectorCredentials((prev) => ({ ...prev, api_uid: e.target.value }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="api_key">API Key</Label>
                              <Input
                                id="api_key"
                                type="password"
                                placeholder="Enter your API Key"
                                value={hotprospectorCredentials.api_key}
                                onChange={(e) =>
                                  setHotprospectorCredentials((prev) => ({ ...prev, api_key: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setHotprospectorDialogOpen(false)
                                setHotprospectorCredentials({ api_uid: "", api_key: "" })
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleHotprospectorConnect}
                              disabled={isLoading || !hotprospectorCredentials.api_uid || !hotprospectorCredentials.api_key}
                            >
                              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                              Connect
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <a href="https://hotprospector.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Account */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-semibold text-2xl">Account Information</CardTitle>
                <CardDescription className="text-[#71658B]">Manage your account preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h1 className="text-sm font-semibold leading-none">Name</h1>
                  <input
                    type="text"
                    value={user?.name ?? ""}
                    readOnly
                    className="flex bg-[#F9F8FC] font-semibold h-10 w-full rounded-md border border-input px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled
                  />
                  <div className="space-y-2 mt-6">
                    <h1 className="text-sm font-semibold leading-none">Email</h1>
                    <input
                      type="text"
                      value={user?.email ?? ""}
                      readOnly
                      className="bg-[#F9F8FC] flex font-semibold h-10 w-full rounded-md border border-input px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  )
}