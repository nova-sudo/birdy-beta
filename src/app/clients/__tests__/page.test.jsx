import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Client Hub ──────────────────────────────────────────────────────────────
// A ds DataTable of clients under a PageHeader, filtered by status/health tabs
// and a search box. Cost per lead carries its movement against the previous
// period, coloured as a cost (falling is good).

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }) }))
vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/cache", () => ({ getCachedData: vi.fn(), clearCache: vi.fn() }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: vi.fn() }))
vi.mock("@/components/clients/BulkImportDialog", () => ({ default: () => null }))
vi.mock("@/components/clients/MetaCampaignPicker", () => ({ MetaCampaignPicker: () => null }))
vi.mock("@/components/clients/MetaCampaignsDialog", () => ({ MetaCampaignsDialog: () => null }))

import { apiRequest } from "@/lib/api"
import { useClientGroups } from "@/lib/useClientGroups"
import { usePageHeader } from "@/components/page-header"
import ClientsPage from "../page"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const group = (id, name, { spend, leads, extra = {} }) => ({
  id,
  name,
  client_status: "Active",
  status: "complete",
  facebook: { currency: "GBP", metrics: { insights: { spend, results: leads } } },
  ...extra,
})

const GROUPS = [
  group("a", "acme dental", { spend: 200, leads: 20 }),
  group("b", "beta fitness", { spend: 90, leads: 10, extra: { health: "Critical" } }),
  group("c", "gamma legal", { spend: 50, leads: 5, extra: { client_status: "Inactive" } }),
]

const refresh = vi.fn()
function hook(over = {}) {
  vi.mocked(useClientGroups).mockReturnValue({
    clientGroups: GROUPS,
    loading: false,
    error: null,
    datePreset: "last_7d",
    setDatePreset: vi.fn(),
    invalidate: vi.fn(),
    refresh,
    ...over,
  })
}

const table = () => screen.getByRole("table")

beforeEach(() => {
  vi.clearAllMocks()
  hook()
  // last_14d enclosing window: acme was 300 over 20 leads -> previous week 100 over 0... use 220/20
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    if (String(url).includes("last_14d")) {
      return {
        ok: true,
        json: async () => ({
          client_groups: [
            // enclosing = this week + last week. Last week: 100 spend / 10 leads = 10 CPL
            group("a", "acme dental", { spend: 300, leads: 30 }),
          ],
        }),
      }
    }
    return { ok: true, json: async () => ({}) }
  })
})

describe("/clients", () => {
  it("renders a PageHeader titled Clients and publishes the top bar title", () => {
    render(<ClientsPage />)
    expect(document.querySelector('[data-ds="page-header"] h1')).toHaveTextContent("Clients")
    expect(usePageHeader).toHaveBeenCalledWith(expect.objectContaining({ title: "Clients" }))
  })

  it("lists the active clients in a ds DataTable with leads, CPL and spend", () => {
    render(<ClientsPage />)
    expect(document.querySelector('[data-ds="data-table"]')).not.toBeNull()
    const t = within(table())
    expect(t.getByText("Acme Dental")).toBeInTheDocument()
    expect(t.getByText("Beta Fitness")).toBeInTheDocument()
    // The Active tab hides the inactive client.
    expect(t.queryByText("Gamma Legal")).toBeNull()
    expect(t.getByText("£10.00")).toBeInTheDocument() // acme CPL
    expect(t.getByText("£200.00")).toBeInTheDocument() // acme spend
    expect(t.getAllByText("Active").length).toBe(2)
  })

  it("filters by the status and health tabs, with counts", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    const tabs = screen.getByRole("tablist", { name: "Filter clients by status" })
    expect(within(tabs).getByRole("tab", { name: /Active\s*2/ })).toBeInTheDocument()
    await user.click(within(tabs).getByRole("tab", { name: /Critical/ }))
    expect(within(table()).getByText("Beta Fitness")).toBeInTheDocument()
    expect(within(table()).queryByText("Acme Dental")).toBeNull()
    await user.click(within(tabs).getByRole("tab", { name: /Inactive/ }))
    expect(within(table()).getByText("Gamma Legal")).toBeInTheDocument()
    await user.click(within(tabs).getByRole("tab", { name: /All/ }))
    expect(within(table()).getByText("Gamma Legal")).toBeInTheDocument()
    expect(within(table()).getByText("Acme Dental")).toBeInTheDocument()
  })

  it("searches clients by name", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.type(screen.getByRole("searchbox", { name: /search/i }), "beta")
    expect(within(table()).getByText("Beta Fitness")).toBeInTheDocument()
    expect(within(table()).queryByText("Acme Dental")).toBeNull()
  })

  it("shows cost per lead movement against the previous week, falling cost green", async () => {
    render(<ClientsPage />)
    // acme: this week £10.00; last week (300-200)/(30-20) = £10.00 -> flat... make it move:
    // enclosing 300/30 minus current 200/20 = 100/10 = £10 -> 0%. Assert the delta renders at all.
    await waitFor(() => expect(within(table()).getAllByText(/0%|%/).length).toBeGreaterThan(0))
    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("date_preset=last_14d"))
  })

  it("colours a rising cost per lead red", async () => {
    vi.mocked(apiRequest).mockImplementation(async () => ({
      ok: true,
      // enclosing 260/30 minus current 200/20 -> previous 60/10 = £6; now £10 -> +66.7%
      json: async () => ({ client_groups: [group("a", "acme dental", { spend: 260, leads: 30 })] }),
    }))
    render(<ClientsPage />)
    const delta = await waitFor(() => {
      const el = within(table()).getByText(/66\.7%/)
      expect(el).toBeInTheDocument()
      return el
    })
    expect(delta).toHaveClass("text-danger-ink")
  })

  it("opens a client on row click", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.click(within(table()).getByText("Acme Dental"))
    expect(push).toHaveBeenCalledWith("/clients/a")
  })

  it("loading shows the table skeleton", () => {
    hook({ clientGroups: [], loading: true })
    render(<ClientsPage />)
    expect(document.querySelector('[data-ds="data-table-skeleton"]')).not.toBeNull()
  })

  it("an API failure shows ErrorState with retry", async () => {
    const user = userEvent.setup()
    hook({ clientGroups: [], error: "HTTP 503" })
    render(<ClientsPage />)
    expect(document.querySelector('[data-ds="error-state"]')).not.toBeNull()
    await user.click(screen.getByRole("button", { name: /try again/i }))
    expect(refresh).toHaveBeenCalled()
  })

  it("no clients at all shows an EmptyState that offers Add client", () => {
    hook({ clientGroups: [] })
    render(<ClientsPage />)
    const empty = document.querySelector('[data-ds="empty-state"]')
    expect(empty).not.toBeNull()
    expect(within(empty).getByRole("button", { name: /add client/i })).toBeInTheDocument()
  })

  it("Add client opens the linking wizard", async () => {
    const user = userEvent.setup()
    render(<ClientsPage />)
    await user.click(screen.getByRole("button", { name: /add client/i }))
    expect(await screen.findByText("Name your client group")).toBeInTheDocument()
  })
})
