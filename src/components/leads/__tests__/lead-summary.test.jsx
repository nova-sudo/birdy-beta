import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

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
    expect(screen.getByText("You're out of credits. Top up to generate AI summaries.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /top up/i })).toHaveAttribute("href", "/credits")
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
