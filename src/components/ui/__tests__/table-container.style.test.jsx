import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import StyledTable from "../table-container"
import { TABLE_ROW_H, TABLE_ROW_H_TALL } from "@/lib/table-style"

// The classic table takes the one table style from lib/table-style, and a
// hovered row changes as one: the pinned cells (checkbox, status switch, name)
// and the rest share the same rule, and nothing on the row fades.

const columns = [
  { key: "name", label: "Name", cell: (v) => v },
  { key: "spend", label: "Spend" },
]
const data = [
  { id: "r1", name: "Alpha", spend: 10, status: "active" },
  { id: "r2", name: "Beta", spend: 20, status: "paused" },
]

const cellsOf = (text) => [...screen.getByText(text).closest("tr").querySelectorAll("td")]

describe("StyledTable style", () => {
  it("gives every cell of a row the same height and no transition, pinned cells included", () => {
    render(
      <StyledTable columns={columns} data={data} onRowClick={() => {}} enableSelection enableStatusToggle />
    )
    const row = screen.getByText("Alpha").closest("tr")
    expect(row.className).not.toMatch(/transition/)
    const cells = cellsOf("Alpha")
    expect(cells).toHaveLength(4)
    for (const td of cells) {
      expect(td.className).toContain(TABLE_ROW_H)
      expect(td.className).not.toMatch(/transition/)
    }
    // Pinned cells paint their own background from the shared rule, not from a zebra class.
    expect(cells[0].className).toContain("pinned-cell")
    expect(cells[1].className).toContain("pinned-cell")
    expect(cells[2].className).toContain("fixed-column")
    expect(row.outerHTML).not.toMatch(/zebra/)
  })

  it("uses the taller row when the name column carries a second line", () => {
    render(<StyledTable columns={[{ ...columns[0], sub: () => "Client" }, columns[1]]} data={data} />)
    for (const td of cellsOf("Alpha")) expect(td.className).toContain(TABLE_ROW_H_TALL)
  })

  it("right-aligns figures with tabular numbers", () => {
    render(<StyledTable columns={columns} data={data} />)
    const td = screen.getByText(/20\.00/).closest("td")
    expect(td.className).toContain("text-right")
    expect(td.className).toContain("tabular-nums")
  })

  it("shows the shared empty state when there are no rows", () => {
    render(<StyledTable columns={columns} data={[]} emptyMessage={{ title: "Nothing here", subtitle: "Try later" }} />)
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument()
    expect(screen.getByText("Try later")).toBeInTheDocument()
  })
})
