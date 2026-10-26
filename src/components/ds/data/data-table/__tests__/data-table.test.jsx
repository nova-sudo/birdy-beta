import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { DataTable, DataTableColumnHeader, Frame, MoneyCell, StatusCell, TwoLineCell } from "@/components/ds"

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
    // The fold follows the table's own width (a container query at 576), not the viewport.
    expect(table().closest("[data-slot='data-table-scroll']").parentElement.className).toContain("@max-xl/table:hidden")
    expect(cards[0].closest("ul").className).toContain("@max-xl/table:flex")
  })

  it("draws the surface edges on the visible scroll box only while the table scrolls sideways", () => {
    const { container, unmount } = render(<DataTable columns={columns} data={data} />)
    expect(container.querySelector("[data-slot='data-table-edges']")).toBeNull()
    unmount()

    const box = (prop, value) => vi.spyOn(HTMLElement.prototype, prop, "get").mockImplementation(function () {
      return this.dataset?.slot === "data-table-scroll" ? value : 0
    })
    const spies = [box("scrollWidth", 1200), box("clientWidth", 600), box("offsetHeight", 412), box("clientHeight", 400)]
    try {
      const wide = render(<DataTable columns={columns} data={data} />)
      const edges = wide.container.querySelector("[data-slot='data-table-edges']")
      expect(edges.querySelectorAll("span")).toHaveLength(6)
      // It stops above the 12px horizontal scrollbar, at the last row.
      expect(edges.style.bottom).toBe("12px")
      wide.rerender(<DataTable columns={columns} data={data} bare />)
      expect(wide.container.querySelector("[data-slot='data-table-edges']")).toBeNull()
    } finally {
      spies.forEach((spy) => spy.mockRestore())
    }
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
    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Paused/ }))
    const t = within(table())
    expect(t.getByText("Bravo")).toBeInTheDocument()
    expect(t.queryByText("Alpha")).toBeNull()
    expect(t.queryByText("Charlie")).toBeNull()
  })

  it("positions the scroll container so absolutely placed header content stays clipped", () => {
    // An sr-only span in a header is position:absolute; without a positioned ancestor it
    // escapes overflow-x-auto and widens the page. jsdom can't measure, so assert the class.
    const { container } = render(<DataTable columns={columns} data={data} />)
    expect(container.querySelector("[data-slot='data-table-scroll']").className).toMatch(/\brelative\b/)
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

describe("Bytes shell and toolbar", () => {
  const twoFacets = [
    ...columns,
    {
      accessorKey: "tier",
      header: "Tier",
      meta: { label: "Tier", variant: "select", options: [{ value: "gold", label: "Gold" }, { value: "free", label: "Free" }] },
    },
  ]
  const tiered = data.map((r, i) => ({ ...r, tier: i === 0 ? "gold" : "free" }))

  it("standalone, it draws its own frame with the toolbar inside it", () => {
    const { container } = render(<DataTable columns={columns} data={data} />)
    const root = container.querySelector("[data-ds='data-table']")
    expect(root.tagName).toBe("SECTION")
    expect(root).not.toHaveAttribute("data-bare")
    for (const c of ["@container/table", "rounded-frame", "bg-frame", "shadow-frame"]) expect(root.className).toContain(c)
    const toolbar = within(root).getByRole("toolbar")
    for (const c of ["min-h-14", "px-3", "py-2"]) expect(toolbar.className).toContain(c)
  })

  it("inside a Frame, or with `bare`, it draws no frame of its own", () => {
    const { container, rerender } = render(
      <Frame title="Lifecycle changes">
        <DataTable columns={columns} data={data} />
      </Frame>
    )
    const root = () => container.querySelector("[data-ds='data-table']")
    expect(root()).toHaveAttribute("data-bare")
    expect(root().className).not.toContain("bg-frame")
    expect(table().querySelector("tbody").className).toContain("[&>tr>*]:border-divider")
    rerender(<DataTable columns={columns} data={data} bare />)
    expect(root()).toHaveAttribute("data-bare")
    expect(root().className).not.toContain("shadow-frame")
  })

  it("uses the Bytes head and body cell classes: 14/500 heads, 60 rows, 52 dense", () => {
    const { rerender } = render(<DataTable columns={columns} data={data} />)
    const head = within(table()).getAllByRole("columnheader")[0]
    for (const c of ["h-9", "px-3", "first:pl-4", "last:pr-4", "text-sm", "font-medium", "text-muted-foreground"]) {
      expect(head.className).toContain(c)
    }
    expect(head.className).not.toContain("text-xs")
    const cell = within(table()).getByText("Alpha").closest("td")
    for (const c of ["px-3", "py-2.5", "h-15", "group-hover/row:bg-row-hover"]) expect(cell.className).toContain(c)
    expect(cell.closest("tr").className).toContain("group/row")
    // Not inside a frame: rows sit on a surface with hairlines between them.
    expect(table().querySelector("tbody").className).toContain("[&>tr:not(:first-child)>*]:border-t")
    rerender(<DataTable columns={columns} data={data} dense />)
    expect(within(table()).getByText("Alpha").closest("td").className).toContain("h-13")
  })

  it("searches through a SearchInput: icon on the right, meta.placeholder, a clear button once typed", () => {
    const placeheld = [{ ...columns[0], meta: { ...columns[0].meta, placeholder: "Search locations or brands…" } }, ...columns.slice(1)]
    const { container } = render(<DataTable columns={placeheld} data={data} />)
    const box = screen.getByRole("searchbox")
    expect(box).toHaveAttribute("placeholder", "Search locations or brands…")
    expect(box.className).toContain("pr-10")
    expect(box.closest("[data-ds='search-input']").parentElement.className).toContain("w-72")
    expect(container.querySelector("[data-slot='search-icon']").getAttribute("class")).toContain("right-3.5")
    fireEvent.change(box, { target: { value: "bra" } })
    expect(within(table()).queryByText("Alpha")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(within(table()).getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByRole("searchbox")).toHaveValue("")
  })

  it("falls back to a placeholder built from the column label", () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Search name…")
  })

  it("has one Filter button in place of a button per facet, with the active count", () => {
    render(<DataTable columns={twoFacets} data={tiered} />)
    const toolbar = screen.getByRole("toolbar")
    expect(within(toolbar).queryByRole("button", { name: /Status/ })).toBeNull()
    expect(within(toolbar).queryByRole("button", { name: /Tier/ })).toBeNull()
    fireEvent.click(within(toolbar).getByRole("button", { name: "Filter" }))
    // Several facets: pick the field first, then its values.
    fireEvent.click(screen.getByRole("menuitem", { name: /Tier/ }))
    fireEvent.click(screen.getByRole("radio", { name: /Gold/ }))
    expect(within(table()).getByText("Alpha")).toBeInTheDocument()
    expect(within(table()).queryByText("Bravo")).toBeNull()
    const button = within(toolbar).getByRole("button", { name: "Filter, 1 on" })
    expect(button).toHaveAttribute("data-active")
  })

  it("the Filter popover can go back from a field to the field list", () => {
    render(<DataTable columns={twoFacets} data={tiered} />)
    fireEvent.click(screen.getByRole("button", { name: "Filter" }))
    fireEvent.click(screen.getByRole("menuitem", { name: /Status/ }))
    expect(screen.getByRole("checkbox", { name: /Live/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Back to filters/ }))
    expect(screen.getByRole("menuitem", { name: /Tier/ })).toBeInTheDocument()
  })

  it("the footer is the Bytes strip, with a small 80-wide rows-per-page select", () => {
    const { container } = render(<DataTable columns={columns} data={data} />)
    const footer = container.querySelector("[data-ds='data-table-pagination']")
    for (const c of ["min-h-13", "px-4", "py-2", "text-sm"]) expect(footer.className).toContain(c)
    const trigger = screen.getByRole("combobox", { name: "Rows per page" })
    expect(trigger).toHaveAttribute("data-size", "sm")
    expect(trigger.className).toContain("w-20")
  })

  it("right-aligns a number column's head: meta.align on a string header, or align on DataTableColumnHeader", () => {
    const aligned = [
      columns[0],
      { ...columns[2], meta: { label: "Spend", align: "right" } },
      {
        id: "leads",
        accessorFn: () => 3,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leads" align="right" />,
      },
    ]
    render(<DataTable columns={aligned} data={data} />)
    const [name, spend, leads] = within(table()).getAllByRole("columnheader")
    expect(name.className).not.toContain("text-right")
    expect(name.querySelector("[data-ds='column-header']").className).not.toContain("justify-end")
    expect(spend.className).toContain("text-right")
    expect(spend.querySelector("[data-ds='column-header']").className).toContain("justify-end")
    expect(leads.querySelector("[data-ds='column-header']").className).toContain("justify-end")
    // Still sortable.
    expect(within(spend).getByRole("button", { name: "Spend" })).toBeInTheDocument()
  })

  it("keeps the column heads while loading, with skeleton rows in the body", () => {
    render(<DataTable columns={columns} data={[]} loading />)
    expect(within(table()).getByRole("columnheader", { name: /Name/ })).toBeInTheDocument()
    expect(table().querySelector("tbody")).toHaveAttribute("aria-busy", "true")
  })
})

describe("cells", () => {
  it("MoneyCell renders GBP with num class, at medium weight", () => {
    render(<MoneyCell value={1234.5} />)
    expect(screen.getByText("£1,234.50")).toHaveClass("num")
    expect(screen.getByText("£1,234.50")).toHaveClass("font-medium")
  })
  it("MoneyCell honours currency", () => {
    render(<MoneyCell value={10} currency="USD" />)
    expect(screen.getByText(/\$10\.00/)).toBeInTheDocument()
  })
  it("StatusCell renders a badge with the label and a leading tone icon", () => {
    const { container } = render(<StatusCell tone="success" label="Live" />)
    expect(screen.getByText("Live")).toBeInTheDocument()
    expect(container.querySelector("svg")).not.toBeNull()
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
    expect(child.className).toContain("bg-row-child")
    const cell = within(table()).getByText("Aura").closest("td")
    // `first:` so it beats BODY_CELL's `first:pl-4`; a bare pl-10 loses to the variant.
    expect(cell.className).toContain("first:pl-10")
    expect(cell.className).not.toContain("first:pl-4")
    const parentCell = within(table()).getByText("Rule one").closest("td")
    expect(parentCell.className).toContain("first:pl-4")
  })

  it("a pinned child cell is opaque, so scrolled cells do not show through it", () => {
    render(<DataTable columns={cols} data={tree} {...expandable} stickyFirstColumn state={{ expanded: { r1: true } }} />)
    const cell = within(table()).getByText("Aura").closest("td")
    expect(cell.className).toContain("sticky")
    expect(cell.className).toContain("bg-row-child")
    expect(cell.className).not.toMatch(/bg-[\w-]+\/\d+/)
    expect(cell.className).not.toContain("bg-background")
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
