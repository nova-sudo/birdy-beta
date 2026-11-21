import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import "@/components/by/__tests__/jsdom"

const data = { groups: [], loading: false, error: null }
const asked = []
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams("") }))
vi.mock("@/lib/useClientGroups", () => ({
  useClientGroups: (preset) => { asked.push(preset); return { clientGroups: data.groups, loading: data.loading, error: data.error, refresh: vi.fn() } },
}))

import { BuyerProjections } from "../projections-tab"

const group = (id, name, spend, results, targets = {}) => ({ id, name, client_status: "Active", targets, facebook: { currency: "GBP", metrics: { insights: { spend, results } } } })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-21T10:00:00Z")) // day 21 of 30, 20.5 days gone
  asked.length = 0
  data.loading = false
  data.error = null
  data.groups = [group("a", "Northside", 2050, 100, { monthly_spend: 3000, cpl: 20 }), group("b", "Harbour", 2700, 90, { monthly_spend: 3000, cpl: 30 }), group("c", "Brightwell", 410, 10)]
})
afterEach(() => vi.useRealTimers())

describe("Media Buyer › Projections", () => {
  it("reads this month's figures and paces the budgets", () => {
    render(<BuyerProjections client={null} />)
    expect(asked).toContain("this_month")
    expect(screen.getByText("November · day 21 of 30 · 3 clients")).toBeInTheDocument()
    // 4,750 spent over 20.5 days → 6,951 by day 30, against 6,000 of budgets.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Overspending for a £6,000 budget")
    expect(screen.getByText(/in November, £951 over the budgets/)).toBeInTheDocument()
    const sheet = screen.getByRole("table", { name: /so far, on pace for/ })
    const spend = within(sheet).getByRole("row", { name: /Ad spend/ })
    expect(spend).toHaveTextContent("£4,750£6,951£6,000+£951")
  })

  it("lists every client, budgets first, with its pace and when its budget runs out", () => {
    render(<BuyerProjections client={null} />)
    const rows = within(screen.getByRole("table", { name: /Each client/ })).getAllByRole("row").slice(1)
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual(["Harbour", "Northside", "Brightwell"])
    expect(rows[0]).toHaveTextContent("Overspending")
    expect(rows[0]).toHaveTextContent("Runs out 23 Nov")
    expect(rows[2]).toHaveTextContent("No budget")
  })

  it("narrows to one client inside it", () => {
    render(<BuyerProjections client={{ id: "a", name: "Northside" }} />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("On pace for its £3,000 budget")
    expect(screen.queryByRole("table", { name: /Each client/ })).toBeNull()
  })

  it("says plainly when no client has a budget, and still shows the straight line", () => {
    data.groups = [group("c", "Brightwell", 410, 10)]
    render(<BuyerProjections client={null} />)
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("On pace for £600 in November")
    expect(screen.getByText(/No client has a monthly budget yet/)).toBeInTheDocument()
  })

  it("has honest loading and error states", () => {
    data.groups = []
    data.loading = true
    const { rerender } = render(<BuyerProjections client={null} />)
    expect(screen.getByLabelText("Loading projections")).toBeInTheDocument()
    data.loading = false
    data.error = new Error("down")
    rerender(<BuyerProjections client={null} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load this month’s spend")
  })
})
