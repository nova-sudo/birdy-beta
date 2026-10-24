import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CallCenterPage from "../page"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"

// Radix Select (the granularity menu) needs these from the browser.
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const makeLeads = (count) =>
  Array.from({ length: count }, (_, i) => {
    const n = i + 1
    return {
      id: `l${n}`,
      first_name: "Lead",
      last_name: String(n).padStart(2, "0"),
      client_name: "Acme",
      call_logs: [
        {
          call_time_iso: `2026-07-${String(((n - 1) % 28) + 1).padStart(2, "0")}T10:00:00Z`,
          call_status: n % 2 === 0 ? "outbound" : "inbound",
          duration: 60,
          from_number: "111",
          to_number: "222",
          recording_url: n === 8 ? "https://rec.example/8.mp3" : null,
        },
      ],
    }
  })

let mockLeads = makeLeads(8)

function mockApiRequest(url) {
  if (url.includes("/api/hotprospector/call-center")) {
    const params = new URLSearchParams(url.split("?")[1] ?? "")
    const skip = Number(params.get("skip") ?? 0)
    const limit = Number(params.get("limit") ?? mockLeads.length)
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: mockLeads.slice(skip, skip + limit), meta: { total: mockLeads.length } }),
    })
  }
  if (url.includes("/api/hotprospector/members/dashboard")) {
    return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
  }
  return Promise.resolve({ ok: true, json: async () => ({}) })
}

const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const GROUPS = [
  {
    id: "g1",
    name: "Acme",
    call_log_provider: "hotprospector",
    ghl_location_id: "loc1",
    hotprospector: {
      metrics: { total_leads: 100 },
      call_stats: { leads_with_calls: 40, transfers: 2 },
      daily_calls: [{ date: YESTERDAY, calls: 12, inbound: 2, talk_min: 30, called: 5 }],
    },
  },
]

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockLeads = makeLeads(8)
  vi.mocked(apiRequest).mockImplementation(mockApiRequest)
  vi.mocked(useClientGroupsWithSeries).mockReturnValue({
    clientGroups: [], loading: false, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(),
  })
})

const table = () => within(screen.getByRole("table"))
const sectionTab = (name) =>
  within(screen.getByRole("tablist", { name: "Sales Hub section" })).getByRole("tab", { name })

describe("Sales Hub page shell", () => {
  it("renders a ds PageHeader titled Sales Hub with the shared period control", async () => {
    const user = userEvent.setup()
    const setDatePreset = vi.fn()
    vi.mocked(useClientGroupsWithSeries).mockReturnValue({
      clientGroups: [], loading: false, datePreset: "last_7d", setDatePreset, refresh: vi.fn(),
    })
    render(<CallCenterPage />)

    expect(document.querySelector('[data-ds="page-header"] h1')).toHaveTextContent("Sales Hub")
    await user.click(screen.getByRole("tab", { name: "30 days" }))
    expect(setDatePreset).toHaveBeenCalledWith("last_30d")
  })

  it("keeps the granularity control and the client picker", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)
    expect(screen.getByRole("combobox", { name: "Client group" })).toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: "Chart granularity" }))
    expect(await screen.findByRole("option", { name: "Weekly" })).toBeInTheDocument()
  })

  it("draws no legacy portfolio markup", () => {
    const { container } = render(<CallCenterPage />)
    expect(container.querySelector("[class*='pd-']")).toBeNull()
  })
})

describe("Sales Hub tables", () => {
  it("pages the Leads table at 25 rows rather than rendering every lead", async () => {
    const user = userEvent.setup()
    mockLeads = makeLeads(60)
    render(<CallCenterPage />)
    await user.click(sectionTab(/leads/i))

    await waitFor(() => expect(table().getByText("Lead 01")).toBeInTheDocument())
    await waitFor(() => expect(table().getAllByRole("row")).toHaveLength(26)) // header + 25
    expect(table().queryByText("Lead 40")).toBeNull()
  })

  it("shows an error with a retry when the first leads batch fails", async () => {
    const user = userEvent.setup()
    let fail = true
    vi.mocked(apiRequest).mockImplementation((url) =>
      fail && url.includes("/api/hotprospector/call-center")
        ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
        : mockApiRequest(url)
    )
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(<CallCenterPage />)
    await user.click(sectionTab(/leads/i))

    expect(await screen.findByText("Couldn't load the leads")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(table().getByText("Lead 01")).toBeInTheDocument())
  })

  it("says so when there are no leads", async () => {
    const user = userEvent.setup()
    mockLeads = []
    render(<CallCenterPage />)
    await user.click(sectionTab(/leads/i))
    expect(await screen.findByText("No leads in this window")).toBeInTheDocument()
  })

  it("keeps the recording Play and Download links on the Calls table", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)
    await user.click(sectionTab(/calls/i))
    await waitFor(() => expect(table().getByText("Lead 08")).toBeInTheDocument())

    expect(table().getByRole("link", { name: /play recording/i })).toHaveAttribute("href", "https://rec.example/8.mp3")
    expect(table().getByRole("link", { name: /download recording/i })).toHaveAttribute("download")
  })

  it("filters calls by direction from the Filters popover", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)
    await user.click(sectionTab(/calls/i))
    await waitFor(() => expect(table().getByText("Lead 08")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /filters/i }))
    await user.click(await screen.findByRole("tab", { name: "Inbound" }))
    await waitFor(() => expect(table().queryByText("Lead 08")).toBeNull()) // even n are outbound
    expect(table().getByText("Lead 07")).toBeInTheDocument()
  })

  it("hides no-dialer leads through the Leads filter, sent as has_calls", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)
    await user.click(sectionTab(/leads/i))
    await waitFor(() => expect(table().getByText("Lead 01")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /filters/i }))
    await user.click(await screen.findByRole("checkbox", { name: /hide no-dialer-activity leads/i }))
    await waitFor(() =>
      expect(vi.mocked(apiRequest).mock.calls.some(([url]) => url.includes("has_calls=true"))).toBe(true)
    )
  })

  it("lists one row per client with a neutral sparkline, and drills into Leads on click", async () => {
    const user = userEvent.setup()
    vi.mocked(useClientGroupsWithSeries).mockReturnValue({
      clientGroups: GROUPS, loading: false, datePreset: "last_7d", setDatePreset: vi.fn(), refresh: vi.fn(),
    })
    render(<CallCenterPage />)

    const cell = await table().findByText("Acme")
    expect(table().getByText(/40 of 100 called/)).toBeInTheDocument()
    expect(document.querySelector('table [data-ds="sparkline"]')).not.toBeNull()

    await user.click(cell)
    expect(await screen.findByText(/Client:/)).toHaveTextContent("Client: Acme")
    expect(sectionTab(/leads/i)).toHaveAttribute("aria-selected", "true")
  })
})
