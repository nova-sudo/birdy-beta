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
const views = vi.hoisted(() => ({ savedColumns: null, saveView: vi.fn(), viewsLoaded: true }))
vi.mock("@/lib/useColumnViews", () => ({ useColumnViews: () => views }))
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

// cmdk (the column picker) scrolls its active item into view, which jsdom lacks.
Element.prototype.scrollIntoView ??= () => {}

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
  views.savedColumns = null
  views.viewsLoaded = true
  hook()
  // last_14d is this week plus last week. Acme this week: 200 over 20 leads (£10).
  // Last week: (340 - 200) / (30 - 20) = £14, so cost per lead fell 28.6%.
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    if (String(url).includes("last_14d")) {
      return {
        ok: true,
        json: async () => ({
          client_groups: [
            group("a", "acme dental", { spend: 340, leads: 30 }),
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

  it("shows cost per lead movement against the previous week, a falling cost green", async () => {
    render(<ClientsPage />)
    const delta = await waitFor(() => within(table()).getByText(/28\.6%/))
    expect(delta).toHaveClass("text-success-ink")
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

  describe("column catalogue", () => {
    const withExtras = () => {
      hook({
        clientGroups: [
          group("a", "acme dental", {
            spend: 200,
            leads: 20,
            extra: {
              facebook: { currency: "GBP", metrics: { total_campaigns: 7, insights: { spend: 200, results: 20, ctr: 1.5 } } },
              gohighlevel: { metrics: { tag_breakdown: { vip: 3 }, total_contacts: 45 } },
            },
          }),
        ],
      })
    }
    const header = (name) => within(table()).queryByRole("columnheader", { name })
    const openView = async (user) => user.click(screen.getByRole("button", { name: "Toggle columns" }))

    it("opens on the five columns; the rest of the catalogue is one click away", async () => {
      withExtras()
      const user = userEvent.setup()
      render(<ClientsPage />)
      for (const h of ["Client", "Status", "Health", "Leads", "Cost per lead", "Ad spend"]) expect(header(h)).not.toBeNull()
      expect(header("Campaigns")).toBeNull()

      await openView(user)
      const menu = screen.getByRole("dialog")
      expect(within(menu).getByText("Campaigns")).toBeInTheDocument()
      expect(within(menu).getByText("GHL Leads")).toBeInTheDocument()
      // The name column cannot be hidden, and the curated columns are not offered twice.
      expect(within(menu).queryByText("Business Name")).toBeNull()
      expect(within(menu).queryByText("Meta Leads")).toBeNull()

      await user.click(within(menu).getByText("Campaigns"))
      expect(header("Campaigns")).not.toBeNull()
      expect(within(table()).getByText("7")).toBeInTheDocument()
    })

    it("offers a column per GHL tag, with the tag's count", async () => {
      withExtras()
      const user = userEvent.setup()
      render(<ClientsPage />)
      await openView(user)
      await user.click(within(screen.getByRole("dialog")).getByText("Tag: Vip"))
      expect(header("Tag: Vip")).not.toBeNull()
      expect(within(table()).getByText("3")).toBeInTheDocument()
    })

    it("offers the agency's custom formulas that are shown on Clients", async () => {
      withExtras()
      vi.mocked(apiRequest).mockImplementation(async (url) => {
        if (String(url) === "/api/custom-metrics") {
          return {
            ok: true,
            json: async () => ({
              custom_metrics: [
                { id: "m1", name: "Spend per contact", dashboards: ["clients"], format_type: "currency",
                  formula_parts: [{ type: "metric", value: "meta_spend" }, { type: "operator", value: "/" }, { type: "metric", value: "ghl_contacts" }] },
                { id: "m2", name: "Other dashboard only", dashboards: ["marketing"], formula_parts: [] },
              ],
            }),
          }
        }
        return { ok: true, json: async () => ({ client_groups: [] }) }
      })
      const user = userEvent.setup()
      render(<ClientsPage />)
      await openView(user)
      const menu = screen.getByRole("dialog")
      expect(await within(menu).findByText("Spend per contact")).toBeInTheDocument()
      expect(within(menu).queryByText("Other dashboard only")).toBeNull()
    })

    it("a saved layout loads: its columns, in its order, legacy ids read as the curated ones", () => {
      withExtras()
      views.savedColumns = ["name", "meta_campaigns", "meta_spend"]
      render(<ClientsPage />)
      const headers = within(table()).getAllByRole("columnheader").map((h) => h.textContent)
      expect(headers).toEqual(["Client", "Campaigns", "Ad spend"])
    })

    it("a user with no saved layout gets the five columns, and Save columns writes the visible ids", async () => {
      withExtras()
      const user = userEvent.setup()
      render(<ClientsPage />)
      await user.click(screen.getByRole("button", { name: "Save columns" }))
      expect(views.saveView).toHaveBeenCalledWith(["name", "status", "health", "leads", "cpl", "spend"])
    })

    it("waits for the saved layout before applying one", () => {
      withExtras()
      views.viewsLoaded = false
      views.savedColumns = ["name", "meta_campaigns"]
      render(<ClientsPage />)
      expect(header("Campaigns")).toBeNull()
      expect(header("Leads")).not.toBeNull()
    })
  })
})
