// Ask Birdy — the conversation sidebar.
//
// History is server-side now, so these cover what the page does with the
// conversations API. ChatConversation is stubbed to a button that fires
// onMessagesChange, and records the props it receives — chiefly `sessionId`,
// which is what decides whether an opened chat actually continues or silently
// starts over with the old transcript on screen.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const chatProps = { current: null }
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    chatProps.current = props
    return (
      <div>
        <button onClick={() => props.onSessionId?.("chat_assigned")}>
          fire-session
        </button>
        <button
          onClick={() => props.onMessagesChange?.([
            { role: "user", content: "hi" },
            { role: "assistant", content: "hello" },
          ])}
        >
          fire-reply
        </button>
      </div>
    )
  },
}))

const AskBirdyPage = (await import("@/app/ask-birdy/page")).default

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status) => ({ ok: false, status, json: async () => ({}) })

const convo = (session_id, title, over = {}) => ({
  session_id,
  title,
  message_count: 2,
  created_at: "2026-08-20T10:00:00.000Z",
  updated_at: "2026-08-20T10:00:00.000Z",
  ...over,
})

/** Queue the initial list fetch. */
function seed(conversations = []) {
  apiRequest.mockReset()
  apiRequest.mockResolvedValueOnce(ok({ conversations }))
}

beforeEach(() => {
  apiRequest.mockReset()
  chatProps.current = null
})

describe("loading history", () => {
  it("lists the conversations the server returns", async () => {
    seed([convo("s1", "What is my CPL?"), convo("s2", "Lead summary")])
    render(<AskBirdyPage />)

    expect(await screen.findByText("What is my CPL?")).toBeInTheDocument()
    expect(screen.getByText("Lead summary")).toBeInTheDocument()
  })

  it("asks the conversations endpoint", async () => {
    seed()
    render(<AskBirdyPage />)
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/chat/conversations")
    )
  })

  it("shows an empty state when there is no history", async () => {
    seed([])
    render(<AskBirdyPage />)
    expect(await screen.findByText(/no conversations yet/i)).toBeInTheDocument()
  })

  it("degrades quietly when the list cannot be loaded", async () => {
    apiRequest.mockReset()
    apiRequest.mockRejectedValueOnce(new Error("offline"))
    render(<AskBirdyPage />)
    expect(await screen.findByText(/no conversations yet/i)).toBeInTheDocument()
  })

  it("shows the message count alongside each chat", async () => {
    seed([convo("s1", "A chat", { message_count: 8 })])
    render(<AskBirdyPage />)
    expect(await screen.findByText(/8 messages/)).toBeInTheDocument()
  })
})

describe("opening a conversation", () => {
  it("fetches that conversation's messages", async () => {
    seed([convo("s1", "What is my CPL?")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1",
      messages: [{ role: "user", content: "What is my CPL?" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("What is my CPL?"))

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/api/chat/conversations/s1")
    )
  })

  it("hands the chat its session id, so the thread actually continues", async () => {
    // The bug this replaces: the transcript was restored from localStorage
    // while the session id was lost, so the model answered follow-ups with no
    // memory of anything on screen.
    seed([convo("s1", "Earlier chat")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1",
      messages: [{ role: "user", content: "Earlier chat" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Earlier chat"))

    await waitFor(() => expect(chatProps.current.sessionId).toBe("s1"))
  })

  it("seeds the pane with the stored messages", async () => {
    seed([convo("s1", "Earlier chat")])
    const messages = [
      { role: "user", content: "Earlier chat" },
      { role: "assistant", content: "Sure." },
    ]
    apiRequest.mockResolvedValueOnce(ok({ session_id: "s1", messages }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Earlier chat"))

    await waitFor(() =>
      expect(chatProps.current.initialMessages).toEqual(messages)
    )
  })

  it("surfaces a failure to open instead of showing a blank chat", async () => {
    const { toast } = await import("sonner")
    seed([convo("s1", "Earlier chat")])
    apiRequest.mockResolvedValueOnce(fail(500))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Earlier chat"))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })
})

describe("starting a new chat", () => {
  it("opens with no session id and no messages", async () => {
    seed([convo("s1", "Earlier chat")])
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByRole("button", { name: /new chat/i }))

    expect(chatProps.current.sessionId).toBeNull()
    expect(chatProps.current.initialMessages).toEqual([])
  })

  it("adopts the session id the first reply assigns", async () => {
    // Without this, a second message in a brand-new chat would start yet
    // another thread instead of continuing the one just created.
    seed([])
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await waitFor(() => expect(chatProps.current).not.toBeNull())
    await user.click(screen.getByText("fire-session"))

    await waitFor(() => expect(chatProps.current.sessionId).toBe("chat_assigned"))
  })

  it("sends a suggestion straight into a fresh chat", async () => {
    seed([])
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByRole("tab", { name: /suggested/i }))
    await user.click(screen.getByText("How many leads did I get this week?"))

    await waitFor(() =>
      expect(chatProps.current.initialMessage).toBe(
        "How many leads did I get this week?"
      )
    )
  })
})

describe("refreshing the list", () => {
  it("reloads history once a reply lands, so the new chat appears", async () => {
    seed([])
    apiRequest.mockResolvedValueOnce(ok({
      conversations: [convo("chat_assigned", "hi")],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await waitFor(() => expect(chatProps.current).not.toBeNull())
    await user.click(screen.getByText("fire-reply"))

    expect(await screen.findByText("hi")).toBeInTheDocument()
  })
})

describe("deleting", () => {
  it("calls the endpoint and drops the row", async () => {
    seed([convo("s1", "Delete me"), convo("s2", "Keep me")])
    apiRequest.mockResolvedValueOnce(ok({ success: true, deleted: 2 }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(
      await screen.findByRole("button", { name: /delete conversation: delete me/i })
    )

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/api/chat/conversations/s1",
        { method: "DELETE" }
      )
    )
    await waitFor(() =>
      expect(screen.queryByText("Delete me")).not.toBeInTheDocument()
    )
    expect(screen.getByText("Keep me")).toBeInTheDocument()
  })

  it("keeps the row when the request fails", async () => {
    seed([convo("s1", "Delete me")])
    apiRequest.mockResolvedValueOnce(fail(500))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(
      await screen.findByRole("button", { name: /delete conversation: delete me/i })
    )

    await waitFor(async () => {
      const { toast } = await import("sonner")
      expect(toast.error).toHaveBeenCalled()
    })
    expect(screen.getByText("Delete me")).toBeInTheDocument()
  })

  it("resets to a new chat when the open conversation is deleted", async () => {
    seed([convo("s1", "Open one")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1",
      messages: [{ role: "user", content: "Open one" }],
    }))
    apiRequest.mockResolvedValueOnce(ok({ success: true, deleted: 2 }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Open one"))
    await waitFor(() => expect(chatProps.current.sessionId).toBe("s1"))

    await user.click(
      screen.getByRole("button", { name: /delete conversation: open one/i })
    )

    await waitFor(() => expect(chatProps.current.sessionId).toBeNull())
  })

  it("exposes delete as its own button, not nested inside the row button", async () => {
    seed([convo("s1", "A chat")])
    render(<AskBirdyPage />)

    const del = await screen.findByRole("button", {
      name: /delete conversation: a chat/i,
    })
    expect(del.closest("button")).toBe(del)
  })
})
