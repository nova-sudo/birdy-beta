import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Settings ────────────────────────────────────────────────────────────────
// Characterization of the page's behaviour: which tab shows for which ?tab=,
// how tab changes reach the URL, the integrations list and its connect, remove
// and credentials flows, the OAuth callback handling, capabilities, and the
// billing handlers handed to the plan picker.

const nav = vi.hoisted(() => ({
  params: "",
  replace: vi.fn(),
  push: vi.fn(),
  // Next hands back a stable object until the URL changes; a fresh one per
  // render would re-fire the init effect, which depends on it.
  cache: { key: null, value: null },
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => {
    if (nav.cache.key !== nav.params) nav.cache = { key: nav.params, value: new URLSearchParams(nav.params) }
    return nav.cache.value
  },
  usePathname: () => "/settings",
}))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))
vi.mock("@/components/page-header", () => ({ usePageHeader: vi.fn() }))
vi.mock("@/components/settings/GeneralSettings", () => ({
  GeneralSettings: (props) => (
    <div data-testid="general-settings" data-slack-connected={String(props.slackConnected)} data-brief={props.brief ?? ""} />
  ),
}))
vi.mock("@/components/settings/CreditsPanel", () => ({ CreditsPanel: () => <div data-testid="credits-panel" /> }))
vi.mock("@/components/attribution/TrackingOverview", () => ({ default: () => <div data-testid="tracking-overview" /> }))
vi.mock("@/components/billing/PlanPicker", () => ({
  PlanPicker: (props) => (
    <div data-testid="plan-picker" data-plan={props.billingStatus?.plan ?? ""} data-busy={String(props.busySubscription)}>
      <button onClick={props.onManage}>manage</button>
      <button onClick={props.onCancel}>cancel-sub</button>
      <button onClick={props.onReactivate}>reactivate-sub</button>
    </div>
  ),
}))
// Radix Select needs pointer APIs jsdom lacks; a native <select> keeps the
// same value/onValueChange contract and lets the test pick an option.
vi.mock("@/components/ds/primitives/select", () => {
  const React = require("react")
  const SelectTrigger = () => null
  const SelectValue = () => null
  const SelectContent = () => null
  const SelectItem = () => null
  function Select({ value, onValueChange, onOpenChange, disabled, children }) {
    let trigger = {}
    const items = []
    const walk = (nodes) =>
      React.Children.forEach(nodes, (n) => {
        if (!n || !n.props) return
        if (n.type === SelectTrigger) trigger = n.props
        if (n.type === SelectItem) items.push(n.props)
        walk(n.props.children)
      })
    walk(children)
    return (
      <select
        id={trigger.id}
        aria-label={trigger["aria-label"]}
        value={value}
        disabled={disabled}
        onFocus={() => onOpenChange?.(true)}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {items.map((i) => <option key={i.value} value={i.value}>{i.children}</option>)}
      </select>
    )
  }
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})
const handoff = vi.hoisted(() => ({ passing: false, stored: null }))
vi.mock("@/lib/oauth-handoff", () => ({
  isPassingThrough: () => handoff.passing,
  peekOAuthHandoff: () => handoff.stored,
  takeOAuthHandoff: () => {
    const v = handoff.stored
    handoff.stored = null
    return v
  },
}))

import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { usePageHeader } from "@/components/page-header"
import { ConfirmHost } from "@/components/ds"
import SettingsPage from "../page"

// remove-integration asks through ds confirm(), which needs its host mounted
const Page = () => (
  <>
    <SettingsPage />
    <ConfirmHost />
  </>
)

const DEFAULT_ROUTES = {
  "/api/status": {},
  "/api/hotprospector/status": { connected: false },
  "/api/integrations/slack/status": { installed: false },
  "/api/capabilities": { media_buying: false },
  "/api/dashboard/settings": {},
  "/api/billing/status": { plan: "pro" },
}

// routes: "METHOD url" or "url" -> body, or { __status, ...body } for non-ok.
function respond(routes = {}) {
  const all = { ...DEFAULT_ROUTES, ...routes }
  vi.mocked(apiRequest).mockImplementation((url, opts = {}) => {
    const key = `${opts.method || "GET"} ${url}`
    const hit = key in all ? all[key] : url in all ? all[url] : {}
    const { __status, ...body } = hit ?? {}
    const status = __status ?? 200
    return Promise.resolve({ ok: status < 400, status, statusText: "ERR", json: async () => body })
  })
}

const calls = (url, method) =>
  vi.mocked(apiRequest).mock.calls.filter(([u, o]) => u === url && (method ? o?.method === method : true))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  nav.params = ""
  handoff.passing = false
  handoff.stored = null
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("tabs", () => {
  it("lists the four tabs and defaults to Integrations", async () => {
    respond()
    render(<Page />)
    const strip = screen.getByRole("tablist", { name: "Settings section" })
    expect(within(strip).getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "General", "Tracking", "Integrations", "Billing",
    ])
    expect(await screen.findByText("Connected services")).toBeInTheDocument()
    expect(screen.queryByTestId("general-settings")).toBeNull()
  })

  it.each([
    ["general", "general-settings"],
    ["tracking", "tracking-overview"],
    ["billing", "credits-panel"],
    ["account", "credits-panel"],
    ["capabilities", "general-settings"],
  ])("?tab=%s shows its panel", async (name, testId) => {
    nav.params = `tab=${name}`
    respond()
    render(<Page />)
    expect(await screen.findByTestId(testId)).toBeInTheDocument()
    expect(screen.queryByText("Connected services")).toBeNull()
  })

  it("falls back to Integrations for an unknown tab", async () => {
    nav.params = "tab=nonsense"
    respond()
    render(<Page />)
    expect(await screen.findByText("Connected services")).toBeInTheDocument()
  })

  it("switching tab swaps the panel and replaces the URL", async () => {
    respond()
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("tab", { name: "Billing" }))
    expect(nav.replace).toHaveBeenCalledWith("/settings?tab=billing", { scroll: false })
    expect(await screen.findByTestId("credits-panel")).toBeInTheDocument()
    expect(screen.getByText("Birdy Credits")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Tracking" }))
    expect(nav.replace).toHaveBeenLastCalledWith("/settings?tab=tracking", { scroll: false })
    expect(await screen.findByTestId("tracking-overview")).toBeInTheDocument()
  })

  it("follows ?tab= when the URL changes without a remount", async () => {
    respond()
    const { rerender } = render(<Page />)
    expect(await screen.findByText("Connected services")).toBeInTheDocument()
    nav.params = "tab=billing"
    rerender(<Page />)
    expect(await screen.findByTestId("credits-panel")).toBeInTheDocument()
  })

  it("sets the page header", async () => {
    respond()
    render(<Page />)
    expect(usePageHeader).toHaveBeenCalled()
  })

  it("re-probes /api/status when ?tab= changes (the init effect depends on the URL)", async () => {
    respond()
    const { rerender } = render(<Page />)
    await waitFor(() => expect(calls("/api/status")).toHaveLength(1))
    nav.params = "tab=billing"
    rerender(<Page />)
    await waitFor(() => expect(calls("/api/status")).toHaveLength(2))
  })
})

describe("rail", () => {
  it("groups the sections under Workspace, Connections and Account", async () => {
    respond()
    render(<Page />)
    const rail = screen.getByRole("tablist", { name: "Settings section" })
    for (const group of ["Workspace", "Connections", "Account"]) {
      expect(within(rail).getByText(group)).toBeInTheDocument()
    }
    expect(within(rail).getByRole("tab", { name: "Integrations" })).toHaveAttribute("aria-selected", "true")
    expect(within(rail).getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "false")
    await screen.findByText("Connected services")
  })

  it.each([
    ["general", "General"],
    ["tracking", "Tracking"],
    ["integrations", "Integrations"],
    ["billing", "Billing"],
  ])("?tab=%s selects its rail item and names the section", async (key, label) => {
    nav.params = `tab=${key}`
    respond()
    render(<Page />)
    expect(screen.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("heading", { level: 2, name: label })).toBeInTheDocument()
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", `settings-tab-${key}`)
  })

  it("an old ?tab=account lands on Billing's rail item", async () => {
    nav.params = "tab=account"
    respond()
    render(<Page />)
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true")
  })

  it("clicking an item selects it and writes ?tab= to the URL", async () => {
    respond()
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole("tab", { name: "General" }))
    expect(nav.replace).toHaveBeenCalledWith("/settings?tab=general", { scroll: false })
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByTestId("general-settings")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toBeInTheDocument()
  })

  it("arrows, Home and End move focus only; Enter or Space selects", async () => {
    nav.params = "tab=general"
    respond()
    const user = userEvent.setup()
    render(<Page />)
    screen.getByRole("tab", { name: "General" }).focus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("tab", { name: "Tracking" })).toHaveFocus()
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("tab", { name: "General" })).toHaveFocus()
    await user.keyboard("{End}")
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveFocus()
    await user.keyboard("{Home}{ArrowUp}")
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveFocus()
    // nothing was selected, so the URL was never written
    expect(nav.replace).not.toHaveBeenCalled()
    expect(screen.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true")

    await user.keyboard("{Enter}")
    expect(nav.replace).toHaveBeenCalledTimes(1)
    expect(nav.replace).toHaveBeenLastCalledWith("/settings?tab=billing", { scroll: false })
    screen.getByRole("tab", { name: "Tracking" }).focus()
    await user.keyboard(" ")
    expect(nav.replace).toHaveBeenLastCalledWith("/settings?tab=tracking", { scroll: false })
  })

  it("flags Integrations in the rail only when a token has expired", async () => {
    respond({ "/api/status": { facebook: { connected: true, expires_at: "2000-01-01T00:00:00Z", token_expired: true } } })
    render(<Page />)
    const item = screen.getByRole("tab", { name: /Integrations/ })
    await waitFor(() => expect(within(item).getByText("Expired")).toBeInTheDocument())
  })

  it("shows no chip when nothing needs attention", async () => {
    respond()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    expect(within(screen.getByRole("tab", { name: "Integrations" })).queryByText("Expired")).toBeNull()
  })
})

describe("integrations: status loading", () => {
  it("probes every integration on mount", async () => {
    respond()
    render(<Page />)
    await waitFor(() => expect(calls("/api/integrations/slack/status")).toHaveLength(1))
    for (const url of ["/api/status", "/api/hotprospector/status", "/api/billing/status", "/api/capabilities", "/api/dashboard/settings"]) {
      expect(calls(url)).toHaveLength(1)
    }
  })

  it("shows Checking before the first status resolves, then Not connected tiles", async () => {
    respond()
    render(<Page />)
    expect(screen.getAllByText("Checking…").length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(4)
  })

  it("shows connected tiles with expiry and workspace, and caches them", async () => {
    respond({
      "/api/status": {
        gohighlevel: { agency: { connected: true, expires_at: "2030-01-15T00:00:00Z" } },
        facebook: { connected: true, expires_at: "2000-01-01T00:00:00Z", token_expired: true },
      },
      "/api/hotprospector/status": { connected: true, api_uid: "uid-9" },
      "/api/integrations/slack/status": { installed: true, team_name: "Acme HQ" },
    })
    render(<Page />)
    expect(await screen.findByText("Acme HQ")).toBeInTheDocument()
    expect(screen.getByText("uid-9")).toBeInTheDocument()
    expect(screen.getByText("API UID")).toBeInTheDocument()
    expect(screen.getAllByText("Connected")).toHaveLength(3)
    const meta = screen.getByRole("heading", { name: "Meta" }).closest("section")
    expect(within(meta).getByText("Expired")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove Meta (Facebook)" })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem("goHighLevelIntegration")).connected).toBe(true)
    expect(JSON.parse(localStorage.getItem("facebookIntegration")).token_expired).toBe(true)
    expect(JSON.parse(localStorage.getItem("hotprospectorIntegration")).api_uid).toBe("uid-9")
    expect(JSON.parse(localStorage.getItem("slackBotIntegration")).team_name).toBe("Acme HQ")
  })

  it("renders from the localStorage cache while the status is in flight", async () => {
    localStorage.setItem("hotprospectorIntegration", JSON.stringify({ connected: true, api_uid: "cached-uid" }))
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}))
    render(<Page />)
    expect(screen.getByText("cached-uid")).toBeInTheDocument()
  })

  it("shows the failure and a toast when /api/status errors, keeping the cached state", async () => {
    localStorage.setItem("goHighLevelIntegration", JSON.stringify({ connected: true, expires_at: "2030-01-01T00:00:00Z" }))
    respond({ "/api/status": { __status: 500 } })
    render(<Page />)
    expect(await screen.findByText("Failed to fetch integration status: Status fetch failed: 500")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Error", { description: "Status fetch failed: 500" })
    expect(screen.getAllByText("Connected").length).toBe(1)
  })

  it("offers a retry when the status probe fails, and probes again", async () => {
    respond({ "/api/status": { __status: 500 } })
    const user = userEvent.setup()
    render(<Page />)
    expect(await screen.findByText("Couldn't load your integrations")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(calls("/api/status")).toHaveLength(2))
  })

  it("clears the failure once a retry succeeds", async () => {
    respond({ "/api/status": { __status: 500 } })
    const user = userEvent.setup()
    render(<Page />)
    await screen.findByText("Couldn't load your integrations")
    respond()
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() => expect(screen.queryByText("Couldn't load your integrations")).toBeNull())
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
  })

  it("announces a connect failure assertively", async () => {
    respond({ "/api/connect/slack": { __status: 400, detail: "Slack is not configured" } })
    const user = userEvent.setup()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    const slack = screen.getByRole("heading", { name: "Slack" }).closest("section")
    await user.click(within(slack).getByRole("button", { name: "Connect" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to connect: Slack is not configured")
  })

  it("names each integration with an h4 under the Frame's h3", async () => {
    respond()
    render(<Page />)
    expect(screen.getByRole("heading", { level: 3, name: "Connected services" })).toBeInTheDocument()
    for (const name of ["Slack", "GoHighLevel", "Meta", "Hot Prospector"]) {
      expect(screen.getByRole("heading", { level: 4, name })).toBeInTheDocument()
    }
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
  })

  it("reacts to another tab changing an integration (storage event)", async () => {
    respond()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    localStorage.setItem("goHighLevelIntegration", JSON.stringify({ connected: true }))
    window.dispatchEvent(new StorageEvent("storage", { key: "goHighLevelIntegration" }))
    expect(await screen.findByText("Connected")).toBeInTheDocument()
  })
})

describe("integrations: connect and remove", () => {
  it("Connect on GoHighLevel and Meta hit their own endpoints", async () => {
    respond({ "/api/connect": {}, "/api/connect/facebook": {} })
    const user = userEvent.setup()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    const tile = (name) => screen.getByRole("heading", { name }).closest("section")
    await user.click(within(tile("GoHighLevel")).getByRole("button", { name: "Connect" }))
    await waitFor(() => expect(calls("/api/connect")).toHaveLength(1))
    expect(await screen.findByText("Failed to connect: No auth URL returned")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Connection Failed", { description: "No auth URL returned" })
    await user.click(within(tile("Meta")).getByRole("button", { name: "Connect" }))
    await waitFor(() => expect(calls("/api/connect/facebook")).toHaveLength(1))
  })

  it("Connect on Slack surfaces the server's detail on failure", async () => {
    respond({ "/api/connect/slack": { __status: 400, detail: "Slack is not configured" } })
    const user = userEvent.setup()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    const slack = screen.getByRole("heading", { name: "Slack" }).closest("section")
    await user.click(within(slack).getByRole("button", { name: "Connect" }))
    expect(await screen.findByText("Failed to connect: Slack is not configured")).toBeInTheDocument()
  })

  it("removing an integration confirms, then DELETEs and clears the cache", async () => {
    respond({
      "/api/status": { facebook: { connected: true } },
      "DELETE /api/integrations/facebook/remove": { ok: true },
    })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: /^Remove$/ }))
    expect(await screen.findByText("Remove Meta (Facebook)?")).toBeInTheDocument()
    expect(calls("/api/integrations/facebook/remove")).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "Yes, remove it" }))
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/integrations/facebook/remove", { method: "DELETE" })
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Integration Removed", {
        description: "Meta (Facebook) credentials have been deleted.",
      })
    )
    expect(localStorage.getItem("facebookIntegration")).toBeNull()
  })

  it("cancelling the removal confirm sends no DELETE", async () => {
    respond({ "/api/status": { facebook: { connected: true } } })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: /^Remove$/ }))
    await screen.findByText("Remove Meta (Facebook)?")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByText("Remove Meta (Facebook)?")).toBeNull())
    expect(vi.mocked(apiRequest).mock.calls.some(([, o]) => o?.method === "DELETE")).toBe(false)
    expect(screen.getByRole("button", { name: /^Remove$/ })).toBeInTheDocument()
  })

  it("a failed removal shows the error and keeps the integration", async () => {
    respond({
      "/api/integrations/slack/status": { installed: true, team_name: "Acme HQ" },
      "DELETE /api/integrations/slack/remove": { __status: 500, detail: "nope" },
    })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: /^Remove$/ }))
    await user.click(await screen.findByRole("button", { name: "Yes, remove it" }))
    expect(await screen.findByText("Failed to remove integration: nope")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Removal Failed", { description: "nope" })
    expect(screen.getByText("Acme HQ")).toBeInTheDocument()
  })

  it("connects HotProspector with the credentials from the dialog", async () => {
    respond({ "POST /api/hotprospector/connect": { groups_count: 3 } })
    const user = userEvent.setup()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    const hp = screen.getByRole("heading", { name: "Hot Prospector" }).closest("section")
    await user.click(within(hp).getByRole("button", { name: "Connect" }))
    const dialog = await screen.findByRole("dialog")
    const submit = within(dialog).getByRole("button", { name: "Connect" })
    expect(submit).toBeDisabled()
    await user.type(within(dialog).getByLabelText("API UID"), "u1")
    await user.type(within(dialog).getByLabelText("API Key"), "k1")
    await user.click(submit)
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/hotprospector/connect", {
        method: "POST",
        body: JSON.stringify({ api_uid: "u1", api_key: "k1" }),
      })
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Connection Successful", {
        description: "HotProspector connected. Found 3 groups.",
      })
    )
    expect(JSON.parse(localStorage.getItem("hotprospectorIntegration"))).toEqual({ connected: true, api_uid: "u1" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByText("u1")).toBeInTheDocument()
  })

  it("Cancel in the HotProspector dialog sends nothing", async () => {
    respond()
    const user = userEvent.setup()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    const hp = screen.getByRole("heading", { name: "Hot Prospector" }).closest("section")
    await user.click(within(hp).getByRole("button", { name: "Connect" }))
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(calls("/api/hotprospector/connect")).toHaveLength(0)
  })

  it("a rejected HotProspector connect shows the detail", async () => {
    respond({ "POST /api/hotprospector/connect": { __status: 400, detail: "Bad credentials" } })
    const user = userEvent.setup()
    render(<Page />)
    await waitFor(() => expect(screen.getAllByText("Not connected")).toHaveLength(4))
    const hp = screen.getByRole("heading", { name: "Hot Prospector" }).closest("section")
    await user.click(within(hp).getByRole("button", { name: "Connect" }))
    const dialog = await screen.findByRole("dialog")
    await user.type(within(dialog).getByLabelText("API UID"), "u")
    await user.type(within(dialog).getByLabelText("API Key"), "k")
    await user.click(within(dialog).getByRole("button", { name: "Connect" }))
    expect(await screen.findByText("Failed to connect HotProspector: Bad credentials")).toBeInTheDocument()
  })
})

describe("integrations: Slack channel", () => {
  const slackRoutes = {
    "/api/integrations/slack/status": { installed: true, team_name: "Acme", notify_channel_id: "C1", notify_channel_name: "ads" },
    "/api/integrations/slack/channels": { channels: [{ id: "C1", name: "ads" }, { id: "C2", name: "ops", is_private: true }] },
  }

  it("loads channels on open and saves the picked one", async () => {
    respond({ ...slackRoutes, "PUT /api/integrations/slack/channel": { ok: true } })
    render(<Page />)
    const select = await screen.findByLabelText("Channel Birdy posts AI suggestions to")
    fireEvent.focus(select)
    await waitFor(() => expect(calls("/api/integrations/slack/channels")).toHaveLength(1))
    await waitFor(() => expect(within(select).getByText("🔒 ops")).toBeInTheDocument())
    fireEvent.change(select, { target: { value: "C2" } })
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/integrations/slack/channel", {
        method: "PUT",
        body: JSON.stringify({ channel_id: "C2", channel_name: "ops" }),
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Suggestions will post to #ops"))
    expect(JSON.parse(localStorage.getItem("slackBotIntegration")).notify_channel_id).toBe("C2")
  })

  it("choosing 'Don't post' clears the channel", async () => {
    respond({ ...slackRoutes, "PUT /api/integrations/slack/channel": { ok: true } })
    render(<Page />)
    const select = await screen.findByLabelText("Channel Birdy posts AI suggestions to")
    fireEvent.change(select, { target: { value: "__none__" } })
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/integrations/slack/channel", {
        method: "PUT",
        body: JSON.stringify({ channel_id: null, channel_name: null }),
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Suggestion posting turned off"))
  })

  it("a failed save toasts", async () => {
    respond({ ...slackRoutes, "PUT /api/integrations/slack/channel": { __status: 500 } })
    render(<Page />)
    const select = await screen.findByLabelText("Channel Birdy posts AI suggestions to")
    fireEvent.change(select, { target: { value: "__none__" } })
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't save channel"))
  })

  it("offers a reconnect when the channel list cannot load", async () => {
    respond({ ...slackRoutes, "/api/integrations/slack/channels": { __status: 403 } })
    render(<Page />)
    const select = await screen.findByLabelText("Channel Birdy posts AI suggestions to")
    fireEvent.focus(select)
    expect(await screen.findByRole("button", { name: "Reconnect Slack" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Channel Birdy posts AI suggestions to")).toBeNull()
  })
})

describe("OAuth callback", () => {
  it("shows an error callback and toasts, without probing status", async () => {
    nav.params = "status=error&error=access_denied&error_description=User%20said%20no"
    respond()
    render(<Page />)
    expect(await screen.findByText("access_denied: User said no")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Connection Failed", { description: "access_denied: User said no" })
    expect(calls("/api/status")).toHaveLength(0)
  })

  it("sends an error callback back to the parked return path", async () => {
    nav.params = "status=error&error=denied"
    handoff.stored = "/onboarding"
    handoff.passing = true
    respond()
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/onboarding"))
    expect(handoff.stored).toBeNull()
  })

  it("renders the hand-off screen instead of the page while passing through", async () => {
    nav.params = "status=success"
    handoff.stored = "/onboarding"
    handoff.passing = true
    respond()
    render(<Page />)
    expect(screen.getByRole("status", { name: "Finishing up" })).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).toBeNull()
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/onboarding"))
    expect(calls("/api/status")).toHaveLength(0)
  })

  it("banks GoHighLevel tokens, caches the status and announces it", async () => {
    const tokens = { scope: "contacts.readonly", expires_in: 100, expires_at: "2099-01-01T00:00:00Z" }
    nav.params = `status=success&tokens=${encodeURIComponent(JSON.stringify(tokens))}`
    respond()
    render(<Page />)
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Connection Successful", {
        description: "GoHighLevel connected successfully.",
      })
    )
    expect(JSON.parse(localStorage.getItem("goHighLevelIntegration")).connected).toBe(true)
    expect(document.cookie).toContain("gohighlevel_tokens=")
    expect(await screen.findByText("Connected")).toBeInTheDocument()
    expect(calls("/api/status")).toHaveLength(0)
  })

  it("treats a read_insights scope as Meta and hands back to the parked path", async () => {
    const tokens = { scope: "ads_read,read_insights" }
    nav.params = `status=success&tokens=${encodeURIComponent(JSON.stringify(tokens))}`
    handoff.stored = "/onboarding"
    respond()
    render(<Page />)
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/onboarding"))
    expect(JSON.parse(localStorage.getItem("facebookIntegration")).connected).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("an unreadable payload on a hand-off load swaps the hand-off screen for the page plus the error", async () => {
    nav.params = "status=success&tokens=%7Bnot-json"
    handoff.stored = "/onboarding"
    handoff.passing = true
    respond()
    render(<Page />)
    // the effect has already dropped the hand-off flag by the time render() returns
    expect(await screen.findByText("Invalid token data received")).toBeInTheDocument()
    expect(screen.queryByRole("status", { name: "Finishing up" })).toBeNull()
    expect(screen.getByRole("tablist", { name: "Settings section" })).toBeInTheDocument()
    expect(nav.replace).not.toHaveBeenCalled()
    expect(handoff.stored).toBeNull()
  })

  it("an unreadable token payload shows Invalid token data", async () => {
    nav.params = "status=success&tokens=%7Bnot-json"
    respond()
    render(<Page />)
    expect(await screen.findByText("Invalid token data received")).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith("Connection Failed", { description: "Invalid token data received" })
  })
})

describe("general tab", () => {
  beforeEach(() => { nav.params = "tab=general" })

  it("gives GeneralSettings the Slack state", async () => {
    respond({ "/api/integrations/slack/status": { installed: true, brief: "weekly" } })
    render(<Page />)
    const general = await screen.findByTestId("general-settings")
    await waitFor(() => expect(general).toHaveAttribute("data-slack-connected", "true"))
    expect(general).toHaveAttribute("data-brief", "weekly")
  })

  it("reflects the saved capabilities on the Media Buying Analyst switch", async () => {
    respond({ "/api/capabilities": { media_buying: true } })
    render(<Page />)
    expect(await screen.findByText("Agent Capabilities")).toBeInTheDocument()
    const toggle = screen.getByRole("switch", { name: "Toggle the Media Buying Analyst capability" })
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"))
    expect(screen.getByText("Enabled")).toBeInTheDocument()
  })

  it("toggling sends the capability and toasts", async () => {
    respond({ "PUT /api/capabilities": { media_buying: true } })
    const user = userEvent.setup()
    render(<Page />)
    const toggle = await screen.findByRole("switch", { name: "Toggle the Media Buying Analyst capability" })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    await user.click(toggle)
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/capabilities", {
        method: "PUT",
        body: JSON.stringify({ media_buying: true }),
      })
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Capability enabled", {
        description: "New Birdy chats will use this setting.",
      })
    )
    expect(toggle).toHaveAttribute("aria-checked", "true")
  })

  it("reverts the switch and toasts when the save fails", async () => {
    respond({ "PUT /api/capabilities": { __status: 500 } })
    const user = userEvent.setup()
    render(<Page />)
    const toggle = await screen.findByRole("switch", { name: "Toggle the Media Buying Analyst capability" })
    await waitFor(() => expect(toggle).not.toBeDisabled())
    await user.click(toggle)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update capability", { description: "Please try again." })
    )
    expect(toggle).toHaveAttribute("aria-checked", "false")
  })

  it("reverts strictness when its save fails", async () => {
    respond({
      "/api/capabilities": { media_buying: true },
      "/api/dashboard/settings": { strictness: "strict" },
      "PUT /api/dashboard/settings": { __status: 500 },
    })
    const user = userEvent.setup()
    render(<Page />)
    const select = await screen.findByLabelText(/how strict should birdy be/i)
    await waitFor(() => expect(select).toHaveValue("strict"))
    await user.selectOptions(select, "lenient")
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update strictness", { description: "Please try again." })
    )
    expect(select).toHaveValue("strict")
  })
})

describe("billing tab", () => {
  beforeEach(() => { nav.params = "tab=billing" })

  it("hands the billing status to the plan picker", async () => {
    respond({ "/api/billing/status": { plan: "scale" } })
    render(<Page />)
    const picker = await screen.findByTestId("plan-picker")
    await waitFor(() => expect(picker).toHaveAttribute("data-plan", "scale"))
  })

  it("cancel POSTs, refetches the status and toasts", async () => {
    respond({ "POST /api/billing/cancel": {} })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: "cancel-sub" }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/billing/cancel", { method: "POST" }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Your subscription will end when the current period does.")
    )
    expect(calls("/api/billing/status").length).toBe(2)
  })

  it("reactivate POSTs and toasts", async () => {
    respond({ "POST /api/billing/reactivate": {} })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: "reactivate-sub" }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/billing/reactivate", { method: "POST" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Your subscription will keep running."))
  })

  it("a failed cancel toasts the server detail", async () => {
    respond({ "POST /api/billing/cancel": { __status: 400, detail: "Already cancelled" } })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: "cancel-sub" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Subscription", { description: "Already cancelled" }))
  })

  it("manage opens the billing portal in a new tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null)
    respond({ "/api/billing/portal-url": { portal_url: "https://portal.test/x" } })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: "manage" }))
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://portal.test/x", "_blank", "noopener,noreferrer"))
  })

  it("a portal failure toasts", async () => {
    respond({ "/api/billing/portal-url": { __status: 500, detail: "down" } })
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole("button", { name: "manage" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Billing Portal Error", { description: "down" }))
  })
})
