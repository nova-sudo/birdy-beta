// The props the agent setup chat uses: a local opening message, content over the composer,
// and a send that the surface takes over (it creates the agent first).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }), Toaster: () => null }))
const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...a) => apiRequest(...a) }))
vi.mock("@/hooks/useAiCredentials", () => ({
  useAiCredentials: () => ({ configured: true, refresh: vi.fn(), markUnconfigured: vi.fn() }),
}))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [] }) }))
vi.mock("@/lib/view-catalogues", () => ({ announceViewOps: vi.fn(), readViewCatalogues: () => [] }))

const { default: ChatConversation } = await import("@/components/chat/ChatConversation")

beforeEach(() => {
  apiRequest.mockReset()
  Element.prototype.scrollTo = vi.fn()
})

const key = () => `setup-${Math.random()}`

describe("ChatConversation setup props", () => {
  it("shows the intro message as Birdy's first bubble instead of the empty state", () => {
    render(
      <ChatConversation
        sessionKey={key()}
        introMessage="Let's build this one from scratch. **What should the agent do?**"
        emptyStateTitle="Empty title"
        aboveComposer={<button type="button">Pause ads that cost too much</button>}
      />
    )
    expect(screen.getByText("What should the agent do?")).toBeInTheDocument()
    expect(screen.queryByText("Empty title")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pause ads that cost too much" })).toBeInTheDocument()
  })

  it("interceptSend takes the message; false keeps the text in the composer", async () => {
    const interceptSend = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<ChatConversation sessionKey={key()} interceptSend={interceptSend} showScopePicker={false} />)
    const box = screen.getByRole("textbox")
    await userEvent.type(box, "Pause expensive ads")
    await userEvent.click(screen.getByLabelText("Send message"))
    await waitFor(() => expect(interceptSend).toHaveBeenCalledWith("Pause expensive ads"))
    expect(box).toHaveValue("Pause expensive ads")

    await userEvent.click(screen.getByLabelText("Send message"))
    await waitFor(() => expect(box).toHaveValue(""))
    expect(interceptSend).toHaveBeenCalledTimes(2)
    expect(apiRequest).not.toHaveBeenCalledWith("/api/chat", expect.anything())
  })
})
