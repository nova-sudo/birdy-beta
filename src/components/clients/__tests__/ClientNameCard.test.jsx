// The name card on the Details tab of the Client Detail settings modal.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
const toast = { success: vi.fn(), error: vi.fn() }
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("sonner", () => ({ toast }))

const { ClientNameCard } = await import("@/components/clients/ClientNameCard")

const respond = (status, body = {}) => ({ ok: status < 400, status, json: async () => body })

function setup(props = {}) {
  const onRenamed = vi.fn()
  const view = render(<ClientNameCard clientId="g1" name="Aura" onRenamed={onRenamed} {...props} />)
  return { ...view, user: userEvent.setup(), onRenamed, input: screen.getByLabelText("Client name") }
}

const saveButton = () => screen.getByRole("button", { name: "Save" })

beforeEach(() => {
  apiRequest.mockReset()
  toast.success.mockReset()
  toast.error.mockReset()
})

describe("ClientNameCard", () => {
  it("only enables Save once the name has really changed", async () => {
    const { user, input } = setup()
    expect(saveButton()).toBeDisabled()

    await user.type(input, " Clinic")
    expect(saveButton()).toBeEnabled()

    await user.clear(input)
    await user.type(input, "  Aura  ")
    expect(saveButton()).toBeDisabled()
  })

  it("asks for a name when the field is blank", async () => {
    const { user, input } = setup()
    await user.clear(input)
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a client name.")
    expect(saveButton()).toBeDisabled()
  })

  it("saves the trimmed name and reports it", async () => {
    apiRequest.mockResolvedValue(respond(200, { name: "Aura Clinic" }))
    const { user, input, onRenamed } = setup()
    await user.clear(input)
    await user.type(input, "  Aura Clinic ")
    await user.click(saveButton())

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("Aura Clinic"))
    const [url, options] = apiRequest.mock.calls[0]
    expect(url).toBe("/api/client-groups/g1/name")
    expect(options.method).toBe("PATCH")
    expect(JSON.parse(options.body)).toEqual({ name: "Aura Clinic" })
    expect(toast.success).toHaveBeenCalledWith("Client renamed to Aura Clinic")
  })

  it("saves when Enter is pressed", async () => {
    apiRequest.mockResolvedValue(respond(200, { name: "Aura Clinic" }))
    const { user, input, onRenamed } = setup()
    await user.type(input, " Clinic{Enter}")
    await waitFor(() => expect(onRenamed).toHaveBeenCalled())
  })

  it("encodes client ids that aren't URL safe", async () => {
    apiRequest.mockResolvedValue(respond(200, { name: "New" }))
    const { user, input } = setup({ clientId: "a/b.c" })
    await user.type(input, "!{Enter}")
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(apiRequest.mock.calls[0][0]).toBe("/api/client-groups/a%2Fb.c/name")
  })

  it("shows the API's reason when it refuses the name", async () => {
    apiRequest.mockResolvedValue(respond(400, { detail: "Client names can be up to 100 characters." }))
    const { user, input, onRenamed } = setup()
    await user.type(input, "!{Enter}")
    expect(await screen.findByRole("alert")).toHaveTextContent("up to 100 characters")
    expect(onRenamed).not.toHaveBeenCalled()
  })

  it("keeps what was typed when the save fails", async () => {
    apiRequest.mockResolvedValue(respond(500))
    const { user, input, onRenamed } = setup()
    await user.type(input, " Clinic{Enter}")
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(input).toHaveValue("Aura Clinic")
    expect(saveButton()).toBeEnabled()
    expect(onRenamed).not.toHaveBeenCalled()
  })

  it("follows the saved name when it changes", () => {
    const { rerender, input } = setup()
    rerender(<ClientNameCard clientId="g1" name="Aura Clinic" />)
    expect(input).toHaveValue("Aura Clinic")
  })

  it("stays disabled until the client has loaded", () => {
    const { input } = setup({ name: undefined })
    expect(input).toBeDisabled()
  })
})
