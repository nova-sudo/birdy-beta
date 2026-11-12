import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { ClientSheet } from "../ClientSheet"

const row = (name, over = {}) => ({
  gid: name.toLowerCase(),
  name,
  leads: 5,
  cpl: 5,
  spend: 25,
  zone: "amb",
  chip: { k: "none" },
  cardId: `card-${name}`,
  readOnly: false,
  decided: 0,
  currency: "GBP",
  targets: { green_under: 4, red_over: 8 },
  noFigures: false,
  ...over,
})
const blank = (name, over = {}) => row(name, { leads: null, cpl: null, spend: null, zone: "gry", noFigures: true, ...over })

const table = () => screen.getByRole("table")
const names = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelector("[data-cell=client]")?.textContent)

describe("ClientSheet", () => {
  it("most urgent puts clients to decide first then CPL rising then no figures", () => {
    const rows = [
      row("Cheap", { cpl: 2 }),
      row("Pricey", { cpl: 9 }),
      row("Changes", { cpl: 3, chip: { k: "changes", n: 2 } }),
      blank("Blank"),
    ]
    render(<ClientSheet rows={rows} view="today" onOpen={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /Show 1 client with no figures/ }))
    expect(names()).toEqual(["Changes", "Cheap", "Pricey", "Blank"])
    expect(within(table()).getByText("2 changes")).toBeInTheDocument()
    expect(within(table()).getByText("No figures")).toBeInTheDocument()
  })

  it("best to worst shows rank and ranks by clicked header", () => {
    const rows = [row("A", { leads: 2, cpl: 3 }), row("B", { leads: 9, cpl: 6 }), row("C", { leads: 5, cpl: 4 })]
    render(<ClientSheet rows={rows} view="today" onOpen={vi.fn()} />)
    expect(within(table()).queryByRole("columnheader", { name: "Rank" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Best to worst" }))
    expect(within(table()).getByRole("columnheader", { name: "Rank" })).toBeInTheDocument()
    expect(names()).toEqual(["A", "C", "B"])
    fireEvent.click(within(table()).getByRole("button", { name: /Rank by Leads/ }))
    expect(names()).toEqual(["B", "C", "A"])
  })

  it("search hidden under 10 rows", () => {
    const nine = Array.from({ length: 9 }, (_, i) => row(`Client ${i}`))
    const { unmount } = render(<ClientSheet rows={nine} view="today" onOpen={vi.fn()} />)
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
    unmount()
    render(<ClientSheet rows={[...nine, row("Zed")]} view="today" onOpen={vi.fn()} />)
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zed" } })
    expect(names()).toEqual(["Zed"])
  })

  it("no-figure rows tucked behind Show N row", () => {
    render(<ClientSheet rows={[row("A"), blank("B"), blank("C")]} view="today" onOpen={vi.fn()} />)
    expect(names()).toEqual(["A"])
    const show = screen.getByRole("button", { name: /Show 2 clients with no figures/ })
    expect(show).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(show)
    expect(names()).toEqual(["A", "B", "C"])
    expect(screen.getByRole("button", { name: /Hide 2 clients with no figures/ })).toBeInTheDocument()
  })

  it("no-figure client to decide stays visible", () => {
    render(<ClientSheet rows={[row("A"), blank("B", { chip: { k: "check" } }), blank("C")]} view="today" onOpen={vi.fn()} />)
    expect(names()).toEqual(["B", "A"])
    expect(within(table()).getByText("Check")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Show 1 client with no figures/ })).toBeInTheDocument()
  })

  it("past view always ranked and shows N decided", () => {
    render(<ClientSheet rows={[row("A", { cpl: 6, decided: 1, readOnly: true }), row("B", { cpl: 2, readOnly: true })]} view="past" onOpen={vi.fn()} />)
    expect(screen.queryByRole("tab", { name: "Most urgent" })).not.toBeInTheDocument()
    expect(within(table()).getByRole("columnheader", { name: "Rank" })).toBeInTheDocument()
    expect(names()).toEqual(["B", "A"])
    expect(within(table()).getByText("1 decided")).toBeInTheDocument()
  })

  it("opens latest card for client outside batch", () => {
    const onOpen = vi.fn()
    const late = blank("Late", { readOnly: true, cardId: "old-card", runId: "r0" })
    render(<ClientSheet rows={[row("A"), late]} view="today" onOpen={onOpen} />)
    fireEvent.click(screen.getByRole("button", { name: /Show 1 client/ }))
    fireEvent.click(within(table()).getByRole("button", { name: "Late: open Birdy's chat" }))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen.mock.calls[0][0]).toMatchObject({ gid: "late", cardId: "old-card", readOnly: true })
  })

  it("row without any card is not clickable", () => {
    const onOpen = vi.fn()
    render(<ClientSheet rows={[row("A", { cardId: null })]} view="today" onOpen={onOpen} />)
    expect(within(table()).queryByRole("button", { name: /open Birdy's chat/ })).not.toBeInTheDocument()
    fireEvent.click(within(table()).getByText("A"))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
