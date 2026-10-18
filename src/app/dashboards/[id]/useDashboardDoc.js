"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { store } from "@/lib/dashkit/store"
import { dataSource } from "@/lib/dashkit/data-source"
import { queryKeys } from "@/lib/query-keys"

/**
 * One saved dashboard document, and the write that saves it.
 *
 * The page keeps its own live copy once this has loaded (the editor owns undo
 * history and unsaved edits), so this cache only has to hold the last saved
 * version: `save` writes it back without a refetch, which would otherwise race
 * the next edit.
 */
export function useDashboardDoc(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.dashboard(id) : null, () => store.load(id))

  const save = useCallback(
    async (doc) => {
      const saved = await store.save(doc)
      await mutate(saved, { revalidate: false })
      return saved
    },
    [mutate],
  )

  return { doc: data ?? null, isLoading, error, save }
}

/**
 * The metric catalog: what a binding may name. The editor's pickers and
 * validation need it, so the page holds the editor back until it is here; the
 * read-only view can render without it.
 */
export function useDashboardCatalog() {
  const { data, error, isLoading } = useSWR(queryKeys.dashboardCatalog(), () => dataSource.catalog(), {
    // Changes only when Birdy ships new metrics; no need to chase focus.
    revalidateOnFocus: false,
  })
  return { catalog: data ?? null, isLoading, error }
}
