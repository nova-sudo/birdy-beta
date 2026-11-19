import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

const push = vi.fn()
const actions = { openAddClient: vi.fn(), openImport: vi.fn() }
const groupsState = { clientGroups: [], loading: false, error: null }
const viewState = { savedColumns: null, saveView: vi.fn(() => Promise.resolve()), viewsLoaded: true }
const refresh = vi.fn()
const setDatePreset = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ custom_metrics: [] }) })) }))
vi.mock("@/components/shell/client-actions", () => ({ useClientActions: () => actions }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ ...groupsState, datePreset: "last_7d", setDatePreset, refresh }) }))
vi.mock("@/lib/useColumnViews", () => ({ useColumnViews: () => viewState }))

import { ClientsList } from "../list/clients-list"

const NOW = new Date().toISOString()
const client = (id, name, extra = {}) => ({
  id, name, client_status: "Active", health: "Healthy", status: "active", call_log_provider: "hotprospector",
  last_meta_refresh: NOW, last_ghl_refresh: NOW, last_hp_refresh: NOW, meta_ad_account_id: "act", ghl_location_id: "loc",
  facebook: { metrics: { insights: { spend: 100, results: 20, clicks: 50, impressions: 1000 } } },
  gohighlevel: { metrics: { total_contacts: 20 } },
  hotprospector: { metrics: { total_leads: 20 }, call_stats: { leads_with_calls: 5, total_leads: 20 } },
  ...extra,
})
const CLIENTS = [
  client("a", "Healthy Glow", { facebook: { metrics: { insights: { spend: 250, results: 100 } } } }),
  client("b", "Aura", { health: "Critical", targets: { cpl: 6 }, facebook: { metrics: { insights: { spend: 50, results: 4 } } } }),
  client("c", "Fallon Physique", { health: "Warning", facebook: { metrics: { insights: { spend: 85, results: 17 } } } }),
  client("d", "Old Clinic", { client_status: "Inactive", health: "Critical" }),
  client("e", "Peach Perfect", { status: "creating" }),
]
const names = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(groupsState, { clientGroups: CLIENTS, loading: false, error: null })
  Object.assign(viewState, { savedColumns: null, viewsLoaded: true })
  window.history.replaceState(null, "", "/clients")
  localStorage.setItem("user_default_currency", "GBP")
})

describe("Clients list", () => {
  it("counts the tabs and opens on All active, most urgent first", () => {
    render(<ClientsList />)
    expect(screen.getByRole("tab", { name: /All active/ })).toHaveTextContent("All active4")
    expect(screen.getByRole("tab", { name: /At risk/ })).toHaveTextContent("At risk2")
    expect(screen.getByRole("tab", { name: /On track/ })).toHaveTextContent("On track2")
    expect(screen.getByRole("tab", { name: /Inactive/ })).toHaveTextContent("Inactive1")
    expect(screen.getByText("2 clients at risk · 4 active")).toBeInTheDocument()
    expect(names()).toEqual(["Aura", "Fallon Physique", "Healthy Glow", "Peach Perfect"])
  })

  it("shows hand-set health in the redesign’s words", () => {
    render(<ClientsList />)
    const row = (name) => screen.getByRole("row", { name: new RegExp(name) })
    expect(within(row("Aura")).getByText("At risk")).toHaveClass("text-by-danger")
    expect(within(row("Fallon Physique")).getByText("At risk")).toHaveClass("text-by-warning")
    expect(within(row("Healthy Glow")).getByText("On track")).toHaveClass("text-by-success")
  })

  it("shows the default columns with a cost per lead over its target in red", () => {
    render(<ClientsList />)
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Client", "Status", "Spend", "Leads", "CPL", "Leads called", "Open"])
    const aura = within(screen.getByRole("row", { name: /Aura/ }))
    expect(aura.getByText("£12.50")).toHaveClass("text-by-danger")
    expect(aura.getByText("£50.00")).toBeInTheDocument()
    expect(aura.getByText("25.00%")).toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /Healthy Glow/ })).getByText("£2.50")).not.toHaveClass("text-by-danger")
  })

  it("never shows numbers for a client that is still syncing", () => {
    render(<ClientsList />)
    const row = within(screen.getByRole("row", { name: /Peach Perfect/ }))
    expect(row.getByText(/^Loading last 7 days/)).toBeInTheDocument()
    expect(row.queryByText(/£/)).not.toBeInTheDocument()
    expect(row.queryByText("On track")).not.toBeInTheDocument()
  })

  it("filters by tab, with inactive clients greyed and without a pill", async () => {
    render(<ClientsList />)
    await userEvent.click(screen.getByRole("tab", { name: /At risk/ }))
    expect(names()).toEqual(["Aura", "Fallon Physique"])
    await userEvent.click(screen.getByRole("tab", { name: /Inactive/ }))
    expect(names()).toEqual(["Old Clinic"])
    // Its stored health is Critical, but an inactive client shows no pill.
    expect(within(screen.getByRole("table")).queryByText("At risk")).not.toBeInTheDocument()
    expect(screen.getByRole("row", { name: /Old Clinic/ })).toHaveClass("text-by-muted")
    expect(window.location.search).toBe("?tab=off")
  })

  it("sorts three ways from a header and keeps it in the address", async () => {
    render(<ClientsList />)
    const spend = () => screen.getByRole("button", { name: "Spend" })
    await userEvent.click(spend())
    expect(names()[0]).toBe("Healthy Glow")
    expect(window.location.search).toBe("?sort=meta_spend-desc")
    await userEvent.click(spend())
    expect(names()[0]).toBe("Aura")
    await userEvent.click(spend())
    expect(window.location.search).toBe("")
    expect(names()[0]).toBe("Aura")
  })

  it("searches, and offers to clear when nothing matches", async () => {
    render(<ClientsList />)
    await userEvent.type(screen.getByRole("searchbox", { name: "Search clients" }), "glow")
    expect(names()).toEqual(["Healthy Glow"])
    await userEvent.type(screen.getByRole("searchbox", { name: "Search clients" }), "zzz")
    expect(screen.getByRole("heading", { name: "No clients match" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(names()).toHaveLength(4)
  })

  it("restores tab, search and sort from the address", () => {
    window.history.replaceState(null, "", "/clients?tab=risk&q=a&sort=meta_spend-desc")
    render(<ClientsList />)
    expect(screen.getByRole("tab", { name: /At risk/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("searchbox", { name: "Search clients" })).toHaveValue("a")
    expect(names()).toEqual(["Fallon Physique", "Aura"])
  })

  it("opens a client on click and on Enter, by its id", async () => {
    render(<ClientsList />)
    await userEvent.click(screen.getByRole("row", { name: /Aura/ }))
    expect(push).toHaveBeenLastCalledWith("/clients/b")
    screen.getByRole("row", { name: /Healthy Glow/ }).focus()
    await userEvent.keyboard("{Enter}")
    expect(push).toHaveBeenLastCalledWith("/clients/a")
  })

  it("opens the two ways of adding clients", async () => {
    render(<ClientsList />)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    await userEvent.click(screen.getByRole("button", { name: "Import" }))
    expect(actions.openAddClient).toHaveBeenCalledOnce()
    expect(actions.openImport).toHaveBeenCalledOnce()
  })

  it("uses a saved view when there is one, and saves a changed one", async () => {
    viewState.savedColumns = ["name", "health", "meta_spend", "meta_ctr"]
    render(<ClientsList />)
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Client", "Status", "Spend", "CTR", "Open"])
    await userEvent.click(screen.getByRole("button", { name: "Columns" }))
    expect(await screen.findByRole("button", { name: "Save as my view" })).toBeDisabled()
    await userEvent.click(screen.getByRole("checkbox", { name: "Leads" }))
    await userEvent.click(screen.getByRole("button", { name: "Save as my view" }))
    expect(viewState.saveView).toHaveBeenCalledWith(["name", "meta_spend", "meta_ctr", "meta_leads"])
  })
})

describe("Clients list: loading, failing and empty", () => {
  it("shows placeholder rows while loading", () => {
    Object.assign(groupsState, { clientGroups: [], loading: true })
    render(<ClientsList />)
    expect(screen.getByText("Loading your clients")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(9)
    expect(screen.queryByText("No clients yet")).not.toBeInTheDocument()
  })

  it("says the list could not load and retries", async () => {
    Object.assign(groupsState, { clientGroups: [], error: "HTTP 500" })
    render(<ClientsList />)
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load your clients.")
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it("offers both ways in when the account has no clients", async () => {
    groupsState.clientGroups = []
    render(<ClientsList />)
    expect(screen.getByRole("heading", { name: "No clients yet" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Import from GoHighLevel" }))
    expect(actions.openImport).toHaveBeenCalledOnce()
  })

  it("names an empty tab", async () => {
    groupsState.clientGroups = [client("a", "Healthy Glow")]
    render(<ClientsList />)
    await userEvent.click(screen.getByRole("tab", { name: /At risk/ }))
    expect(screen.getByRole("heading", { name: "No clients at risk" })).toBeInTheDocument()
  })
})
