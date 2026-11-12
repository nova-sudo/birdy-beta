// Without an AI key, a surface that built its own opening (the Media Buying card chat) keeps it and its
// quick replies, because "Yes to all" needs no AI (spec §7). Plain chats still show the key empty state.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }), Toaster: () => null }))
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }))
vi.mock("@/hooks/useAiCredentials", () => ({
  useAiCredentials: () => ({ configured: false, refresh: vi.fn(), markUnconfigured: vi.fn() }),
}))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [] }) }))
vi.mock("@/lib/view-catalogues", () => ({ announceViewOps: vi.fn(), readViewCatalogues: () => [] }))

const { default: ChatConversation } = await import("@/components/chat/ChatConversation")

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn()
})

const key = () => `nokey-${Math.random()}`

describe("ChatConversation without an AI key", () => {
  it("keeps a page-built opening and quick replies, with a link to add a key", () => {
    render(
      <ChatConversation
        sessionKey={key()}
        showScopePicker={false}
        intro={<p>Two ads to pause on Aura.</p>}
        composerTop={<button type="button">Yes to all 2</button>}
      />
    )
    expect(screen.getByText("Two ads to pause on Aura.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Yes to all 2" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Add your AI key" })).toHaveAttribute("href", "/settings?tab=integrations")
  })

  it("a plain chat still shows the add-a-key empty state", () => {
    render(<ChatConversation sessionKey={key()} />)
    expect(screen.getByRole("link", { name: /Go to Settings/ })).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
})
