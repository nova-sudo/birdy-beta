import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }))
let query = ""
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }))
vi.mock("@/lib/creatives-api", () => ({ useCreativeTests: vi.fn() }))
const chat = { messages: [], loading: false, send: vi.fn(async () => true) }
vi.mock("@/components/agency/chat/use-agent-chat", () => ({ useAgentChat: vi.fn(() => chat) }))
vi.mock("@/components/agency/chat/thread", () => ({ ChatThread: () => <div>thread</div> }))
vi.mock("next/image", () => ({ default: () => null }))

import { apiRequest } from "@/lib/api"
import { useCreativeTests } from "@/lib/creatives-api"
import { useAgentChat } from "@/components/agency/chat/use-agent-chat"
import { AlertsSection } from "../alerts/alerts-section"

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
globalThis.HTMLElement.prototype.scrollIntoView ??= () => {}
globalThis.HTMLElement.prototype.hasPointerCapture ??= () => false
globalThis.HTMLElement.prototype.releasePointerCapture ??= () => {}

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const rule = (over) => ({
  id: "a1", name: "High spend", status: "active", tracking_mode: "total", scope: "clients", type: "warning",
  condition: { metric: "spend", operator: "gt", value: 500, period: "day" }, target_group_ids: ["g1"], target_group_names: ["Acme"],
  notification_channels: ["in_app"], frequency: "daily", updated_at: "2026-11-20T10:00:00Z", ...over,
})
const fired = rule({ id: "a2", name: "CPL watch", status: "triggered", tracking_mode: "per_client", condition: { metric: "cpl", operator: "gt", value: 40, period: "week" } })
const DATA = {
  alerts: [rule(), { ...fired }, rule({ id: "a3", name: "Quiet one", status: "paused", snoozed_until: "2026-12-01T00:00:00Z" })],
  active: [rule()],
  triggered: [
    { ...fired, _virtual: true, _virtual_id: "a2::g1", _client_id: "g1", _client_name: "Acme", _client_value: 55, _client_progress: 100 },
    { ...fired, _virtual: true, _virtual_id: "a2::g2", _client_id: "g2", _client_name: "Bolt", _client_value: 61, _client_progress: 100 },
  ],
  paused: [rule({ id: "a3", name: "Quiet one", status: "paused", snoozed_until: "2026-12-01T00:00:00Z" })],
  counts: { active: 1, triggered: 2, paused: 1 },
}

let calls
const writes = () => calls.filter(([, m]) => m !== "GET")
beforeEach(() => {
  vi.clearAllMocks()
  query = ""
  calls = []
  useCreativeTests.mockReturnValue({ tests: [] })
  apiRequest.mockImplementation(async (url, opts = {}) => {
    const method = opts.method || "GET"
    calls.push([url, method, opts.body ? JSON.parse(opts.body) : undefined])
    if (method !== "GET") return ok({ success: true, evaluation: { triggered: false, progress_pct: 10, current_value: 1 } })
    if (url === "/api/alerts") return ok(DATA)
    if (url.startsWith("/api/client-groups")) return ok({ client_groups: [{ id: "g1", name: "Acme", client_status: "Active" }, { id: "g2", name: "Bolt", client_status: "Active" }, { id: "g3", name: "Old", client_status: "Inactive" }] })
    if (url === "/api/custom-metrics") return ok({ custom_metrics: [] })
    if (url.startsWith("/api/alerts/notifications")) return ok({ notifications: [{ id: "n1", alert_id: "a2", message: "CPL 55 > 40", group_name: "Acme", triggered_at: "2026-11-20T09:00:00", read: true }] })
    return { ok: false, status: 404, json: async () => ({}) }
  })
})

const setup = async (q = "") => {
  query = q
  const user = userEvent.setup()
  render(<AlertsSection />)
  await waitFor(() => expect(screen.queryByLabelText("Loading alerts")).toBeNull())
  return user
}

const openMenu = async (user, name) => user.click(screen.getByRole("button", { name: `Actions for ${name}` }))

describe("AlertsSection: reading", () => {
  it("only reads on open, and opens on Triggered with the per-client rule folded", async () => {
    await setup()
    expect(screen.getByRole("tab", { name: /Triggered/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("CPL watch")).toBeInTheDocument()
    expect(screen.getByText("2 clients")).toBeInTheDocument()
    expect(screen.getByText("Cost Per Lead ($) > 40 · Last 7 Days")).toBeInTheDocument()
    expect(writes()).toEqual([])
    expect(useAgentChat).toHaveBeenCalledWith(expect.objectContaining({ page: "alerts" }))
    expect(chat.send).not.toHaveBeenCalled()
  })

  it("honours the old ?tab= and lists that bucket", async () => {
    await setup("section=alerts&tab=paused")
    expect(screen.getByRole("tab", { name: /Snoozed & paused/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Quiet one")).toBeInTheDocument()
    expect(screen.getByText("Snoozed")).toBeInTheDocument()
  })

  it("shows an honest empty state", async () => {
    apiRequest.mockImplementation(async (url) => ok(url === "/api/alerts" ? { active: [], triggered: [], paused: [], counts: {} } : {}))
    await setup("tab=active")
    expect(screen.getByText("No alerts yet")).toBeInTheDocument()
  })

  it("History reads every fire without marking anything read", async () => {
    const user = await setup()
    await user.click(screen.getByRole("tab", { name: /History/ }))
    expect(await screen.findByText("CPL 55 > 40")).toBeInTheDocument()
    expect(calls.some(([u]) => u === "/api/alerts/notifications?unread_only=false")).toBe(true)
    expect(writes()).toEqual([])
  })
})

describe("AlertsSection: writes happen only on an explicit action", () => {
  it("creates an alert only when Create alert is pressed", async () => {
    const user = await setup("tab=active")
    await user.click(screen.getAllByRole("button", { name: "New alert" })[0])
    const dialog = await screen.findByRole("dialog", { name: "New alert" })
    await user.click(within(dialog).getByRole("button", { name: "Create alert" }))
    expect(within(dialog).getByText("Give this alert a name.")).toBeInTheDocument()
    expect(writes()).toEqual([])

    await user.type(within(dialog).getByLabelText("Name"), "Spend cap")
    await user.clear(within(dialog).getByLabelText("Value"))
    await user.type(within(dialog).getByLabelText("Value"), "900")
    await user.click(within(dialog).getByRole("checkbox", { name: "Acme" }))
    expect(within(dialog).getByRole("checkbox", { name: "Acme" })).toBeChecked()
    expect(within(dialog).queryByRole("checkbox", { name: "Old" })).toBeNull()
    expect(writes()).toEqual([])
    await user.click(within(dialog).getByRole("button", { name: "Create alert" }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    const [url, method, body] = writes()[0]
    expect([url, method]).toEqual(["/api/alerts", "POST"])
    expect(body).toMatchObject({ name: "Spend cap", scope: "clients", target_group_ids: ["g1"], condition: { metric: "spend", operator: "gt", value: 900, period: "day" }, notification_channels: ["in_app"] })
  })

  it("cancelling the editor writes nothing", async () => {
    const user = await setup("tab=active")
    await user.click(screen.getAllByRole("button", { name: "New alert" })[0])
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("Name"), "x")
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(writes()).toEqual([])
  })

  it("edits with PATCH to the rule's id", async () => {
    const user = await setup("tab=active")
    await openMenu(user, "High spend")
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit alert" })
    expect(within(dialog).getByLabelText("Name")).toHaveValue("High spend")
    expect(within(dialog).getByRole("checkbox", { name: "Acme" })).toBeChecked()
    await user.click(within(dialog).getByRole("switch", { name: "Also email me" }))
    expect(writes()).toEqual([])
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][0]).toBe("/api/alerts/a1")
    expect(writes()[0][1]).toBe("PATCH")
    expect(writes()[0][2].notification_channels).toEqual(["in_app", "email"])
  })

  it("the switch pauses a rule, and a paused one switches back on", async () => {
    const user = await setup("tab=active")
    await user.click(screen.getByRole("switch", { name: "Pause High spend" }))
    await waitFor(() => expect(writes()).toEqual([["/api/alerts/a1", "PATCH", { status: "paused" }]]))
  })

  it("deletes only after the confirm", async () => {
    const user = await setup("tab=active")
    await openMenu(user, "High spend")
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
    const dialog = await screen.findByRole("dialog", { name: "Delete this alert?" })
    expect(writes()).toEqual([])
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(writes()).toEqual([])
    await openMenu(user, "High spend")
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(writes()).toEqual([["/api/alerts/a1", "DELETE", undefined]]))
  })

  it("snoozes for the chosen time only on Snooze", async () => {
    const user = await setup("tab=active")
    await openMenu(user, "High spend")
    await user.click(await screen.findByRole("menuitem", { name: "Snooze" }))
    const dialog = await screen.findByRole("dialog", { name: "Snooze alert" })
    expect(writes()).toEqual([])
    await user.click(within(dialog).getByRole("button", { name: "Snooze" }))
    await waitFor(() => expect(writes()).toEqual([["/api/alerts/a1/snooze", "POST", { hours: 24 }]]))
  })

  it("Check now evaluates the rule", async () => {
    const user = await setup("tab=active")
    await openMenu(user, "High spend")
    await user.click(await screen.findByRole("menuitem", { name: "Check now" }))
    await waitFor(() => expect(writes()).toEqual([["/api/alerts/a1/evaluate", "POST", undefined]]))
  })

  it("clears or snoozes one client of a per-client rule", async () => {
    const user = await setup()
    await user.click(screen.getByRole("button", { name: "Show the 2 clients" }))
    expect(screen.getByText("Bolt")).toBeInTheDocument()
    await openMenu(user, "Bolt")
    await user.click(await screen.findByRole("menuitem", { name: "Clear this entry" }))
    expect(writes()).toEqual([])
    await user.click(within(await screen.findByRole("dialog", { name: "Clear this entry?" })).getByRole("button", { name: "Clear" }))
    await waitFor(() => expect(writes()).toEqual([["/api/alerts/a2/dismiss-client", "POST", { client_id: "g2" }]]))

    await openMenu(user, "Acme")
    await user.click(await screen.findByRole("menuitem", { name: "Snooze this client" }))
    await user.click(within(await screen.findByRole("dialog", { name: "Snooze this client" })).getByRole("button", { name: "Snooze" }))
    await waitFor(() => expect(writes().at(-1)).toEqual(["/api/alerts/a2/snooze-client", "POST", { client_id: "g1", hours: 24 }]))
  })

  it("a creative-test alert saves its scope with every live test", async () => {
    useCreativeTests.mockReturnValue({ tests: [{ id: "t1", code: "CT-0001", name: "Hook A", status: "testing" }, { id: "t2", code: "CT-0002", name: "Old", status: "archived" }] })
    const user = await setup("tab=active")
    await user.click(screen.getAllByRole("button", { name: "New alert" })[0])
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("Name"), "Verdicts")
    await user.click(within(dialog).getByRole("radio", { name: "Creative tests" }))
    expect(within(dialog).getByRole("switch", { name: "All live tests" })).toBeChecked()
    expect(within(dialog).getByRole("checkbox", { name: "CT-0001 Hook A" })).toBeInTheDocument()
    expect(within(dialog).queryByText("CT-0002")).toBeNull()
    expect(within(dialog).getByText("Fires when a test gets a winner or loser verdict.")).toBeInTheDocument()
    expect(within(dialog).getByRole("radio", { name: "Per account" })).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Create alert" }))
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0][2]).toMatchObject({ scope: "creative_tests", creative_test_ids: [], target_group_ids: [], condition: { metric: "creative_verdict", operator: "eq", value: 1 } })
  })

  it("Ask Birdy sends only what the owner typed, when they send it", async () => {
    const user = await setup()
    expect(chat.send).not.toHaveBeenCalled()
    await user.type(screen.getByPlaceholderText(/Ask Birdy to set up an alert/), "Tell me when CPL passes 40{Enter}")
    await waitFor(() => expect(chat.send).toHaveBeenCalledWith("Tell me when CPL passes 40"))
    expect(await screen.findByRole("complementary", { name: /Ask Birdy about alerts/ })).toBeInTheDocument()
    expect(writes()).toEqual([])
  })
})
