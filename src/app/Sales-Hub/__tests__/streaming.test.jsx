import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CallCenterPage from "../page"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"

Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Lean leads: only the fields the Leads table maps.
const makeLeads = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    first_name: "Lead",
    last_name: String(i + 1).padStart(4, "0"),
    call_logs: [],
  }))

let requests
let inFlight
let maxInFlight

// Serves the call-centre endpoint from `total` leads, recording each request's
// skip/limit and how many were in flight together. `failSkip` makes one fail.
function serve(total, { failSkip } = {}) {
  const leads = makeLeads(total)
  requests = []
  inFlight = 0
  maxInFlight = 0
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    if (!url.includes("/api/hotprospector/call-center")) {
      return { ok: true, json: async () => ({ data: [] }) }
    }
    const params = new URLSearchParams(url.split("?")[1])
    const skip = Number(params.get("skip"))
    const limit = Number(params.get("limit"))
    requests.push({ skip, limit })
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
    if (skip === failSkip) return { ok: false, status: 500, json: async () => ({}) }
    return { ok: true, json: async () => ({ data: leads.slice(skip, skip + limit), meta: { total } }) }
  })
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(useClientGroupsWithSeries).mockReturnValue({
    clientGroups: [], loading: false, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(),
  })
})

const openLeads = async () => {
  const user = userEvent.setup()
  render(<CallCenterPage />)
  await user.click(
    within(screen.getByRole("tablist", { name: "Sales Hub section" })).getByRole("tab", { name: /leads/i })
  )
}

describe("Sales Hub — leads streaming", () => {
  it("fetches a first batch of 40, then batches of 200", async () => {
    serve(500)
    await openLeads()

    await waitFor(() => expect(requests).toHaveLength(4))
    expect(requests).toEqual([
      { skip: 0, limit: 40 },
      { skip: 40, limit: 200 },
      { skip: 240, limit: 200 },
      { skip: 440, limit: 200 },
    ])
    await waitFor(() => expect(screen.queryByText(/loading the rest/i)).toBeNull())
  })

  it("never has more than 6 background batches in flight", async () => {
    serve(2800)
    await openLeads()

    await waitFor(() => expect(requests).toHaveLength(15), { timeout: 4000 })
    expect(requests[0]).toEqual({ skip: 0, limit: 40 })
    expect(requests.slice(1).map((r) => r.skip)).toEqual(
      Array.from({ length: 14 }, (_, i) => 40 + i * 200)
    )
    expect(requests.slice(1).every((r) => r.limit === 200)).toBe(true)
    expect(maxInFlight).toBe(6)
  })

  it("keeps the rows that loaded when a background batch fails, and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    serve(2800, { failSkip: 1440 })
    await openLeads()

    // First batch (40) + the first chunk of six (1200) + the five that
    // succeeded in the second chunk (1000). Nothing after the failed chunk.
    expect(
      await screen.findByText("Loaded 2240 of 2800, some rows couldn't load", {}, { timeout: 4000 })
    ).toBeInTheDocument()
    expect(requests).toHaveLength(13)
    // The table is still there with rows, not an error screen.
    expect(screen.queryByText("Couldn't load the leads")).toBeNull()
    expect(within(screen.getByRole("table")).getByText("Lead 0001")).toBeInTheDocument()
  })
})
