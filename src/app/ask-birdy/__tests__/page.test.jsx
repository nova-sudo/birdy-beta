// Ask Birdy — the conversation sidebar.
//
// History is server-side now, so these cover what the page does with the
// conversations API. ChatConversation is stubbed to a button that fires
// onMessagesChange, and records the props it receives — chiefly `sessionId`,
// which is what decides whether an opened chat actually continues or silently
// starts over with the old transcript on screen.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// next/font hits the network at module load, which a unit test has no business
// doing — the class names are all the page uses.
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

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

  it("is marked unsaved until the first reply gives it a scope", async () => {
    // A chat with no server row yet has no scope to claim, so it says so
    // rather than asserting it is global and then possibly changing its mind.
    seed([])
    render(<AskBirdyPage />)

    expect(await screen.findByText(/not saved yet/i)).toBeInTheDocument()
  })
})

// ── global vs client scope ────────────────────────────────────────────────
//
// The whole point of the redesign: which conversations are about the
// workspace and which are about one client, visible without opening them.
// Scope is decided server-side and arrives on each row; the page only has to
// show it consistently in the four places the handoff calls for — the row
// badge, the header badge, the header description, and the composer
// placeholder.

describe("conversation scope", () => {
  const globalConvo = (id, title) =>
    convo(id, title, { scope: "global", client_group_id: null, client_name: null })
  const clientConvo = (id, title, name = "Aura") =>
    convo(id, title, { scope: "client", client_group_id: "g1", client_name: name })

  // The filter control also spells "Global", so a bare text query would match
  // it too — badges are asserted on the row they belong to.
  const rowFor = async (title) =>
    (await screen.findByText(title)).closest("button")

  it("badges each row as global or as its client", async () => {
    seed([globalConvo("s1", "Whole account"), clientConvo("s2", "Aura's CPL")])
    render(<AskBirdyPage />)

    expect(within(await rowFor("Whole account")).getByText("Global")).toBeInTheDocument()
    expect(within(await rowFor("Aura's CPL")).getByText("Aura")).toBeInTheDocument()
  })

  it("filters the list down to client conversations", async () => {
    seed([globalConvo("s1", "Whole account"), clientConvo("s2", "Aura's CPL")])
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByRole("radio", { name: "Clients" }))

    expect(screen.getByText("Aura's CPL")).toBeInTheDocument()
    expect(screen.queryByText("Whole account")).not.toBeInTheDocument()
  })

  it("filters the list down to global conversations", async () => {
    seed([globalConvo("s1", "Whole account"), clientConvo("s2", "Aura's CPL")])
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByRole("radio", { name: "Global" }))

    expect(screen.getByText("Whole account")).toBeInTheDocument()
    expect(screen.queryByText("Aura's CPL")).not.toBeInTheDocument()
  })

  it("does not change the open conversation when the filter changes", async () => {
    // The filter is a view of the list, not a navigation control — filtering
    // a thread out of sight must not close it.
    seed([globalConvo("s1", "Whole account"), clientConvo("s2", "Aura's CPL")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s2", messages: [{ role: "user", content: "Aura's CPL" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Aura's CPL"))
    await waitFor(() => expect(chatProps.current.sessionId).toBe("s2"))

    await user.click(screen.getByRole("radio", { name: "Global" }))
    expect(chatProps.current.sessionId).toBe("s2")
  })

  it("badges an open client conversation with that client, in the header", async () => {
    seed([clientConvo("s1", "Aura's CPL")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1", messages: [{ role: "user", content: "Aura's CPL" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Aura's CPL"))

    expect(await screen.findByText(/Aura · client conversation/)).toBeInTheDocument()
  })

  it("badges an open workspace conversation as global", async () => {
    seed([globalConvo("s1", "Whole account")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1", messages: [{ role: "user", content: "Whole account" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Whole account"))

    expect(await screen.findByText("Global conversation")).toBeInTheDocument()
  })

  it("names the client in the composer placeholder", async () => {
    seed([clientConvo("s1", "Aura's CPL")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1", messages: [{ role: "user", content: "Aura's CPL" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Aura's CPL"))

    await waitFor(() =>
      expect(chatProps.current.composerPlaceholder).toMatch(/about Aura/i)
    )
  })

  it("never pins the chat to a client, so a thread can pivot to another", async () => {
    // Passing clientGroupId would pin every analysis tool to that client
    // server-side. Right on a client's own page, wrong on the workspace hub.
    seed([clientConvo("s1", "Aura's CPL")])
    apiRequest.mockResolvedValueOnce(ok({
      session_id: "s1", messages: [{ role: "user", content: "Aura's CPL" }],
    }))
    const user = userEvent.setup()
    render(<AskBirdyPage />)

    await user.click(await screen.findByText("Aura's CPL"))
    await waitFor(() => expect(chatProps.current.sessionId).toBe("s1"))

    expect(chatProps.current.clientGroupId ?? null).toBeNull()
  })

  it("treats a row with no scope field as global", async () => {
    // Threads archived before scope existed carry none; they must not fall
    // out of the list or render a blank badge.
    seed([convo("s1", "Older thread")])
    render(<AskBirdyPage />)

    expect(within(await rowFor("Older thread")).getByText("Global")).toBeInTheDocument()
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
