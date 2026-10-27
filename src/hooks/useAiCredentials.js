"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [status, setStatus] = useState(() => readCache())
  const [loading, setLoading] = useState(true)

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
    loading,
    provider: status.provider,
    model: status.model,
    keyPreview: status.key_preview,
    validated: status.validated,
    refresh: fetchStatus,
    markUnconfigured,
  }
}
