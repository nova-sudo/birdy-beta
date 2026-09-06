// The delete action on the internal admin console's agency table.
//
// This is now the only way an account leaves Birdy — users can no longer
// delete themselves from Settings — so the guardrails around the button
// matter more than the button. The confirm dialog will not arm until the
// admin has typed the row's own email, and admin rows have no delete at all
// (the server refuses them, this just says so before the round trip).

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const deleteUserAccount = vi.fn()
vi.mock("@/lib/admin-api", () => ({
  deleteUserAccount: (...a) => deleteUserAccount(...a),
  startImpersonation: vi.fn(),
  fetchMe: vi.fn(),
}))
const toast = { success: vi.fn(), error: vi.fn() }
vi.mock("sonner", () => ({ toast }))

const AgenciesTable = (await import("@/components/admin/AgenciesTable")).default

const owner = (over = {}) => ({
  email: "owner@agency.com",
  owner: "SOUP Marketing",
  role: "user",
  plan: "Growth",
  sub_accounts: 3,
  leads: 1204,
  ai_queries: 88,
  last_active: "2026-09-01T10:00:00Z",
  ...over,
})

function setup(agencies = [owner()]) {
  const onDeleted = vi.fn()
  render(<AgenciesTable agencies={agencies} loading={false} onDeleted={onDeleted} />)
  return { user: userEvent.setup(), onDeleted }
}

const openDialog = async (user, email = "owner@agency.com") =>
  user.click(screen.getByRole("button", { name: `Delete ${email}` }))

const confirmButton = () => screen.getByRole("button", { name: /delete this account/i })

beforeEach(() => {
  deleteUserAccount.mockReset()
  deleteUserAccount.mockResolvedValue({ deleted: true })
  toast.success.mockReset()
  toast.error.mockReset()
})

describe("the confirmation", () => {
  it("names the account and what goes with it", async () => {
    const { user } = setup()
    await openDialog(user)

    const dialog = within(screen.getByRole("alertdialog"))
    expect(dialog.getByText(/delete soup marketing's account\?/i)).toBeInTheDocument()
    expect(dialog.getByText("owner@agency.com")).toBeInTheDocument()
    expect(dialog.getByText(/no backup and no undo/i)).toBeInTheDocument()
  })

  it("stays disabled until the email is typed exactly", async () => {
    const { user } = setup()
    await openDialog(user)
    const field = screen.getByLabelText(/type the account email/i)

    expect(confirmButton()).toBeDisabled()

    await user.type(field, "owner@agency.co")
    expect(confirmButton()).toBeDisabled()

    await user.type(field, "m")
    expect(confirmButton()).toBeEnabled()
  })

  it("accepts the email as typed rather than as stored", async () => {
    // Admins read the address off the row and retype it; case and a trailing
    // space from a copy/paste are not a reason to make them do it again.
    const { user } = setup()
    await openDialog(user)
    await user.type(screen.getByLabelText(/type the account email/i), " Owner@Agency.com ")
    expect(confirmButton()).toBeEnabled()
  })

  it("does not delete anything until it is confirmed", async () => {
    const { user } = setup()
    await openDialog(user)
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })
})

describe("deleting", () => {
  it("calls the admin endpoint and refetches the table", async () => {
    const { user, onDeleted } = setup()
    await openDialog(user)
    await user.type(screen.getByLabelText(/type the account email/i), "owner@agency.com")
    await user.click(confirmButton())

    await waitFor(() => expect(deleteUserAccount).toHaveBeenCalledWith("owner@agency.com"))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })

  it("surfaces the server's refusal instead of pretending it worked", async () => {
    // e.g. the 409 for an account whose Whop subscription is still live.
    deleteUserAccount.mockRejectedValue(new Error("still has an active subscription"))
    const { user, onDeleted } = setup()
    await openDialog(user)
    await user.type(screen.getByLabelText(/type the account email/i), "owner@agency.com")
    await user.click(confirmButton())

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(toast.error.mock.calls[0][1].description).toMatch(/active subscription/i)
    expect(onDeleted).not.toHaveBeenCalled()
  })
})

describe("admin rows", () => {
  it("cannot be deleted from the table", () => {
    setup([owner({ email: "admin@birdy.ai", owner: "Support", role: "admin" })])
    expect(screen.getByRole("button", { name: "Delete admin@birdy.ai" })).toBeDisabled()
  })
})
