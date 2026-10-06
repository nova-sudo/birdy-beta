"use client"

import { useEffect, useState } from "react"

import { apiRequest } from "@/lib/api"

// Settings caches the HotProspector status under this key when it loads or
// connects; reading it first means a page that already knows says so at once.
const CACHE_KEY = "hotprospectorIntegration"

function readCached() {
  try {
    return !!JSON.parse(localStorage.getItem(CACHE_KEY) || "null")?.connected
  } catch {
    return false
  }
}

/** Whether this account has HotProspector connected. False until known. */
export function useHotProspectorConnected() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let cancelled = false
    setConnected(readCached())
    apiRequest("/api/hotprospector/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setConnected(!!data.connected)
        try {
          if (data.connected) localStorage.setItem(CACHE_KEY, JSON.stringify(data))
          else localStorage.removeItem(CACHE_KEY)
        } catch {
          // Storage unavailable — the live answer above still stands.
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return connected
}
