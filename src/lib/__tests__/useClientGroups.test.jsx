import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { SWRConfig } from "swr"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { fetcher } from "@/lib/fetcher"
import { useClientGroups } from "@/lib/useClientGroups"

// The full payload carries the per-day series the hubs chart and sum; the lite
// one is what /clients asks for, and drops them.
const FULL = {
  id: "g1",
  name: "Aura Dental",
  ghl_daily_leads: [{ date: "2026-08-01", leads: 12 }],
  meta_daily_spend: [{ date: "2026-08-01", spend: 40 }],
  hp_daily_calls: [{ date: "2026-08-01", calls: 9 }],
}
const LITE = { id: "g1", name: "Aura Dental" }

function respond(url) {
  const lite = url.includes("include_daily=false")
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ client_groups: [lite ? LITE : FULL], meta: { lite } }),
  })
}

// One cache per test, shared by every mount inside it — which is how the real
// app is wired: a single provider at the root that components mount and
// unmount under. A fresh Map per renderHook would defeat the thing being
// tested. Timings match src/components/swr-provider.
let cache

function wrapper({ children }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        provider: () => cache,
        dedupingInterval: 5 * 60 * 1000,
        revalidateOnFocus: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}

beforeEach(() => {
  cache = new Map()
  localStorage.clear()
  apiRequest.mockReset()
  apiRequest.mockImplementation(respond)
})

describe("useClientGroups", () => {
  it("never presents a daily-less payload as settled figures", async () => {
    // The regression: /clients opts out of the per-day series, and both
    // variants shared one cache key. Opening the Client Hub and then a page
    // that charts the series — clicking through to a client is the usual way —
    // painted that cached payload with `loading` already false. Its KPI tiles
    // and trend chart sum ghl_daily_leads / meta_daily_spend / hp_daily_calls,
    // so they read a confident zero until the real response landed.
    const hub = renderHook(
      () => useClientGroups("last_30_days", { includeDaily: false }),
      { wrapper }
    )
    await waitFor(() => expect(hub.result.current.loading).toBe(false))
    expect(hub.result.current.clientGroups[0].ghl_daily_leads).toBeUndefined()

    const leads = renderHook(() => useClientGroups("last_30_days"), { wrapper })

    // Synchronously after mount, before the network can have answered: it must
    // be loading, not showing a daily-less group as though it were done.
    expect(leads.result.current.loading).toBe(true)
    expect(leads.result.current.clientGroups).toEqual([])

    await waitFor(() => expect(leads.result.current.loading).toBe(false))
    expect(leads.result.current.clientGroups[0].ghl_daily_leads).toEqual([
      { date: "2026-08-01", leads: 12 },
    ])
    expect(leads.result.current.clientGroups[0].meta_daily_spend).toBeDefined()
    expect(leads.result.current.clientGroups[0].hp_daily_calls).toBeDefined()
  })

  it("asks for each variant separately", async () => {
    const full = renderHook(() => useClientGroups("last_30_days"), { wrapper })
    await waitFor(() => expect(full.result.current.loading).toBe(false))

    const lite = renderHook(
      () => useClientGroups("last_30_days", { includeDaily: false }),
      { wrapper }
    )
    await waitFor(() => expect(lite.result.current.loading).toBe(false))

    const asked = apiRequest.mock.calls.map(([url]) => url)
    expect(asked.filter((u) => !u.includes("include_daily=false"))).toHaveLength(1)
    expect(asked.filter((u) => u.includes("include_daily=false"))).toHaveLength(1)
  })

  it("asks for each date preset separately", async () => {
    const { result } = renderHook(() => useClientGroups("last_30_days"), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setDatePreset("last_7_days"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const asked = apiRequest.mock.calls.map(([url]) => url)
    expect(asked.some((u) => u.includes("date_preset=last_30_days"))).toBe(true)
    expect(asked.some((u) => u.includes("date_preset=last_7_days"))).toBe(true)
  })

  it("does not carry one preset's figures under another's label", async () => {
    const { result } = renderHook(() => useClientGroups("last_30_days"), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.clientGroups).toHaveLength(1)

    act(() => result.current.setDatePreset("last_7_days"))

    // A spinner, not last month's numbers relabelled as this week's.
    expect(result.current.loading).toBe(true)
    expect(result.current.clientGroups).toEqual([])
  })

  // The point of the whole exercise: leaving a page and coming back is a
  // remount, and a remount inside the freshness window must not re-download
  // six megabytes.
  it("serves a remount from cache without touching the network", async () => {
    const first = renderHook(() => useClientGroups("last_30_days"), { wrapper })
    await waitFor(() => expect(first.result.current.loading).toBe(false))
    expect(apiRequest).toHaveBeenCalledTimes(1)

    first.unmount()

    const second = renderHook(() => useClientGroups("last_30_days"), { wrapper })
    expect(second.result.current.loading).toBe(false)
    expect(second.result.current.clientGroups[0].ghl_daily_leads).toBeDefined()
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("makes one request when two pages ask for the same thing at once", async () => {
    const view = renderHook(
      () => {
        useClientGroups("last_30_days")
        return useClientGroups("last_30_days")
      },
      { wrapper }
    )

    await waitFor(() => expect(view.result.current.loading).toBe(false))
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it("reports the server's message rather than a status code", async () => {
    apiRequest.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 402,
        json: () => Promise.resolve({ detail: "You're out of credits" }),
      })
    )

    const { result } = renderHook(() => useClientGroups("last_30_days"), { wrapper })
    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.error).toBe("You're out of credits")
  })
})
