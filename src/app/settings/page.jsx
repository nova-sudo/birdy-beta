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
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, Plug2, Phone, RefreshCw, Bot } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Suspense } from "react"
import { checkAndRefreshExpiredTokens } from "@/lib/checkExpiredTokens"
import { apiRequest } from "@/lib/api"
import { AI_MODELS } from "@/lib/constants"
import { Crown, ExternalLink as ExternalLinkIcon, AlertCircle as AlertCircleIcon } from "lucide-react"

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") || "integrations"

  // Separate state variables with clear naming — no ambiguity about which level of nesting.
  //
  // Lazy-init from localStorage so a remount (e.g. user navigates to /meta
  // and comes back) doesn't flash a stale "Connect" button while
  // /api/status is in flight. The init effect below still hits the backend
  // and overwrites with truth — this just bridges the network gap with the
  // last-known-good state. Same pattern as the existing `user` state below.
  //
  // `token_expired` is recomputed against the current clock every time we
  // read from cache, so a stored `false` from yesterday doesn't claim a
  // token is still valid past its `expires_at`.
  const readCachedStatus = (key) => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return { connected: false }
      const parsed = JSON.parse(raw)
      if (!parsed || !parsed.connected) return { connected: false }
      if (parsed.expires_at) {
        parsed.token_expired = new Date(parsed.expires_at) < new Date()
      }
      return parsed
    } catch {
      return { connected: false }
    }
  }
  const [ghlStatus, setGhlStatus] = useState(() => readCachedStatus("goHighLevelIntegration"))
  const [facebookStatus, setFacebookStatus] = useState(() => readCachedStatus("facebookIntegration"))
  const [hotprospectorStatus, setHotprospectorStatus] = useState(() => readCachedStatus("hotprospectorIntegration"))
  // Separate reader from readCachedStatus() above — the AI credential status
  // shape uses `configured` (matching useAiCredentials.js, which reads/writes
  // the same "aiCredentialsIntegration" localStorage key), not `connected`.
  const readCachedAiStatus = () => {
    try {
      const raw = localStorage.getItem("aiCredentialsIntegration")
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.configured ? parsed : { configured: false }
    } catch {
      return { configured: false }
    }
  }
  const [aiStatus, setAiStatus] = useState(() => readCachedAiStatus())
  // Same shape convention as AI credentials — `installed`, not `connected`.
  const readCachedSlackStatus = () => {
    try {
      const raw = localStorage.getItem("slackBotIntegration")
      const parsed = raw ? JSON.parse(raw) : null
      return parsed?.installed ? parsed : { installed: false }
    } catch {
      return { installed: false }
    }
  }
  const [slackStatus, setSlackStatus] = useState(() => readCachedSlackStatus())
  // True until the first /api/status fetch resolves. Used to gate the
  // Connect buttons behind a "Checking…" pill — so a first-time user on a
  // fresh browser (no cache) doesn't see "Connect" flash before their real
  // status loads. Returning users with a cached connected state never see
  // this because the cache short-circuits them straight to "Connected".
  const [statusInitialLoading, setStatusInitialLoading] = useState(true)

  const [refreshCycle, setRefreshCycle] = useState({ running: false, groups_done: 0, groups_total: 0, current_group: null })
  const [refreshStarting, setRefreshStarting] = useState(false)

  const [billingStatus, setBillingStatus] = useState(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  const [hotprospectorDialogOpen, setHotprospectorDialogOpen] = useState(false)
  const [hotprospectorCredentials, setHotprospectorCredentials] = useState({ api_uid: "", api_key: "" })
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiCredentials, setAiCredentials] = useState({ provider: "anthropic", api_key: "", model: "" })
  const [aiValidating, setAiValidating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [removingIntegration, setRemovingIntegration] = useState(null)
  const [error, setError] = useState(null)
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) } catch { return null }
  })

  const setCookie = (name, value, maxAge) => {
    const safeMaxAge = Number.isInteger(maxAge) && maxAge > 0 ? maxAge : 3600
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${safeMaxAge}; SameSite=Lax`
  }

  const clearCookie = (name) => {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
  }
  
  useEffect(() => {
    apiRequest("/api/billing/status")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setBillingStatus(data) })
      .catch(() => {})
  }, [])

  const handlePortal = async () => {
    setLoadingPortal(true)
    try {
      const res = await apiRequest("/api/billing/portal-url")
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Failed to open billing portal")
      if (data.portal_url) window.open(data.portal_url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error("Billing Portal Error", { description: err.message })
    } finally {
      setLoadingPortal(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const tokenData = searchParams.get("tokens")
        const status = searchParams.get("status")
        const errorMsg = searchParams.get("error")
        const errorDescription = searchParams.get("error_description")

        if (errorMsg && status === "error") {
          const msg = `${errorMsg}${errorDescription ? `: ${errorDescription}` : ""}`
          setError(msg)
          toast.error("Connection Failed", { description: msg })
          return
        }

        if (tokenData && status === "success") {
          try {
            const tokens = JSON.parse(decodeURIComponent(tokenData))
            const integrationType = tokens.scope?.includes("read_insights") ? "facebook" : "gohighlevel"
            const cookieName = integrationType === "gohighlevel" ? "gohighlevel_tokens" : "facebook_tokens"
            const expiresIn = tokens.expires_in || (integrationType === "facebook" ? 60 * 24 * 60 * 60 : 3600)
            setCookie(cookieName, JSON.stringify(tokens), expiresIn)

            const newStatus = {
              connected: true,
              expires_at: tokens.expires_at,
              token_expired: tokens.expires_at ? new Date(tokens.expires_at) < new Date() : false,
            }

            if (integrationType === "gohighlevel") {
              localStorage.setItem("goHighLevelIntegration", JSON.stringify(newStatus))
              setGhlStatus(newStatus)
            } else {
              localStorage.setItem("facebookIntegration", JSON.stringify(newStatus))
              setFacebookStatus(newStatus)
            }

            toast.success("Connection Successful", {
              description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} connected successfully.`,
            })

            const storedRedirect = sessionStorage.getItem("post_integration_redirect")
            if (storedRedirect) {
              sessionStorage.removeItem("post_integration_redirect")
              const nextPath = await checkAndRefreshExpiredTokens(storedRedirect)
              if (nextPath !== null) router.push(nextPath)
            }
            return
          } catch (e) {
            console.error("Error parsing OAuth callback tokens:", e)
            setError("Invalid token data received")
            toast.error("Connection Failed", { description: "Invalid token data received" })
            return
          }
        }

        // Normal load — backend is the source of truth
        const res = await apiRequest("/api/status")
        if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`)
        const data = await res.json()

        // GHL: agency.connected is what controls the UI
        if (data.gohighlevel?.agency?.connected) {
          const s = {
            connected: true,
            expires_at: data.gohighlevel.agency.expires_at,
            token_expired: data.gohighlevel.agency.token_expired ?? false,
          }
          localStorage.setItem("goHighLevelIntegration", JSON.stringify(s))
          setGhlStatus(s)
        } else {
          setGhlStatus({ connected: false })
          localStorage.removeItem("goHighLevelIntegration")
        }

        // Facebook
        if (data.facebook?.connected) {
          const s = {
            connected: true,
            expires_at: data.facebook.expires_at,
            token_expired: data.facebook.token_expired ?? false,
          }
          localStorage.setItem("facebookIntegration", JSON.stringify(s))
          setFacebookStatus(s)
        } else {
          setFacebookStatus({ connected: false })
          localStorage.removeItem("facebookIntegration")
        }

        // HotProspector
        const hpRes = await apiRequest("/api/hotprospector/status")
        if (hpRes.ok) {
          const hpData = await hpRes.json()
          setHotprospectorStatus(hpData)
          // Cache so a remount shows the right state instantly (same pattern
          // as GHL and Facebook above).
          if (hpData?.connected) {
            localStorage.setItem("hotprospectorIntegration", JSON.stringify(hpData))
          } else {
            localStorage.removeItem("hotprospectorIntegration")
          }
        }

        // AI Credentials (BYOK)
        const aiRes = await apiRequest("/api/integrations/ai/status")
        if (aiRes.ok) {
          const aiData = await aiRes.json()
          setAiStatus(aiData)
          if (aiData?.configured) {
            localStorage.setItem("aiCredentialsIntegration", JSON.stringify(aiData))
          } else {
            localStorage.removeItem("aiCredentialsIntegration")
          }
        }

        // Slack bot
        const slackRes = await apiRequest("/api/integrations/slack/status")
        if (slackRes.ok) {
          const slackData = await slackRes.json()
          setSlackStatus(slackData)
          if (slackData?.installed) {
            localStorage.setItem("slackBotIntegration", JSON.stringify(slackData))
          } else {
            localStorage.removeItem("slackBotIntegration")
          }
        }

        // Refresh cycle status
        const cycleRes = await apiRequest("/api/client-groups/refresh-all/status")
        if (cycleRes.ok) setRefreshCycle(await cycleRes.json())

      } catch (err) {
        console.error("init error:", err)
        setError(`Failed to fetch integration status: ${err.message}`)
        toast.error("Error", { description: err.message })

        // Fall back to localStorage on error so UI still shows last known state
        try {
          const s = JSON.parse(localStorage.getItem("goHighLevelIntegration") || "{}")
          if (s.connected) setGhlStatus(s)
        } catch { }
        try {
          const s = JSON.parse(localStorage.getItem("facebookIntegration") || "{}")
          if (s.connected) setFacebookStatus(s)
        } catch { }
      } finally {
        setIsLoading(false)
        setStatusInitialLoading(false)
      }
    }

    init()
  }, [searchParams])

  // ── Cross-tab sync ────────────────────────────────────────────────────
  // If the user disconnects (or connects) an integration in another tab,
  // localStorage fires a `storage` event in every OTHER open tab. Hook in
  // so this tab updates without waiting for the next /api/status fetch —
  // avoids "still says Connected" for several seconds after a disconnect
  // happened elsewhere.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "goHighLevelIntegration") {
        setGhlStatus(readCachedStatus("goHighLevelIntegration"))
      } else if (e.key === "facebookIntegration") {
        setFacebookStatus(readCachedStatus("facebookIntegration"))
      } else if (e.key === "hotprospectorIntegration") {
        setHotprospectorStatus(readCachedStatus("hotprospectorIntegration"))
      } else if (e.key === "aiCredentialsIntegration") {
        setAiStatus(readCachedAiStatus())
      } else if (e.key === "slackBotIntegration") {
        setSlackStatus(readCachedSlackStatus())
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // ── Refresh-all cycle polling ──────────────────────────────────────────
  useEffect(() => {
    if (!refreshCycle.running) return
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest("/api/client-groups/refresh-all/status")
        if (res.ok) {
          const data = await res.json()
          setRefreshCycle(data)
          if (!data.running) clearInterval(interval)
        }
      } catch { /* ignore */ }
    }, 10_000)
    return () => clearInterval(interval)
  }, [refreshCycle.running])

  const handleStartRefreshAll = async () => {
    try {
      setRefreshStarting(true)
      const res = await apiRequest("/api/client-groups/refresh-all", { method: "POST" })
      if (!res.ok) throw new Error("Failed to start")
      const data = await res.json()
      if (data.status === "already_running") {
        toast.info("Refresh cycle is already running")
      } else {
        toast.success("Refresh cycle started", { description: "Groups will refresh one by one, every 15 minutes." })
      }
      // Fetch initial status
      const statusRes = await apiRequest("/api/client-groups/refresh-all/status")
      if (statusRes.ok) setRefreshCycle(await statusRes.json())
    } catch (err) {
      toast.error("Failed to start refresh", { description: err.message })
    } finally {
      setRefreshStarting(false)
    }
  }

  const handleStopRefreshAll = async () => {
    try {
      await apiRequest("/api/client-groups/refresh-all", { method: "DELETE" })
      setRefreshCycle(prev => ({ ...prev, running: false, current_group: null }))
      toast.success("Refresh cycle stopped")
    } catch (err) {
      toast.error("Failed to stop", { description: err.message })
    }
  }

  const handleConnect = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      const endpoint = integrationType === "gohighlevel" ? "/api/connect" : "/api/connect/facebook"
      const res = await apiRequest(endpoint)
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

  const handleConnectSlack = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await apiRequest("/api/connect/slack")
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `${res.status} ${res.statusText}`)
      }
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

  const handleRemoveIntegration = async (integrationType) => {
    try {
      setRemovingIntegration(integrationType)
      setError(null)

      const endpointMap = {
        gohighlevel: "/api/integrations/gohighlevel/remove",
        facebook: "/api/integrations/facebook/remove",
        hotprospector: "/api/integrations/hotprospector/remove",
        ai: "/api/integrations/ai/remove",
        slack: "/api/integrations/slack/remove",
      }

      const res = await apiRequest(endpointMap[integrationType], {
        method: "DELETE",
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `${res.status} ${res.statusText}`)
      }

      if (integrationType === "gohighlevel") {
        localStorage.removeItem("goHighLevelIntegration")
        clearCookie("gohighlevel_tokens")
        setGhlStatus({ connected: false })
      } else if (integrationType === "facebook") {
        localStorage.removeItem("facebookIntegration")
        clearCookie("facebook_tokens")
        setFacebookStatus({ connected: false })
      } else if (integrationType === "hotprospector") {
        localStorage.removeItem("hotprospectorIntegration")
        setHotprospectorStatus({ connected: false })
      } else if (integrationType === "ai") {
        localStorage.removeItem("aiCredentialsIntegration")
        window.dispatchEvent(new Event("aiCredentialsUpdated"))
        setAiStatus({ configured: false })
      } else if (integrationType === "slack") {
        localStorage.removeItem("slackBotIntegration")
        setSlackStatus({ installed: false })
      }

      const labelMap = {
        gohighlevel: "GoHighLevel",
        facebook: "Meta (Facebook)",
        hotprospector: "HotProspector",
        ai: "AI Credentials",
        slack: "Slack Bot",
      }

      toast.success("Integration Removed", {
        description: `${labelMap[integrationType]} credentials have been deleted.`,
      })
    } catch (err) {
      setError(`Failed to remove integration: ${err.message}`)
      toast.error("Removal Failed", { description: err.message })
    } finally {
      setRemovingIntegration(null)
    }
  }

  const handleTestApi = async (integrationType) => {
    try {
      setIsLoading(true)
      setError(null)
      const endpoint = integrationType === "gohighlevel" ? "/test" : "/test/facebook"
      const res = await apiRequest(endpoint)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      toast.success("Test Successful", { description: "API test passed." })
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
      const res = await apiRequest("/api/hotprospector/connect", {
        method: "POST",
        body: JSON.stringify(hotprospectorCredentials),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to connect HotProspector")
      }
      const data = await res.json()
      const hpNext = { connected: true, api_uid: hotprospectorCredentials.api_uid }
      setHotprospectorStatus(hpNext)
      localStorage.setItem("hotprospectorIntegration", JSON.stringify(hpNext))
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

  const handleAiConnect = async () => {
    try {
      setAiValidating(true)
      setError(null)
      const res = await apiRequest("/api/integrations/ai/connect", {
        method: "POST",
        body: JSON.stringify(aiCredentials),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // The backend's `detail` is already a specific, human-readable
        // rejection reason (e.g. "Invalid Anthropic API key.", "'gpt-4o'
        // did not respond with a tool call...") — show it directly.
        throw new Error(data.detail || "Failed to validate your AI credentials.")
      }
      const next = {
        configured: true,
        provider: data.provider,
        model: data.model,
        key_preview: data.key_preview,
        validated: data.validated,
      }
      setAiStatus(next)
      localStorage.setItem("aiCredentialsIntegration", JSON.stringify(next))
      window.dispatchEvent(new Event("aiCredentialsUpdated"))
      setAiDialogOpen(false)
      setAiCredentials({ provider: "anthropic", api_key: "", model: "" })
      toast.success("AI Connected", {
        description: `Birdy AI will now use your ${data.provider} key (${data.model}).`,
      })
    } catch (err) {
      toast.error("Connection Failed", { description: err.message })
    } finally {
      setAiValidating(false)
    }
  }

  // Reusable remove button with confirmation
  const RemoveButton = ({ integrationType, label }) => {
    const isRemoving = removingIntegration === integrationType
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isRemoving}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors disabled:opacity-50"
          >
            {isRemoving
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Removing…</>
              : "Remove"
            }
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your {label} credentials from Birdy. You will need
              to reconnect if you want to use this integration again. Client groups linked to
              this integration will lose their data source.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleRemoveIntegration(integrationType)}
            >
              Yes, remove it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <div className="min-h-dvh w-[calc(100dvw-70px)] md:w-[calc(100dvw-130px)] mx-auto">
      <div className="flex gap-4 flex flex-col py-2 md:py-0 md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-3xl md:text-3xl lg:text-4xl font-bold text-foreground text-center md:text-left whitespace-nowrap">Settings</h1>
      </div>

      <div>
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="w-full justify-start">
            {["general", "integrations", "account"].map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ))}
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
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Connected Services</h2>
                <p className="text-sm text-muted-foreground">Manage your third-party service integrations</p>
              </div>

              <Separator />

              {/* AI Credentials (BYOK) — gates the flagship chat feature, shown first */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">Birdy AI Agent</CardTitle>
                        {aiStatus.configured && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Connected
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        Connect your own Anthropic or OpenAI API key — Birdy AI chat uses it exclusively, nothing is sent through Birdy's own account.
                      </CardDescription>
                      {aiStatus.configured && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {aiStatus.provider === "anthropic" ? "Anthropic" : "OpenAI"} · {aiStatus.model} · Key {aiStatus.key_preview}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {aiStatus.configured ? (
                      <RemoveButton integrationType="ai" label="AI Credentials" />
                    ) : statusInitialLoading ? (
                      <Button size="sm" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking…
                      </Button>
                    ) : (
                      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                            Connect
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Connect Your AI Agent</DialogTitle>
                            <DialogDescription>
                              We verify your key supports tool use with a real test call before saving —
                              this can take a few seconds.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="ai_provider">Provider</Label>
                              <Select
                                value={aiCredentials.provider}
                                onValueChange={(value) =>
                                  setAiCredentials((prev) => ({ ...prev, provider: value, model: "" }))
                                }
                              >
                                <SelectTrigger id="ai_provider">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                                  <SelectItem value="openai">OpenAI</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ai_model">Model</Label>
                              <Select
                                value={aiCredentials.model}
                                onValueChange={(value) => setAiCredentials((prev) => ({ ...prev, model: value }))}
                              >
                                <SelectTrigger id="ai_model">
                                  <SelectValue placeholder="Select a model" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AI_MODELS[aiCredentials.provider].map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="ai_api_key">API Key</Label>
                              <Input
                                id="ai_api_key"
                                type="password"
                                placeholder="Enter your API key"
                                value={aiCredentials.api_key}
                                onChange={(e) =>
                                  setAiCredentials((prev) => ({ ...prev, api_key: e.target.value }))
                                }
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              disabled={aiValidating}
                              onClick={() => {
                                setAiDialogOpen(false)
                                setAiCredentials({ provider: "anthropic", api_key: "", model: "" })
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              onClick={handleAiConnect}
                              disabled={aiValidating || !aiCredentials.api_key || !aiCredentials.model}
                            >
                              {aiValidating
                                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Validating…</>
                                : "Connect"
                              }
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Slack Bot */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#4A154B] to-[#611f69] flex items-center justify-center shrink-0">
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">Slack Bot</CardTitle>
                        {slackStatus.installed && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Connected
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        Talk to Birdy AI from Slack — @mention the bot or DM it directly, using this account's own AI key.
                      </CardDescription>
                      {slackStatus.installed && (
                        <p className="text-xs text-muted-foreground mt-1">{slackStatus.team_name || slackStatus.team_id}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {slackStatus.installed ? (
                      <RemoveButton integrationType="slack" label="Slack Bot" />
                    ) : statusInitialLoading ? (
                      <Button size="sm" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking…
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleConnectSlack} disabled={isLoading}>
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Connect
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <a href="https://slack.com" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* GoHighLevel */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                      <Plug2 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">GoHighLevel</CardTitle>
                        {ghlStatus.connected && (
                          <Badge variant={ghlStatus.token_expired ? "destructive" : "default"} className="text-xs">
                            {ghlStatus.token_expired
                              ? <><XCircle className="h-3 w-3 mr-1" />Expired</>
                              : <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
                            }
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">CRM and marketing automation platform for agencies</CardDescription>
                      {ghlStatus.connected && ghlStatus.expires_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {new Date(ghlStatus.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ghlStatus.connected ? (
                      <>
                        {ghlStatus.token_expired && (
                          <Button size="sm" variant="destructive" onClick={() => handleConnect("gohighlevel")} disabled={isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Reconnect
                          </Button>
                        )}
                        <RemoveButton integrationType="gohighlevel" label="GoHighLevel" />
                      </>
                    ) : statusInitialLoading ? (
                      <Button size="sm" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking…
                      </Button>
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
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shrink-0">
                      <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">Meta (Facebook)</CardTitle>
                        {facebookStatus.connected && (
                          <Badge variant={facebookStatus.token_expired ? "destructive" : "default"} className="text-xs">
                            {facebookStatus.token_expired
                              ? <><XCircle className="h-3 w-3 mr-1" />Expired</>
                              : <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</>
                            }
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">Access Facebook insights and marketing tools</CardDescription>
                      {facebookStatus.connected && facebookStatus.expires_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Expires: {new Date(facebookStatus.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {facebookStatus.connected ? (
                      <>
                        {facebookStatus.token_expired && (
                          <Button size="sm" variant="destructive" onClick={() => handleConnect("facebook")} disabled={isLoading}>
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Reconnect
                          </Button>
                        )}
                        <RemoveButton integrationType="facebook" label="Meta (Facebook)" />
                      </>
                    ) : statusInitialLoading ? (
                      <Button size="sm" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking…
                      </Button>
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
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shrink-0">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">HotProspector</CardTitle>
                        {hotprospectorStatus.connected && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Connected
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">Lead generation and call center management platform</CardDescription>
                      {hotprospectorStatus.connected && hotprospectorStatus.api_uid && (
                        <p className="text-xs text-muted-foreground mt-1">API UID: {hotprospectorStatus.api_uid}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap">
                    {hotprospectorStatus.connected ? (
                      <RemoveButton integrationType="hotprospector" label="HotProspector" />
                    ) : statusInitialLoading ? (
                      <Button size="sm" disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Checking…
                      </Button>
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

              <Separator className="my-4" />

              {/* Refresh All Groups */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Data Refresh</h2>
                <p className="text-sm text-muted-foreground">Manually refresh cached data for all client groups</p>
              </div>

              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0">
                      <RefreshCw className={`h-6 w-6 text-white ${refreshCycle.running ? "animate-spin" : ""}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">Refresh All Groups</CardTitle>
                        {refreshCycle.running && (
                          <Badge variant="default" className="text-xs">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />Running
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        Refreshes Meta and GHL data for every client group, one at a time, every 15 minutes.
                      </CardDescription>
                      {refreshCycle.running && refreshCycle.current_group && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Currently refreshing: <span className="font-medium text-foreground">{refreshCycle.current_group}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Progress: {refreshCycle.groups_done} / {refreshCycle.groups_total} groups
                          </p>
                          {refreshCycle.groups_total > 0 && (
                            <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                              <div
                                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${(refreshCycle.groups_done / refreshCycle.groups_total) * 100}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {refreshCycle.running ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={handleStopRefreshAll}
                      >
                        Stop
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleStartRefreshAll} disabled={true}>
                        {refreshStarting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Start Refresh Cycle
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            {/* ── Current Plan Card ── */}
            {billingStatus?.subscribed && (() => {
              const PLANS = [
                { id: "starter", name: "Starter", color: "blue",    maxClients: 3  },
                { id: "growth",  name: "Growth",  color: "purple",  maxClients: 10 },
                { id: "scale",   name: "Scale",   color: "emerald", maxClients: 25 },
              ]
              const COLOR_CLASSES = {
                blue:    { border: "border-blue-500",    light: "bg-blue-50",    text: "text-blue-600",    bg: "bg-blue-600"    },
                purple:  { border: "border-purple-500",  light: "bg-purple-50",  text: "text-purple-600",  bg: "bg-purple-600"  },
                emerald: { border: "border-emerald-500", light: "bg-emerald-50", text: "text-emerald-600", bg: "bg-emerald-600" },
              }
              const STATUS_STYLES = {
                active:   "bg-green-100 text-green-700 border-green-200",
                trialing: "bg-blue-100 text-blue-700 border-blue-200",
                past_due: "bg-amber-100 text-amber-700 border-amber-200",
                canceled: "bg-red-100 text-red-700 border-red-200",
                inactive: "bg-gray-100 text-gray-600 border-gray-200",
              }
              const STATUS_LABELS = { active: "Active", trialing: "Trial", past_due: "Past Due", canceled: "Canceled", inactive: "No Plan" }

              const plan = PLANS.find(p => p.id === billingStatus.plan?.id)
              if (!plan) return null
              const c = COLOR_CLASSES[plan.color]
              const usagePct = Math.min(100, (billingStatus.client_count / Math.max(billingStatus.client_limit, 1)) * 100)

              return (
                <div className={`rounded-2xl border-2 ${c.border} ${c.light} p-5`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <Crown className={`w-6 h-6 ${c.text}`} />
                      <div>
                        <p className="text-xs text-gray-500 font-medium">Current Plan</p>
                        <h3 className={`text-xl font-bold ${c.text}`}>{plan.name}</h3>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[billingStatus.status] ?? STATUS_STYLES.inactive}`}>
                        {STATUS_LABELS[billingStatus.status] ?? billingStatus.status}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Client groups</span>
                        <span className="font-medium text-gray-700">
                          {billingStatus.client_count} / {billingStatus.client_limit}
                          {billingStatus.extra_clients_paid > 0 && (
                            <span className="ml-1 text-emerald-600">(+{billingStatus.extra_clients_paid} extra)</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-white rounded-full border border-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${usagePct >= 90 ? "bg-red-500" : c.bg}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    </div>

                    {billingStatus.current_period_end && (
                      <div className="text-sm text-gray-600 shrink-0">
                        <p className="text-xs text-gray-400 mb-0.5">
                          {billingStatus.cancel_at_period_end ? "Cancels" : "Renews"}
                        </p>
                        <p className="font-medium">
                          {new Date(billingStatus.current_period_end).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handlePortal}
                      disabled={loadingPortal}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-60 shrink-0"
                    >
                      {loadingPortal
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <ExternalLink className="w-4 h-4" />
                      }
                      Manage Billing
                    </button>
                  </div>

                  {billingStatus.cancel_at_period_end && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Your subscription will cancel at the end of this billing period.
                    </div>
                  )}
                </div>
              )
            })()}
            <Card>
              <CardHeader>
                <CardTitle className="text-semibold text-2xl">Account Information</CardTitle>
                <CardDescription className="text-[#71658B] mb-2">Manage your account preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h1 className="text-sm font-semibold leading-none">Name</h1>
                  <input
                    type="text"
                    value={user?.name ?? ""}
                    readOnly
                    disabled
                    className="flex bg-[#F9F8FC] font-semibold h-10 w-full rounded-md border border-input px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="space-y-2 mt-6">
                    <h1 className="text-sm font-semibold leading-none">Email</h1>
                    <input
                      type="text"
                      value={user?.email ?? ""}
                      readOnly
                      disabled
                      className="bg-[#F9F8FC] flex font-semibold h-10 w-full rounded-md border border-input px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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