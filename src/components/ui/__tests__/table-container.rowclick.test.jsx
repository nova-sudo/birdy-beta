import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import StyledTable from "../table-container"

// A row with onRowClick must open from the keyboard as well as the mouse:
// it takes focus, and Enter or Space on the row calls the handler.

const columns = [
  { key: "name", label: "Name", cell: (value) => value },
  {
    key: "link",
    label: "Link",
    cell: () => <input aria-label="Inner field" />,
  },
]
const data = [
  { id: "r1", name: "Rebecca", contactId: "c1" },
  { id: "r2", name: "Emma", contactId: "c2" },
]

function rowOf(text) {
  return screen.getByText(text).closest("tr")
}

describe("StyledTable row click from the keyboard", () => {
  it("calls onRowClick with the row when Enter is pressed on a focused row", async () => {
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(<StyledTable columns={columns} data={data} onRowClick={onRowClick} />)

    const row = rowOf("Emma")
    expect(row).toHaveAttribute("tabindex", "0")
    row.focus()
    await user.keyboard("{Enter}")

    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toMatchObject({ contactId: "c2" })
  })

  it("opens on Space too", async () => {
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(<StyledTable columns={columns} data={data} onRowClick={onRowClick} />)

    rowOf("Rebecca").focus()
    await user.keyboard(" ")
    expect(onRowClick.mock.calls[0][0]).toMatchObject({ contactId: "c1" })
  })

  it("ignores keys pressed inside an interactive descendant", async () => {
    const onRowClick = vi.fn()
    const user = userEvent.setup()
    render(<StyledTable columns={columns} data={data} onRowClick={onRowClick} />)

    rowOf("Emma").querySelector("input").focus()
    await user.keyboard("{Enter} ")
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("leaves rows out of the tab order without onRowClick", () => {
    render(<StyledTable columns={columns} data={data} />)
    expect(rowOf("Emma")).not.toHaveAttribute("tabindex")
  })
})
