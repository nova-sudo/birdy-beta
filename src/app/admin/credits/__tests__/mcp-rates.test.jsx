import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const BASE = {
  markup: 3, markup_min: 1, markup_max: 20, rate_mode: "managed", enforce: false,
  model: "m", model_pricing: { in: 1, out: 2 },
  mcp_base_fee: 0.2, mcp_per_10k_chars: 1, mcp_live_fee: 1, mcp_max_per_call: 10,
}
let CONFIG = BASE
const mutate = vi.fn()
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock("@/components/motion", () => ({ Stagger: ({ children }) => <div>{children}</div>, StaggerItem: ({ children }) => <div>{children}</div> }))
vi.mock("@/lib/admin-api", () => ({
  useCreditsConfig: () => ({ data: CONFIG, isLoading: false, mutate }),
  useCreditsAccounts: () => ({ data: { accounts: [], totals: {} }, isLoading: false }),
  updateCreditsConfig: vi.fn(async (b) => ({ ...CONFIG, ...b })),
  grantCredits: vi.fn(),
}))

import { updateCreditsConfig } from "@/lib/admin-api"
import { toast } from "sonner"
import AdminCreditsPage from "../page"

beforeEach(() => { vi.clearAllMocks(); CONFIG = BASE })

describe("admin MCP rates", () => {
  it("shows the defaults from the config", () => {
    render(<AdminCreditsPage />)
    expect(screen.getByLabelText("MCP request fee")).toHaveValue(0.2)
    expect(screen.getByLabelText("MCP credits per 10,000 characters")).toHaveValue(1)
    expect(screen.getByLabelText("MCP live change fee")).toHaveValue(1)
    expect(screen.getByLabelText("MCP max per request")).toHaveValue(10)
    expect(screen.getByText(/Price per request = request fee/)).toBeInTheDocument()
  })

  it("admin saves mcp rates", async () => {
    const user = userEvent.setup()
    render(<AdminCreditsPage />)
    const save = screen.getByRole("button", { name: /save pricing/i })
    expect(save).toBeDisabled()
    const fee = screen.getByLabelText("MCP request fee")
    await user.clear(fee)
    await user.type(fee, "0.5")
    await user.click(save)
    await waitFor(() => expect(updateCreditsConfig).toHaveBeenCalledTimes(1))
    expect(updateCreditsConfig).toHaveBeenCalledWith({
      markup: 3, rate_mode: "managed", enforce: false,
      mcp_base_fee: 0.5, mcp_per_10k_chars: 1, mcp_live_fee: 1, mcp_max_per_call: 10,
    })
  })

  it("blocks saving a rate above 100", async () => {
    const user = userEvent.setup()
    render(<AdminCreditsPage />)
    const max = screen.getByLabelText("MCP max per request")
    await user.clear(max)
    await user.type(max, "101")
    expect(screen.getByRole("button", { name: /save pricing/i })).toBeDisabled()
  })

  it("a revalidate with new saved rates does not wipe an edit in progress", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AdminCreditsPage />)
    const fee = screen.getByLabelText("MCP request fee")
    await user.clear(fee)
    await user.type(fee, "0.7")
    CONFIG = { ...BASE, mcp_max_per_call: 12 } // someone else saved a different rate
    rerender(<AdminCreditsPage />)
    expect(screen.getByLabelText("MCP request fee")).toHaveValue(0.7)
    expect(screen.getByLabelText("MCP max per request")).toHaveValue(12) // untouched field follows the saved value
    await user.click(screen.getByRole("button", { name: /save pricing/i }))
    await waitFor(() => expect(updateCreditsConfig).toHaveBeenCalledTimes(1))
    expect(updateCreditsConfig.mock.calls[0][0]).toMatchObject({ mcp_base_fee: 0.7, mcp_max_per_call: 12 })
  })

  it("untouched fields follow a changed saved value", () => {
    const { rerender } = render(<AdminCreditsPage />)
    CONFIG = { ...BASE, mcp_max_per_call: 12 }
    rerender(<AdminCreditsPage />)
    expect(screen.getByLabelText("MCP max per request")).toHaveValue(12)
  })

  it("the save toast names the MCP rates", async () => {
    const user = userEvent.setup()
    render(<AdminCreditsPage />)
    const fee = screen.getByLabelText("MCP request fee")
    await user.clear(fee)
    await user.type(fee, "0.5")
    await user.click(screen.getByRole("button", { name: /save pricing/i }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(toast.success.mock.calls[0][1].description).toContain("MCP 0.5 + 1/10k chars + 1 live, max 10")
  })
})
