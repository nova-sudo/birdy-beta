import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "https://api.example.test",
}))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

import { apiRequest } from "@/lib/api"
import { toast } from "sonner"
import { ConnectAI } from "../ConnectAI"

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const CONNECTIONS = [
  { id: "c1", kind: "oauth", name: "Claude", access: "write", created_at: "2026-11-15T10:00:00Z", last_used_at: "2026-11-15T11:00:00Z", expires_at: null },
  { id: "c2", kind: "manual", name: "Cursor", access: "read", created_at: "2026-11-12T10:00:00Z", last_used_at: null, expires_at: null },
]

let calls
beforeEach(() => {
  vi.clearAllMocks()
  calls = []
  let list = [...CONNECTIONS]
  apiRequest.mockImplementation(async (url, opts = {}) => {
    calls.push([url, opts.method || "GET", opts.body])
    if (url === "/api/mcp/connections" && !opts.method) return ok(list)
    if (url === "/api/mcp/connections/c1" && opts.method === "DELETE") {
      list = list.filter((c) => c.id !== "c1")
      return ok({ ok: true })
    }
    if (url === "/api/mcp/tokens" && opts.method === "POST") {
      return ok({ id: "t1", name: "CI", token: "birdy_secret_123", created_at: "x", expires_at: "y" })
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
})

describe("ConnectAI", () => {
  it("copies MCP url", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(navigator.clipboard, "writeText")
    render(<ConnectAI />)
    expect(screen.getByText("https://api.example.test/mcp")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Copy link" }))
    expect(spy).toHaveBeenCalledWith("https://api.example.test/mcp")
    expect(toast.success).toHaveBeenCalled()
  })

  it("shows steps per app, Claude Code has the command", async () => {
    const user = userEvent.setup()
    render(<ConnectAI />)
    await user.click(screen.getByRole("button", { name: "Claude Code" }))
    expect(screen.getByText("claude mcp add --transport http birdy https://api.example.test/mcp")).toBeInTheDocument()
  })

  it("lists connections and revokes after confirm", async () => {
    const user = userEvent.setup()
    render(<ConnectAI />)
    expect(await screen.findByText("View and make changes")).toBeInTheDocument()
    expect(screen.getByText("View my data")).toBeInTheDocument()
    const row = screen.getByText("Claude", { selector: "td *, td" }).closest("tr")
    await user.click(within(row).getByRole("button", { name: "Disconnect" }))
    expect(calls.some((c) => c[1] === "DELETE")).toBe(false)
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Disconnect" }))
    await waitFor(() => expect(calls).toContainEqual(["/api/mcp/connections/c1", "DELETE", undefined]))
    await waitFor(() => expect(screen.queryByText("View and make changes")).not.toBeInTheDocument())
  })

  it("keeps the row and shows an error toast when revoke fails", async () => {
    const user = userEvent.setup()
    const base = apiRequest.getMockImplementation()
    apiRequest.mockImplementation(async (url, opts = {}) =>
      opts.method === "DELETE" ? { ok: false, status: 500, json: async () => ({}) } : base(url, opts))
    render(<ConnectAI />)
    await screen.findByText("View and make changes")
    const row = screen.getByText("Claude", { selector: "td *, td" }).closest("tr")
    await user.click(within(row).getByRole("button", { name: "Disconnect" }))
    const dialog = await screen.findByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Disconnect" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByText("View and make changes")).toBeInTheDocument()
  })

  it("creates read-only token and shows it once", async () => {
    const user = userEvent.setup()
    render(<ConnectAI />)
    await user.click(screen.getByRole("button", { name: "Create token for developers" }))
    await user.type(screen.getByLabelText("Token name"), "CI")
    await user.click(screen.getByRole("button", { name: "Create token" }))
    expect(await screen.findByText("birdy_secret_123")).toBeInTheDocument()
    expect(screen.getByText(/only time/i)).toBeInTheDocument()
    const post = calls.find((c) => c[1] === "POST")
    expect(JSON.parse(post[2])).toMatchObject({ name: "CI", access: "read" })
    await user.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.queryByText("birdy_secret_123")).not.toBeInTheDocument()
  })

  it("shows check-in prompt", async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(navigator.clipboard, "writeText")
    render(<ConnectAI />)
    const text = "Every weekday at 8am, use Birdy's check_my_accounts tool and tell me only what needs my attention today, most urgent first."
    expect(screen.getByText(text)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Copy" }))
    expect(spy).toHaveBeenCalledWith(text)
  })
})
