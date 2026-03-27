// lib/useColumnViews.js
// Shared hook for loading & saving per-page column views from the backend.
// Now with localStorage cache — if views were prefetched at login, this returns instantly.

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api"
import { getCachedData, setCachedData } from "@/lib/cache"
import { CACHE_KEYS } from "@/lib/constants"

export function useColumnViews(page) {
  const [savedColumns, setSavedColumns] = useState(null)
  const [viewsLoaded, setViewsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Check cache first (populated by prefetchAfterLogin or a previous page visit)
        const cached = getCachedData(CACHE_KEYS.USER_VIEWS)
        if (cached) {
          if (!cancelled) {
            setSavedColumns(cached[page] ?? null)
            setViewsLoaded(true)
          }
          return
        }

        // Cache miss — fetch from API
        const res = await fetch(`${API_BASE_URL}/api/user/views`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        // Cache the full response for all pages
        setCachedData(CACHE_KEYS.USER_VIEWS, data)

        if (!cancelled) {
          setSavedColumns(data[page] ?? null)
        }
      } catch (err) {
        console.warn(`[useColumnViews] Could not load views for "${page}":`, err)
      } finally {
        if (!cancelled) setViewsLoaded(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [page])

  const saveView = useCallback(
    async (columns) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/user/views`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, visible_columns: columns }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSavedColumns(columns)

        // Update cache in-place so other pages see the change
        const cached = getCachedData(CACHE_KEYS.USER_VIEWS) || {}
        cached[page] = columns
        setCachedData(CACHE_KEYS.USER_VIEWS, cached)

        toast.success("View saved!")
      } catch (err) {
        console.error("[useColumnViews] Save failed:", err)
        toast.error("Failed to save view")
      }
    },
    [page]
  )

  return { savedColumns, saveView, viewsLoaded }
}
