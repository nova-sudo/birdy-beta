// The Targets tab of the Client Detail settings modal.
//
// Close rate is stored as a fraction (0.25) but typed as a percentage (25) —
// getting that conversion backwards would store a 2500% close rate and quietly
// make every client look wildly behind, so it is the most covered thing here.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { ClientTargetsForm } = await import("@/components/clients/ClientTargetsForm")

const ok = (body = {}) => ({ ok: true, status: 200, json: async () => body })

function setup({ targets } = {}) {
  const onSaved = vi.fn()
  render(
    <ClientTargetsForm
      clientId="g1"
      targets={targets}
      currencySymbol="£"
      onSaved={onSaved}
    />
  )
  return { user: userEvent.setup(), onSaved }
}

const save = async (user) =>
  user.click(screen.getByRole("button", { name: /save targets/i }))

/** The body of the PUT the form sent. */
const sentBody = () => JSON.parse(apiRequest.mock.calls.at(-1)[1].body)

beforeEach(() => {
  apiRequest.mockReset()
  apiRequest.mockResolvedValue(ok({ targets: {} }))
})

describe("the six fields", () => {
  it("renders each one with its help line", () => {
    setup()
    for (const label of [
      "Cost per lead", "Monthly closes", "Monthly revenue",
      "Close rate", "Monthly spend", "Average order value",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(
      screen.getByText(/what the health band is measured against/i)
    ).toBeInTheDocument()
  })

  it("prefills from the stored targets", () => {
    setup({ targets: { cpl: 9.5, monthly_wins: 12, monthly_revenue: 50000 } })
    expect(screen.getByLabelText("Cost per lead")).toHaveValue(9.5)
    expect(screen.getByLabelText("Monthly closes")).toHaveValue(12)
    expect(screen.getByLabelText("Monthly revenue")).toHaveValue(50000)
  })

  it("shows an unset target as empty, not zero", () => {
    // Zero is a real target someone could choose; blank means "not set".
    setup({ targets: { cpl: 9.5 } })
    expect(screen.getByLabelText("Monthly closes")).toHaveValue(null)
  })
})

describe("close rate conversion", () => {
  it("shows a stored fraction as a percentage", () => {
    setup({ targets: { conversion_rate: 0.25 } })
    expect(screen.getByLabelText("Close rate")).toHaveValue(25)
  })

  it("stores a typed percentage as a fraction", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Close rate"), "25")
    await save(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(sentBody().conversion_rate).toBe(0.25)
  })

  it("round-trips without drifting", async () => {
    const { user } = setup({ targets: { conversion_rate: 0.25 } })
    await save(user)
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(sentBody().conversion_rate).toBe(0.25)
  })

  it("rejects a close rate above 100%", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Close rate"), "150")
    await save(user)

    expect(await screen.findByText(/cannot exceed 100%/i)).toBeInTheDocument()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("leaves other fields unscaled", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "12")
    await save(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(sentBody().monthly_wins).toBe(12)
  })
})

describe("saving", () => {
  it("PUTs to the client's targets endpoint", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "12")
    await save(user)

    await waitFor(() =>
      expect(apiRequest.mock.calls.at(-1)[0]).toBe("/api/client-groups/g1/targets")
    )
    expect(apiRequest.mock.calls.at(-1)[1].method).toBe("PUT")
  })

  it("omits blank fields rather than sending null", async () => {
    // The endpoint merges, so an omitted field keeps its stored value; sending
    // null would blank it.
    const { user } = setup({ targets: { monthly_wins: 12 } })
    await user.type(screen.getByLabelText("Cost per lead"), "9")
    await save(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    const body = sentBody()
    expect(body.cpl).toBe(9)
    expect(body).not.toHaveProperty("monthly_revenue")
    expect(body).not.toHaveProperty("aov")
  })

  it("sends zero, which is a real target", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "0")
    await save(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(sentBody().monthly_wins).toBe(0)
  })

  it("refuses to submit an entirely empty form", async () => {
    const { toast } = await import("sonner")
    const { user } = setup()
    await save(user)
    expect(apiRequest).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it("notifies the page once saved", async () => {
    apiRequest.mockResolvedValue(ok({ targets: { monthly_wins: 12 } }))
    const { user, onSaved } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "12")
    await save(user)

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ monthly_wins: 12 }))
  })

  it("surfaces a failure instead of claiming success", async () => {
    const { toast } = await import("sonner")
    apiRequest.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const { user, onSaved } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "12")
    await save(user)

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onSaved).not.toHaveBeenCalled()
  })
})

describe("validation", () => {
  it("rejects a negative target", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Monthly revenue"), "-100")
    await save(user)

    expect(await screen.findByText(/cannot be negative/i)).toBeInTheDocument()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("clears an error once the field is edited", async () => {
    const { user } = setup()
    const field = screen.getByLabelText("Monthly revenue")
    await user.type(field, "-100")
    await save(user)
    expect(await screen.findByText(/cannot be negative/i)).toBeInTheDocument()

    await user.clear(field)
    await user.type(field, "100")
    expect(screen.queryByText(/cannot be negative/i)).not.toBeInTheDocument()
  })
})

describe("agency default", () => {
  it("is off unless ticked", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "12")
    await save(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(sentBody().save_as_default).toBe(false)
  })

  it("is sent when ticked", async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText("Monthly closes"), "12")
    await user.click(screen.getByRole("checkbox"))
    await save(user)

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(sentBody().save_as_default).toBe(true)
  })
})
