"use client"

import { useCallback, useMemo } from "react"
import useSWR from "swr"
import { migrate } from "dashkit/core"
import { registry } from "@/lib/dashkit/registry"
import { store } from "@/lib/dashkit/store"
import { dataSource } from "@/lib/dashkit/data-source"
import { queryKeys } from "@/lib/query-keys"

/**
 * One saved dashboard document, and the write that saves it.
 *
 * Stored documents may be older than dashkit 0.4.0: v1 (sections of spanned
 * widgets, before 0.3.0) or v2 (a binding per slot). They are upgraded here,
 * in memory, as they load: `migrate` takes them to v3 (one `query` per
 * widget), a no-op on v3 docs. The next save stores v3, so no bulk migration
 * is needed.
 *
 * The migration needs the metric catalog: it decides what some v2 widgets
 * become (a donut of a metric that doesn't add up turns into a bar chart, a
 * chart keeps only the metrics that share its first one's format). The backend
 * migrates stored docs with the same catalog, so both sides see the same v3
 * doc. Until the catalog is here there is no doc; a catalog that fails to
 * load is this hook's error too.
 *
 * The cache holds the doc as stored (or as last saved); the migrated copy is
 * derived from it. The page keeps its own live copy once this has loaded (the
 * editor owns undo history and unsaved edits), so this cache only has to hold
 * the last saved version: `save` writes it back without a refetch, which would
 * otherwise race the next edit.
 */
export function useDashboardDoc(id) {
  const { data, error: loadError, isLoading: docLoading, mutate } = useSWR(id ? queryKeys.dashboard(id) : null, () =>
    store.load(id),
  )
  const { catalog, error: catalogError, isLoading: catalogLoading } = useDashboardCatalog()

  const migrated = useMemo(() => {
    if (!data || !catalog) return { doc: null, error: null }
    try {
      return { doc: migrate(data, { registry, catalog }), error: null }
    } catch (err) {
      return { doc: null, error: err }
    }
  }, [data, catalog])

  const save = useCallback(
    async (doc) => {
      const saved = await store.save(doc)
      await mutate(saved, { revalidate: false })
      return saved
    },
    [mutate],
  )

  return {
    doc: migrated.doc,
    isLoading: docLoading || catalogLoading,
    error: loadError ?? catalogError ?? migrated.error ?? undefined,
    save,
  }
}

/**
 * The metric catalog: what a query may name. The doc's migration, the
 * editor's pickers and validation need it, so the page waits for it before
 * it mounts the dashboard.
 */
export function useDashboardCatalog() {
  const { data, error, isLoading } = useSWR(queryKeys.dashboardCatalog(), () => dataSource.catalog(), {
    // Changes only when Birdy ships new metrics; no need to chase focus.
    revalidateOnFocus: false,
  })
  return { catalog: data ?? null, isLoading, error }
}
