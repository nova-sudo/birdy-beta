// Escape in the composer: while the slash menu is open it closes the menu and
// claims the key (preventDefault), so a surrounding drawer or dialog that
// closes on Escape knows to leave itself open.
import { describe, it, expect } from "vitest"
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
