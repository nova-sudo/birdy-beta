import { useEffect } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@/components/by/__tests__/jsdom"
import { useDashboardControls } from "@/components/dashboard-controls"
import { OpsDashboard } from "../ops-dashboard"

// Birdy's /dashboard: the old Portfolio Dashboard under the section header, its controls in the header.

const push = vi.fn()
const replace = vi.fn()
const route = { search: "" }
const seen = { preset: null }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(route.search),
}))
vi.mock("@/components/agency/use-suggestions", () => ({ useSuggestionCount: () => 2 }))
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))
vi.mock("@/components/agency/birds-eye", () => ({ BirdsEye: () => <p>Client view</p> }))
// The page itself is covered by page.test.jsx; here it only reports what it was handed and publishes a count.
vi.mock("../portfolio-dashboard", () => ({
  PortfolioDashboard: function Stub() {
    const { preset, setClientCount } = useDashboardControls()
    seen.preset = preset
    useEffect(() => setClientCount(12), [setClientCount])
    return <p>Portfolio page</p>
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  seen.preset = null
})

describe("Birdy's Dashboard", () => {
  it("shows the old page under the section header, with Chat, Dashboard and Suggestions", () => {
    render(<OpsDashboard />)
    expect(screen.getByText("Portfolio page")).toBeInTheDocument()
    const views = screen.getByRole("tablist", { name: "Birdy views" })
    expect(within(views).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Chat", "Dashboard", "Suggestions2"])
    expect(within(views).getByRole("tab", { name: "Dashboard" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Portfolio dashboard · 12 clients")).toBeInTheDocument()
  })

  it("keeps the date range in the address, and reads it from there", async () => {
    route.search = "range=last_30d"
    render(<OpsDashboard />)
    expect(seen.preset).toBe("last_30d")
    await userEvent.click(screen.getByRole("button", { name: /^Date range:/ }))
    await userEvent.click(screen.getByRole("option", { name: "Today" }))
    expect(replace).toHaveBeenCalledWith("/dashboard?range=today")
  })

  it("has one date range and the granularity chip, nothing else competing", () => {
    render(<OpsDashboard />)
    expect(screen.getAllByRole("button", { name: /^Date range:/ })).toHaveLength(1)
    expect(screen.getByRole("button", { name: /Chart granularity:/ })).toBeInTheDocument()
  })

  it("carries the range to the other tabs", async () => {
    route.search = "range=last_30d"
    render(<OpsDashboard />)
    await userEvent.click(screen.getByRole("tab", { name: "Chat" }))
    expect(push).toHaveBeenCalledWith("/dashboard/chat?range=last_30d")
  })

  it("stays the client view inside a client", () => {
    route.search = "client=a"
    render(<OpsDashboard />)
    expect(screen.getByText("Client view")).toBeInTheDocument()
    expect(screen.queryByText("Portfolio page")).toBeNull()
  })
})
