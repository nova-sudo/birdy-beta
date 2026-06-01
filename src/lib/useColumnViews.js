// lib/useColumnViews.js
// Shared hook for loading & saving per-page column views from the backend.
// Now with localStorage cache — if views were prefetched at login, this returns instantly.

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api"
import { getCachedData, setCachedData, clearCache } from "@/lib/cache"
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

  // Original signature: saveView(columns) — saves the current page's columns.
  // FIX: cache update now merges instead of overwriting, so other pages aren't wiped.
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

        // Update local state immediately so the current page reflects the save
        setSavedColumns(columns)

        // Merge the new value into the cache so other hook instances that are
        // still mounted get the updated columns without a full refetch.
        // Then invalidate (clear) the cache so the NEXT fresh load re-fetches
        // from the API — this prevents any stale data surviving across sessions
        // or page navigations.
        const cached = getCachedData(CACHE_KEYS.USER_VIEWS) || {}
        const updated = { ...cached, [page]: columns }
        setCachedData(CACHE_KEYS.USER_VIEWS, updated)

        // Invalidate so the next mount always gets server-fresh data
        clearCache(CACHE_KEYS.USER_VIEWS)

        toast.success("View saved!")
      } catch (err) {
        console.error("[useColumnViews] Save failed:", err)
        toast.error("Failed to save view")
      }
    },
    [page]
  )

  // ── Debounced auto-save ──────────────────────────────────────────────────
  // Used by pages to persist column order changes (drag-reorder events) the
  // moment they happen — no need for the user to click "Save View". Rapid
  // consecutive reorders are collapsed into a single API call after `delay`
  // ms of silence so the network doesn't get hammered.
  const debounceTimerRef = useRef(null)

  const saveViewDebounced = useCallback(
    (columns, delay = 600) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        saveView(columns)
        debounceTimerRef.current = null
      }, delay)
    },
    [saveView]
  )

  // Clear any pending debounced save when the component unmounts so we don't
  // fire a PATCH against a navigated-away page.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  return { savedColumns, saveView, saveViewDebounced, viewsLoaded }
}
