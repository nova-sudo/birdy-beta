import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
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

beforeEach(() => {
  localStorage.clear()
  apiRequest.mockReset()
  apiRequest.mockImplementation(respond)
})

describe("useClientGroups caching", () => {
  it("never presents a daily-less payload as settled figures", async () => {
    // The regression: /clients opts out of the per-day series, and both
    // variants shared one cache key. Opening the Client Hub and then a page
    // that charts the series — clicking through to a client is the usual way —
    // painted that cached payload with `loading` already false. Its KPI tiles
    // and trend chart sum ghl_daily_leads / meta_daily_spend / hp_daily_calls,
    // so they read a confident zero until the real response landed, which for
    // a multi-megabyte payload is not quick. Changing the date preset was the
    // only way out, because that was the only thing that moved the key.
    const hub = renderHook(() => useClientGroups("last_30_days", { includeDaily: false }))
    await waitFor(() => expect(hub.result.current.loading).toBe(false))
    expect(hub.result.current.clientGroups[0].ghl_daily_leads).toBeUndefined()

    const leads = renderHook(() => useClientGroups("last_30_days"))

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

  it("keeps the two variants in separate cache entries", async () => {
    const full = renderHook(() => useClientGroups("last_30_days"))
    await waitFor(() => expect(full.result.current.loading).toBe(false))

    const lite = renderHook(() => useClientGroups("last_30_days", { includeDaily: false }))
    await waitFor(() => expect(lite.result.current.loading).toBe(false))

    const keys = Object.keys(localStorage).filter((k) => k.includes("last_30_days"))
    expect(keys).toHaveLength(2)
  })

  it("still serves its own variant from cache, without waiting on the network", async () => {
    const first = renderHook(() => useClientGroups("last_30_days"))
    await waitFor(() => expect(first.result.current.loading).toBe(false))

    // A second mount paints immediately off the cache rather than showing a
    // loading state — the point of caching it in the first place.
    const second = renderHook(() => useClientGroups("last_30_days"))
    expect(second.result.current.loading).toBe(false)
    expect(second.result.current.clientGroups[0].ghl_daily_leads).toBeDefined()
  })

  it("caches each date preset apart", async () => {
    const { result } = renderHook(() => useClientGroups("last_30_days"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.setDatePreset("last_7_days"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining("date_preset=last_7_days"),
      expect.anything()
    )
    const keys = Object.keys(localStorage).filter((k) => k.includes("clientGroups"))
    expect(keys.sort()).toHaveLength(2)
  })
})
