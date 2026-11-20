// The full chat page's composer follows the thread when an agent's part is docked on the right.
import { describe, it, expect, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import "@/components/by/__tests__/jsdom"
import { AgencyChat } from "../chat/agency-chat"

const dock = { tell: null }
vi.mock("../chat/thread", () => ({ ChatThread: ({ onDock }) => { dock.tell = onDock; return null } }))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 0 }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/dashboard/chat", useSearchParams: () => new URLSearchParams("") }))
vi.mock("@/lib/api", () => ({ apiRequest: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ conversations: [] }) }) }))
vi.mock("@/lib/chat-store", () => ({
  useChat: () => ({ messages: [{ role: "user", content: "Hi" }], loading: false, sessionId: null, submittedUIs: [] }),
  sendChatMessage: vi.fn(), markUISubmitted: vi.fn(), resetChat: vi.fn(), hydrateChat: vi.fn(), syncProposals: vi.fn(),
}))
vi.mock("@/hooks/useAiCredentials", () => ({ useAiCredentials: () => ({ configured: true, loading: false, refresh: vi.fn(), markUnconfigured: vi.fn() }) }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ blocked: false, refresh: vi.fn() }) }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [] }) }))
vi.mock("@/components/shell/account-menu", () => ({ useStoredUser: () => ({ name: "Hadley Stone" }) }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

describe("the chat page's composer", () => {
  it("moves with the thread while an agent's part is docked, and goes back when it closes", () => {
    const { container } = render(<AgencyChat />)
    const box = () => screen.getByRole("textbox", { name: "Message Agency Ops" }).closest("[data-composer] > div > div")
    const outer = () => container.querySelector("[data-composer]")
    expect(box().getAttribute("style")).toBeNull()
    act(() => dock.tell({ shift: 154, pad: 186, gutter: 15 }))
    expect(box()).toHaveStyle({ marginLeft: "-154px", paddingRight: "186px" })
    expect(outer()).toHaveStyle({ paddingRight: "15px" })
    act(() => dock.tell(null))
    expect(box().getAttribute("style") || "").toBe("")
  })
})
