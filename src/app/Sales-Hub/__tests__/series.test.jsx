import { describe, it, expect } from "vitest"
import { renderHook } from "@testing-library/react"

import { useSalesHubSeries } from "../useSalesHubSeries"

// Two clients, each with their own precomputed daily call series — the shape
// /api/client-groups now serves as hotprospector.daily_calls. No fetch: the
// hook reads straight off the client groups it's handed.
//
// Dates sit in different months: the "maximum" preset used below buckets by
// month (see granularityForRange), and a fixed preset keeps these tests from
// depending on today's date the way a relative window like "last_30d" would.
const clientGroups = [
  {
    id: "g1",
    hotprospector: {
      daily_calls: [
        { date: "2026-06-15", calls: 5, inbound: 2, talk_min: 12, called: 3 },
        { date: "2026-07-15", calls: 4, inbound: 1, talk_min: 8, called: 1 },
      ],
    },
  },
  {
    id: "g2",
    hotprospector: {
      daily_calls: [{ date: "2026-06-15", calls: 3, inbound: 0, talk_min: 6, called: 2 }],
    },
  },
]

const render = (overrides = {}) =>
  renderHook(() =>
    useSalesHubSeries({
      clientGroups,
      groupsLoading: false,
      datePreset: "maximum",
      selectedClientGroup: "all",
      ...overrides,
    })
  )

describe("useSalesHubSeries", () => {
  it("sums every client's daily series with no fetch involved", () => {
    const { result } = render()

    // June bucket: g1's 5 + g2's 3. July bucket: g1's 4 only.
    expect(result.current.chartMetrics.calls.values).toEqual([8, 4])
    expect(result.current.loading).toBe(false)
    expect(result.current.streaming).toBe(false)
  })

  it("scopes to one client when selected", () => {
    const { result } = render({ selectedClientGroup: "g2" })

    expect(result.current.chartMetrics.calls.values).toEqual([3])
  })

  it("carries no coverage note — there is nothing partial to report", () => {
    const { result } = render()

    expect(result.current.chartMetrics.calls.coverage).toBeNull()
  })

  it("marks every metric pending while client groups are still loading", () => {
    const { result } = render({ groupsLoading: true })

    expect(result.current.chartMetrics.calls.pending).toBe(true)
    expect(result.current.loading).toBe(true)
  })

  it("counts inbound separately, on the same axis as total calls", () => {
    const { result } = render()

    const { calls, inbound } = result.current.chartMetrics
    expect(inbound.values).toEqual([2, 1])
    expect(inbound.tooltipLabels).toEqual(calls.tooltipLabels)
  })
})
