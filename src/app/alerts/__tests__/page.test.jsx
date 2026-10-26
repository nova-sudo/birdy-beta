import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Alerts ──────────────────────────────────────────────────────────────────
// Characterization of the page's behaviour: the list per tab, creating and
// editing a rule (the exact request payload), pausing, snoozing and deleting.

const tab = vi.hoisted(() => ({ value: "active" }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (k) => (k === "tab" ? tab.value : null) }),
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }) }))
vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/components/chat/ChatConversation", () => ({ default: () => <div data-testid="birdy-chat" /> }))
vi.mock("@/components/ui/MetricPicker", () => ({ default: () => <div data-testid="metric-picker" /> }))

import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { usePageHeader } from "@/components/page-header"
import { ConfirmHost } from "@/components/ds"
import { STORAGE_KEYS } from "@/lib/constants"
import AlertsPage from "../page"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

const NOW = new Date().toISOString()

const rule = (id, name, over = {}) => ({
  id,
  name,
  description: "",
  type: "warning",
  status: "active",
  condition: { metric: "spend", operator: "gt", value: 100, period: "day" },
  target_group_ids: ["g1"],
  target_group_names: ["Acme Dental"],
  notification_channels: ["in_app"],
  frequency: "daily",
  tracking_mode: "total",
  updated_at: NOW,
  progress_pct: 40,
  current_value: 40,
  ...over,
})

const LOADED = {
  active: [rule("a1", "Spend cap", { description: "Daily spend ceiling" })],
  triggered: [],
  paused: [rule("p1", "Quiet rule", { status: "paused" })],
  counts: { active: 1, triggered: 0, paused: 1 },
}

const child = (cid, cname, progress) => ({
  ...rule("t1", "CPL watch"),
  status: "triggered",
  _virtual: true,
  _virtual_id: `t1_${cid}`,
  _client_id: cid,
  _client_name: cname,
  _client_progress: progress,
  _client_value: 31.5,
  tracking_mode: "per_client",
})

function mockGroup() {
  tab.value = "triggered"
  mockApi({
    ...LOADED,
    triggered: [child("c1", "Acme Dental", 120), child("c2", "Beta Fitness", 80)],
    counts: { active: 1, triggered: 2, paused: 1 },
  })
}

const calls = (method) => vi.mocked(apiRequest).mock.calls.filter(([, o]) => o?.method === method)

function mockApi(alerts = LOADED) {
  vi.mocked(apiRequest).mockImplementation(async (url, opts) => {
    if (url === "/api/alerts" && !opts) return { ok: true, json: async () => alerts }
    if (url.startsWith("/api/client-groups"))
      return { ok: true, json: async () => ({ client_groups: [{ id: "g1", name: "Acme Dental", client_status: "Active" }] }) }
    if (url === "/api/custom-metrics") return { ok: true, json: async () => ({ custom_metrics: [] }) }
    return { ok: true, text: async () => "", json: async () => ({}) }
  })
}

function renderPage() {
  return render(
    <>
      <ConfirmHost />
      <AlertsPage />
    </>
  )
}

async function pressCreate(user) {
  await user.click(screen.getByRole("button", { name: /create alert/i }))
}

// The table and its narrow-screen cards are both in the DOM; read the table.
const tableEl = () => screen.getByRole("table")
const rowOf = (name) => within(tableEl()).getByText(name).closest("tr")
const loaded = (name) => waitFor(() => expect(rowOf(name)).toBeInTheDocument())
const sheet = () => screen.getByRole("dialog")

beforeEach(() => {
  vi.clearAllMocks()
  tab.value = "active"
  localStorage.clear()
  mockApi()
})

describe("/alerts", () => {
  it("lists the alerts on the chosen tab with their condition and status", async () => {
    renderPage()
    await loaded("Spend cap")
    const row = rowOf("Spend cap")
    expect(within(row).getByText("Daily spend ceiling")).toBeInTheDocument()
    expect(within(row).getByText("Total Spend")).toBeInTheDocument()
    expect(within(row).getByText("> 100")).toBeInTheDocument()
    expect(within(row).getByText("Active")).toBeInTheDocument()
    expect(within(row).getByText("Acme Dental")).toBeInTheDocument()
    expect(screen.queryByText("Quiet rule")).toBeNull()
  })

  it("shows the paused alerts on the snoozed tab and an empty state on a tab with none", async () => {
    tab.value = "paused"
    const { unmount } = renderPage()
    await loaded("Quiet rule")
    expect(within(rowOf("Quiet rule")).getByText("Snoozed")).toBeInTheDocument()
    unmount()

    tab.value = "triggered"
    renderPage()
    expect(await screen.findAllByText("No triggered alerts")).not.toHaveLength(0)
  })

  it("loads alerts, client groups and custom metrics from the same endpoints", async () => {
    renderPage()
    await loaded("Spend cap")
    const urls = vi.mocked(apiRequest).mock.calls.map(([u]) => u)
    expect(urls).toContain("/api/alerts")
    expect(urls).toContain("/api/client-groups?include_daily=false")
    expect(urls).toContain("/api/custom-metrics")
  })

  it("creates a rule by hand with the exact payload", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await pressCreate(user)
    // Opens in Ask Birdy mode; switch to the form.
    expect(await screen.findByTestId("birdy-chat")).toBeInTheDocument()
    await user.click(within(sheet()).getByRole("tab", { name: /^manual$/i }))
    await user.type(screen.getByPlaceholderText("e.g. Low ROI Alert"), "CPL cap")
    const value = screen.getByRole("spinbutton")
    await user.clear(value)
    await user.type(value, "25")
    await user.click(within(sheet()).getByRole("button", { name: "Create Alert" }))

    await waitFor(() => expect(calls("POST")).toHaveLength(1))
    const [url, opts] = calls("POST")[0]
    expect(url).toBe("/api/alerts")
    expect(JSON.parse(opts.body)).toEqual({
      name: "CPL cap",
      description: "",
      type: "warning",
      condition: { metric: "spend", operator: "gt", value: 25, period: "day" },
      target_group_ids: [],
      notification_channels: ["in_app"],
      frequency: "daily",
      tracking_mode: "total",
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Alert created"))
  })

  it("refuses to save a rule with no name", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await pressCreate(user)
    await user.click(await screen.findByRole("tab", { name: /^manual$/i }))
    await user.click(within(sheet()).getByRole("button", { name: "Create Alert" }))
    expect(toast.error).toHaveBeenCalledWith("Alert name is required")
    expect(calls("POST")).toHaveLength(0)
  })

  it("edits a rule with a PATCH carrying the whole form", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await user.click(within(rowOf("Spend cap")).getByRole("button", { name: "Alert actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /edit/i }))
    const name = await screen.findByPlaceholderText("e.g. Low ROI Alert")
    expect(name).toHaveValue("Spend cap")
    await user.clear(name)
    await user.type(name, "Spend ceiling")
    await user.click(within(sheet()).getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
    const [url, opts] = calls("PATCH")[0]
    expect(url).toBe("/api/alerts/a1")
    expect(JSON.parse(opts.body)).toEqual({
      name: "Spend ceiling",
      description: "Daily spend ceiling",
      type: "warning",
      condition: { metric: "spend", operator: "gt", value: 100, period: "day" },
      target_group_ids: ["g1"],
      notification_channels: ["in_app"],
      frequency: "daily",
      tracking_mode: "total",
    })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Alert updated"))
  })

  it("pauses an active rule", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await user.click(within(rowOf("Spend cap")).getByRole("button", { name: "Alert actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /pause/i }))
    await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
    expect(calls("PATCH")[0][0]).toBe("/api/alerts/a1")
    expect(JSON.parse(calls("PATCH")[0][1].body)).toEqual({ status: "paused" })
    expect(toast.success).toHaveBeenCalledWith("Alert paused")
  })

  it("activates a paused rule", async () => {
    tab.value = "paused"
    const user = userEvent.setup()
    renderPage()
    await loaded("Quiet rule")
    await user.click(within(rowOf("Quiet rule")).getByRole("button", { name: "Alert actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /activate/i }))
    await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
    expect(JSON.parse(calls("PATCH")[0][1].body)).toEqual({ status: "active" })
  })

  it("snoozes a rule for the chosen hours", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await user.click(within(rowOf("Spend cap")).getByRole("button", { name: "Alert actions" }))
    await user.click(await screen.findByRole("menuitem", { name: /snooze/i }))
    const dialog = await screen.findByRole("dialog", { name: /snooze alert/i })
    await user.click(within(dialog).getByRole("button", { name: /^snooze$/i }))
    await waitFor(() => expect(calls("POST")).toHaveLength(1))
    expect(calls("POST")[0][0]).toBe("/api/alerts/a1/snooze")
    expect(JSON.parse(calls("POST")[0][1].body)).toEqual({ hours: 24 })
  })

  it("deletes a rule only after confirming", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await user.click(within(rowOf("Spend cap")).getByRole("button", { name: "Delete Spend cap" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Spend cap")
    expect(calls("DELETE")).toHaveLength(0)
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(calls("DELETE")).toHaveLength(1))
    expect(calls("DELETE")[0][0]).toBe("/api/alerts/a1")
    expect(toast.success).toHaveBeenCalledWith("Alert deleted")
  })

  it("cancelling the delete confirmation deletes nothing", async () => {
    const user = userEvent.setup()
    renderPage()
    await loaded("Spend cap")
    await user.click(within(rowOf("Spend cap")).getByRole("button", { name: "Delete Spend cap" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(calls("DELETE")).toHaveLength(0)
  })

  it("groups triggered per-client entries under their rule and expands them", async () => {
    mockGroup()
    const user = userEvent.setup()
    renderPage()
    const header = await waitFor(() => rowOf("CPL watch"))
    expect(within(header).getByText("2 clients")).toBeInTheDocument()
    expect(within(tableEl()).queryByText("Beta Fitness")).toBeNull()
    await user.click(header)
    const child = within(tableEl()).getByText("Beta Fitness").closest("tr")
    expect(child).toHaveAttribute("data-depth", "1")
    expect(within(child).getByText("£31.50")).toBeInTheDocument()
    await user.click(header)
    expect(within(tableEl()).queryByText("Beta Fitness")).toBeNull()
  })

  it("expands a group from its chevron button", async () => {
    mockGroup()
    const user = userEvent.setup()
    renderPage()
    await loaded("CPL watch")
    await user.click(within(tableEl()).getByRole("button", { name: "Expand CPL watch" }))
    expect(within(tableEl()).getByText("Beta Fitness")).toBeInTheDocument()
    expect(within(tableEl()).getByRole("button", { name: "Collapse CPL watch" })).toHaveAttribute("aria-expanded", "true")
  })

  it("evaluates, snoozes and dismisses one client of a triggered rule", async () => {
    mockGroup()
    const user = userEvent.setup()
    renderPage()
    await loaded("CPL watch")
    await user.click(within(tableEl()).getByRole("button", { name: "Expand CPL watch" }))

    await user.click(within(tableEl()).getByRole("button", { name: "Evaluate Beta Fitness" }))
    await waitFor(() => expect(calls("POST")).toHaveLength(1))
    expect(calls("POST")[0][0]).toBe("/api/alerts/t1/evaluate")

    await user.click(within(tableEl()).getByRole("button", { name: "Snooze Beta Fitness" }))
    await user.click(within(await screen.findByRole("dialog", { name: /snooze alert/i })).getByRole("button", { name: /snooze client/i }))
    await waitFor(() => expect(calls("POST")).toHaveLength(2))
    expect(calls("POST")[1][0]).toBe("/api/alerts/t1/snooze-client")
    expect(JSON.parse(calls("POST")[1][1].body)).toEqual({ client_id: "c2", hours: 24 })

    await user.click(within(tableEl()).getByRole("button", { name: "Dismiss Beta Fitness" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(calls("POST")).toHaveLength(2)
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))
    await waitFor(() => expect(calls("POST")).toHaveLength(3))
    expect(calls("POST")[2][0]).toBe("/api/alerts/t1/dismiss-client")
    expect(JSON.parse(calls("POST")[2][1].body)).toEqual({ client_id: "c2" })
  })

  it("renders the ds shell: a PageHeader, a DataTable, icon badges and progress bars", async () => {
    renderPage()
    await loaded("Spend cap")
    expect(document.querySelector('[data-ds="page-header"] h1')).toHaveTextContent("Alerts")
    expect(usePageHeader).toHaveBeenCalledWith(expect.objectContaining({ title: "Alerts" }))
    expect(document.querySelector('[data-ds="data-table"]')).not.toBeNull()
    expect(within(rowOf("Spend cap")).getByText("Active").closest('[data-ds="badge"]').querySelector("svg")).not.toBeNull()
    expect(within(rowOf("Spend cap")).getByRole("progressbar", { name: "Progress to trigger" })).toHaveAttribute("aria-valuenow", "40")
  })

  it("keeps the delete control icon-only with an accessible name", async () => {
    renderPage()
    await loaded("Spend cap")
    const trash = within(rowOf("Spend cap")).getByRole("button", { name: "Delete Spend cap" })
    expect(trash).toHaveTextContent("")
  })

  it("shows an error with a retry, not an empty list, when the alerts fail to load", async () => {
    vi.mocked(apiRequest).mockImplementation(async (url) => {
      if (url === "/api/alerts") return { ok: false, text: async () => "boom" }
      return { ok: true, json: async () => ({}) }
    })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText("Couldn't load your alerts")).toBeInTheDocument()
    expect(screen.queryByText("No active alerts")).toBeNull()
    expect(document.querySelector('[data-ds="data-table"]')).toBeNull()

    mockApi()
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await loaded("Spend cap")
    expect(screen.queryByText("Couldn't load your alerts")).toBeNull()
  })

  it("writes money in the user's currency, never a hard-coded sign", async () => {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_CURRENCY, "EUR")
    mockApi({
      ...LOADED,
      active: [rule("a1", "CPL cap", { condition: { metric: "cpl", operator: "gt", value: 6, period: "day" }, current_value: 7.4 })],
    })
    renderPage()
    await loaded("CPL cap")
    const row = rowOf("CPL cap")
    await waitFor(() => expect(within(row).getByText("€7.40")).toBeInTheDocument())
    expect(within(row).getByText("Cost Per Lead (€)")).toBeInTheDocument()
    expect(row.textContent).not.toMatch(/[$£]/)
  })

  it("defaults to pounds when no currency is stored", async () => {
    mockApi({
      ...LOADED,
      active: [rule("a1", "CPL cap", { condition: { metric: "cpl", operator: "gt", value: 6, period: "day" }, current_value: 7.4 })],
    })
    renderPage()
    await loaded("CPL cap")
    expect(within(rowOf("CPL cap")).getByText("£7.40")).toBeInTheDocument()
    expect(within(rowOf("CPL cap")).getByText("Cost Per Lead (£)")).toBeInTheDocument()
  })

  it("marks a triggered group as Per Client", async () => {
    mockGroup()
    renderPage()
    const header = await waitFor(() => rowOf("CPL watch"))
    expect(within(header).getByText("Per Client")).toBeInTheDocument()
  })

  it("still marks a group Per Client when its rule has no targets and is not in per-client mode", async () => {
    // The group row is per-client by construction, whatever the rule it was
    // built from says: an empty target list must not turn it into "Global (All)".
    tab.value = "triggered"
    mockApi({
      ...LOADED,
      triggered: [{ ...child("c1", "Acme Dental", 120), target_group_ids: [], target_group_names: [], tracking_mode: "total" }],
      counts: { active: 1, triggered: 1, paused: 1 },
    })
    renderPage()
    const header = await waitFor(() => rowOf("CPL watch"))
    expect(within(header).getByText("Per Client")).toBeInTheDocument()
    expect(within(header).queryByText("Global (All)")).toBeNull()
  })
})
