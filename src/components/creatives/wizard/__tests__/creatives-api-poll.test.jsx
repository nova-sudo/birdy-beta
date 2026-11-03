import { describe, it, expect, vi } from "vitest"

const captured = {}
vi.mock("swr", () => ({
  default: (key, fetcher, opts) => {
    captured.opts = opts
    return { data: null, error: null, isLoading: false, mutate: vi.fn() }
  },
  mutate: vi.fn(),
}))

import { renderHook } from "@testing-library/react"
import { useCreativeTest, POSTING_POLL_MS } from "@/lib/creatives-api"

describe("useCreativeTest polling", () => {
  it("never polls unless asked", () => {
    renderHook(() => useCreativeTest("t1"))
    expect(captured.opts.refreshInterval).toBe(0)
  })

  it("polls while posting or while any ad is pending, otherwise stops", () => {
    renderHook(() => useCreativeTest("t1", { pollWhilePosting: true }))
    const f = captured.opts.refreshInterval
    expect(f({ status: "posting", ads: [] })).toBe(POSTING_POLL_MS)
    expect(f({ status: "testing", ads: [{ post_state: "active" }, { post_state: "pending" }] })).toBe(POSTING_POLL_MS)
    expect(f({ status: "testing", ads: [{ post_state: "active" }, { post_state: "failed" }] })).toBe(0)
    expect(f(undefined)).toBe(0)
  })
})
