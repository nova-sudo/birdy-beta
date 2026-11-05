import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AlertsPage from "@/app/alerts/page"
import CreativeScopeFields from "../CreativeScopeFields"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("tab=active") }))
vi.mock("@/lib/creatives-api", () => ({ useCreativeTests: vi.fn() }))
let header
vi.mock("@/components/page-header", () => ({ usePageHeader: (h) => { header = h } }))
vi.mock("@/components/chat/ChatConversation", () => ({ default: () => null }))

import { apiRequest } from "@/lib/api"
import { useCreativeTests } from "@/lib/creatives-api"

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
globalThis.HTMLElement.prototype.scrollIntoView ??= () => {}
globalThis.HTMLElement.prototype.hasPointerCapture ??= () => false

const TESTS = [
  { id: "t1", code: "CT-0001", name: "Hook A", status: "testing" },
  { id: "t2", code: "CT-0002", name: "Hook B", status: "winner" },
  { id: "t3", code: "CT-0003", name: "Draft", status: "draft" },
  { id: "t4", code: "CT-0004", name: "Old", status: "archived" },
]

describe("CreativeScopeFields", () => {
  it("lists live tests with code and name, and 'All live tests' is on for an empty selection", () => {
    render(<CreativeScopeFields value={[]} onChange={() => {}} tests={TESTS} />)
    expect(screen.getByText("All live tests")).toBeInTheDocument()
    expect(screen.getByText("CT-0001")).toBeInTheDocument()
    expect(screen.getByText("Hook B")).toBeInTheDocument()
    expect(screen.queryByText("CT-0003")).toBeNull()
    expect(screen.queryByText("CT-0004")).toBeNull()
    expect(screen.getByRole("switch", { name: /all live tests/i })).toBeChecked()
  })

  it("picking a test turns the toggle off and reports ids", async () => {
    const onChange = vi.fn()
    render(<CreativeScopeFields value={[]} onChange={onChange} tests={TESTS} />)
    await userEvent.click(screen.getByRole("checkbox", { name: /CT-0001/ }))
    expect(onChange).toHaveBeenCalledWith(["t1"])
  })

  it("lists saved ids that are no longer live as checked '(not live)' rows that can be deselected", async () => {
    const onChange = vi.fn()
    render(<CreativeScopeFields value={["t1", "t4"]} onChange={onChange} tests={TESTS} />)
    const stale = screen.getByRole("checkbox", { name: /CT-0004 Old \(not live\)/ })
    expect(stale).toBeChecked()
    await userEvent.click(stale)
    expect(onChange).toHaveBeenCalledWith(["t1"])
  })

  it("turning 'All live tests' on clears the selection", async () => {
    const onChange = vi.fn()
    render(<CreativeScopeFields value={["t1"]} onChange={onChange} tests={TESTS} />)
    const sw = screen.getByRole("switch", { name: /all live tests/i })
    expect(sw).not.toBeChecked()
    await userEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith([])
  })
})

describe("alerts editor scope", () => {
  const clientAlert = {
    id: "a1", name: "CPL high", type: "warning", status: "active",
    condition: { metric: "spend", operator: "gt", value: 5, period: "day" },
    target_group_ids: ["g1"], notification_channels: ["in_app"], frequency: "daily",
    tracking_mode: "total", updated_at: "2026-11-01T00:00:00Z",
  }
  const creativeAlert = (over = {}) => ({
    ...clientAlert, id: "a2", name: "Verdicts", scope: "creative_tests", creative_test_ids: ["t1"],
    condition: { metric: "creative_verdict", operator: "eq", value: 1, period: "week" },
    target_group_ids: [], ...over,
  })
  let saved, alertsPayload, patched
  beforeEach(() => {
    saved = null
    patched = null
    alertsPayload = [clientAlert]
    useCreativeTests.mockReturnValue({ tests: TESTS })
    apiRequest.mockImplementation((url, opts) => {
      if (url === "/api/alerts" && opts?.method === "POST") {
        saved = JSON.parse(opts.body)
        return Promise.resolve({ ok: true, json: async () => ({}), text: async () => "" })
      }
      if (url.startsWith("/api/alerts/") && opts?.method === "PATCH") {
        patched = JSON.parse(opts.body)
        return Promise.resolve({ ok: true, json: async () => ({}), text: async () => "" })
      }
      if (url === "/api/alerts") return Promise.resolve({ ok: true, json: async () => ({ active: alertsPayload, triggered: [], paused: [], counts: {} }) })
      if (url.startsWith("/api/client-groups")) return Promise.resolve({ ok: true, json: async () => ({ client_groups: [{ id: "g1", name: "Acme", status: "active" }] }) })
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
  })

  async function openManual() {
    render(<AlertsPage />)
    await waitFor(() => expect(header).toBeTruthy())
    render(header.controls)
    await userEvent.click(screen.getByRole("button", { name: /create alert/i }))
    await userEvent.click(await screen.findByRole("button", { name: "Manual" }))
  }

  it("opens in Clients scope with the client checklist", async () => {
    await openManual()
    expect(await screen.findByText("Target All Client Groups")).toBeInTheDocument()
    expect(screen.queryByRole("switch", { name: /all live tests/i })).toBeNull()
    expect(screen.getByRole("tab", { name: "Clients" })).toHaveAttribute("aria-selected", "true")
  })

  it("switching to Creative tests swaps the checklist, metrics and tracking label", async () => {
    await openManual()
    await userEvent.click(await screen.findByRole("tab", { name: "Creative tests" }))
    expect(await screen.findByRole("switch", { name: /all live tests/i })).toBeInTheDocument()
    expect(screen.queryByText("Target All Client Groups")).toBeNull()
    expect(screen.getByText("Per account")).toBeInTheDocument()
    // metric select offers creative metrics only
    await userEvent.click(screen.getByRole("combobox", { name: /metric/i }))
    for (const l of ["Creative verdict", "Creative CPL", "Creative CTR", "Creative hook rate", "Creative post failed"]) {
      expect(await screen.findByRole("option", { name: l })).toBeInTheDocument()
    }
    expect(screen.queryByRole("option", { name: "Total Spend" })).toBeNull()
  })

  it("empty selection submits scope creative_tests with creative_test_ids []", async () => {
    await openManual()
    await userEvent.click(await screen.findByRole("tab", { name: "Creative tests" }))
    fireEvent.change(screen.getByPlaceholderText("e.g. Low ROI Alert"), { target: { value: "Winners" } })
    await userEvent.click(screen.getByRole("combobox", { name: /metric/i }))
    await userEvent.click(await screen.findByRole("option", { name: "Creative verdict" }))
    await userEvent.click(screen.getByRole("button", { name: "Create Alert", hidden: false }))
    await waitFor(() => expect(saved).toBeTruthy())
    expect(saved.scope).toBe("creative_tests")
    expect(saved.creative_test_ids).toEqual([])
    expect(saved.condition.metric).toBe("creative_verdict")
  })

  async function openEditFor(name) {
    render(<AlertsPage />)
    await screen.findByText(name)
    await userEvent.click(screen.getByRole("button", { name: "Alert actions" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: /edit/i }))
  }

  it("opens an existing client alert in Clients scope", async () => {
    await openEditFor("CPL high")
    expect(await screen.findByText("Target All Client Groups")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Clients" })).toHaveAttribute("aria-selected", "true")
  })

  it("reopens a creative alert in Creative tests with ids checked and no threshold", async () => {
    alertsPayload = [creativeAlert()]
    await openEditFor("Verdicts")
    expect(screen.getByRole("tab", { name: "Creative tests" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("checkbox", { name: /CT-0001/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /CT-0002/ })).not.toBeChecked()
    expect(screen.queryByText("When it")).toBeNull()
    expect(screen.getByText("Fires when a test gets a winner or loser verdict.")).toBeInTheDocument()
  })

  it("saves selected ids and eq/1 for the verdict", async () => {
    alertsPayload = [creativeAlert()]
    await openEditFor("Verdicts")
    await userEvent.click(await screen.findByRole("checkbox", { name: /CT-0002/ }))
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }))
    await waitFor(() => expect(patched).toBeTruthy())
    expect(patched.scope).toBe("creative_tests")
    expect(patched.creative_test_ids).toEqual(["t1", "t2"])
    expect(patched.condition).toMatchObject({ metric: "creative_verdict", operator: "eq", value: 1 })
  })

  it("saves gt/0 for post failed", async () => {
    alertsPayload = [creativeAlert({ condition: { metric: "creative_post_failed", operator: "gt", value: 0, period: "week" } })]
    await openEditFor("Verdicts")
    await userEvent.click(await screen.findByRole("button", { name: "Save Changes" }))
    await waitFor(() => expect(patched).toBeTruthy())
    expect(patched.condition).toMatchObject({ metric: "creative_post_failed", operator: "gt", value: 0 })
  })

  it("resets the value when moving from a no-threshold metric to CPL", async () => {
    await openManual()
    await userEvent.click(await screen.findByRole("tab", { name: "Creative tests" }))
    await userEvent.click(screen.getByRole("combobox", { name: /metric/i }))
    await userEvent.click(await screen.findByRole("option", { name: "Creative CPL" }))
    expect(screen.getByRole("spinbutton")).toHaveValue(null)
  })

  it("shows test codes, Per account and the verdict hint in the table", async () => {
    alertsPayload = [
      creativeAlert({ tracking_mode: "per_client" }),
      creativeAlert({ id: "a3", name: "Failed posts", creative_test_ids: [], condition: { metric: "creative_post_failed", operator: "gt", value: 0, period: "week" } }),
    ]
    render(<AlertsPage />)
    await screen.findByText("Verdicts")
    expect(screen.getByText("Winner or loser")).toBeInTheDocument()
    expect(screen.getByText("Any failed post")).toBeInTheDocument()
    expect(await screen.findByText("CT-0001")).toBeInTheDocument()
    expect(screen.getByText("Per account")).toBeInTheDocument()
    expect(screen.getByText("All live tests")).toBeInTheDocument()
  })
})
