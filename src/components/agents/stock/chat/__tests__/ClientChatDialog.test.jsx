import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(), API_BASE_URL: "http://api.test" }))
vi.mock("@/lib/jobs-store", () => ({ startJob: vi.fn(), finishJob: vi.fn() }))
vi.mock("@/lib/ask-birdy", () => ({ openBirdyChat: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: () => <span data-testid="birdy-avatar" /> }))

const revalidateStock = vi.fn(() => Promise.resolve())
vi.mock("@/lib/stock-agent-api", async (importOriginal) => ({
  ...(await importOriginal()),
  revalidateStock: (...a) => revalidateStock(...a),
  useCardChat: () => ({ sessionId: null, messages: [], isLoading: false }),
  useStockActions: () => ({}),
}))

// The real chat needs AI keys, credits and the client list; this stand-in renders what the dialog hands it.
vi.mock("@/components/chat/ChatConversation", async () => {
  const { useChat } = await import("@/lib/chat-store")
  return {
    default: function ChatStub(props) {
      const { messages } = useChat(props.sessionKey)
      const { onMessagesChange } = props
      useEffect(() => onMessagesChange?.(messages), [messages, onMessagesChange])
      return (
        <div data-testid="chat" data-page={props.page} data-card={props.cardId} data-read-only={String(Boolean(props.cardReadOnly))} data-key={props.sessionKey}>
          {props.intro}
          {messages.map((m, i) => (
            <div key={i}>
              <p>{m.content}</p>
              {m.role !== "user" && props.renderAfterMessage?.(m, i)}
            </div>
          ))}
          {props.composerTop}
          <input aria-label="Message" placeholder={props.composerPlaceholder} />
        </div>
      )
    },
  }
})

import { appendMessage, resetChat } from "@/lib/chat-store"
import { ClientChatDialog } from "../ClientChatDialog"

const line = (id, over = {}) => ({ id, kind: "remove", state: "proposed", mode: "ask", ad_name: `Ad ${id}`, spend: 20, leads: 0, cpl: null, flags: [], ...over })
const CARD = {
  id: "c1",
  client_group_id: "g1",
  client_name: "Cloud Nine Beauty",
  currency: "GBP",
  status: "open",
  can_apply: true,
  zone: "red",
  previous_cpl: 12.57,
  current_cpl: 5.9,
  leads: 19,
  spend: 112.15,
  ads_live: 3,
  lines: [line("l1"), line("l2")],
}
const ROW = { gid: "g1", name: "Cloud Nine Beauty", leads: 19, cpl: 5.9, spend: 112.15, zone: "red", currency: "GBP", readOnly: false, targets: { green_under: 4, red_over: 6 } }

const renderDialog = (props = {}) => {
  const actions = { applyCard: vi.fn(), attachLineFile: vi.fn() }
  const handlers = { onClose: vi.fn(), onNext: vi.fn(), onSetTargets: vi.fn() }
  render(
    <ClientChatDialog
      agentId="s1"
      card={CARD}
      row={ROW}
      alerts={[]}
      nextClient={{ gid: "g2", name: "Aura" }}
      leftToDecide={15}
      actions={actions}
      {...handlers}
      {...props}
    />
  )
  return { actions, ...handlers }
}

beforeEach(() => {
  revalidateStock.mockClear()
  resetChat("stock_card:c1")
})

describe("ClientChatDialog", () => {
  it("opens on Birdy's own opening, scoped to the card", () => {
    renderDialog()
    expect(screen.getByRole("dialog", { name: "Cloud Nine Beauty" })).toBeInTheDocument()
    const chat = screen.getByTestId("chat")
    expect(chat).toHaveAttribute("data-page", "stock_card")
    expect(chat).toHaveAttribute("data-card", "c1")
    expect(chat).toHaveAttribute("data-key", "stock_card:c1")
    expect(chat).toHaveAttribute("data-read-only", "false")
    expect(screen.getByText("Here's what I'd do:")).toBeInTheDocument()
    expect(screen.getByText("Want me to do all 2?")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Tell Birdy what to do…")).toBeInTheDocument()
    expect(screen.getByText("15 left to decide")).toBeInTheDocument()
  })

  it("yes to all calls applyCard and shows per-line results", async () => {
    const { actions } = renderDialog()
    actions.applyCard.mockResolvedValue({ ok: true, outcome: "applied", card: { ...CARD, status: "applied", can_apply: false, lines: CARD.lines.map((ln) => ({ ...ln, state: "applied" })) } })
    fireEvent.click(screen.getByRole("button", { name: "Yes to all 2" }))
    await waitFor(() => expect(actions.applyCard).toHaveBeenCalledWith("c1"))
    expect(await screen.findByText("Done. Both changes are applied.")).toBeInTheDocument()
    const results = screen.getByRole("list", { name: "What happened to each change" })
    expect(results).toHaveTextContent("Remove - Ad l1")
    expect(results).toHaveTextContent("Remove - Ad l2")
    expect(results.querySelectorAll("[data-slot=badge]")).toHaveLength(2)
  })

  it("failed line shows reason", async () => {
    const { actions } = renderDialog()
    actions.applyCard.mockResolvedValue({
      ok: true,
      outcome: "partial",
      card: { ...CARD, status: "partly_applied", lines: [{ ...CARD.lines[0], state: "applied" }, { ...CARD.lines[1], state: "failed", error: "Meta refused the change." }] },
    })
    fireEvent.click(screen.getByRole("button", { name: "Yes to all 2" }))
    expect(await screen.findByText("1 applied, 1 failed.")).toBeInTheDocument()
    expect(screen.getByText("Meta refused the change.")).toBeInTheDocument()
  })

  it("revalidates on agent_changes", async () => {
    renderDialog()
    act(() => appendMessage("stock_card:c1", { role: "assistant", content: "Skipped it.", agent_changes: [{ tool: "dismiss_card", changed: "dismissed" }] }))
    await waitFor(() => expect(revalidateStock).toHaveBeenCalledTimes(1))
    expect(revalidateStock.mock.calls[0][1]).toBe("s1")
    expect(screen.getByText("Card skipped")).toBeInTheDocument()
    // a lesson re-reads too, so the Lessons tab shows it
    act(() => appendMessage("stock_card:c1", { role: "assistant", content: "Saved.", agent_changes: [{ tool: "add_lesson", changed: "lesson" }] }))
    expect(await screen.findByText("Lesson saved")).toBeInTheDocument()
    await waitFor(() => expect(revalidateStock).toHaveBeenCalledTimes(2))
  })

  it.each([
    ["apply_failed", "Meta refused both."],
    ["stale", "Slack already applied this card."],
  ])("revalidates on %s, the lines moved without the sheet", async (changed, content) => {
    renderDialog()
    act(() => appendMessage("stock_card:c1", { role: "assistant", content, agent_changes: [{ tool: "apply_card_lines", changed }] }))
    await waitFor(() => expect(revalidateStock).toHaveBeenCalledTimes(1))
  })

  it("doesn't revalidate on a reply that changed nothing", async () => {
    renderDialog()
    act(() => appendMessage("stock_card:c1", { role: "assistant", content: "It's red because CPL rose." }))
    expect(await screen.findByText("It's red because CPL rose.")).toBeInTheDocument()
    expect(revalidateStock).not.toHaveBeenCalled()
  })

  it("skip goes to next client", () => {
    const { onNext } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Skip for now: Aura ›" }))
    expect(onNext).toHaveBeenCalledWith({ gid: "g2", name: "Aura" })
  })

  it("read-only card hides Yes to all", () => {
    renderDialog({ row: { ...ROW, readOnly: true } })
    expect(screen.queryByRole("button", { name: /Yes to all/ })).not.toBeInTheDocument()
    expect(screen.getByText(/^Read-only\./)).toBeInTheDocument()
    expect(screen.queryByText(/left to decide/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Ask about this report…")).toBeInTheDocument()
    // the server is told too, so the card tools refuse even when the card is still open
    expect(screen.getByTestId("chat")).toHaveAttribute("data-read-only", "true")
  })

  it("Set targets shows without a target and hands the client to Settings", () => {
    const { onSetTargets } = renderDialog({ row: { ...ROW, targets: null } })
    fireEvent.click(screen.getByRole("button", { name: "Set targets" }))
    expect(onSetTargets).toHaveBeenCalledWith("g1")
  })
})
