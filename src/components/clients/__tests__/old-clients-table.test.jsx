import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

const push = vi.fn()
const actions = { openAddClient: vi.fn(), openImport: vi.fn() }
const groupsState = { clientGroups: [], loading: false, error: null }
const setDatePreset = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/clients",
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ custom_metrics: [], views: [] }) })),
  API_BASE_URL: "",
}))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/shell/client-actions", () => ({ useClientActions: () => actions }))
vi.mock("@/lib/useClientGroups", () => ({
  useClientGroups: () => ({ ...groupsState, datePreset: "last_7d", setDatePreset, refresh: vi.fn(), invalidate: vi.fn() }),
}))
vi.mock("@/lib/useColumnViews", () => ({
  useColumnViews: () => ({ savedColumns: null, saveView: vi.fn(), saveViewDebounced: vi.fn(), viewsLoaded: true }),
}))

import { OldClientsTable } from "../list/old-clients-table"

const NOW = new Date().toISOString()
const client = (id, name, extra = {}) => ({
  id, name, client_status: "Active", health: "Healthy", status: "active",
  last_meta_refresh: NOW, last_ghl_refresh: NOW, last_hp_refresh: NOW, meta_ad_account_id: "act", ghl_location_id: "loc",
  facebook: { metrics: { insights: { spend: 100, results: 20, clicks: 50, impressions: 1000 } } },
  gohighlevel: { metrics: { total_contacts: 20 } },
  ...extra,
})
const CLIENTS = [
  client("a", "Healthy Glow"),
  client("b", "Aura Aesthetics", { health: "Critical" }),
  client("c", "Fallon Physique", { health: "Warning" }),
  client("d", "Old Clinic", { client_status: "Inactive" }),
]
const tab = (name) => screen.getByRole("tab", { name: new RegExp(`^${name}`) })
const rowNames = () => {
  const table = screen.getByRole("table")
  return within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent.trim())
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(groupsState, { clientGroups: CLIENTS, loading: false, error: null })
  localStorage.setItem("user_default_currency", "GBP")
})

describe("Old clients table", () => {
  it("frames the table under the Clients section header with the date range", () => {
    render(<OldClientsTable />)
    expect(screen.getByRole("heading", { level: 1, name: "Clients" })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("sits under another section's header when given a frame, with the same table and date range", () => {
    render(<OldClientsTable frame={({ dateRange, body }) => <div><h1>Agency Ops</h1>{dateRange}{body}</div>} />)
    expect(screen.getByRole("heading", { level: 1, name: "Agency Ops" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1, name: "Clients" })).toBeNull()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(rowNames().sort()).toEqual(["Aura Aesthetics", "Fallon Physique", "Healthy Glow"])
  })

  it("opens on Active and renders the active clients' rows", () => {
    render(<OldClientsTable />)
    expect(tab("Active")).toHaveAttribute("aria-selected", "true")
    expect(tab("Active")).toHaveTextContent("3")
    expect(tab("All Clients")).toHaveTextContent("4")
    expect(rowNames().sort()).toEqual(["Aura Aesthetics", "Fallon Physique", "Healthy Glow"])
  })

  it("filters by the status tabs", async () => {
    render(<OldClientsTable />)
    await userEvent.click(tab("Critical"))
    expect(rowNames()).toEqual(["Aura Aesthetics"])
    await userEvent.click(tab("Inactive"))
    expect(rowNames()).toEqual(["Old Clinic"])
    await userEvent.click(tab("All Clients"))
    expect(rowNames()).toHaveLength(4)
  })

  it("filters by search", async () => {
    render(<OldClientsTable />)
    await userEvent.type(screen.getByRole("textbox", { name: "Search clients" }), "fallon")
    expect(rowNames()).toEqual(["Fallon Physique"])
  })

  it("Import and + open the shell's dialogs", async () => {
    render(<OldClientsTable />)
    await userEvent.click(screen.getByRole("button", { name: "Import clients from GoHighLevel" }))
    expect(actions.openImport).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole("button", { name: "Add client" }))
    expect(actions.openAddClient).toHaveBeenCalledTimes(1)
  })

  it("a row click opens the client in the new shell", async () => {
    render(<OldClientsTable />)
    const row = within(screen.getByRole("table")).getAllByRole("row").find((r) => r.textContent.includes("Healthy Glow"))
    await userEvent.click(row)
    expect(push).toHaveBeenCalledWith("/dashboard?client=a")
  })

  it("shows a client still importing as a loading row", () => {
    groupsState.clientGroups = [...CLIENTS, client("e", "Peach Perfect", { status: "creating" })]
    render(<OldClientsTable />)
    const row = within(screen.getByRole("table")).getAllByRole("row").find((r) => r.textContent.includes("Peach Perfect"))
    expect(row).toHaveTextContent("Syncing")
  })
})
