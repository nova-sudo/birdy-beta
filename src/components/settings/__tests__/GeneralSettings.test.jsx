import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Settings → General ─────────────────────────────────────────────────────
// Account fields, password and the Slack brief schedule, each saved by its own
// button: the endpoints and payloads, plus the loading-failure state.

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/components/report-designer/SavedReportCard", () => ({ default: () => <div data-testid="saved-report" /> }))
// Radix Select needs pointer APIs jsdom lacks; a native <select> keeps the
// same value/onValueChange contract.
vi.mock("@/components/ds/primitives/select", () => {
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

import { toast } from "sonner"
import { apiRequest } from "@/lib/api"
import { GeneralSettings } from "../GeneralSettings"

const PROFILE = { name: "Ada", email: "ada@example.com", default_currency: "GBP", timezone: "Europe/London" }

function respond(routes = {}) {
  const all = { "/api/user/profile": PROFILE, ...routes }
  vi.mocked(apiRequest).mockImplementation((url, opts = {}) => {
    const key = `${opts.method || "GET"} ${url}`
    const hit = key in all ? all[key] : url in all ? all[url] : {}
    const { __status, ...body } = hit ?? {}
    const status = __status ?? 200
    return Promise.resolve({ ok: status < 400, status, json: async () => body })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("account", () => {
  it("loads the profile into the fields and keeps Save disabled until something changes", async () => {
    respond()
    render(<GeneralSettings />)
    expect(await screen.findByDisplayValue("Ada")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com")
    expect(screen.getByLabelText("Email")).toBeDisabled()
    expect(screen.getByLabelText("Currency")).toHaveValue("GBP")
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled()
  })

  it("PATCHes the trimmed name, currency and timezone, then caches the currency", async () => {
    respond({ "PATCH /api/user/profile": {} })
    const user = userEvent.setup()
    render(<GeneralSettings />)
    const name = await screen.findByDisplayValue("Ada")
    await user.clear(name)
    await user.type(name, "  Grace  ")
    await user.selectOptions(screen.getByLabelText("Currency"), "USD")
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "Grace", default_currency: "USD", timezone: "Europe/London" }),
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Settings saved"))
    expect(localStorage.getItem("user_default_currency")).toBe("USD")
  })

  it("refuses an empty name", async () => {
    respond()
    const user = userEvent.setup()
    render(<GeneralSettings />)
    const name = await screen.findByDisplayValue("Ada")
    await user.clear(name)
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(toast.error).toHaveBeenCalledWith("Name cannot be empty")
  })

  it("says so when the profile cannot be loaded, and retries", async () => {
    respond({ "/api/user/profile": { __status: 500 } })
    const user = userEvent.setup()
    render(<GeneralSettings />)
    expect(await screen.findByText("Couldn't load your profile")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /try again/i }))
    await waitFor(() =>
      expect(vi.mocked(apiRequest).mock.calls.filter(([u]) => u === "/api/user/profile")).toHaveLength(2)
    )
  })
})

describe("password", () => {
  async function fill(user, { current = "old-pass", next = "new-pass-1", confirm = "new-pass-1" } = {}) {
    await user.type(screen.getByLabelText("Current password"), current)
    await user.type(screen.getByLabelText("New password"), next)
    await user.type(screen.getByLabelText("Confirm new password"), confirm)
  }

  it("keeps Update disabled until all three are filled", async () => {
    respond()
    render(<GeneralSettings />)
    expect(screen.getByRole("button", { name: "Update password" })).toBeDisabled()
  })

  it("POSTs the current and new password and clears the fields", async () => {
    respond({ "POST /api/user/password": {} })
    const user = userEvent.setup()
    render(<GeneralSettings />)
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Update password" }))
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/user/password", {
        method: "POST",
        body: JSON.stringify({ current_password: "old-pass", new_password: "new-pass-1" }),
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Password updated"))
    expect(screen.getByLabelText("Current password")).toHaveValue("")
  })

  it("does not send mismatched passwords", async () => {
    respond()
    const user = userEvent.setup()
    render(<GeneralSettings />)
    await fill(user, { confirm: "different" })
    await user.click(screen.getByRole("button", { name: "Update password" }))
    expect(await screen.findByText("The two new passwords do not match")).toBeInTheDocument()
    expect(vi.mocked(apiRequest).mock.calls.some(([u]) => u === "/api/user/password")).toBe(false)
  })

  it("shows the server's reason when it refuses", async () => {
    respond({ "POST /api/user/password": { __status: 400, detail: "Current password is wrong" } })
    const user = userEvent.setup()
    render(<GeneralSettings />)
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Update password" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is wrong")
  })
})

describe("notification preferences", () => {
  it("asks to connect Slack first when it is not connected", async () => {
    respond()
    render(<GeneralSettings slackConnected={false} />)
    expect(screen.getByText("Connect the Slack bot under Integrations to schedule a brief.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save schedule" })).toBeNull()
  })

  it("saves a daily schedule with no day", async () => {
    respond({ "PUT /api/integrations/slack/brief": { brief: { frequency: "daily", time: "8:00 AM" } } })
    const onBriefSaved = vi.fn()
    const user = userEvent.setup()
    render(<GeneralSettings slackConnected brief={{ frequency: "daily", time: "9:00 AM" }} onBriefSaved={onBriefSaved} />)
    expect(screen.getByTestId("saved-report")).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("What time?"), "8:00 AM")
    await user.click(screen.getByRole("button", { name: "Save schedule" }))
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/integrations/slack/brief", {
        method: "PUT",
        body: JSON.stringify({ frequency: "daily", time: "8:00 AM", day: null }),
      })
    )
    await waitFor(() => expect(onBriefSaved).toHaveBeenCalledWith({ frequency: "daily", time: "8:00 AM" }))
    expect(toast.success).toHaveBeenCalledWith("Brief schedule saved")
  })

  it("weekly reveals the day and sends it", async () => {
    respond({ "PUT /api/integrations/slack/brief": { brief: {} } })
    const user = userEvent.setup()
    render(<GeneralSettings slackConnected brief={{ frequency: "daily", time: "9:00 AM" }} />)
    expect(screen.queryByLabelText("Which day?")).toBeNull()
    await user.click(screen.getByRole("button", { name: /Weekly/ }))
    expect(screen.getByRole("button", { name: /Weekly/ })).toHaveAttribute("aria-pressed", "true")
    await user.selectOptions(screen.getByLabelText("Which day?"), "Friday")
    await user.click(screen.getByRole("button", { name: "Save schedule" }))
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/integrations/slack/brief", {
        method: "PUT",
        body: JSON.stringify({ frequency: "weekly", time: "9:00 AM", day: "Friday" }),
      })
    )
  })

  it("toasts when the schedule cannot be saved", async () => {
    respond({ "PUT /api/integrations/slack/brief": { __status: 500 } })
    const user = userEvent.setup()
    render(<GeneralSettings slackConnected brief={{ frequency: "daily", time: "9:00 AM" }} />)
    await user.click(screen.getByRole("button", { name: "Save schedule" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save the brief schedule"))
  })
})

describe("layout", () => {
  it("puts a Frame's description under its title, wrapping rather than truncated", async () => {
    respond()
    render(<GeneralSettings />)
    await screen.findByDisplayValue("Ada")
    const desc = screen.getByText("Manage your general application and account settings")
    expect(desc.className).not.toMatch(/truncate/)
    const title = screen.getByRole("heading", { name: "General settings" })
    expect(title.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The Frame's own description slot, stacked under the title.
    expect(desc).toHaveAttribute("data-slot", "frame-description")
    expect(title.parentElement).toHaveClass("flex-col")
  })

  it("builds each form as a ds Frame of label/control rows", async () => {
    respond()
    const { container } = render(<GeneralSettings />)
    await screen.findByDisplayValue("Ada")
    expect(container.querySelectorAll('[data-ds="frame"]')).toHaveLength(3)
    const account = screen.getByRole("heading", { name: "General settings" }).closest("section")
    expect(within(account).getAllByText(/Name|Email|Timezone|Currency/).length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-slot="setting-row"]').length).toBeGreaterThanOrEqual(7)
  })
})
