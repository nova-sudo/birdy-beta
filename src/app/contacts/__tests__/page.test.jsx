import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Lead Hub ────────────────────────────────────────────────────────────────
// A ds PageHeader with the period control, the hero (metric tabs + Birdy's
// read) and the leads table.

vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
vi.mock("@/lib/useClientGroupsWithSeries", () => ({ useClientGroupsWithSeries: vi.fn() }))
vi.mock("@/components/contacts/LeadHubOverview", () => ({
  LeadHubOverview: (p) => <div data-testid="overview" data-group={p.selectedClientGroup} data-gran={p.granularity} data-preset={p.datePreset} />,
}))
vi.mock("@/components/contacts/LeadsContent", () => ({
  LeadsContent: (p) => <div data-testid="leads" data-group={p.selectedClientGroup} data-preset={p.datePreset} />,
}))

import { useClientGroupsWithSeries } from "@/lib/useClientGroupsWithSeries"
import { usePageHeader } from "@/components/page-header"
import ContactPage from "../page"

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

const GROUPS = [
  { id: "g1", name: "Acme", ghl_location_id: "loc1" },
  { id: "g2", name: "Beta", ghl_location_id: "loc2" },
  { id: "g3", name: "No GHL" },
]

const setDatePreset = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useClientGroupsWithSeries).mockReturnValue({
    clientGroups: GROUPS, loading: false, error: null, refresh: vi.fn(), datePreset: "last_7d", setDatePreset,
  })
})

describe("/contacts", () => {
  it("renders a PageHeader titled Lead Hub and publishes the top bar title", () => {
    render(<ContactPage />)
    expect(document.querySelector('[data-ds="page-header"] h1')).toHaveTextContent("Lead Hub")
    expect(usePageHeader).toHaveBeenCalledWith(expect.objectContaining({ title: "Lead Hub" }))
  })

  it("moves the date range from the shared period control", async () => {
    const user = userEvent.setup()
    render(<ContactPage />)
    await user.click(screen.getByRole("tab", { name: "30 days" }))
    expect(setDatePreset).toHaveBeenCalledWith("last_30d")
  })

  it("scopes the hero and the table to the picked client group, GHL-backed groups only", async () => {
    const user = userEvent.setup()
    render(<ContactPage />)
    await user.click(screen.getByRole("combobox", { name: "Client group" }))
    expect(screen.queryByRole("option", { name: "No GHL" })).toBeNull()
    await user.click(await screen.findByRole("option", { name: "Beta" }))
    expect(screen.getByTestId("overview")).toHaveAttribute("data-group", "g2")
    expect(screen.getByTestId("leads")).toHaveAttribute("data-group", "g2")
  })

  it("selects either of two groups that share a name", async () => {
    vi.mocked(useClientGroupsWithSeries).mockReturnValue({
      clientGroups: [
        { id: "u1", name: "", ghl_location_id: "l1" },
        { id: "u2", name: "", ghl_location_id: "l2" },
      ],
      loading: false, error: null, refresh: vi.fn(), datePreset: "last_7d", setDatePreset,
    })
    const user = userEvent.setup()
    render(<ContactPage />)
    await user.click(screen.getByRole("combobox", { name: "Client group" }))
    const options = await screen.findAllByRole("option", { name: "Unnamed Client" })
    expect(options).toHaveLength(2)
    await user.click(options[1])
    expect(screen.getByTestId("leads")).toHaveAttribute("data-group", "u2")
  })

  it("lets the chart granularity be chosen", async () => {
    const user = userEvent.setup()
    render(<ContactPage />)
    expect(screen.getByTestId("overview")).toHaveAttribute("data-gran", "Daily")
    await user.click(screen.getByRole("combobox", { name: "Chart granularity" }))
    await user.click(await screen.findByRole("option", { name: "Weekly" }))
    expect(screen.getByTestId("overview")).toHaveAttribute("data-gran", "Weekly")
  })

  it("renders no legacy portfolio markup", () => {
    const { container } = render(<ContactPage />)
    expect(within(container).queryByText("Lead Hub")).not.toBeNull()
    expect(container.querySelector("[class*='pd-']")).toBeNull()
  })
})
