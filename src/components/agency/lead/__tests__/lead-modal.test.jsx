import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import "@/components/by/__tests__/jsdom"

vi.mock("../lead-view", () => ({ LeadView: ({ contactId, embed }) => <p>{`Lead ${contactId}${embed ? " (embedded)" : ""}`}</p> }))

import { LeadModal, leadHref } from "../lead-modal"

function Host() {
  const [open, setOpen] = useState(null)
  return (
    <>
      <button onClick={() => setOpen("c 1")}>Open Kim</button>
      <LeadModal contactId={open} name="Kim Jones" onClose={() => setOpen(null)} />
    </>
  )
}

beforeEach(() => vi.clearAllMocks())

describe("LeadModal", () => {
  it("shows nothing while no lead is open", () => {
    render(<LeadModal contactId={null} onClose={() => {}} />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("opens the lead's view, embedded, with a link to its full page", async () => {
    render(<Host />)
    await userEvent.click(screen.getByRole("button", { name: "Open Kim" }))
    const dialog = screen.getByRole("dialog", { name: "Lead: Kim Jones" })
    expect(dialog).toHaveTextContent("Lead c 1 (embedded)")
    expect(screen.getByRole("link", { name: /Open full page/ })).toHaveAttribute("href", "/contacts/c%201")
  })

  it("closes on Escape and on ×, and gives focus back to what opened it", async () => {
    render(<Host />)
    const opener = screen.getByRole("button", { name: "Open Kim" })
    await userEvent.click(opener)
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() => expect(opener).toHaveFocus())
    await userEvent.click(opener)
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("builds the lead page's address", () => {
    expect(leadHref("a/b")).toBe("/contacts/a%2Fb")
  })
})
