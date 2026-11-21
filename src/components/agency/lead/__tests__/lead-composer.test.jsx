import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"

// The composer sends a real SMS or email to a real person. These pin the old
// page's send flow, unchanged, and that a send only ever follows an explicit
// Send: the button, or Enter in an SMS.

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { LeadComposer } from "../lead-composer"

const msg = (extra = {}) => ({
  id: "m1", channel: "SMS", direction: "outbound", body: "Hi", subject: null, status: "delivered",
  date: "2026-07-17T12:00:00+00:00", attachments: [], source: "app", ...extra,
})
const box = () => screen.getByRole("textbox", { name: "Message" })

beforeEach(() => vi.clearAllMocks())

describe("LeadComposer: nothing sends without an explicit Send", () => {
  const contact = { id: "c1", phone: "07393 421825", email: "a@b.co" }

  it("makes no request on render, typing, switching channel or leaving the box", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.type(box(), "Hello there")
    await user.click(screen.getByRole("button", { name: "Email" }))
    await user.type(screen.getByLabelText("Subject"), "Quote")
    await user.click(screen.getByRole("button", { name: "SMS" }))
    await user.tab()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("Enter in an email adds a line and does not send", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Email" }))
    await user.type(screen.getByLabelText("Subject"), "Quote")
    await user.type(box(), "Hello{Enter}there")
    expect(box()).toHaveValue("Hello\nthere")
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("never sends while Send is off, even with a draft", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="reconnect" onSent={() => {}} />)
    await user.type(box(), "Hi{Enter}")
    fireEvent.submit(box().closest("form"))
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("sends exactly once on one click of Send", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, status: 201, json: async () => ({ message: msg() }) })
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.type(box(), "Hi")
    expect(apiRequest).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: /^send$/i }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))
    expect(apiRequest.mock.calls[0][1].method).toBe("POST")
  })
})

describe("LeadComposer", () => {
  const contact = { id: "c1", phone: "07393 421825", email: "a@b.co" }
  const okResponse = (message) => ({ ok: true, status: 201, json: async () => ({ message }) })
  const sendButton = () => screen.getByRole("button", { name: /^send$/i })

  it("is disabled with a reason when GHL needs reconnecting", () => {
    render(<LeadComposer contact={contact} status="reconnect" onSent={() => {}} />)
    expect(sendButton()).toBeDisabled()
    expect(screen.getByText("Reconnect GoHighLevel to send messages.")).toBeInTheDocument()
  })

  it("is disabled while messages load or are unavailable", () => {
    const { rerender } = render(<LeadComposer contact={contact} status="loading" onSent={() => {}} />)
    expect(sendButton()).toBeDisabled()
    rerender(<LeadComposer contact={contact} status="unavailable" onSent={() => {}} />)
    expect(sendButton()).toBeDisabled()
  })

  it("explains a missing phone for SMS and a missing email for Email", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={{ id: "c1", phone: null, email: null }} status="ok" onSent={() => {}} />)
    expect(screen.getByText("No phone number")).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Email" }))
    expect(screen.getByText("No email address")).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
  })

  it("is disabled until there is a body, and Email needs a subject field", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    expect(sendButton()).toBeDisabled()
    expect(screen.queryByLabelText("Subject")).toBeNull()
    await user.type(box(), "  ")
    expect(sendButton()).toBeDisabled()
    await user.type(box(), "Hi")
    expect(sendButton()).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Email" }))
    expect(screen.getByLabelText("Subject")).toBeInTheDocument()
    expect(sendButton()).toBeDisabled()
    await user.type(screen.getByLabelText("Subject"), "Quote")
    expect(sendButton()).toBeEnabled()
  })

  it("posts, hands the message to onSent and clears the inputs", async () => {
    const sent = msg({ id: "new", direction: "outbound", body: "Hi" })
    vi.mocked(apiRequest).mockResolvedValue(okResponse(sent))
    const onSent = vi.fn()
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={onSent} />)

    await user.type(box(), "Hi")
    await user.click(sendButton())

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(sent))
    expect(apiRequest).toHaveBeenCalledWith("/api/leads/contact/c1/messages", {
      method: "POST",
      body: JSON.stringify({ channel: "SMS", message: "Hi" }),
    })
    expect(box()).toHaveValue("")
  })

  it("sends the subject with an email", async () => {
    vi.mocked(apiRequest).mockResolvedValue(okResponse(msg({ channel: "Email" })))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Email" }))
    await user.type(screen.getByLabelText("Subject"), "Quote")
    await user.type(box(), "Hello")
    await user.click(sendButton())
    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(JSON.parse(vi.mocked(apiRequest).mock.calls[0][1].body)).toEqual({
      channel: "Email",
      message: "Hello",
      subject: "Quote",
    })
  })

  it("shows the backend detail on error and keeps the draft", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Reconnect GoHighLevel to send messages" }),
    })
    const onSent = vi.fn()
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={onSent} />)
    await user.type(box(), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("Reconnect GoHighLevel to send messages")
    expect(onSent).not.toHaveBeenCalled()
    expect(box()).toHaveValue("Hi")
  })

  it("makes one request on a double click", async () => {
    let resolve
    vi.mocked(apiRequest).mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.type(box(), "Hi")
    await user.dblClick(sendButton())
    expect(apiRequest).toHaveBeenCalledTimes(1)
    resolve(okResponse(msg()))
    await waitFor(() => expect(box()).toHaveValue(""))
  })

  it("Enter sends SMS; Shift+Enter does not", async () => {
    vi.mocked(apiRequest).mockResolvedValue(okResponse(msg()))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    const input = box()
    await user.type(input, "Hi{Shift>}{Enter}{/Shift}there")
    expect(apiRequest).not.toHaveBeenCalled()
    expect(input).toHaveValue("Hi\nthere")
    await user.type(input, "{Enter}")
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))
  })

  it("ignores Enter while an IME is composing", () => {
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    const input = box()
    fireEvent.change(input, { target: { value: "こん" } })
    fireEvent.keyDown(input, { key: "Enter", isComposing: true })
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("asks for a subject when an email has a body but no subject", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Email" }))
    await user.type(box(), "Hello")
    expect(screen.getByText("Add a subject")).toBeInTheDocument()
  })

  it("on a 504 shows the detail, clears the draft and calls onUnconfirmed", async () => {
    const detail = "We couldn't confirm the message was sent. Check the thread before sending again."
    vi.mocked(apiRequest).mockResolvedValue({ ok: false, status: 504, json: async () => ({ detail }) })
    const onSent = vi.fn()
    const onUnconfirmed = vi.fn()
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={onSent} onUnconfirmed={onUnconfirmed} />)
    await user.type(box(), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent(detail)
    expect(box()).toHaveValue("")
    expect(onUnconfirmed).toHaveBeenCalledTimes(1)
    expect(onSent).not.toHaveBeenCalled()
  })

  it("on a 502 keeps the draft and does not call onUnconfirmed", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false, status: 502, json: async () => ({ detail: "GoHighLevel rejected the message." }),
    })
    const onUnconfirmed = vi.fn()
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} onUnconfirmed={onUnconfirmed} />)
    await user.type(box(), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("GoHighLevel rejected the message.")
    expect(box()).toHaveValue("Hi")
    expect(onUnconfirmed).not.toHaveBeenCalled()
  })

  it("posts to the route contactId", async () => {
    vi.mocked(apiRequest).mockResolvedValue(okResponse(msg()))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} contactId="route-id" status="ok" onSent={() => {}} />)
    await user.type(box(), "Hi")
    await user.click(sendButton())
    expect(apiRequest.mock.calls[0][0]).toBe("/api/leads/contact/route-id/messages")
  })

  it("shows the first msg of a pydantic detail list, or a fallback", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      ok: false, status: 422, json: async () => ({ detail: [{ msg: "String should have at most 1600 characters" }] }),
    })
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.type(box(), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("String should have at most 1600 characters")
    vi.mocked(apiRequest).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    await user.click(sendButton())
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't send the message."))
  })
})
