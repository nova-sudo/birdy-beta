import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CallCenterPage from "../page"
import { STORAGE_KEYS } from "@/lib/constants"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
}))
vi.mock("@/lib/useClientGroups", () => ({
  useClientGroups: vi.fn(),
}))
// next/font hits the network at module load, which a unit test has no business
// doing — the class names are all the shell uses.
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"

// 8 leads, one call each, at increasing timestamps (Lead08 is the most recent).
const mockLeads = Array.from({ length: 8 }, (_, i) => {
  const n = i + 1
  return {
    id: `l${n}`,
    first_name: "Lead",
    last_name: String(n).padStart(2, "0"),
    client_name: "Acme",
    call_logs: [
      {
        call_time_iso: `2026-07-${String(n).padStart(2, "0")}T10:00:00Z`,
        call_status: n % 2 === 0 ? "outbound" : "inbound",
        duration: 60,
        from_number: "111",
        to_number: "222",
      },
    ],
  }
})

// The call-centre endpoint pages. meta.total is how many leads the window
// holds; each request returns the slice its skip/limit asks for.
function mockApiRequest(url) {
  if (url.includes("/api/hotprospector/call-center")) {
    const params = new URLSearchParams(url.split("?")[1] ?? "")
    const skip = Number(params.get("skip") ?? 0)
    const limit = Number(params.get("limit") ?? mockLeads.length)
    return Promise.resolve({
      ok: true,
      json: async () => ({
        data: mockLeads.slice(skip, skip + limit),
        meta: { total: mockLeads.length },
      }),
    })
  }
  if (url.includes("/api/hotprospector/members/dashboard")) {
    return Promise.resolve({ ok: true, json: async () => ({ data: [] }) })
  }
  return Promise.resolve({ ok: true, json: async () => ({}) })
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(apiRequest).mockImplementation(mockApiRequest)
  vi.mocked(useClientGroups).mockReturnValue({
    clientGroups: [],
    loading: false,
    datePreset: "last_7d",
    setDatePreset: vi.fn(),
  })
})

describe("Sales Hub — Calls tab", () => {
  it("renders all four tabs, including the new Calls tab, without breaking the existing ones", () => {
    render(<CallCenterPage />)

    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /leads/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /members/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /calls/i })).toBeInTheDocument()
  })

  it("mounts only the selected section, so the other three don't fetch behind it", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)

    // Radix's Tabs mounted all four panels and hid three, so the Leads tab's
    // first batch was fetched on a visit that never left Overview. The trend
    // chart above the tabs has its own call-centre fetch and is expected here;
    // the Leads batch is the one that should not have run, and it is
    // recognisable by its page size (LEADS_FIRST_BATCH_SIZE).
    const leadsBatchFetched = () =>
      vi.mocked(apiRequest).mock.calls.some(([url]) => url.includes("limit=40"))

    expect(leadsBatchFetched()).toBe(false)

    await user.click(screen.getByRole("tab", { name: /leads/i }))
    await waitFor(() => expect(leadsBatchFetched()).toBe(true))

    await user.click(screen.getByRole("tab", { name: /calls/i }))
    await waitFor(() => expect(screen.getByText("Lead 08")).toBeInTheDocument())
  })

  it("shows the most recent calls, sorted newest first, when the Calls tab is opened", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)

    await user.click(screen.getByRole("tab", { name: /calls/i }))

    await waitFor(() => {
      expect(screen.getByText("Lead 08")).toBeInTheDocument()
      expect(screen.getByText("Lead 01")).toBeInTheDocument()
    })
  })

  it("lets the user change how many recent calls are shown, and persists the choice", async () => {
    const user = userEvent.setup()
    render(<CallCenterPage />)

    await user.click(screen.getByRole("tab", { name: /calls/i }))
    await waitFor(() => expect(screen.getByText("Lead 08")).toBeInTheDocument())

    // All 8 calls fit under the default limit of 20.
    expect(screen.getByText("Lead 01")).toBeInTheDocument()

    // The limit lives in the Calls tab's filter menu, so it has to be opened
    // before it exists to query. This assertion used to run against a closed
    // menu and had been failing on main.
    await user.click(screen.getByRole("button", { name: /filters/i }))

    const limitInput = await screen.findByLabelText(/show last/i)
    expect(limitInput).toHaveValue(20)

    fireEvent.change(limitInput, { target: { value: "5" } })
    fireEvent.blur(limitInput)

    await waitFor(() => {
      // Only the 5 most recent calls (Lead 08..04) should remain.
      expect(screen.getByText("Lead 08")).toBeInTheDocument()
      expect(screen.getByText("Lead 04")).toBeInTheDocument()
      expect(screen.queryByText("Lead 03")).not.toBeInTheDocument()
      expect(screen.queryByText("Lead 01")).not.toBeInTheDocument()
    })

    expect(localStorage.getItem(STORAGE_KEYS.SALES_HUB_CALLS_LIMIT)).toBe("5")
  })
})
