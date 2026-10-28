import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, renderHook, act } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { timeAgo } from "@/lib/lead-detail"
import { LeadSummaryCard, useLeadSummary } from "../LeadSummaryCard"

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const payload = (extra = {}) => ({
  status: "ok",
  summary: "Rebecca came from a Meta ad.",
  generated_at: new Date(Date.now() - 5 * 60000).toISOString(),
  stale: false,
  ...extra,
})

function Harness({ id = "c1" }) {
  const s = useLeadSummary(id, true)
  return <LeadSummaryCard {...s} />
}

beforeEach(() => vi.clearAllMocks())

describe("timeAgo", () => {
  const now = new Date("2026-07-17T12:00:00Z")
  const ago = (ms) => new Date(now.getTime() - ms).toISOString()
  it("covers each range", () => {
    expect(timeAgo(ago(30000), now)).toBe("just now")
    expect(timeAgo(ago(5 * 60000), now)).toBe("5 mins ago")
    expect(timeAgo(ago(60 * 60000), now)).toBe("1 hour ago")
    expect(timeAgo(ago(3 * 3600000), now)).toBe("3 hours ago")
    expect(timeAgo(ago(2 * 86400000), now)).toBe("2 days ago")
    expect(timeAgo(ago(60000), now)).toBe("1 min ago")
    expect(timeAgo(ago(86400000), now)).toBe("1 day ago")
    expect(timeAgo(ago(-5 * 60000), now)).toBe("just now")
    expect(timeAgo(null, now)).toBe("")
    expect(timeAgo("nonsense", now)).toBe("")
  })
})

describe("LeadSummaryCard", () => {
  it("shows loading then the summary with time", async () => {
    apiRequest.mockResolvedValue(ok(payload()))
    render(<Harness />)
    expect(screen.getByText("Writing a summary…")).toBeInTheDocument()
    expect(await screen.findByText("Rebecca came from a Meta ad.")).toBeInTheDocument()
    expect(screen.getByText("5 mins ago")).toBeInTheDocument()
    expect(screen.getByText("AI summary")).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(apiRequest.mock.calls[0][0]).toBe("/api/leads/contact/c1/summary")
  })

  it("shows the stale note", async () => {
    apiRequest.mockResolvedValue(ok(payload({ stale: true })))
    render(<Harness />)
    expect(await screen.findByText("New activity since this summary.")).toBeInTheDocument()
  })

  it("blocked shows the credits link and cached text", async () => {
    apiRequest.mockResolvedValue(ok(payload({ status: "blocked" })))
    render(<Harness />)
    expect(await screen.findByText("Rebecca came from a Meta ad.")).toBeInTheDocument()
    expect(screen.getByText(/You.re out of credits\./)).toBeInTheDocument()
    expect(screen.getAllByText(/top up/i)).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Top up" })).toHaveAttribute("href", "/credits")
  })

  it("is hidden when unavailable", async () => {
    apiRequest.mockResolvedValue(ok(payload({ status: "unavailable", summary: null, generated_at: null })))
    const { container } = render(<Harness />)
    await waitFor(() => expect(screen.queryByText("Writing a summary…")).not.toBeInTheDocument())
    expect(container).toBeEmptyDOMElement()
  })

  it("failed and network error offer Try again, keeping cached text", async () => {
    apiRequest.mockResolvedValueOnce(ok(payload({ status: "failed" })))
    render(<Harness />)
    expect(await screen.findByText("Couldn't write the summary.")).toBeInTheDocument()
    expect(screen.getByText("Rebecca came from a Meta ad.")).toBeInTheDocument()
    apiRequest.mockResolvedValueOnce(ok(payload({ summary: "Fresh text." })))
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Fresh text.")).toBeInTheDocument()
    expect(apiRequest.mock.calls[1][1]).toMatchObject({ method: "POST" })
  })

  it("network error shows the failed state", async () => {
    apiRequest.mockRejectedValue(new Error("down"))
    render(<Harness />)
    expect(await screen.findByText("Couldn't write the summary.")).toBeInTheDocument()
  })

  it("refresh posts once on double click and updates text and time", async () => {
    apiRequest.mockResolvedValueOnce(ok(payload()))
    render(<Harness />)
    await screen.findByText("Rebecca came from a Meta ad.")
    let resolve
    apiRequest.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const button = screen.getByRole("button", { name: "Regenerate summary" })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(apiRequest).toHaveBeenCalledTimes(2)
    resolve(ok(payload({ summary: "Updated.", generated_at: new Date().toISOString() })))
    expect(await screen.findByText("Updated.")).toBeInTheDocument()
    expect(screen.getByText("just now")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Regenerate summary" })).not.toBeDisabled()
  })

  it("drops a slow response for a previous lead", async () => {
    let resolveFirst
    apiRequest.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    apiRequest.mockResolvedValueOnce(ok(payload({ summary: "Second lead." })))
    const { rerender } = render(<Harness id="a" />)
    rerender(<Harness id="b" />)
    expect(await screen.findByText("Second lead.")).toBeInTheDocument()
    resolveFirst(ok(payload({ summary: "First lead." })))
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByText("First lead.")).not.toBeInTheDocument()
  })
})

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
      expect(apiRequest).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("gives up after five re-checks and shows failed", async () => {
    vi.useFakeTimers()
    try {
      apiRequest.mockResolvedValue(ok({ status: "generating", summary: null, generated_at: null, stale: false }))
      const { result } = renderHook(() => useLeadSummary("c1", true))
      await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
      expect(apiRequest).toHaveBeenCalledTimes(6)
      expect(result.current.data.status).toBe("failed")
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("LeadSummaryCard states", () => {
  it("disables refresh until loaded and hides the failed note during a retry", () => {
    const { rerender } = render(<LeadSummaryCard data={null} busy onRefresh={() => {}} />)
    expect(screen.getByRole("button", { name: "Regenerate summary" })).toBeDisabled()
    rerender(<LeadSummaryCard data={{ status: "failed" }} busy onRefresh={() => {}} />)
    expect(screen.queryByText(/Couldn.t write the summary/)).not.toBeInTheDocument()
  })
})
