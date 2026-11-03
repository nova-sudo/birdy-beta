import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClaimConflicts } from "../ClaimConflicts"

const CLIENTS = [
  { id: "g1", name: "Alpha" },
  { id: "g2", name: "Beta" },
]
const one = [{ client_group_id: "g1", holder_id: "a7", holder_name: "Old rules" }]
const two = [...one, { client_group_id: "g2", holder_id: "a8", holder_name: "Other rules" }]

describe("ClaimConflicts", () => {
  it("offers one Move it here for a single conflict and Only flag on its row", async () => {
    const onMove = vi.fn()
    const onOnlyFlag = vi.fn()
    render(<ClaimConflicts conflicts={one} clients={CLIENTS} onMove={onMove} onOnlyFlag={onOnlyFlag} />)
    await userEvent.click(screen.getByRole("button", { name: "Move it here" }))
    await userEvent.click(screen.getByRole("button", { name: "Only flag" }))
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onOnlyFlag).toHaveBeenCalledWith("g1")
  })

  it("with several conflicts shows one Move all here and an Only flag per row", async () => {
    const onMove = vi.fn()
    const onOnlyFlag = vi.fn()
    render(<ClaimConflicts conflicts={two} clients={CLIENTS} onMove={onMove} onOnlyFlag={onOnlyFlag} />)
    expect(screen.getAllByRole("button", { name: "Move all here" })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Move it here" })).toBeNull()
    expect(screen.getAllByRole("button", { name: "Only flag" })).toHaveLength(2)
    await userEvent.click(screen.getAllByRole("button", { name: "Only flag" })[1])
    expect(onOnlyFlag).toHaveBeenCalledWith("g2")
  })

  it("names the holder as another agent when it has no name", () => {
    render(
      <ClaimConflicts
        conflicts={[{ client_group_id: "g1", holder_id: "a7", holder_name: null }]}
        clients={CLIENTS}
        onMove={vi.fn()}
        onOnlyFlag={vi.fn()}
      />
    )
    expect(screen.getByText(/is with another agent/)).toBeInTheDocument()
  })
})
