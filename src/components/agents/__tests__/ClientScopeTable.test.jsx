import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

vi.mock("@/lib/agents-api", () => ({ setClientTarget: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { setClientTarget } from "@/lib/agents-api"
import { ClientScopeTable } from "../ClientScopeTable"

const CLIENTS = [
  { id: "a", name: "Tylaesthetics", account: "act_2381", currency: "GBP", cpl: 22 },
  { id: "b", name: "The Contour Co", account: "act_8812", currency: "USD", cpl: null },
  { id: "c", name: "Thee Vision Studio", account: null, currency: null, cpl: null },
]

function Harness({ initial = [], caps = {}, onCapChange = vi.fn(), onSelectedChange }) {
  const [selected, setSelected] = useState(initial)
  return (
    <ClientScopeTable
      agentId="ag1"
      clients={CLIENTS}
      selected={selected}
      onSelectedChange={(ids) => {
        onSelectedChange?.(ids)
        setSelected(ids)
      }}
      caps={caps}
      onCapChange={onCapChange}
    />
  )
}

beforeEach(() => {
  vi.mocked(setClientTarget).mockReset()
  vi.mocked(setClientTarget).mockResolvedValue({ client_group_id: "b", targets: { cpl: 25 } })
})

describe("ClientScopeTable", () => {
  it("filters by search", async () => {
    render(<Harness />)
    expect(screen.getByText("Tylaesthetics")).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText("Search clients"), "contour")
    await waitFor(() => expect(screen.queryByText("Tylaesthetics")).not.toBeInTheDocument())
    expect(screen.getByText("The Contour Co")).toBeInTheDocument()
    expect(screen.queryByText("Thee Vision Studio")).not.toBeInTheDocument()
  })

  it("Select all ticks only Meta-connected clients", async () => {
    const onSelectedChange = vi.fn()
    render(<Harness onSelectedChange={onSelectedChange} />)
    await userEvent.click(screen.getByRole("button", { name: "Select all" }))
    expect(onSelectedChange).toHaveBeenLastCalledWith(["a", "b"])
    expect(screen.getByRole("checkbox", { name: "Watch Tylaesthetics" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Watch Thee Vision Studio" })).toBeDisabled()
    expect(screen.getByText("2 of 3 watched")).toBeInTheDocument()
    // The client with no Meta account links to its integrations instead.
    const row = screen.getByText("Thee Vision Studio").closest("[data-slot=client-row]")
    expect(within(row).getByRole("link", { name: /Connect/ })).toHaveAttribute(
      "href",
      "/clients/c?settings=integrations"
    )
  })

  it("empty target shows the warning ring and saves on blur", async () => {
    const onSelectedChange = vi.fn()
    render(<Harness initial={["a", "b"]} onSelectedChange={onSelectedChange} />)
    const empty = screen.getByLabelText("CPL target for The Contour Co")
    expect(empty).toHaveAttribute("data-warning", "true")
    expect(screen.getByLabelText("CPL target for Tylaesthetics")).not.toHaveAttribute("data-warning")
    // Each client shows its own currency, never a hard-coded one.
    const row = empty.closest("[data-slot=client-row]")
    expect(within(row).getByText("$")).toBeInTheDocument()

    await userEvent.type(empty, "25")
    expect(empty).not.toHaveAttribute("data-warning")
    fireEvent.blur(empty)
    await waitFor(() => expect(setClientTarget).toHaveBeenCalledWith("ag1", "b", 25))
    // Saving a target never changes what is watched.
    expect(onSelectedChange).not.toHaveBeenCalled()
  })

  it("an unwatched client's target is editable but carries no warning", async () => {
    render(<Harness initial={[]} />)
    const target = screen.getByLabelText("CPL target for The Contour Co")
    expect(target).toBeEnabled()
    expect(target).not.toHaveAttribute("data-warning")
    expect(screen.getByLabelText("Max pauses per day for The Contour Co")).toBeDisabled()
    await userEvent.type(target, "30")
    fireEvent.blur(target)
    await waitFor(() => expect(setClientTarget).toHaveBeenCalledWith("ag1", "b", 30))
  })

  it("blank cap sends null", async () => {
    const onCapChange = vi.fn()
    render(<Harness initial={["a"]} caps={{ a: 2 }} onCapChange={onCapChange} />)
    const cap = screen.getByLabelText("Max pauses per day for Tylaesthetics")
    expect(cap).toHaveValue("2")
    await userEvent.clear(cap)
    fireEvent.blur(cap)
    expect(onCapChange).toHaveBeenCalledWith("a", null)
  })
})
