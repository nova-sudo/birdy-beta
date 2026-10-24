import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { DataTable, MoneyCell, StatusCell, TwoLineCell } from "@/components/ds"

const data = [
  { id: "1", name: "Alpha", status: "live", spend: 1234.5 },
  { id: "2", name: "Bravo", status: "paused", spend: 80 },
  { id: "3", name: "Charlie", status: "live", spend: 410 },
]

const columns = [
  { accessorKey: "name", header: "Name", meta: { label: "Name", variant: "text" } },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    meta: {
      label: "Status",
      variant: "multiSelect",
      options: [
        { value: "live", label: "Live" },
        { value: "paused", label: "Paused" },
      ],
    },
  },
  { accessorKey: "spend", header: "Spend", cell: ({ getValue }) => <MoneyCell value={getValue()} /> },
]

const table = () => screen.getByRole("table")

describe("DataTable", () => {
  it("renders header and rows", () => {
    render(<DataTable columns={columns} data={data} />)
    const t = within(table())
    expect(t.getByRole("columnheader", { name: /Name/ })).toBeInTheDocument()
    expect(t.getAllByRole("row")).toHaveLength(4) // header + 3
    expect(t.getByText("Bravo")).toBeInTheDocument()
  })

  it("also renders every row as a stacked card for narrow screens", () => {
    const { container } = render(<DataTable columns={columns} data={data} />)
    const cards = container.querySelectorAll("[data-slot='data-table-card']")
    expect(cards).toHaveLength(3)
    expect(within(cards[0]).getByText("Alpha")).toBeInTheDocument()
    expect(within(cards[0]).getByText("Spend")).toBeInTheDocument()
    expect(table().closest("[data-slot='data-table-scroll']").className).toContain("max-md:hidden")
  })

  it("loading shows skeleton rows instead of data", () => {
    const { container } = render(<DataTable columns={columns} data={data} loading />)
    expect(container.querySelectorAll("[data-slot='data-table-skeleton-row']").length).toBeGreaterThan(0)
    expect(screen.queryByText("Alpha")).toBeNull()
  })

  it("renders the empty node when there is no data", () => {
    render(<DataTable columns={columns} data={[]} empty={<p>Nothing yet</p>} />)
    expect(screen.getByText("Nothing yet")).toBeInTheDocument()
  })

  it("a faceted filter narrows rows", () => {
    render(<DataTable columns={columns} data={data} />)
    fireEvent.click(screen.getByRole("button", { name: /Status/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Paused/ }))
    const t = within(table())
    expect(t.getByText("Bravo")).toBeInTheDocument()
    expect(t.queryByText("Alpha")).toBeNull()
    expect(t.queryByText("Charlie")).toBeNull()
  })

  it("clicking a sortable header toggles aria-sort", () => {
    render(<DataTable columns={columns} data={data} />)
    const th = () => within(table()).getByRole("columnheader", { name: /Spend/ })
    expect(th()).toHaveAttribute("aria-sort", "none")
    fireEvent.click(within(th()).getByRole("button"))
    expect(th()).toHaveAttribute("aria-sort", "ascending")
    fireEvent.click(within(th()).getByRole("button"))
    expect(th()).toHaveAttribute("aria-sort", "descending")
    const first = within(table()).getAllByRole("row")[1]
    expect(within(first).getByText("Alpha")).toBeInTheDocument()
  })

  it("onRowClick fires with the row original", () => {
    const onRowClick = vi.fn()
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} getRowId={(r) => r.id} />)
    fireEvent.click(within(table()).getByText("Bravo"))
    expect(onRowClick).toHaveBeenCalledWith(data[1])
  })

  it("reports state changes when the page controls state", () => {
    const onStateChange = vi.fn()
    render(<DataTable columns={columns} data={data} state={{ sorting: [] }} onStateChange={onStateChange} />)
    fireEvent.click(within(within(table()).getByRole("columnheader", { name: /Spend/ })).getByRole("button"))
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ sorting: [{ id: "spend", desc: false }] }))
  })

  it("paginates by pageSize", () => {
    render(<DataTable columns={columns} data={data} pageSize={2} />)
    expect(within(table()).getAllByRole("row")).toHaveLength(3)
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(within(table()).getByText("Charlie")).toBeInTheDocument()
  })

  it("pulls back to the last page when data shrinks under the current page", () => {
    const { rerender } = render(<DataTable columns={columns} data={data} pageSize={2} empty={<p>Nothing yet</p>} />)
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(within(table()).getByText("Charlie")).toBeInTheDocument()
    rerender(<DataTable columns={columns} data={data.slice(0, 1)} pageSize={2} empty={<p>Nothing yet</p>} />)
    expect(within(table()).getByText("Alpha")).toBeInTheDocument()
    expect(screen.queryByText("Nothing yet")).toBeNull()
  })

  it("filtered-to-zero shows No results with a working Clear filters, not the empty node", () => {
    render(<DataTable columns={columns} data={data} empty={<p>Nothing yet</p>} />)
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } })
    expect(screen.getByText("No results")).toBeInTheDocument()
    expect(screen.queryByText("Nothing yet")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(within(table()).getByText("Alpha")).toBeInTheDocument()
  })

  it("emptyFiltered overrides the default filtered-empty node", () => {
    render(<DataTable columns={columns} data={data} emptyFiltered={<p>Custom none</p>} />)
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } })
    expect(screen.getByText("Custom none")).toBeInTheDocument()
  })

  it("accepts a string facet filter value", () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        state={{ columnFilters: [{ id: "status", value: "paused" }] }}
        onStateChange={() => {}}
      />
    )
    expect(within(table()).getByText("Bravo")).toBeInTheDocument()
    expect(within(table()).queryByText("Alpha")).toBeNull()
  })
})

describe("server-side pagination and column reorder", () => {
  it("manualPagination pages by rowCount and reports page changes without slicing data", () => {
    const onStateChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        data={data}
        manualPagination
        rowCount={40}
        pageSize={15}
        pageSizeOptions={[15]}
        state={{ pagination: { pageIndex: 0, pageSize: 15 } }}
        onStateChange={onStateChange}
      />
    )
    expect(within(table()).getAllByRole("row")).toHaveLength(4)
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }))
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: { pageIndex: 1, pageSize: 15 } })
    )
  })

  it("onColumnReorder fires when a header is dropped on another", () => {
    const onColumnReorder = vi.fn()
    render(<DataTable columns={columns} data={data} onColumnReorder={onColumnReorder} />)
    const heads = within(table()).getAllByRole("columnheader")
    expect(heads[0]).toHaveAttribute("draggable", "true")
    const dataTransfer = { setData: vi.fn(), getData: () => "name", effectAllowed: "" }
    fireEvent.dragStart(heads[0], { dataTransfer })
    fireEvent.dragOver(heads[2], { dataTransfer })
    fireEvent.drop(heads[2], { dataTransfer })
    expect(onColumnReorder).toHaveBeenCalledWith("name", "spend")
  })
})

describe("wide tables", () => {
  it("scrolls sideways inside its own container and never wraps cells", () => {
    render(<DataTable columns={columns} data={data} />)
    const scroll = table().closest("[data-slot='data-table-scroll']")
    expect(scroll.className).toContain("overflow-x-auto")
    expect(within(table()).getByText("Alpha").closest("td").className).toContain("whitespace-nowrap")
  })

  it("pins the first column only when asked, and honours meta.minWidth", () => {
    const wide = [{ ...columns[0], meta: { ...columns[0].meta, minWidth: 220 } }, ...columns.slice(1)]
    const { rerender } = render(<DataTable columns={wide} data={data} />)
    expect(within(table()).getByText("Alpha").closest("td").className).not.toContain("sticky")
    rerender(<DataTable columns={wide} data={data} stickyFirstColumn />)
    const heads = within(table()).getAllByRole("columnheader")
    expect(heads[0].className).toContain("sticky")
    expect(heads[0].className).toContain("left-0")
    expect(heads[1].className).not.toContain("sticky")
    const cell = within(table()).getByText("Alpha").closest("td")
    expect(cell.className).toContain("sticky")
    expect(cell.className).toContain("bg-background")
    expect(cell).toHaveStyle({ minWidth: "220px" })
  })

  it("locked columns cannot be dragged or dropped onto", () => {
    const onColumnReorder = vi.fn()
    render(<DataTable columns={columns} data={data} onColumnReorder={onColumnReorder} lockedColumnIds={["name"]} />)
    const heads = within(table()).getAllByRole("columnheader")
    expect(heads[0]).toHaveAttribute("draggable", "false")
    expect(heads[1]).toHaveAttribute("draggable", "true")
    const dt = { setData: vi.fn(), getData: () => "status", effectAllowed: "" }
    fireEvent.drop(heads[0], { dataTransfer: dt })
    expect(onColumnReorder).not.toHaveBeenCalled()
    const fromLocked = { setData: vi.fn(), getData: () => "name", effectAllowed: "" }
    fireEvent.drop(heads[2], { dataTransfer: fromLocked })
    expect(onColumnReorder).not.toHaveBeenCalled()
  })

  it("an empty server-paged table settles on page 1 of 1 without fighting the page", () => {
    const onStateChange = vi.fn()
    render(
      <DataTable columns={columns} data={[]} manualPagination rowCount={0} empty={<p>none</p>}
        state={{ pagination: { pageIndex: 2, pageSize: 15 } }} onStateChange={onStateChange} />
    )
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it("hides rows-per-page when there is only one size", () => {
    const { rerender } = render(<DataTable columns={columns} data={data} pageSize={15} pageSizeOptions={[15]} />)
    expect(screen.queryByText("Rows per page")).toBeNull()
    rerender(<DataTable columns={columns} data={data} />)
    expect(screen.getByText("Rows per page")).toBeInTheDocument()
  })
})

describe("cells", () => {
  it("MoneyCell renders GBP with num class", () => {
    render(<MoneyCell value={1234.5} />)
    expect(screen.getByText("£1,234.50")).toHaveClass("num")
  })
  it("MoneyCell honours currency", () => {
    render(<MoneyCell value={10} currency="USD" />)
    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument()
  })
  it("StatusCell renders a dot badge with the label", () => {
    const { container } = render(<StatusCell tone="success" label="Live" />)
    expect(screen.getByText("Live")).toBeInTheDocument()
    expect(container.querySelector("[data-badge-dot]")).not.toBeNull()
  })
  it("TwoLineCell renders both lines and skips an empty secondary", () => {
    const { rerender } = render(<TwoLineCell primary="Acme" secondary="Retail" />)
    expect(screen.getByText("Retail")).toBeInTheDocument()
    rerender(<TwoLineCell primary="Acme" />)
    expect(screen.queryByText("Retail")).toBeNull()
  })
})

describe("DataTable row expansion", () => {
  const tree = [
    { id: "r1", name: "Rule one", metric: "CPL", subRows: [{ id: "c1", name: "Aura" }, { id: "c2", name: "Beta" }] },
    { id: "r2", name: "Rule two", metric: "Spend" },
  ]
  const cols = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row, getValue }) => (
        <span>
          {row.getCanExpand() && (
            <button type="button" aria-label={`Expand ${getValue()}`} onClick={row.getToggleExpandedHandler()}>
              +
            </button>
          )}
          {getValue()}
        </span>
      ),
    },
    { accessorKey: "metric", header: "Metric" },
  ]
  const expandable = { getSubRows: (r) => r.subRows, getRowId: (r) => r.id }

  it("does nothing without getSubRows: subRows stay data, rows are not nested", () => {
    render(<DataTable columns={cols} data={tree} />)
    expect(within(table()).queryByText("Aura")).toBeNull()
    expect(within(table()).getAllByRole("row")).toHaveLength(3)
  })

  it("starts collapsed and reveals child rows when a parent is expanded", () => {
    render(<DataTable columns={cols} data={tree} {...expandable} />)
    expect(within(table()).queryByText("Aura")).toBeNull()
    fireEvent.click(within(table()).getByRole("button", { name: "Expand Rule one" }))
    expect(within(table()).getAllByRole("row")).toHaveLength(5) // header + 2 rules + 2 clients
    expect(within(table()).getByText("Aura").closest("tr")).toHaveAttribute("data-depth", "1")
    expect(within(table()).getByText("Rule one").closest("tr")).toHaveAttribute("data-depth", "0")
  })

  it("gives child rows a muted background and an indented first cell", () => {
    render(<DataTable columns={cols} data={tree} {...expandable} state={{ expanded: { r1: true } }} />)
    const child = within(table()).getByText("Aura").closest("tr")
    expect(child.className).toContain("bg-muted")
    expect(within(table()).getByText("Aura").closest("td").className).toContain("pl-10")
  })

  it("pages the parent rows only: children do not count toward the page size", () => {
    render(<DataTable columns={cols} data={tree} pageSize={1} {...expandable} state={{ expanded: { r1: true } }} />)
    expect(within(table()).getByText("Rule one")).toBeInTheDocument()
    expect(within(table()).getByText("Aura")).toBeInTheDocument()
    expect(within(table()).queryByText("Rule two")).toBeNull()
  })

  it("renders child rows as nested cards on narrow screens", () => {
    const { container } = render(
      <DataTable columns={cols} data={tree} {...expandable} state={{ expanded: { r1: true } }} />
    )
    const cards = container.querySelectorAll("[data-slot='data-table-card']")
    expect(cards).toHaveLength(4)
    expect(cards[1]).toHaveAttribute("data-depth", "1")
  })
})
