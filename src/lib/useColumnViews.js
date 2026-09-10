// lib/useColumnViews.js
// Shared hook for loading & saving per-page column views from the backend.
//
// Every table page mounts this, so it used to be a fetch per page with a
// localStorage copy in front of it — and a save had to write that copy, then
// immediately clear it so the next mount wouldn't read something stale. All
// pages' views come back in one small object under a single key, so SWR holds
// exactly one of them and a save just tells it what changed.

import { useCallback, useEffect, useRef } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { optionalFetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"

export function useColumnViews(page) {
  // optionalFetcher: a user who has never saved a view has no row, and that
  // is not an error — the page falls back to its default columns.
  const { data: views, isLoading, mutate } = useSWR(
    queryKeys.userViews(),
    optionalFetcher
  )

  const savedColumns = views?.[page] ?? null
  // Settled once there is an answer, even if a revalidation is still running
  // behind it — pages hold off rendering columns until this flips, so tying it
  // to "no request in flight" would stall them on every background refresh.
  const viewsLoaded = views !== undefined

  const saveView = useCallback(
    async (columns) => {
      // Paint the new columns before the request goes out, and tell SWR to
      // confirm against the server afterwards. Every other mounted instance of
      // this hook — the other table pages — sees it at the same moment,
      // because they are all reading the one cache entry.
      const optimistic = { ...(views ?? {}), [page]: columns }

      try {
        await mutate(
          async () => {
            const res = await apiRequest(queryKeys.userViews(), {
              method: "PATCH",
              body: JSON.stringify({ page, visible_columns: columns }),
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return optimistic
          },
          { optimisticData: optimistic, rollbackOnError: true, revalidate: true }
        )

        toast.success("View saved!")
      } catch (err) {
        console.error("[useColumnViews] Save failed:", err)
        toast.error("Failed to save view")
      }
    },
    [page, views, mutate]
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
