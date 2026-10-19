"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { migrate } from "dashkit/core"
import { registry } from "@/lib/dashkit/registry"
import { store } from "@/lib/dashkit/store"
import { dataSource } from "@/lib/dashkit/data-source"
import { queryKeys } from "@/lib/query-keys"

/**
 * One saved dashboard document, and the write that saves it.
 *
 * Documents saved before dashkit 0.3.0 are v1 (sections of spanned widgets).
 * They are upgraded here, in memory, as they load: `migrate` turns each
 * titled section into a heading widget and places the widgets on the grid
 * (a no-op on v2 docs). The next save stores v2, which is all the backend
 * accepts, so no bulk migration is needed.
 *
 * The page keeps its own live copy once this has loaded (the editor owns undo
 * history and unsaved edits), so this cache only has to hold the last saved
 * version: `save` writes it back without a refetch, which would otherwise race
 * the next edit.
 */
export function useDashboardDoc(id) {
  const { data, error, isLoading, mutate } = useSWR(id ? queryKeys.dashboard(id) : null, async () =>
    migrate(await store.load(id), { registry }),
  )

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
