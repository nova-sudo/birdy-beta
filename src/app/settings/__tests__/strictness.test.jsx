import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Suggestion strictness, under the Media Buying Analyst switch ───────────
// The backend has always stored a per-account strictness for the weekly and
// monthly ad suggestions (PUT /api/dashboard/settings) but no screen set it,
// so every account ran on the default. It now sits with the Media Buying
// Analyst switch and only shows while that switch is on.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("tab=general"),
  usePathname: () => "/settings",
}))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/page-header", () => ({ usePageHeader: () => {} }))
vi.mock("@/components/settings/GeneralSettings", () => ({ GeneralSettings: () => null }))
vi.mock("@/components/settings/CreditsPanel", () => ({ CreditsPanel: () => null }))
vi.mock("@/components/billing/PlanPicker", () => ({ PlanPicker: () => null }))
vi.mock("@/components/attribution/TrackingOverview", () => ({ default: () => null }))
// Radix Select needs pointer APIs jsdom lacks; a native <select> keeps the
// same value/onValueChange contract and lets the test pick an option.
vi.mock("@/components/ui/select", () => {
  const React = require("react")
  const SelectTrigger = () => null
  const SelectValue = () => null
  const SelectContent = () => null
  const SelectItem = () => null
  function Select({ value, onValueChange, disabled, children }) {
    let id
    const items = []
    const walk = (nodes) =>
      React.Children.forEach(nodes, (n) => {
        if (!n || !n.props) return
        if (n.type === SelectTrigger) id = n.props.id
        if (n.type === SelectItem) items.push(n.props)
        walk(n.props.children)
      })
    walk(children)
    return (
      <select id={id} value={value} disabled={disabled} onChange={(e) => onValueChange(e.target.value)}>
        {items.map((i) => <option key={i.value} value={i.value}>{i.children}</option>)}
      </select>
    )
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

import { apiRequest } from "@/lib/api"
import SettingsPage from "../page"

function respond(routes) {
  vi.mocked(apiRequest).mockImplementation((url, opts = {}) => {
    const key = `${opts.method || "GET"} ${url}`
    const body = routes[key] ?? routes[url] ?? {}
    return Promise.resolve({ ok: true, json: async () => body })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("suggestion strictness", () => {
  it("is hidden while the Media Buying Analyst is off", async () => {
    respond({
      "/api/capabilities": { media_buying: false },
      "/api/dashboard/settings": { strictness: "balanced" },
    })
    render(<SettingsPage />)

    await waitFor(() => expect(screen.getByText("Media Buying Analyst")).toBeInTheDocument())
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/capabilities"))
    expect(screen.queryByLabelText(/how strict should birdy be/i)).toBeNull()
  })

  it("shows the account's saved level and what it means once the analyst is on", async () => {
    respond({
      "/api/capabilities": { media_buying: true },
      "/api/dashboard/settings": { strictness: "strict" },
    })
    render(<SettingsPage />)

    const select = await screen.findByLabelText(/how strict should birdy be/i)
    await waitFor(() => expect(select).toHaveValue("strict"))
    expect(screen.getByText(/flags sooner/i)).toBeInTheDocument()
  })

  it("saves a new level through the dashboard settings endpoint", async () => {
    respond({
      "/api/capabilities": { media_buying: true },
      "/api/dashboard/settings": { strictness: "balanced" },
      "PUT /api/dashboard/settings": { ok: true, strictness: "lenient" },
    })
    const user = userEvent.setup()
    render(<SettingsPage />)

    const select = await screen.findByLabelText(/how strict should birdy be/i)
    await waitFor(() => expect(select).not.toBeDisabled())
    await user.selectOptions(select, "lenient")

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/dashboard/settings", {
        method: "PUT",
        body: JSON.stringify({ strictness: "lenient" }),
      })
    )
    expect(screen.getByText(/only the clearest waste/i)).toBeInTheDocument()
  })
})
