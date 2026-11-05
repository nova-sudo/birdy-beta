// On a client's own pages the side panel is about that client only.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const conversation = vi.fn()
vi.mock("@/components/chat/ChatConversation", () => ({
  default: (props) => {
    conversation(props)
    return <div data-testid="conversation" />
  },
}))
vi.mock("@/lib/useClientGroups", () => ({
  useClientGroups: () => ({ clientGroups: [{ id: "g-lead/1", name: "Acme Dental" }] }),
}))

const { default: BirdyChatModal } = await import("@/components/chat/BirdyChatModal")
const lastProps = () => conversation.mock.calls.at(-1)[0]

beforeEach(() => conversation.mockClear())

describe("BirdyChatModal", () => {
  it("locks a client page's chat to that client and hides the picker", () => {
    render(<BirdyChatModal open onOpenChange={() => {}} pathname={`/clients/${encodeURIComponent("g-lead/1")}/tracking`} />)

    // "lead" in the id no longer reads as the Leads page.
    expect(lastProps()).toMatchObject({
      page: "client_detail",
      clientGroupId: "g-lead/1",
      clientName: "Acme Dental",
      showScopePicker: false,
      sessionKey: "birdy_chat_client_panel_g-lead/1",
    })
    expect(screen.getByText("Acme Dental")).toBeInTheDocument()
  })

  it("keeps the picker and the shared thread everywhere else", () => {
    render(<BirdyChatModal open onOpenChange={() => {}} pathname="/clients" />)
    expect(lastProps()).toMatchObject({
      page: null,
      clientGroupId: null,
      showScopePicker: true,
      sessionKey: "birdy_chat_modal_session",
    })
  })
})
