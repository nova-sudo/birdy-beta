// lib/useColumnViews.js
// Shared hook for loading & saving per-page column views from the backend.
//
// Usage:
//   const { savedColumns, saveView, viewsLoaded } = useColumnViews("campaigns")
//
// - savedColumns  : string[] | null  (null = no saved view for this page)
// - viewsLoaded   : boolean          (true once the network call settles — success OR error)
// - saveView(cols): async fn that PATCHes the backend and shows a toast
//
// IMPORTANT: viewsLoaded starts as false. Pages should render a
// "Loading your custom view…" skeleton instead of the real table until
// viewsLoaded is true. This prevents the default columns flashing before
// the saved ones appear.

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://birdy-backend.vercel.app"

export function useColumnViews(page) {
  const [savedColumns, setSavedColumns] = useState(null)
  const [viewsLoaded, setViewsLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/user/views`, {
          credentials: "include",
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!cancelled) {
          setSavedColumns(data[page] ?? null)
        }
      } catch (err) {
        console.warn(`[useColumnViews] Could not load views for "${page}":`, err)
        // savedColumns stays null → page will use its built-in defaults
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
        const res = await fetch(`${API_BASE}/api/user/views`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page, visible_columns: columns }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setSavedColumns(columns)
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