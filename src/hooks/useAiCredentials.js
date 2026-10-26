"use client"

import { useState, useEffect, useLayoutEffect, useCallback } from "react"
import { apiRequest } from "@/lib/api"

const CACHE_KEY = "aiCredentialsIntegration"

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.configured ? parsed : { configured: false }
  } catch {
    return { configured: false }
  }
}

/**
 * Whether the current user has connected their own Anthropic/OpenAI API key
 * (BYOK) — Birdy AI chat is fully blocked (no fallback) until this is true.
 * Caches to localStorage (matching the Settings page's integration-status
 * pattern) so returning users don't see a flash on remount, and stays in
 * sync across tabs/mounts via both the native `storage` event and a custom
 * "aiCredentialsUpdated" event (fired by the Settings page on save/remove —
 * see src/app/settings/page.jsx — for the one case `storage` can't cover:
 * an already-mounted BirdyChatModal instance in the same tab/document).
 */
export function useAiCredentials() {
  // The cache is read after mount, never during render: the server has no
  // localStorage, so a lazy initial read made the first client render differ
  // from the server's (React hydration error 418 on /ask-birdy). `hydrated` tells
  // callers the cache has been consulted, so they can hold a neutral shell
  // instead of flashing the "add your key" state at a returning user.
  const [status, setStatus] = useState({ configured: false })
  const [hydrated, setHydrated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Layout effect: runs before the first paint, so a returning user never sees
  // the blank shell frame (it is a no-op on the server, with no SSR warning in React 19).
  useLayoutEffect(() => {
    setStatus(readCache())
    setHydrated(true)
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiRequest("/api/integrations/ai/status")
      if (!res.ok) return
      const data = await res.json()
      setStatus(data)
      if (data.configured) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      } else {
        localStorage.removeItem(CACHE_KEY)
      }
    } catch {
      // keep the cached value on a network error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === CACHE_KEY) setStatus(readCache())
    }
    const onCustomEvent = () => setStatus(readCache())
    window.addEventListener("storage", onStorage)
    window.addEventListener("aiCredentialsUpdated", onCustomEvent)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("aiCredentialsUpdated", onCustomEvent)
    }
  }, [])

  const markUnconfigured = useCallback(() => {
    localStorage.removeItem(CACHE_KEY)
    setStatus({ configured: false })
  }, [])

  return {
    configured: !!status.configured,
    hydrated,
    loading,
    provider: status.provider,
    model: status.model,
    keyPreview: status.key_preview,
    validated: status.validated,
    refresh: fetchStatus,
    markUnconfigured,
  }
}
