import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

const push = vi.fn()
let search = ""
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}))

let list = []
let archivedList = []
vi.mock("@/lib/creatives-api", () => ({
  useCreativeTests: (f) => ({ tests: f?.status === "archived" ? archivedList : list, isLoading: false }),
}))
vi.mock("@/lib/usePageViews", () => ({ usePageViews: () => ({ views: [] }) }))
vi.mock("@/components/views/ColumnsMenu", () => ({ default: () => <button type="button">Columns</button> }))
vi.mock("../CreativeDetailSheet", () => ({
  CreativeDetailSheet: ({ testId, open }) => (open ? <div data-testid="sheet">sheet for {testId}</div> : null),
}))

import { CreativesTab } from "../CreativesTab"

const mk = (id, code, name, status) => ({
  id,
  code,
  name,
  status,
  targets: {},
  creative: { format: "video", media: {} },
  summary: { currency: "GBP", spend: 10, leads: 1, cpl: 10 },
  ads: [],
})

beforeEach(() => {
  push.mockClear()
  search = ""
  list = [
    mk("a", "CT-0041", "Alpha ad", "testing"),
    mk("b", "CT-0042", "Beta ad", "winner"),
    mk("c", "CT-0043", "Gamma ad", "loser"),
  ]
  archivedList = []
})

const rows = () => within(screen.getByRole("table"))

describe("CreativesTab", () => {
  it("shows the period-picker note", () => {
    render(<CreativesTab />)
    expect(screen.getByText(/Tests use their own dates; the period picker doesn't apply/)).toBeInTheDocument()
  })

  it("status chips filter rows and show counts", () => {
    render(<CreativesTab />)
    expect(rows().getByText("Alpha ad")).toBeInTheDocument()
    expect(rows().getByText("Beta ad")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: /Winners/ }))
    expect(rows().getByText("Beta ad")).toBeInTheDocument()
    expect(rows().queryByText("Alpha ad")).toBeNull()
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("3")
  })

  it("search narrows rows by name or code", () => {
    render(<CreativesTab />)
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "CT-0043" } })
    expect(rows().getByText("Gamma ad")).toBeInTheDocument()
    expect(rows().queryByText("Alpha ad")).toBeNull()
  })

  it("?creative=CT-0042 opens the sheet for that code", () => {
    search = "creative=CT-0042"
    render(<CreativesTab />)
    expect(screen.getByTestId("sheet")).toHaveTextContent("sheet for b")
  })

  it("clicking a row opens its sheet", () => {
    render(<CreativesTab />)
    expect(screen.queryByTestId("sheet")).toBeNull()
    fireEvent.click(rows().getByText("Alpha ad"))
    expect(screen.getByTestId("sheet")).toHaveTextContent("sheet for a")
  })

  it("New creative test goes to the wizard", () => {
    render(<CreativesTab />)
    fireEvent.click(screen.getByRole("button", { name: "New creative test" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/new")
  })

  it("empty state offers both paths", () => {
    list = []
    render(<CreativesTab />)
    fireEvent.click(screen.getByRole("button", { name: "Create a new ad" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/new")
    fireEvent.click(screen.getByRole("button", { name: "Test an ad you already have" }))
    expect(push).toHaveBeenCalledWith("/campaigns/creatives/new?path=revive")
  })
})
