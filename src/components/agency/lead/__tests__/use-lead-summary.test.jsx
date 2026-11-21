import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { useLeadSummary } from "../use-lead-summary"

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const payload = (extra = {}) => ({ status: "ok", summary: "Came from a Meta ad.", generated_at: new Date().toISOString(), stale: false, ...extra })

beforeEach(() => vi.clearAllMocks())

describe("useLeadSummary", () => {
  it("guards a double refresh without relying on the disabled button", async () => {
    apiRequest.mockResolvedValueOnce(ok(payload()))
    const { result } = renderHook(() => useLeadSummary("c1", true))
    await waitFor(() => expect(result.current.data?.status).toBe("ok"))
    let resolve
    apiRequest.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    act(() => {
      result.current.onRefresh()
      result.current.onRefresh()
    })
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(apiRequest.mock.calls[1]).toEqual(["/api/leads/contact/c1/summary", { method: "POST" }])
    await act(async () => resolve(ok(payload())))
  })

  it("does not fetch until enabled", async () => {
    const { rerender } = renderHook(({ on }) => useLeadSummary("c1", on), { initialProps: { on: false } })
    expect(apiRequest).not.toHaveBeenCalled()
    apiRequest.mockResolvedValue(ok(payload()))
    rerender({ on: true })
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))
  })

  it("polls again while generating, then settles", async () => {
    vi.useFakeTimers()
    try {
      apiRequest.mockResolvedValueOnce(ok({ status: "generating", summary: null, generated_at: null, stale: false }))
      apiRequest.mockResolvedValueOnce(ok(payload({ summary: "Done." })))
      const { result } = renderHook(() => useLeadSummary("c1", true))
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(result.current.data.status).toBe("generating")
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(result.current.data.summary).toBe("Done.")
    } finally {
      vi.useRealTimers()
    }
  })

  it("gives up after twelve re-checks and shows failed", async () => {
    vi.useFakeTimers()
    try {
      apiRequest.mockResolvedValue(ok({ status: "generating", summary: null, generated_at: null, stale: false }))
      const { result } = renderHook(() => useLeadSummary("c1", true))
      await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
      expect(apiRequest).toHaveBeenCalledTimes(13)
      expect(result.current.data.status).toBe("failed")
    } finally {
      vi.useRealTimers()
    }
  })
})
