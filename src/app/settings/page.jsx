"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { usePageHeader } from "@/components/page-header"
import { pdFontClass } from "@/lib/pd-fonts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GeneralSettings } from "@/components/settings/GeneralSettings"
import { CreditsPanel } from "@/components/settings/CreditsPanel"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, Plug2, Phone, RefreshCw, Target, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
import { Crown } from "lucide-react"

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // The tabs were general/integrations/capabilities/account and are now
  // general/integrations/billing. A bookmarked ?tab= from before would select
  // a tab that no longer exists and render an empty page, so old names map to
  // where their content went.
  const TAB_ALIASES = { account: "billing", capabilities: "general" }
  const requestedTab = searchParams.get("tab")
  const defaultTab =
    TAB_ALIASES[requestedTab] ??
    (["general", "integrations", "billing"].includes(requestedTab)
      ? requestedTab
      : "integrations")

  // Title in the global top bar, in place of the Birdy wordmark — the same
  // place every other redesigned page puts it. No controls: this page's tabs
  // are its own navigation, not a filter over shared data.
  const header = useMemo(
    () => ({
      title: (
        <div className={`${pdFontClass} min-w-0`}>
          <h1 className="truncate font-pd-display text-[19px] font-bold leading-none tracking-[-0.02em] text-pd-ink">
            Settings
          </h1>
          <p className="mt-1 truncate text-[12px] leading-none text-pd-faint">
            Your account, your connected sources and your plan
          </p>
        </div>
      ),
    }),
    []
  )
  usePageHeader(header)

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
  // Shape convention: Slack reports `installed`, not `connected`.
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
  const [slackChannels, setSlackChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelsError, setChannelsError] = useState(false)
  const [savingChannel, setSavingChannel] = useState(false)
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
  const [isLoading, setIsLoading] = useState(false)
  const [removingIntegration, setRemovingIntegration] = useState(null)
  const [error, setError] = useState(null)
  // ── Capabilities (Settings → Capabilities tab) ────────────────────────────
  // Per-user Birdy agent ability toggles, persisted server-side via
  // /api/capabilities. `capsLoaded` gates the switches until the real values
  // arrive so we don't flash a default-off state over an enabled capability.
  const [capabilities, setCapabilities] = useState({ media_buying: false })
  const [capsLoaded, setCapsLoaded] = useState(false)
  const [savingCapability, setSavingCapability] = useState(null) // capability key mid-save
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

  // Load the user's capability flags for the Capabilities tab.
  useEffect(() => {
    apiRequest("/api/capabilities")
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setCapabilities(prev => ({ ...prev, ...data })) })
      .catch(() => {})
      .finally(() => setCapsLoaded(true))
  }, [])

  // Toggle a capability with optimistic UI + revert on failure. The backend
  // returns the full resolved set, so we reconcile against its response.
  const toggleCapability = async (key, next) => {
    const previous = capabilities[key]
    setCapabilities(c => ({ ...c, [key]: next }))
    setSavingCapability(key)
    try {
      const res = await apiRequest("/api/capabilities", {
        method: "PUT",
        body: JSON.stringify({ [key]: next }),
      })
      if (!res.ok) throw new Error("Failed to save capability")
      const data = await res.json()
      setCapabilities(c => ({ ...c, ...data }))
      toast.success(next ? "Capability enabled" : "Capability disabled", {
        description: "New Birdy chats will use this setting.",
      })
    } catch (err) {
      setCapabilities(c => ({ ...c, [key]: previous })) // revert optimistic change
      toast.error("Couldn't update capability", { description: "Please try again." })
    } finally {
      setSavingCapability(null)
    }
  }

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

        // An OAuth hop started elsewhere (e.g. the onboarding wizard) stashes
        // its return path here; honour it for every callback shape, not just
        // the GHL/Meta tokens one below.
        const storedRedirect = sessionStorage.getItem("post_integration_redirect")

        if (errorMsg && status === "error") {
          const msg = `${errorMsg}${errorDescription ? `: ${errorDescription}` : ""}`
          setError(msg)
          toast.error("Connection Failed", { description: msg })
          if (storedRedirect) {
            sessionStorage.removeItem("post_integration_redirect")
            router.push(storedRedirect)
          }
          return
        }

        // Slack's callback returns status=success with no tokens payload.
        if (status === "success" && !tokenData && storedRedirect) {
          sessionStorage.removeItem("post_integration_redirect")
          router.push(storedRedirect)
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

  const loadSlackChannels = async () => {
    if (slackChannels.length > 0 || channelsLoading) return
    setChannelsLoading(true)
    setChannelsError(false)
    try {
      const res = await apiRequest("/api/integrations/slack/channels")
      if (!res.ok) throw new Error("list failed")
      const data = await res.json()
      setSlackChannels(data.channels || [])
    } catch {
      setChannelsError(true)
    } finally {
      setChannelsLoading(false)
    }
  }

  const saveSlackChannel = async (value) => {
    const channelId = value === "__none__" ? null : value
    const chan = slackChannels.find((c) => c.id === channelId)
    setSavingChannel(true)
    try {
      const res = await apiRequest("/api/integrations/slack/channel", {
        method: "PUT",
        body: JSON.stringify({ channel_id: channelId, channel_name: chan?.name || null }),
      })
      if (res.ok) {
        const next = { ...slackStatus, notify_channel_id: channelId, notify_channel_name: chan?.name || null }
        setSlackStatus(next)
        try { localStorage.setItem("slackBotIntegration", JSON.stringify(next)) } catch {}
        toast.success(channelId ? `Suggestions will post to #${chan?.name}` : "Suggestion posting turned off")
      } else {
        toast.error("Couldn't save channel")
      }
    } catch {
      toast.error("Couldn't save channel")
    } finally {
      setSavingChannel(false)
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
      } else if (integrationType === "slack") {
        localStorage.removeItem("slackBotIntegration")
        setSlackStatus({ installed: false })
      }

      const labelMap = {
        gohighlevel: "GoHighLevel",
        facebook: "Meta (Facebook)",
        hotprospector: "HotProspector",
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
      <div>
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className="w-full justify-start">
            {[
              { key: "general", label: "General" },
              { key: "integrations", label: "Integrations" },
              { key: "billing", label: "Billing" },
            ].map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <GeneralSettings
              slackConnected={Boolean(slackStatus?.installed)}
              brief={slackStatus?.brief}
              onBriefSaved={(brief) => setSlackStatus((prev) => ({ ...prev, brief }))}
            />

            {/* The design drops the Capabilities tab, but the Media Buying
                Analyst toggle behind it is real functionality — removing the
                tab must not remove the switch, so it lives here now. */}
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Agent Capabilities</h2>
                <p className="text-sm text-muted-foreground">
                  Optional abilities for the Birdy AI agent. Turn these on to give Birdy extra expertise in chat — they take effect on your next Birdy conversation.
                </p>
              </div>

              <Separator />

              {/* Media Buying Analyst — injects senior-media-buyer reasoning into Birdy chat */}
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">Media Buying Analyst</CardTitle>
                            {capsLoaded && capabilities.media_buying && (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Enabled
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-sm">
                            Adds senior media-buyer reasoning to Birdy chat — it diagnoses CPL, CTR, CPM and ROAS
                            across campaigns, ad sets and ads, judges lead quality through GoHighLevel, and recommends
                            what to scale, kill, and fix. Applies to the Campaigns, Dashboard, client, and Ask&nbsp;Birdy
                            chats (not the Alerts or Metrics assistants).
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          {savingCapability === "media_buying" && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            checked={!!capabilities.media_buying}
                            onCheckedChange={(v) => toggleCapability("media_buying", v)}
                            disabled={!capsLoaded || savingCapability === "media_buying"}
                            aria-label="Toggle the Media Buying Analyst capability"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                More capabilities are coming. Have one in mind? Let us know.
              </p>
            </div>
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


              {/* Slack */}
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

                  {slackStatus.installed && (
                    <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">AI suggestions channel</p>
                        <p className="text-xs text-muted-foreground">
                          Birdy posts each new suggestion here with “Do it for me” and “Ignore” buttons. Change it anytime.
                        </p>
                      </div>
                      {channelsError ? (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Couldn’t load channels — your Slack connection predates channel support.{" "}
                            <button onClick={handleConnectSlack} className="underline font-medium">
                              Reconnect Slack
                            </button>{" "}
                            to enable it.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Select
                            value={slackStatus.notify_channel_id || ""}
                            onValueChange={saveSlackChannel}
                            disabled={savingChannel}
                            onOpenChange={(o) => { if (o) loadSlackChannels() }}
                          >
                            <SelectTrigger className="w-[240px]">
                              <SelectValue placeholder={channelsLoading ? "Loading channels…" : "Select a channel…"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Don’t post —</SelectItem>
                              {slackChannels.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.is_private ? "🔒 " : "# "}{c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {savingChannel && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </div>
                      )}
                      {slackStatus.notify_channel_name && !channelsError && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Posting to #{slackStatus.notify_channel_name}
                        </p>
                      )}
                    </div>
                  )}
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


          <TabsContent value="billing" className="space-y-6">
            {/* Credits, packs and the 30-day usage chart the design asks for.
                The same panel the standalone /credits page renders, so the two
                cannot drift. */}
            <CreditsPanel />

            <Separator />

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