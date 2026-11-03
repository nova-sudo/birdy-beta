import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

import CreativeTestCard from "@/components/chat/blocks/CreativeTestCard"
import MessageBubble from "@/components/chat/MessageBubble"

const data = {
  test_id: "t1", code: "CT-0048", name: "Spring promo", thumbnail: "https://cdn.test/a.jpg",
  origin: "new", accounts: [{ name: "Acme", adset_name: "Set 1" }, { name: "Bolt", adset_name: "Set 2" }],
  targets_text: "CPL under $25", destination_text: "Website: https://a.test",
  warnings: ["No metric targets set"], posts_as: "Paused, then live together once all 2 accept",
  n_accounts: 2, ready: true,
}

beforeEach(() => push.mockClear())

describe("CreativeTestCard", () => {
  it("renders details and warnings", () => {
    render(<CreativeTestCard data={data} onSend={vi.fn()} />)
    expect(screen.getByText("CT-0048")).toBeInTheDocument()
    expect(screen.getByText("Spring promo")).toBeInTheDocument()
    expect(screen.getByText("No metric targets set")).toBeInTheDocument()
    expect(screen.getByText(/Acme/)).toBeInTheDocument()
  })

  it("Post sends the exact text once and disables", async () => {
    const onSend = vi.fn()
    render(<CreativeTestCard data={data} onSend={onSend} />)
    const btn = screen.getByRole("button", { name: "Post to 2 accounts" })
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith("Yes, post CT-0048 to 2 accounts.")
    expect(btn).toBeDisabled()
  })

  it("falls back to accounts.length when n_accounts is missing", async () => {
    const onSend = vi.fn()
    render(<CreativeTestCard data={{ ...data, n_accounts: undefined }} onSend={onSend} />)
    await userEvent.click(screen.getByRole("button", { name: "Post to 2 accounts" }))
    expect(onSend).toHaveBeenCalledWith("Yes, post CT-0048 to 2 accounts.")
  })

  it("disables Post with a hint when ready is false, but a missing ready counts as ready", () => {
    const { unmount } = render(<CreativeTestCard data={{ ...data, ready: false }} onSend={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Post to 2 accounts/ })).toBeDisabled()
    expect(screen.getByText(/still needs/i)).toBeInTheDocument()
    unmount()
    const { ready, ...old } = data
    render(<CreativeTestCard data={old} onSend={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Post to 2 accounts" })).toBeEnabled()
  })

  it("Open in wizard routes to the edit page", async () => {
    render(<CreativeTestCard data={data} onSend={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Open in wizard" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/t1/edit")
  })

  it("Change targets sends once", async () => {
    const onSend = vi.fn()
    render(<CreativeTestCard data={data} onSend={onSend} />)
    const btn = screen.getByRole("button", { name: "Change targets" })
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith("Change the targets for CT-0048.")
  })

  it("renders nothing for a payload without a code or test_id", () => {
    const { container } = render(<CreativeTestCard data={{ foo: 1 }} onSend={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("MessageBubble creative block", () => {
  it("passes onSend through to the card", async () => {
    const onSend = vi.fn()
    render(
      <MessageBubble
        message={{ role: "assistant", content: `Draft:\n:::creative ${JSON.stringify(data)}:::`, tools_used: [] }}
        messageIndex={1}
        onSend={onSend}
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: "Post to 2 accounts" }))
    expect(onSend).toHaveBeenCalledWith("Yes, post CT-0048 to 2 accounts.")
  })
})
