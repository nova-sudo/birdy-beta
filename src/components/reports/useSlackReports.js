"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { queryKeys } from "@/lib/query-keys"

/** A response's error as one sentence: FastAPI's detail, or the template's first validation error. */
async function failure(res) {
  let message = "Something went wrong. Please try again."
  try {
    const body = await res.json()
    const detail = body?.detail
    if (typeof detail === "string") message = detail
    else if (detail?.errors?.length) message = detail.errors[0]
    else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg
  } catch {
    // not JSON
  }
  const err = new Error(message)
  err.status = res.status
  return err
}

async function send(path, method, body) {
  const res = await apiRequest(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
  if (!res.ok) throw await failure(res)
  return res.json()
}

/**
 * The account's Slack reports (Hub → Reports) and every write the hub makes.
 * Writes update the cached list from the server's answer, so a card changes
 * the moment the save lands.
 */
export function useSlackReports() {
  const { data, error, isLoading, mutate } = useSWR(queryKeys.slackReports(), fetcher)
  const reports = data?.reports ?? []

  const replace = useCallback(
    (report) => mutate((cur) => ({ ...cur, reports: (cur?.reports ?? []).map((r) => (r.id === report.id ? report : r)) }), { revalidate: false }),
    [mutate],
  )

  const create = useCallback(
    async (body) => {
      const { report } = await send("/api/slack-reports", "POST", body)
      await mutate((cur) => ({ ...cur, reports: [...(cur?.reports ?? []), report] }), { revalidate: false })
      return report
    },
    [mutate],
  )

  const update = useCallback(
    async (id, body) => {
      const { report } = await send(`/api/slack-reports/${id}`, "PATCH", body)
      await replace(report)
      return report
    },
    [replace],
  )

  /** Flip on/off at once; roll back if the save fails. */
  const setEnabled = useCallback(
    async (id, enabled) => {
      await mutate(
        async (cur) => {
          const { report } = await send(`/api/slack-reports/${id}`, "PATCH", { enabled })
          return { ...cur, reports: (cur?.reports ?? []).map((r) => (r.id === id ? report : r)) }
        },
        {
          optimisticData: (cur) => ({ ...cur, reports: (cur?.reports ?? []).map((r) => (r.id === id ? { ...r, enabled } : r)) }),
          rollbackOnError: true,
          revalidate: false,
        },
      )
    },
    [mutate],
  )

  const remove = useCallback(
    async (id) => {
      await send(`/api/slack-reports/${id}`, "DELETE")
      await mutate((cur) => ({ ...cur, reports: (cur?.reports ?? []).filter((r) => r.id !== id) }), { revalidate: false })
    },
    [mutate],
  )

  const test = useCallback((id) => send(`/api/slack-reports/${id}/test`, "POST"), [])

  return { reports, max: data?.max ?? 20, isLoading, error, retry: () => mutate(), create, update, setEnabled, remove, test }
}
