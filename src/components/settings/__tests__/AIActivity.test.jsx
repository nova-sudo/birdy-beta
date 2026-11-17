import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "https://api.example.test",
}))

import { apiRequest } from "@/lib/api"
import AIActivity from "../AIActivity"

// jsdom gaps Radix Select leans on (same shims as the other Select tests).
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const iso = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString()

const ITEMS = [
  { id: "e2", created_at: iso(1), app_name: "Claude", app_kind: "oauth", kind: "live", summary: "Paused 2 ads for Acme Dental", clients: [{ id: "g1", name: "Acme Dental" }], credits: { total: 1.3 }, result_status: "ok", revoked: false },
  { id: "e1", created_at: iso(2), app_name: "Cursor", app_kind: "manual", kind: "refused", summary: "Tried to create an alert", clients: [], credits: { total: 0 }, result_status: "error", refusal_reason: "view_only", revoked: true },
]
const DETAIL = {
  id: "e2", created_at: iso(1), app_name: "Claude", access: "write", tool: "apply_agent_card", kind: "live", summary: "Paused 2 ads for Acme Dental",
  clients: [{ id: "g1", name: "Acme Dental" }], tool_label: "Applied an agent card", args: { card: 3 }, result_excerpt: "Paused 2 ads in Meta.", confirmed_after: "e1",
  link: "/clients/g1", refusal_reason: null, result_status: "ok", revoked: false, response_chars: 1200,
  credits: { request: 0.2, data: 0.1, live: 1, total: 1.3 },
}

let calls
function route(overrides = {}) {
  apiRequest.mockImplementation(async (url) => {
    calls.push(url)
    if (overrides[url]) return overrides[url]()
    if (url === "/api/mcp/activity/apps") return ok([{ grant_id: "c1", app_name: "Claude", revoked: false }, { grant_id: "c2", app_name: "Cursor", revoked: true }])
    if (url.startsWith("/api/mcp/activity?")) return ok({ items: ITEMS, next_cursor: null, totals: { requests: 2, credits: 1.3 } })
    if (url === "/api/mcp/activity/e2") return ok(DETAIL)
    if (url === "/api/mcp/activity/e1") return ok({ ...DETAIL, id: "e1", created_at: iso(2), summary: "Previewed" })
    return { ok: false, status: 404, json: async () => ({}) }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  calls = []
  route()
})

describe("AIActivity", () => {
  it("renders rows and totals", async () => {
    render(<AIActivity />)
    expect(await screen.findByText("Paused 2 ads for Acme Dental")).toBeInTheDocument()
    expect(screen.getByText(/2 requests · 1\.3 credits/)).toBeInTheDocument()
    expect(screen.getByText("Tried to create an alert")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Export CSV" }).getAttribute("href")).toMatch(
      /^https:\/\/api\.example\.test\/api\/mcp\/activity\.csv\?from=\d{4}-\d{2}-\d{2}T[\d%A:.]+Z$/,
    )
    await userEvent.setup().click(screen.getByRole("combobox", { name: "App" }))
    expect(await screen.findByRole("option", { name: "Cursor (disconnected)" })).toBeInTheDocument()
  })

  it("filter change refetches with params", async () => {
    const user = userEvent.setup()
    render(<AIActivity />)
    await screen.findByText("Paused 2 ads for Acme Dental")
    expect(calls.find((u) => u.startsWith("/api/mcp/activity?"))).toMatch(/^\/api\/mcp\/activity\?from=\d{4}-\d{2}-\d{2}T[\d%A:.]+Z$/)
    const pick = async (label, option) => {
      await user.click(screen.getByRole("combobox", { name: label }))
      await user.click(await screen.findByRole("option", { name: option }))
    }
    await pick("Kind", "Live change")
    await pick("App", "Claude")
    await pick("Client", "Acme Dental")
    await pick("Period", "Last 30 days")
    await waitFor(() => {
      const last = calls.filter((u) => u.startsWith("/api/mcp/activity?")).at(-1)
      expect(last).toContain("kind=live")
      expect(last).toContain("app=c1")
      expect(last).toContain("client_group_id=g1")
      expect(last).toMatch(/from=\d{4}-\d{2}-\d{2}T/)
      expect(last).not.toContain("cursor=")
    })
  })

  it("row click opens panel with breakdown", async () => {
    const user = userEvent.setup()
    render(<AIActivity />)
    await user.click(await screen.findByText("Paused 2 ads for Acme Dental"))
    const panel = await screen.findByRole("dialog", { name: "Activity details" })
    expect(await within(panel).findByText("Paused 2 ads in Meta.")).toBeInTheDocument()
    expect(within(panel).getByText("Applied an agent card")).toBeInTheDocument()
    expect(within(panel).getByText("Data returned (1,200 characters)")).toBeInTheDocument()
    expect(within(panel).getByText("Live change")).toBeInTheDocument()
    expect(within(panel).getByText("Total").nextSibling).toHaveTextContent("1.3")
    expect(within(panel).getByRole("link", { name: "Open in Birdy →" })).toHaveAttribute("href", "/clients/g1")
    expect(await within(panel).findByText(/Confirmed after the preview at/)).toBeInTheDocument()
  })

  it("shows the refusal reason on the row", async () => {
    render(<AIActivity />)
    await screen.findByText("Tried to create an alert")
    expect(screen.getAllByText("Refused · View-only connection").length).toBeGreaterThan(0)
  })

  it("preview shows when it was confirmed, looking past the 7-day default", async () => {
    const user = userEvent.setup()
    route({
      "/api/mcp/activity/e2": () => ok({ ...DETAIL, id: "e2", kind: "preview", confirmed_after: null, created_at: "2026-10-01T10:41:00Z" }),
    })
    apiRequest.mockImplementation(async (url) => {
      calls.push(url)
      if (url === "/api/mcp/activity/apps") return ok([])
      if (url === "/api/mcp/activity/e2") return ok({ ...DETAIL, id: "e2", kind: "preview", confirmed_after: null, created_at: "2026-10-01T10:41:00Z" })
      if (url.startsWith("/api/mcp/activity?confirmed_after=e2")) return ok({ items: [{ ...ITEMS[0], id: "e9", created_at: "2026-10-01T10:42:00Z" }], next_cursor: null, totals: null })
      return ok({ items: ITEMS, next_cursor: null, totals: { requests: 2, credits: 1.3 } })
    })
    render(<AIActivity />)
    await user.click(await screen.findByText("Paused 2 ads for Acme Dental"))
    expect(await screen.findByText(/^Confirmed at/)).toBeInTheDocument()
    expect(calls).toContain("/api/mcp/activity?confirmed_after=e2&from=2026-10-01&limit=1")
  })

  it("explains a refusal in plain words", async () => {
    route({ "/api/mcp/activity/e1": () => ok({ ...DETAIL, id: "e1", kind: "refused", refusal_reason: "view_only", confirmed_after: null, credits: { request: 0, data: 0, live: 0, total: 0 } }) })
    const user = userEvent.setup()
    render(<AIActivity />)
    await user.click(await screen.findByText("Tried to create an alert"))
    const panel = await screen.findByRole("dialog", { name: "Activity details" })
    expect(await within(panel).findByText("Refused · View-only connection")).toBeInTheDocument()
  })

  it("empty state copy", async () => {
    route({})
    apiRequest.mockImplementation(async (url) =>
      url === "/api/mcp/activity/apps" ? ok([]) : ok({ items: [], next_cursor: null, totals: { requests: 0, credits: 0 } }))
    render(<AIActivity />)
    expect(await screen.findByText("Nothing yet. Requests from your connected apps will show up here.")).toBeInTheDocument()
  })

  it("load more appends", async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation(async (url) => {
      calls.push(url)
      if (url === "/api/mcp/activity/apps") return ok([])
      if (url.includes("cursor=abc")) return ok({ items: [{ ...ITEMS[1], id: "e0", summary: "Older request" }], next_cursor: null, totals: null })
      return ok({ items: [ITEMS[0]], next_cursor: "abc", totals: { requests: 2, credits: 1.3 } })
    })
    render(<AIActivity />)
    await user.click(await screen.findByRole("button", { name: "Load more" }))
    expect(await screen.findByText("Older request")).toBeInTheDocument()
    expect(screen.getByText("Paused 2 ads for Acme Dental")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("sends the viewer's local midnight as an exact instant", async () => {
    render(<AIActivity />)
    await screen.findByText("Paused 2 ads for Acme Dental")
    const d = new Date()
    d.setDate(d.getDate() - 7)
    d.setHours(0, 0, 0, 0)
    const url = calls.find((u) => u.startsWith("/api/mcp/activity?"))
    expect(new URLSearchParams(url.split("?")[1]).get("from")).toBe(d.toISOString())
  })

  it("the mobile meta line has no loose separator that a wrap could strand", async () => {
    render(<AIActivity />)
    await screen.findByText("Tried to create an alert")
    expect(screen.queryAllByText("·")).toHaveLength(0)
    const kind = screen.getAllByText("Refused · View-only connection")[0]
    expect(kind.className).toContain("whitespace-nowrap")
  })

  it("a failed Load more says so and keeps the rows and the button", async () => {
    const user = userEvent.setup()
    apiRequest.mockImplementation(async (url) => {
      calls.push(url)
      if (url === "/api/mcp/activity/apps") return ok([])
      if (url.includes("cursor=")) return { ok: false, status: 500, json: async () => ({}) }
      return ok({ items: ITEMS, next_cursor: "c1", totals: { requests: 2, credits: 1.3 } })
    })
    render(<AIActivity />)
    await screen.findByText("Paused 2 ads for Acme Dental")
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByText("Couldn't load more. Try Load more again.")).toBeInTheDocument()
    expect(screen.queryByText(/Change a filter or refresh/)).not.toBeInTheDocument()
    expect(screen.getByText("Paused 2 ads for Acme Dental")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled()
  })

  it("the details panel is a dialog that takes focus and returns it on close", async () => {
    const user = userEvent.setup()
    render(<AIActivity />)
    const rowText = await screen.findByText("Paused 2 ads for Acme Dental")
    rowText.focus()
    await user.click(rowText)
    const panel = await screen.findByRole("dialog", { name: "Activity details" })
    await waitFor(() => expect(panel).toHaveFocus())
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(rowText).toHaveFocus()
  })

  it("locks page scroll behind the full-screen panel on small screens", async () => {
    const user = userEvent.setup()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    try {
      render(<AIActivity />)
      await user.click(await screen.findByText("Paused 2 ads for Acme Dental"))
      const panel = await screen.findByRole("dialog", { name: "Activity details" })
      expect(panel).toHaveAttribute("aria-modal", "true")
      expect(document.body.style.overflow).toBe("hidden")
      await user.keyboard("{Escape}")
      await waitFor(() => expect(document.body.style.overflow).toBe(""))
    } finally {
      delete window.matchMedia
    }
  })

  it("traps Tab inside the full-screen panel on small screens", async () => {
    const user = userEvent.setup()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    try {
      render(<AIActivity />)
      await user.click(await screen.findByText("Paused 2 ads for Acme Dental"))
      const panel = await screen.findByRole("dialog", { name: "Activity details" })
      await waitFor(() => expect(panel).toHaveFocus())
      const items = [...panel.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      expect(items.length).toBeGreaterThan(0)
      items[items.length - 1].focus()
      await user.tab()
      expect(items[0]).toHaveFocus()
      await user.tab({ shift: true })
      expect(items[items.length - 1]).toHaveFocus()
      for (let i = 0; i < items.length + 2; i += 1) {
        await user.tab()
        expect(panel.contains(document.activeElement)).toBe(true)
      }
    } finally {
      delete window.matchMedia
    }
  })
})
