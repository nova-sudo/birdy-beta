"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { createDashboard } from "dashkit/core"
import { store } from "@/lib/dashkit/store"
import { queryKeys } from "@/lib/query-keys"

/**
 * The saved-dashboards list, plus the two writes the list page makes.
 *
 * The list is `[{ id, title, updatedAt }]` summaries; the full document is only
 * loaded on the detail page. Both writes update the cached list immediately and
 * reconcile with the server afterwards, so a card appears (or disappears) the
 * moment you act, not after a round trip.
 */
export function useDashboards() {
  const { data, error, isLoading, mutate } = useSWR(queryKeys.dashboards(), () => store.list())

  /**
   * Save a new, empty dashboard and return its id. `brief` is not stored: it is
   * the page's job to hand it to the detail page, where the AI acts on it.
   * createDashboard seeds one "Overview" section so the AI's propose_widget
   * has somewhere to put the first widget.
   */
  const create = useCallback(
    async ({ title }) => {
      const doc = createDashboard({ title: title.trim() })
      const saved = await store.save(doc)
      const summary = { id: saved.id, title: saved.title, updatedAt: saved.meta.updatedAt }
      await mutate((current) => [summary, ...(current ?? [])], { revalidate: true })
      return saved.id
    },
    [mutate],
  )

  const remove = useCallback(
    async (id) => {
      try {
        await mutate(
          async (current) => {
            await store.remove(id)
            return (current ?? []).filter((d) => d.id !== id)
          },
          {
            // Drop the card now; if the DELETE fails SWR rolls the list back.
            optimisticData: (current) => (current ?? []).filter((d) => d.id !== id),
            rollbackOnError: true,
            revalidate: false,
          },
        )
      } catch (err) {
        toast.error("Couldn't delete that dashboard. Please try again.")
        throw err
      }
    },
    [mutate],
  )

  return { items: data ?? [], isLoading, error, create, remove }
}
