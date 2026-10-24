import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Settings → Tracking ────────────────────────────────────────────────────
// The roster of clients with their lead source and tracking status: loading,
// error with retry, empty, and the rows themselves.

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import TrackingOverview from "../TrackingOverview"

const NOW = new Date("2026-10-24T12:00:00Z")

const CLIENTS = [
  { group_id: "g1", group_name: "Acme Dental", method: "landing_page", installed: true, site_id: "s1", last_seen_at: "2026-10-24T11:00:00Z", tracked_leads: 42 },
  { group_id: "g2", group_name: "Beta Fitness", method: "landing_page", installed: false, site_id: "s2", last_seen_at: null, tracked_leads: 0 },
  { group_id: "g3", group_name: "Gamma Legal", method: "instant_form", installed: false, site_id: null, last_seen_at: null, tracked_leads: 0 },
  { group_id: "g4", group_name: "Delta Auto", method: "unknown", installed: false, site_id: null, last_seen_at: null, tracked_leads: 0 },
]

function respond(body, status = 200) {
  vi.mocked(apiRequest).mockResolvedValue({ ok: status < 400, status, json: async () => body })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe("TrackingOverview", () => {
  it("shows a loading skeleton, then a row per client", async () => {
    respond({ clients: CLIENTS })
    render(<TrackingOverview />)
    expect(screen.getByLabelText("Loading tracking status")).toBeInTheDocument()
    expect(await screen.findByText("Acme Dental")).toBeInTheDocument()
    expect(apiRequest).toHaveBeenCalledWith("/attribution/overview")
    expect(screen.getAllByRole("row")).toHaveLength(CLIENTS.length + 1)
  })

  it("reads lead source, script state, age and captured count per row", async () => {
    respond({ clients: CLIENTS })
    render(<TrackingOverview />)
    const acme = (await screen.findByText("Acme Dental")).closest("tr")
    expect(within(acme).getByText("Own landing page")).toBeInTheDocument()
    expect(within(acme).getByText("Live")).toBeInTheDocument()
    expect(within(acme).getByText("1h ago")).toBeInTheDocument()
    expect(within(acme).getByText("42")).toBeInTheDocument()
    const beta = screen.getByText("Beta Fitness").closest("tr")
    expect(within(beta).getByText("Not seen")).toBeInTheDocument()
    const gamma = screen.getByText("Gamma Legal").closest("tr")
    expect(within(gamma).getByText("Meta forms")).toBeInTheDocument()
    expect(within(gamma).queryByText("Live")).toBeNull()
  })

  it("counts the clients with no lead source set", async () => {
    respond({ clients: CLIENTS })
    render(<TrackingOverview />)
    expect(await screen.findByText("1 client has no lead source set")).toBeInTheDocument()
  })

  it("badges the lead source with ds Badge", async () => {
    respond({ clients: CLIENTS })
    const { container } = render(<TrackingOverview />)
    await screen.findByText("Acme Dental")
    expect(container.querySelectorAll('[data-ds="badge"]')).toHaveLength(CLIENTS.length)
  })

  it("copies the install link only for clients that need the script", async () => {
    respond({ clients: CLIENTS })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
    render(<TrackingOverview />)
    await screen.findByText("Acme Dental")
    expect(screen.getAllByRole("button", { name: /Link/ })).toHaveLength(2)
    await user.click(within(screen.getByText("Acme Dental").closest("tr")).getByRole("button", { name: /Link/ }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/install/s1`)
    expect(toast.success).toHaveBeenCalledWith("Install link copied")
  })

  it("Set up opens the client's tracking page", async () => {
    respond({ clients: CLIENTS })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TrackingOverview />)
    const row = (await screen.findByText("Gamma Legal")).closest("tr")
    await user.click(within(row).getByRole("button", { name: /Set up/ }))
    expect(push).toHaveBeenCalledWith("/clients/g3/tracking")
  })

  it("says so when there are no clients", async () => {
    respond({ clients: [] })
    const { container } = render(<TrackingOverview />)
    expect(await screen.findByText("No clients yet.")).toBeInTheDocument()
    expect(container.querySelector('[data-ds="empty-state"]')).not.toBeNull()
  })

  it("states the failure and retries", async () => {
    respond({}, 500)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = render(<TrackingOverview />)
    expect(await screen.findByText("Couldn't load tracking status (500)")).toBeInTheDocument()
    expect(container.querySelector('[data-ds="error-state"]')).not.toBeNull()
    respond({ clients: CLIENTS })
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(screen.getByText("Acme Dental")).toBeInTheDocument())
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })
})
