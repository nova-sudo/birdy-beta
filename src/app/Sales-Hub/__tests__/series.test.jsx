import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { useSalesHubSeries } from "../useSalesHubSeries"

// 1,400 leads in the window, one call each. More than a single page, which is
// the whole point: the endpoint orders leads by *creation* date, not by call
// recency, so the first page is not a sample of the window — it is a biased
// slice, and a curve drawn off it undercounts by however much it missed.
const TOTAL = 1400

const leadAt = (i) => ({
  id: `l${i}`,
  call_logs: [
    {
      call_time_iso: `2026-07-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
      call_status: i % 2 === 0 ? "outbound" : "inbound",
      duration: 60,
    },
  ],
})

const allLeads = Array.from({ length: TOTAL }, (_, i) => leadAt(i))

beforeEach(() => {
  vi.mocked(apiRequest).mockImplementation((url) => {
    const params = new URLSearchParams(url.split("?")[1] ?? "")
    const skip = Number(params.get("skip") ?? 0)
    const limit = Number(params.get("limit") ?? TOTAL)
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: allLeads.slice(skip, skip + limit), meta: { total: TOTAL } }),
    })
  })
})

const render = () =>
  renderHook(() =>
    useSalesHubSeries({
      clientGroups: [],
      groupsLoading: false,
      datePreset: "last_30d",
      selectedClientGroup: "all",
    })
  )

const plottedCalls = (result) =>
  result.current.chartMetrics.calls.values.reduce((a, b) => a + b, 0)

// `streaming` starts false, so waiting on it resolves against empty state.
// Settle on the thing that actually changes: every page landing.
const settle = (result) =>
  waitFor(() => expect(plottedCalls(result)).toBe(TOTAL), { timeout: 5000 })

describe("useSalesHubSeries", () => {
  it("pages through the whole window rather than plotting the first page", async () => {
    const { result } = render()

    // Settles only once every call in the window is counted. A single-page
    // fetch would stall at the first page's worth and time out here.
    await settle(result)
    expect(plottedCalls(result)).toBe(TOTAL)
  })

  it("asks for every page, starting with a small one", async () => {
    const { result } = render()
    await settle(result)

    const skips = vi
      .mocked(apiRequest)
      .mock.calls.map(([url]) => Number(new URLSearchParams(url.split("?")[1]).get("skip")))

    // A small first page so a curve appears quickly, then the rest behind it.
    expect(skips[0]).toBe(0)
    expect(new Set(skips).size).toBeGreaterThan(1)
  })

  it("drops its coverage note once the whole window has landed", async () => {
    const { result } = render()
    await settle(result)

    // While pages are still arriving the chart says so; complete, it stops
    // qualifying a figure that no longer needs qualifying.
    expect(result.current.chartMetrics.calls.coverage).toBeNull()
  })

  it("keeps paging past any round number — a window larger than 40,500 leads", async () => {
    // The regression this pins: an earlier version capped at 40 pages, so a
    // busy window stopped dead on 40,500 leads and drew a curve that quietly
    // omitted everything after it. There is no ceiling now.
    const BIG = 45_000
    const big = Array.from({ length: BIG }, (_, i) => leadAt(i))
    vi.mocked(apiRequest).mockImplementation((url) => {
      const params = new URLSearchParams(url.split("?")[1] ?? "")
      const skip = Number(params.get("skip") ?? 0)
      const limit = Number(params.get("limit") ?? BIG)
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: big.slice(skip, skip + limit), meta: { total: BIG } }),
      })
    })

    const { result } = render()

    await waitFor(
      () => expect(result.current.chartMetrics.calls.values.reduce((a, b) => a + b, 0)).toBe(BIG),
      { timeout: 20000 }
    )
    expect(result.current.chartMetrics.calls.coverage).toBeNull()
  }, 30000)

  it("counts inbound separately, on the same axis as total calls", async () => {
    const { result } = render()
    await settle(result)

    const { calls, inbound } = result.current.chartMetrics
    const inboundPlotted = inbound.values.reduce((a, b) => a + b, 0)

    expect(inboundPlotted).toBe(TOTAL / 2)
    expect(inbound.tooltipLabels).toEqual(calls.tooltipLabels)
  })
})
