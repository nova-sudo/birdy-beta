"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") || "integrations"
  const [integrationStatus, setIntegrationStatus] = useState(null)
  const [facebookIntegrationStatus, setFacebookIntegrationStatus] = useState(null)
  const [hotprospectorStatus, setHotprospectorStatus] = useState(null)
  const [hotprospectorDialogOpen, setHotprospectorDialogOpen] = useState(false)
  const [hotprospectorCredentials, setHotprospectorCredentials] = useState({ api_uid: "", api_key: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Helper to set cookie
  const setCookie = (name, value, maxAge) => {
    const safeMaxAge = Number.isInteger(maxAge) && maxAge > 0 ? maxAge : 3600
    const cookieString = `${name}=${encodeURIComponent(value)}; path=/; max-age=${safeMaxAge}; SameSite=Lax`
    document.cookie = cookieString
    console.log(`Set cookie: ${cookieString}`)
    console.log(`Immediate cookie check: ${document.cookie}`)
  }

  // Helper to get cookie
  const getCookie = (name) => {
    console.log(`All cookies: ${document.cookie}`)
    const cookies = document.cookie.split(";")
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split("=")
      if (key === name) {
        return decodeURIComponent(value)
      }
    }
    return null
  }

  // Helper to save integration status to localStorage
  const saveIntegrationStatus = (integrationType, status) => {
    if (status) {
      const key = integrationType === "gohighlevel" ? "goHighLevelIntegration" : "facebookIntegration"
      localStorage.setItem(key, JSON.stringify(status))
      if (integrationType === "gohighlevel") {
        setIntegrationStatus(status)
      } else {
        setFacebookIntegrationStatus(status)
      }
      console.log(`Saved ${integrationType} integration status:`, status)
    }
  }

  // Helper to clear integration status from localStorage and cookie
  const clearIntegrationStatus = (integrationType) => {
    const key = integrationType === "gohighlevel" ? "goHighLevelIntegration" : "facebookIntegration"
    const cookieName = integrationType === "gohighlevel" ? "gohighlevel_tokens" : "facebook_tokens"
    localStorage.removeItem(key)
    document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`
    if (integrationType === "gohighlevel") {
      setIntegrationStatus({ connected: false })
    } else {
      setFacebookIntegrationStatus({ connected: false })
    }
    console.log(`Cleared ${integrationType} integration status and cookie`)
  }

  // Check integration status and handle callback query parameters
  useEffect(() => {
    const checkIntegrationStatus = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const tokenData = searchParams.get("tokens")
        const status = searchParams.get("status")
        const errorMsg = searchParams.get("error")
        const errorDescription = searchParams.get("error_description")

        console.log(
          "Query params - tokens:",
          tokenData,
          "status:",
          status,
          "error:",
          errorMsg,
          "error_description:",
          errorDescription,
        )

        if (errorMsg && status === "error") {
          const errorMessage = `${errorMsg}${errorDescription ? `: ${errorDescription}` : ""}`
          setError(errorMessage)
          toast({
            title: "Connection Failed",
            description: errorMessage,
            variant: "destructive",
          })
          return
        }

        if (tokenData && status === "success") {
          try {
            const decodedTokenData = decodeURIComponent(tokenData)
            console.log("Raw tokenData:", tokenData)
            console.log("Decoded token data:", decodedTokenData)
            const tokens = JSON.parse(decodedTokenData)
            console.log("Parsed tokens:", tokens)
            const integrationType = tokens.scope?.includes("read_insights") ? "facebook" : "gohighlevel"
            const cookieName = integrationType === "gohighlevel" ? "gohighlevel_tokens" : "facebook_tokens"
            setCookie(
              cookieName,
              JSON.stringify(tokens),
              tokens.expires_in || (integrationType === "facebook" ? 60 * 24 * 60 * 60 : 3600),
            )
            console.log(`Cookie set: ${getCookie(cookieName)}`)
            saveIntegrationStatus(integrationType, {
              connected: true,
              expires_at: tokens.expires_at,
              token_expired: new Date(tokens.expires_at) < new Date(Date.now() - 5 * 60 * 1000),
            })
            toast({
              title: "Connection Successful",
              description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} has been connected successfully.`,
            })
            return
          } catch (e) {
            console.error("Error parsing tokens:", e, "Raw tokenData:", tokenData)
            const errorMessage = "Invalid token data received"
            setError(errorMessage)
            toast({
              title: "Connection Failed",
              description: errorMessage,
              variant: "destructive",
            })
            return
          }
        }

        // Check localStorage for both integrations
        const ghlStoredStatus = localStorage.getItem("goHighLevelIntegration")
        const fbStoredStatus = localStorage.getItem("facebookIntegration")
        console.log("Stored GHL status:", ghlStoredStatus)
        console.log("Stored Meta status:", fbStoredStatus)

        if (ghlStoredStatus) {
          const parsedStatus = JSON.parse(ghlStoredStatus)
          if (parsedStatus.connected && parsedStatus.expires_at) {
            setIntegrationStatus(parsedStatus)
            const isExpired = new Date(parsedStatus.expires_at) < new Date(Date.now() - 5 * 60 * 1000)
            console.log("GHL status expired:", isExpired)
            if (!isExpired) {
              console.log("GHL cookie check:", getCookie("gohighlevel_tokens"))
            }
          }
        }

        if (fbStoredStatus) {
          const parsedStatus = JSON.parse(fbStoredStatus)
          if (parsedStatus.connected && parsedStatus.expires_at) {
            setFacebookIntegrationStatus(parsedStatus)
            const isExpired = new Date(parsedStatus.expires_at) < new Date(Date.now() - 5 * 60 * 1000)
            console.log("Meta status expired:", isExpired)
            if (!isExpired) {
              console.log("Meta cookie check:", getCookie("facebook_tokens"))
            }
          }
        }

        // Fetch status from backend
        console.log("Fetching status from backend")
        const response = await fetch("https://birdy-backend.vercel.app/api/status", {
          credentials: "include",
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch integration status: ${response.status} ${response.statusText}`)
        }
        const data = await response.json()
        console.log("Backend status response:", data)

        // Update GHL status
        if (data.gohighlevel?.agency?.connected) {
          const isExpired = new Date(data.gohighlevel.agency.expires_at) < new Date(Date.now() - 5 * 60 * 1000)
          saveIntegrationStatus("gohighlevel", {
            connected: true,
            expires_at: data.gohighlevel.agency.expires_at,
            token_expired: isExpired,
          })
        } else if (!data.gohighlevel?.agency?.connected && ghlStoredStatus && JSON.parse(ghlStoredStatus).connected) {
          console.log("GHL backend failed, trusting localStorage")
        } else {
          saveIntegrationStatus("gohighlevel", { connected: false })
        }

        // Update Meta status
        if (data.facebook?.connected) {
          const isExpired = new Date(data.facebook.expires_at) < new Date(Date.now() - 5 * 60 * 1000)
          saveIntegrationStatus("facebook", {
            connected: true,
            expires_at: data.facebook.expires_at,
            token_expired: isExpired,
          })
        } else if (!data.facebook?.connected && fbStoredStatus && JSON.parse(fbStoredStatus).connected) {
          console.log("Meta backend failed, trusting localStorage")
        } else {
          saveIntegrationStatus("facebook", { connected: false })
        }

        // Check HotProspector status
        const hpResponse = await fetch("https://birdy-backend.vercel.app/api/hotprospector/status", {
          credentials: "include",
        })
        if (hpResponse.ok) {
          const hpData = await hpResponse.json()
          setHotprospectorStatus(hpData)
          console.log("HotProspector status:", hpData)
        }
      } catch (err) {
        console.error("Error in checkIntegrationStatus:", err)
        const errorMessage = `Failed to fetch integration status: ${err.message}`
        setError(errorMessage)
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    checkIntegrationStatus()
  }, [searchParams])

  // Handle connect button click
  const handleConnect = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      const endpoint = integrationType === "gohighlevel" ? "/api/connect" : "/api/connect/facebook"
      console.log(`Initiating ${integrationType} connect request`)
      const response = await fetch(`https://birdy-backend.vercel.app${endpoint}`, {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed to initiate ${integrationType} integration: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      console.log(`${integrationType} connect response:`, data)
      if (data.auth_url) {
        window.location.href = data.auth_url
      } else {
        throw new Error(data.error || `Failed to initiate ${integrationType} integration`)
      }
    } catch (err) {
      console.error(`${integrationType} connect error:`, err)
      const errorMessage = `Failed to connect to ${integrationType} service: ${err.message}`
      setError(errorMessage)
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle disconnect button click
  const handleDisconnect = async (integrationType) => {
    console.log(`${integrationType} disconnect initiated`)
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch("https://birdy-backend.vercel.app/disconnect", {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(
          `Failed to disconnect ${integrationType} integration: ${response.status} ${response.statusText}`,
        )
      }
      clearIntegrationStatus(integrationType)
      toast({
        title: "Disconnected",
        description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} integration has been disconnected.`,
      })
    } catch (err) {
      console.error(`${integrationType} disconnect error:`, err)
      const errorMessage = `Failed to disconnect ${integrationType} integration: ${err.message}`
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle test API button click
  const handleTestApi = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      console.log(`Initiating ${integrationType} test API request`)
      const endpoint = integrationType === "gohighlevel" ? "/test" : "/test/facebook"
      const response = await fetch(`https://birdy-backend.vercel.app${endpoint}`, {
        credentials: "include",
      })
      if (!response.ok) {
        throw new Error(`Failed to test ${integrationType} API connection: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      console.log(`${integrationType} test API response:`, data)
      toast({
        title: "Test Successful",
        description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} API test successful! Check console for details.`,
      })
    } catch (err) {
      console.error(`${integrationType} test API error:`, err)
      const errorMessage = `Failed to test ${integrationType} API connection: ${err.message}`
      setError(errorMessage)
      toast({
        title: "Test Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle HotProspector connect handler
  const handleHotprospectorConnect = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("https://birdy-backend.vercel.app/api/hotprospector/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(hotprospectorCredentials),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to connect HotProspector")
      }

      const data = await response.json()
      console.log("HotProspector connect response:", data)

      setHotprospectorStatus({ connected: true, api_uid: hotprospectorCredentials.api_uid })
      setHotprospectorDialogOpen(false)
      setHotprospectorCredentials({ api_uid: "", api_key: "" })

      toast({
        title: "Connection Successful",
        description: `HotProspector connected successfully. Found ${data.groups_count} groups.`,
      })
    } catch (err) {
      console.error("HotProspector connect error:", err)
      const errorMessage = `Failed to connect HotProspector: ${err.message}`
      setError(errorMessage)
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen ">
      <div className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

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

              {/* GoHighLevel Integration */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Plug2 className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">GoHighLevel</CardTitle>
                          {integrationStatus?.connected && (
                            <Badge
                              variant={integrationStatus.token_expired ? "destructive" : "default"}
                              className="text-xs"
                            >
                              {integrationStatus.token_expired ? (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Expired
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Connected
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          CRM and marketing automation platform for agencies
                        </CardDescription>
                        {integrationStatus?.connected && integrationStatus.expires_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Expires: {new Date(integrationStatus.expires_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {integrationStatus?.connected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestApi("gohighlevel")}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Test Connection
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect("gohighlevel")}
                          disabled={isLoading}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect("gohighlevel")} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

              {/* Meta (Facebook) Integration */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
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
                            <Badge
                              variant={facebookIntegrationStatus.token_expired ? "destructive" : "default"}
                              className="text-xs"
                            >
                              {facebookIntegrationStatus.token_expired ? (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Expired
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Connected
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          Access Facebook insights and marketing tools
                        </CardDescription>
                        {facebookIntegrationStatus?.connected && facebookIntegrationStatus.expires_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Expires: {new Date(facebookIntegrationStatus.expires_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {facebookIntegrationStatus?.connected ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestApi("facebook")}
                          disabled={isLoading}
                        >
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Test Connection
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDisconnect("facebook")}
                          disabled={isLoading}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect("facebook")} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

              {/* HotProspector Integration */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">HotProspector</CardTitle>
                          {hotprospectorStatus?.connected && (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Connected
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          Lead generation and call center management platform
                        </CardDescription>
                        {hotprospectorStatus?.connected && hotprospectorStatus.api_uid && (
                          <p className="text-xs text-muted-foreground mt-2">API UID: {hotprospectorStatus.api_uid}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {hotprospectorStatus?.connected ? (
                      <Button variant="outline" size="sm" disabled>
                        Connected
                      </Button>
                    ) : (
                      <Dialog open={hotprospectorDialogOpen} onOpenChange={setHotprospectorDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" disabled={isLoading}>
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Connect
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Connect HotProspector</DialogTitle>
                            <DialogDescription>
                              Enter your HotProspector API credentials to connect your account.
                            </DialogDescription>
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
                              disabled={
                                isLoading || !hotprospectorCredentials.api_uid || !hotprospectorCredentials.api_key
                              }
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your account preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Account settings content goes here.</p>
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <SettingsPageContent />
    </Suspense>
  );
} 