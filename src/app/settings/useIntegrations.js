import { useState, useEffect, useLayoutEffect } from "react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { peekOAuthHandoff, takeOAuthHandoff } from "@/lib/oauth-handoff"

// Separate state variables with clear naming — no ambiguity about which level of nesting.
//
// Lazy-init from localStorage so a remount (e.g. user navigates to /meta
// and comes back) doesn't flash a stale "Connect" button while
// /api/status is in flight. The init effect below still hits the backend
// and overwrites with truth — this just bridges the network gap with the
// last-known-good state.
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

// Integrations tab state: the four service statuses (cached in localStorage),
// the OAuth callback handling, and the connect and remove flows. `router`,
// `searchParams` and `setPassingThrough` come from the page, which owns the
// hand-off screen.
export function useIntegrations({ router, searchParams, setPassingThrough }) {
  const [ghlStatus, setGhlStatus] = useState({ connected: false })
  const [facebookStatus, setFacebookStatus] = useState({ connected: false })
  const [hotprospectorStatus, setHotprospectorStatus] = useState({ connected: false })
  const [slackStatus, setSlackStatus] = useState({ installed: false })
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

  // Fill the statuses from the cache before the first paint. A layout effect
  // rather than the useState initialisers, so storage and the clock are not
  // read while rendering; it still runs ahead of the browser's paint, so a
  // returning user never sees the empty state.
  useLayoutEffect(() => {
    setGhlStatus(readCachedStatus("goHighLevelIntegration"))
    setFacebookStatus(readCachedStatus("facebookIntegration"))
    setHotprospectorStatus(readCachedStatus("hotprospectorIntegration"))
    setSlackStatus(readCachedSlackStatus())
  }, [])

  const [hotprospectorDialogOpen, setHotprospectorDialogOpen] = useState(false)
  const [hotprospectorCredentials, setHotprospectorCredentials] = useState({ api_uid: "", api_key: "" })
  const [isLoading, setIsLoading] = useState(false)
  const [removingIntegration, setRemovingIntegration] = useState(null)
  const [error, setError] = useState(null)
  // The message of a failed status probe, so the page can offer a retry for
  // that failure only (a failed connect or remove sets `error` but not this).
  const [statusError, setStatusError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const setCookie = (name, value, maxAge) => {
    const safeMaxAge = Number.isInteger(maxAge) && maxAge > 0 ? maxAge : 3600
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${safeMaxAge}; SameSite=Lax`
  }

  const clearCookie = (name) => {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
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
        //
        // `replace`, not `push`, on every one of these: the URL being left
        // behind carries the callback's tokens and status, so leaving it in
        // history means a back button re-runs a spent OAuth callback — and,
        // from the wizard, walks the user into the settings page they were
        // just spared.
        const storedRedirect = peekOAuthHandoff()

        if (errorMsg && status === "error") {
          const msg = `${errorMsg}${errorDescription ? `: ${errorDescription}` : ""}`
          setError(msg)
          // The toast is the only account of the failure that survives the
          // redirect — the wizard re-probes /api/status and would otherwise
          // just show an un-explained "not connected".
          toast.error("Connection Failed", { description: msg })
          if (storedRedirect) {
            takeOAuthHandoff()
            router.replace(storedRedirect)
          }
          return
        }

        // Slack's callback returns status=success with no tokens payload.
        if (status === "success" && !tokenData && storedRedirect) {
          takeOAuthHandoff()
          router.replace(storedRedirect)
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

            const handoff = takeOAuthHandoff()

            // Only announce it to someone who is staying to read it. The
            // wizard confirms the connection in its own words on the step
            // itself, so a toast on the way out is a second, redundant one
            // that lands over the top of it.
            if (!handoff) {
              toast.success("Connection Successful", {
                description: `${integrationType === "gohighlevel" ? "GoHighLevel" : "Meta"} connected successfully.`,
              })
            } else {
              // Straight back to whoever started the hop. Deliberately not via
              // checkAndRefreshExpiredTokens: that re-inspects /api/status and
              // can launch a second OAuth redirect off its own bat — which,
              // mid-wizard, is a decision that belongs to the wizard, and
              // which it will make itself when it probes the integrations on
              // boot. Its round-trip was also most of the delay the user saw
              // here, spent on a screen they had already left.
              router.replace(handoff)
            }
            return
          } catch (e) {
            console.error("Error parsing OAuth callback tokens:", e)
            // Nothing to hand back — the callback is unreadable, so drop the
            // return path and stay here to say so. Staying means rendering the
            // real page, so the hand-off screen has to come down with it or
            // the error would have nowhere to show.
            takeOAuthHandoff()
            setPassingThrough(false)
            setError("Invalid token data received")
            toast.error("Connection Failed", { description: "Invalid token data received" })
            return
          }
        }

        // A callback shape none of the branches above claimed — a bare
        // ?status=error with no error text, say — while a return path is still
        // pending. Honour it anyway: recognising the shape was never what made
        // the redirect correct, and falling through to the normal load would
        // leave the user on the hand-off screen with nothing left to move them
        // off it.
        if (storedRedirect && (tokenData || status || errorMsg)) {
          takeOAuthHandoff()
          router.replace(storedRedirect)
          return
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

      } catch (err) {
        console.error("init error:", err)
        setError(`Failed to fetch integration status: ${err.message}`)
        setStatusError(`Failed to fetch integration status: ${err.message}`)
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
  }, [searchParams, reloadKey])

  const retryStatus = () => setReloadKey((k) => k + 1)

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

  return {
    statusError,
    retryStatus,
    ghlStatus,
    facebookStatus,
    hotprospectorStatus,
    slackStatus,
    setSlackStatus,
    slackChannels,
    channelsLoading,
    channelsError,
    savingChannel,
    statusInitialLoading,
    hotprospectorDialogOpen,
    setHotprospectorDialogOpen,
    hotprospectorCredentials,
    setHotprospectorCredentials,
    isLoading,
    removingIntegration,
    error,
    handleConnect,
    loadSlackChannels,
    saveSlackChannel,
    handleConnectSlack,
    handleRemoveIntegration,
    handleHotprospectorConnect,
  }
}
