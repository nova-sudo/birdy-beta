import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))

import { apiRequest } from "@/lib/api"
import { threadDays } from "@/lib/lead-detail"
import { LeadThread } from "../LeadThread"
import { LeadComposer } from "../LeadComposer"

const msg = (extra = {}) => ({
  id: "m1",
  channel: "SMS",
  direction: "inbound",
  body: "Hello there",
  subject: null,
  status: "delivered",
  date: "2026-07-17T12:00:00+00:00",
  attachments: [],
  source: "app",
  ...extra,
})

const renderThread = (messages, props = {}) =>
  render(
    <LeadThread
      days={threadDays([], messages)}
      leadName="Rebecca Becirspahic"
      messagesStatus="ok"
      onRetry={() => {}}
      {...props}
    />
  )

beforeEach(() => vi.clearAllMocks())

describe("LeadThread messages", () => {
  it("puts inbound on the left with the lead's initials and outbound on the right", () => {
    renderThread([msg({ id: "a" }), msg({ id: "b", direction: "outbound", body: "Hi Rebecca" })])
    const inbound = screen.getByText("Hello there").closest("[data-direction]")
    const outbound = screen.getByText("Hi Rebecca").closest("[data-direction]")
    expect(inbound).toHaveAttribute("data-direction", "inbound")
    expect(inbound.className).toContain("justify-start")
    expect(inbound).toHaveTextContent("RB")
    expect(outbound).toHaveAttribute("data-direction", "outbound")
    expect(outbound.className).toContain("justify-end")
    expect(outbound).not.toHaveTextContent("RB")
  })

  it("shows a channel · time meta line", () => {
    renderThread([msg({ channel: "WhatsApp" })])
    expect(screen.getByText(/^WhatsApp · /)).toBeInTheDocument()
  })

  it("shows an email subject in bold and never renders the body as markup", () => {
    const { container } = renderThread([
      msg({ channel: "Email", subject: "Your quote", body: "<b>bold</b> <img src=x onerror=alert(1)>" }),
    ])
    expect(screen.getByText("Your quote").tagName).toBe("P")
    expect(screen.getByText("Your quote").className).toContain("font-semibold")
    expect(screen.getByText("<b>bold</b> <img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("b")).toBeNull()
    expect(screen.getByText(/^<b>bold/).className).toContain("whitespace-pre-wrap")
  })

  it("links attachments", () => {
    renderThread([msg({ attachments: ["https://x.test/a.jpg", "https://x.test/b.pdf"] })])
    expect(screen.getByRole("link", { name: "Attachment 1" })).toHaveAttribute("href", "https://x.test/a.jpg")
    expect(screen.getByRole("link", { name: "Attachment 2" })).toHaveAttribute("href", "https://x.test/b.pdf")
  })

  it("still renders calls", () => {
    const days = threadDays([{ id: "c", direction: "outbound", status: "completed", started_at: "2026-07-17T12:00:00+00:00" }], [])
    render(<LeadThread days={days} messagesStatus="ok" />)
    expect(screen.getByText("Outbound call · completed")).toBeInTheDocument()
    expect(screen.queryByText("No messages yet.")).toBeNull()
  })
})

describe("LeadThread status notes", () => {
  it("loading", () => {
    renderThread([], { messagesStatus: "loading" })
    expect(screen.getByText("Loading messages…")).toBeInTheDocument()
  })

  it("reconnect links to settings", () => {
    renderThread([], { messagesStatus: "reconnect" })
    expect(screen.getByText(/Reconnect GoHighLevel in Settings to see and send messages\./)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings")
  })

  it("unavailable offers a retry", async () => {
    const onRetry = vi.fn()
    renderThread([], { messagesStatus: "unavailable", onRetry })
    expect(screen.getByText("Messages couldn't be loaded.")).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("ok and empty says no messages yet", () => {
    renderThread([], { messagesStatus: "ok" })
    expect(screen.getByText("No messages yet.")).toBeInTheDocument()
  })

  it("renders the composer under the thread", () => {
    renderThread([], { composer: <div>composer slot</div> })
    expect(screen.getByText("composer slot")).toBeInTheDocument()
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
    await user.type(screen.getByPlaceholderText("Type a message…"), "  ")
    expect(sendButton()).toBeDisabled()
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
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

    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.click(sendButton())

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(sent))
    expect(apiRequest).toHaveBeenCalledWith("/api/leads/contact/c1/messages", {
      method: "POST",
      body: JSON.stringify({ channel: "SMS", message: "Hi" }),
    })
    expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("")
  })

  it("sends the subject with an email", async () => {
    vi.mocked(apiRequest).mockResolvedValue(okResponse(msg({ channel: "Email" })))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Email" }))
    await user.type(screen.getByLabelText("Subject"), "Quote")
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello")
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
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("Reconnect GoHighLevel to send messages")
    expect(onSent).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("Hi")
  })

  it("makes one request on a double click", async () => {
    let resolve
    vi.mocked(apiRequest).mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.dblClick(sendButton())
    expect(apiRequest).toHaveBeenCalledTimes(1)
    resolve(okResponse(msg()))
    await waitFor(() => expect(screen.getByPlaceholderText("Type a message…")).toHaveValue(""))
  })

  it("Enter sends SMS; Shift+Enter does not", async () => {
    vi.mocked(apiRequest).mockResolvedValue(okResponse(msg()))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    const box = screen.getByPlaceholderText("Type a message…")
    await user.type(box, "Hi{Shift>}{Enter}{/Shift}there")
    expect(apiRequest).not.toHaveBeenCalled()
    expect(box).toHaveValue("Hi\nthere")
    await user.type(box, "{Enter}")
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(1))
  })

  it("ignores Enter while an IME is composing", () => {
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    const box = screen.getByPlaceholderText("Type a message…")
    fireEvent.change(box, { target: { value: "こん" } })
    fireEvent.keyDown(box, { key: "Enter", isComposing: true })
    fireEvent.keyDown(box, { key: "Enter", keyCode: 229 })
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it("asks for a subject when an email has a body but no subject", async () => {
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.click(screen.getByRole("button", { name: "Email" }))
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hello")
    expect(screen.getByText("Add a subject")).toBeInTheDocument()
  })

  it("on a 504 shows the detail, clears the draft and calls onUnconfirmed", async () => {
    const detail = "We couldn't confirm the message was sent. Check the thread before sending again."
    vi.mocked(apiRequest).mockResolvedValue({ ok: false, status: 504, json: async () => ({ detail }) })
    const onSent = vi.fn()
    const onUnconfirmed = vi.fn()
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={onSent} onUnconfirmed={onUnconfirmed} />)
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent(detail)
    expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("")
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
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("GoHighLevel rejected the message.")
    expect(screen.getByPlaceholderText("Type a message…")).toHaveValue("Hi")
    expect(onUnconfirmed).not.toHaveBeenCalled()
  })

  it("posts to the route contactId", async () => {
    vi.mocked(apiRequest).mockResolvedValue(okResponse(msg()))
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} contactId="route-id" status="ok" onSent={() => {}} />)
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.click(sendButton())
    expect(apiRequest.mock.calls[0][0]).toBe("/api/leads/contact/route-id/messages")
  })

  it("shows the first msg of a pydantic detail list, or a fallback", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      ok: false, status: 422, json: async () => ({ detail: [{ msg: "String should have at most 1600 characters" }] }),
    })
    const user = userEvent.setup()
    render(<LeadComposer contact={contact} status="ok" onSent={() => {}} />)
    await user.type(screen.getByPlaceholderText("Type a message…"), "Hi")
    await user.click(sendButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("String should have at most 1600 characters")
    vi.mocked(apiRequest).mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    await user.click(sendButton())
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't send the message."))
  })
})

describe("LeadThread notes and keys", () => {
  it("shows the partial note only when status is ok", () => {
    const { rerender } = renderThread([msg()], { messagesNote: "Some messages couldn't be loaded." })
    expect(screen.getByText("Some messages couldn't be loaded.")).toBeInTheDocument()
    rerender(<LeadThread days={threadDays([], [msg()])} messagesStatus="unavailable" messagesNote="Some messages couldn't be loaded." />)
    expect(screen.queryByText("Some messages couldn't be loaded.")).toBeNull()
  })

  it("tolerates duplicate attachment urls", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    renderThread([msg({ attachments: ["https://x.test/a", "https://x.test/a"] })])
    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
