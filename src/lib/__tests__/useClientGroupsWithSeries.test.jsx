/**
 * Splitting the per-day series into their own request reintroduces the exact
 * hazard include_daily was created to close: every aggregator downstream sums
 * daily_leads / daily_spend / daily_calls, and a series that hasn't arrived
 * sums to zero as convincingly as a real one. The Lead Hub once rendered 0
 * leads while its own table showed 1,459.
 *
 * So the thing to hold down is not that the merge works — it's that nothing
 * can read the groups as finished before the series are on them.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"

const GROUP = { id: "g1", name: "Aura Dental", gohighlevel: {}, facebook: {}, hotprospector: {} }
const SERIES = {
  g1: {
    daily_leads: [{ date: "2026-08-01", leads: 12 }],
    daily_spend: [{ date: "2026-08-01", spend: 40 }],
    daily_calls: null,
  },
}

let cache
let releaseSeries

function wrapper({ children }) {
  return (
    <SWRConfig
      value={{ fetcher, provider: () => cache, dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false }}
    >
      {children}
    </SWRConfig>
  )
}

function ok(body) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) }
}

beforeEach(() => {
  cache = new Map()
  apiRequest.mockReset()
  releaseSeries = null

  apiRequest.mockImplementation((url) => {
    if (url.includes("/daily")) {
      // Held open so a test can inspect the in-between state, where the groups
      // have landed and the series have not.
      return new Promise((resolve) => {
        releaseSeries = () => resolve(ok({ series: SERIES }))
      })
    }
    return Promise.resolve(ok({ client_groups: [GROUP], meta: null }))
  })
})

describe("useClientGroupsWithSeries", () => {
  it("stays loading while the series are still in flight", async () => {
    const { result } = renderHook(() => useClientGroupsWithSeries("last_30d"), { wrapper })

    // Groups have arrived; series have not. Reporting settled here is what
    // would paint a confident zero on every tile.
    await waitFor(() => expect(result.current.groupsLoading).toBe(false))
    expect(result.current.seriesLoading).toBe(true)
    expect(result.current.loading).toBe(true)

    releaseSeries()
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it("shows nothing rather than zeros when the series request fails", async () => {
    // The way this actually happens: this bundle ships before the backend
    // that serves /api/client-groups/daily, and the answer is a 404. Loading
    // ends without the series ever arriving, so unless the groups are
    // withheld here, every aggregator's `?? []` renders a confident 0.
    apiRequest.mockImplementation((url) =>
      url.includes("/daily")
        ? Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ detail: "Not Found" }) })
        : Promise.resolve(ok({ client_groups: [GROUP], meta: null }))
    )

    const { result } = renderHook(() => useClientGroupsWithSeries("last_30d"), { wrapper })

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.clientGroups).toEqual([])
  })

  it("puts the series back exactly where the aggregators read them", async () => {
    const { result } = renderHook(() => useClientGroupsWithSeries("last_30d"), { wrapper })
    await waitFor(() => expect(result.current.groupsLoading).toBe(false))
    releaseSeries()
    await waitFor(() => expect(result.current.loading).toBe(false))

    const [group] = result.current.clientGroups
    expect(group.gohighlevel.daily_leads).toEqual([{ date: "2026-08-01", leads: 12 }])
    expect(group.facebook.daily_spend).toEqual([{ date: "2026-08-01", spend: 40 }])
    // null, not [] — a client with no dialler has no call series, and that has
    // to stay distinguishable from one that made no calls.
    expect(group.hotprospector.daily_calls).toBeNull()
  })

  it("asks for the groups without their series", async () => {
    renderHook(() => useClientGroupsWithSeries("last_30d"), { wrapper })
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(2))

    const asked = apiRequest.mock.calls.map(([url]) => url)
    expect(asked.some((u) => u.includes("include_daily=false"))).toBe(true)
    expect(asked.some((u) => u.endsWith("/api/client-groups/daily"))).toBe(true)
  })

  it("does not refetch the history when the date preset moves", async () => {
    const { result } = renderHook(() => useClientGroupsWithSeries("last_30d"), { wrapper })
    await waitFor(() => expect(result.current.groupsLoading).toBe(false))
    releaseSeries()
    await waitFor(() => expect(result.current.loading).toBe(false))

    const seriesCallsBefore = apiRequest.mock.calls.filter(([u]) => u.includes("/daily")).length

    result.current.setDatePreset("last_7d")
    await waitFor(() =>
      expect(apiRequest.mock.calls.some(([u]) => u.includes("date_preset=last_7d"))).toBe(true)
    )

    // The series carry no preset — every row is a day, and which days you want
    // is decided in the browser. Refetching them here was hundreds of
    // kilobytes for an answer that cannot have changed.
    const seriesCallsAfter = apiRequest.mock.calls.filter(([u]) => u.includes("/daily")).length
    expect(seriesCallsAfter).toBe(seriesCallsBefore)
  })
})
