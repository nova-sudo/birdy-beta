import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { LeadTracking } from "../lead-tracking"

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const CLIENTS = [
  { group_id: "g1", group_name: "Aura", method: "unknown" },
  { group_id: "g2", group_name: "Beaulea", method: "landing_page", installed: true, tracked_leads: 12, site_id: "site-2", last_seen_at: new Date().toISOString() },
  { group_id: "g3", group_name: "Glow", method: "instant_form" },
]

beforeEach(() => {
  vi.clearAllMocks()
  apiRequest.mockResolvedValue(ok({ clients: CLIENTS }))
})

describe("LeadTracking", () => {
  it("is folded, with the count of clients that need a source", async () => {
    render(<LeadTracking />)
    expect(apiRequest).toHaveBeenCalledWith("/attribution/overview")
    expect(await screen.findByText("1 need setup")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("opens to the summary and every client", async () => {
    const user = userEvent.setup()
    render(<LeadTracking />)
    await screen.findByText("1 need setup")
    await user.click(screen.getByRole("button", { name: /Lead tracking per client/ }))
    expect(screen.getByText("2 of 3 set up")).toBeInTheDocument()
    expect(screen.getByText(/1 client has no lead source set/)).toBeInTheDocument()
    expect(screen.getByText("Live")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("Not set")).toBeInTheDocument()
  })

  it("copies a client's install link and opens its setup", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(navigator.clipboard, "writeText")
    render(<LeadTracking />)
    await screen.findByText("1 need setup")
    await user.click(screen.getByRole("button", { name: /Lead tracking per client/ }))
    // Only a landing page needs the pixel, so only it has a link to copy.
    expect(screen.getAllByRole("button", { name: /Link/ })).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: /Link/ }))
    expect(spy).toHaveBeenCalledWith(`${window.location.origin}/install/site-2`)
    expect(toast.success).toHaveBeenCalledWith("Install link copied")
    await user.click(screen.getByRole("button", { name: "Set up tracking for Aura" }))
    expect(push).toHaveBeenCalledWith("/clients/g1/tracking")
  })

  it("says when it can't load, and retries", async () => {
    const user = userEvent.setup()
    apiRequest.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    render(<LeadTracking />)
    await user.click(screen.getByRole("button", { name: /Lead tracking per client/ }))
    expect(await screen.findByText("Couldn't load tracking status (500)")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.getByText("2 of 3 set up")).toBeInTheDocument())
  })
})
