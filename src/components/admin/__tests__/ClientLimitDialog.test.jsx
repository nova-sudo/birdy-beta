import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/admin-api", () => ({ setClientLimit: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { setClientLimit } from "@/lib/admin-api"
import ClientLimitDialog from "../ClientLimitDialog"

const agency = (extra = {}) => ({
  email: "owner@agency.com", owner: "Owner", sub_accounts: 5,
  plan_client_limit: 3, client_limit: 3, client_limit_override: null, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(setClientLimit).mockResolvedValue({})
})

describe("ClientLimitDialog", () => {
  it("saves a new limit with its reason", async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<ClientLimitDialog agency={agency()} onClose={vi.fn()} onSaved={onSaved} />)

    await user.type(screen.getByLabelText("Clients allowed"), "12")
    await user.type(screen.getByLabelText("Reason (optional)"), "pilot")
    await user.click(screen.getByRole("button", { name: "Save limit" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(setClientLimit).toHaveBeenCalledWith("owner@agency.com", { limit: 12, note: "pilot" })
  })

  it("won't save a limit out of range", async () => {
    const user = userEvent.setup()
    render(<ClientLimitDialog agency={agency()} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText("Clients allowed"), "1001")
    expect(screen.getByRole("button", { name: "Save limit" })).toBeDisabled()
    expect(screen.getByText(/whole number from 0 to 1000/)).toBeInTheDocument()
  })

  it("warns when the limit is below the clients they already have", async () => {
    const user = userEvent.setup()
    render(<ClientLimitDialog agency={agency()} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText("Clients allowed"), "2")
    expect(screen.getByText(/fewer than the 5 clients they already have/)).toBeInTheDocument()
  })

  it("removes an existing override", async () => {
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(<ClientLimitDialog agency={agency({ client_limit_override: 20, client_limit: 20 })} onClose={vi.fn()} onSaved={onSaved} />)

    expect(screen.getByLabelText("Clients allowed")).toHaveValue(20)
    await user.click(screen.getByRole("button", { name: "Remove override" }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(setClientLimit).toHaveBeenCalledWith("owner@agency.com", { limit: null, note: "" })
  })
})
