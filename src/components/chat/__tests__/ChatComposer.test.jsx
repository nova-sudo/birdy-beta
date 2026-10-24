// Escape in the composer: while the slash menu is open it closes the menu and
// claims the key (preventDefault), so a surrounding drawer or dialog that
// closes on Escape knows to leave itself open.
import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ChatComposer from "../ChatComposer"

function Harness({ seen }) {
  const [value, setValue] = useState("")
  return (
    <div onKeyDown={(e) => e.key === "Escape" && seen.push(e.defaultPrevented)}>
      <ChatComposer value={value} onChange={setValue} onSend={() => {}} compact />
    </div>
  )
}

describe("ChatComposer Escape", () => {
  it("closes an open slash menu and claims the key", async () => {
    const user = userEvent.setup()
    const seen = []
    render(<Harness seen={seen} />)

    await user.type(screen.getByRole("textbox"), "/")
    expect(screen.getByText("Commands")).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByText("Commands")).toBeNull()
    expect(seen).toEqual([true])
  })

  it("leaves Escape alone when no menu is open", async () => {
    const user = userEvent.setup()
    const seen = []
    render(<Harness seen={seen} />)

    await user.type(screen.getByRole("textbox"), "hi")
    await user.keyboard("{Escape}")
    expect(seen).toEqual([false])
  })
})

describe("ChatComposer send keys", () => {
  function Sender({ onSend, initial = "hello" }) {
    const [value, setValue] = useState(initial)
    return <ChatComposer value={value} onChange={setValue} onSend={onSend} />
  }

  it("sends on Enter", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<Sender onSend={onSend} />)

    await user.click(screen.getByRole("textbox"))
    await user.keyboard("{Enter}")
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it("does not send on Shift+Enter", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<Sender onSend={onSend} />)

    await user.click(screen.getByRole("textbox"))
    await user.keyboard("{Shift>}{Enter}{/Shift}")
    expect(onSend).not.toHaveBeenCalled()
  })

  it("does not send an empty message on Enter", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<Sender onSend={onSend} initial="" />)

    await user.click(screen.getByRole("textbox"))
    await user.keyboard("{Enter}")
    expect(onSend).not.toHaveBeenCalled()
  })

  it("is a ds textarea with a ds send button", () => {
    const { container } = render(<Sender onSend={() => {}} />)
    expect(container.querySelector('[data-ds="textarea"]')).not.toBeNull()
    expect(screen.getByRole("button", { name: "Send message" })).toHaveAttribute("data-ds", "button")
  })
})
