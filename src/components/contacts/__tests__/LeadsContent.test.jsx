import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Lead table ──────────────────────────────────────────────────────────────
// The unified leads list in a ds DataTable, paged on the server (limit 15),
// with pipeline tabs, faceted filters, search and the saved column views.

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
const views = vi.hoisted(() => ({
  savedColumns: null, saveView: vi.fn(), saveViewDebounced: vi.fn(), viewsLoaded: true,
}))
vi.mock("@/lib/useColumnViews", () => ({ useColumnViews: () => views }))
vi.mock("@/lib/usePageViews", () => ({
  usePageViews: () => ({ views: [], activeViewId: null, activeView: null, applyView: vi.fn(), createView: vi.fn(), updateView: vi.fn(), deleteView: vi.fn() }),
}))

import { apiRequest } from "@/lib/api"
import { LeadsContent } from "@/components/contacts/LeadsContent"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}

const GROUPS = [{ id: "g1", name: "Acme", ghl_location_id: "loc" }]

const contact = (n, over = {}) => ({
  id: `c${n}`,
  contactName: `lead number ${n}`,
  email: `lead${n}@example.com`,
  phone: `0700000${n}`,
  groupName: "Acme",
  tags: ["vip"],
  type: "lead",
  dateAdded: "2026-10-01T00:00:00Z",
  opportunities: [{ status: "open", monetaryValue: 100 }],
  sources: { ghl: true, meta: true },
  ...over,
})

const page = (n, { contacts = [contact(1), contact(2)], stats = {} } = {}) => ({
  contacts,
  meta: {
    total_contacts: 40, total_pages: 3, has_next: n < 3, has_prev: n > 1,
    stats: { lead_count: 40, open: 20, won: 8, abandoned: 2, lost: 10, ...stats },
  },
})

const urls = () => vi.mocked(apiRequest).mock.calls.map(([u]) => String(u))
const unified = () => urls().filter((u) => u.startsWith("/api/leads/unified"))

beforeEach(() => {
  vi.clearAllMocks()
  views.savedColumns = null
  vi.mocked(apiRequest).mockImplementation(async (url) => {
    const u = String(url)
    if (u.startsWith("/api/leads/unified")) {
      const n = Number(new URL(u, "http://x").searchParams.get("page"))
      return { ok: true, json: async () => page(n) }
    }
    if (u.startsWith("/api/leads/filter-options")) {
      return { ok: true, json: async () => ({ sources: ["facebook", "google"], tags: ["vip", "hot"] }) }
    }
    return { ok: true, json: async () => ({ custom_metrics: [] }) }
  })
})

// The table and its stacked cards are both in the DOM; read the table.
const inTable = (text) => waitFor(() => within(screen.getByRole("table")).getByText(text))

const renderLeads = (props = {}) =>
  render(
    <LeadsContent clientGroups={GROUPS} groupsLoading={false} datePreset="last_7d" showStatCards={false} selectedClientGroup="all" {...props} />
  )

describe("LeadsContent", () => {
  it("lists the unified leads, 15 to a server page, in a ds DataTable", async () => {
    renderLeads()
    expect(await inTable("Lead Number 1")).toBeInTheDocument()
    expect(document.querySelector('[data-ds="data-table"]')).not.toBeNull()
    expect(unified()[0]).toContain("page=1&limit=15")
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument()
  })

  it("asks the server for the next page", async () => {
    const user = userEvent.setup()
    renderLeads()
    await inTable("Lead Number 1")
    await user.click(screen.getByRole("button", { name: "Go to next page" }))
    await waitFor(() => expect(unified().some((u) => u.includes("page=2&limit=15"))).toBe(true))
    expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument()
  })

  it("shows the pipeline tabs with their counts and filters by opportunity status", async () => {
    const user = userEvent.setup()
    renderLeads()
    await inTable("Lead Number 1")
    const tabs = screen.getByRole("tablist", { name: "Pipeline stage" })
    expect(within(tabs).getByRole("tab", { name: /All Leads\s*40/ })).toBeInTheDocument()
    expect(within(tabs).getByRole("tab", { name: /Won\s*8/ })).toBeInTheDocument()
    await user.click(within(tabs).getByRole("tab", { name: /Open/ }))
    await waitFor(() => expect(unified().some((u) => u.includes("opportunity_status=open"))).toBe(true))
  })

  it("sends the Sources and Tags facets to the server", async () => {
    const user = userEvent.setup()
    renderLeads()
    await inTable("Lead Number 1")
    await user.click(await screen.findByRole("button", { name: /Sources/ }))
    await user.click(await screen.findByRole("checkbox", { name: /facebook/ }))
    await waitFor(() => expect(unified().some((u) => u.includes("&source=facebook"))).toBe(true))
    await user.click(screen.getByRole("button", { name: /Tags/ }))
    await user.click(await screen.findByRole("checkbox", { name: /hot/ }))
    await waitFor(() => expect(unified().some((u) => u.includes("&tag=hot"))).toBe(true))
  })

  it("searches the loaded page", async () => {
    const user = userEvent.setup()
    renderLeads()
    await inTable("Lead Number 1")
    const box = screen.getByRole("searchbox", { name: "Search leads" })
    expect(box.closest('[data-ds="search-input"]')).not.toBeNull()
    await user.type(box, "lead2@")
    const t = within(screen.getByRole("table"))
    expect(t.getByText("Lead Number 2")).toBeInTheDocument()
    expect(t.queryByText("Lead Number 1")).toBeNull()
  })

  it("saves a dragged column order (move right and left) and keeps Name locked", async () => {
    renderLeads()
    await inTable("Lead Number 1")
    const heads = () => within(screen.getByRole("table")).getAllByRole("columnheader")
    const dropOn = (fromId, headerText) => {
      const dt = { setData: vi.fn(), getData: () => fromId, effectAllowed: "" }
      fireEvent.drop(heads().find((h) => h.textContent.trim() === headerText), { dataTransfer: dt })
    }
    const saved = () => views.saveViewDebounced.mock.calls.at(-1)[0]
    expect(heads()[0]).toHaveAttribute("draggable", "false")

    dropOn("groupName", "Email") // move right
    expect(saved().slice(0, 3)).toEqual(["contactName", "email", "groupName"])
    dropOn("groupName", "Email") // move left again
    expect(saved().slice(0, 3)).toEqual(["contactName", "groupName", "email"])

    views.saveViewDebounced.mockClear()
    dropOn("contactName", "Email") // Name cannot be dragged
    dropOn("email", "Name") // nothing goes ahead of Name
    expect(views.saveViewDebounced).not.toHaveBeenCalled()
  })

  it("puts Name first even when a saved view has it mid-order, and keeps it first after a drop", async () => {
    views.savedColumns = ["email", "contactName", "groupName", "phone"]
    renderLeads()
    await inTable("Lead Number 1")
    const heads = () => within(screen.getByRole("table")).getAllByRole("columnheader")
    expect(heads().map((h) => h.textContent.trim()).slice(0, 4)).toEqual(["Name", "Email", "Client Group", "Phone"])

    // Dropping on the first movable column (index 1) must never land ahead of Name.
    const dt = { setData: vi.fn(), getData: () => "phone", effectAllowed: "" }
    fireEvent.drop(heads().find((h) => h.textContent.trim() === "Email"), { dataTransfer: dt })
    const saved = views.saveViewDebounced.mock.calls.at(-1)[0]
    expect(saved[0]).toBe("contactName")
    expect(saved.slice(0, 3)).toEqual(["contactName", "phone", "email"])
  })

  it("keeps the Columns menu and the source icons", async () => {
    renderLeads()
    await inTable("Lead Number 1")
    expect(screen.getByRole("button", { name: /columns/i })).toBeInTheDocument()
    expect(within(screen.getByRole("table")).getAllByAltText("GHL").length).toBeGreaterThan(0)
  })

  it("states a failed load with a retry that fetches again", async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockImplementation(async (url) =>
      String(url).startsWith("/api/leads/unified") ? { ok: false, status: 500 } : { ok: true, json: async () => ({}) }
    )
    renderLeads()
    expect(await screen.findByText("Couldn't load your leads")).toBeInTheDocument()
    expect(screen.getByText(/Failed: 500/)).toBeInTheDocument()
    const before = unified().length
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(unified().length).toBeGreaterThan(before))
  })

  it("shows an empty state when there are no leads", async () => {
    vi.mocked(apiRequest).mockImplementation(async (url) =>
      String(url).startsWith("/api/leads/unified")
        ? { ok: true, json: async () => page(1, { contacts: [] }) }
        : { ok: true, json: async () => ({}) }
    )
    renderLeads()
    expect(await screen.findByText("No leads yet")).toBeInTheDocument()
  })

  it("still renders the stat cards where asked to (client page)", async () => {
    renderLeads({ showStatCards: true })
    await inTable("Lead Number 1")
    expect(document.querySelector('[data-ds="metric-group"]')).not.toBeNull()
    expect(screen.getByText("Total Leads")).toBeInTheDocument()
  })
})
