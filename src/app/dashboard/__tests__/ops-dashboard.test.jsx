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
// The page itself is covered by page.test.jsx; here it only reports what it was handed and publishes a count.
vi.mock("../portfolio-dashboard", () => ({
  PortfolioDashboard: function Stub({ clientId, onClientName }) {
    const { preset, setClientCount } = useDashboardControls()
    seen.preset = preset
    seen.clientId = clientId
    useEffect(() => setClientCount(12), [setClientCount])
    useEffect(() => onClientName?.(clientId ? "Aura Aesthetics" : null), [clientId, onClientName])
    return <p>Portfolio page</p>
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  route.search = ""
  seen.preset = null
})

describe("Birdy's Dashboard", () => {
  it("shows the old page under the section header, with Chat, Bird's Eye and Suggestions", () => {
    render(<OpsDashboard />)
    expect(screen.getByText("Portfolio page")).toBeInTheDocument()
    const views = screen.getByRole("tablist", { name: "Agency Ops views" })
    expect(within(views).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Chat", "Bird's Eye", "Dashboard", "Suggestions2"])
    expect(within(views).getByRole("tab", { name: "Bird's Eye" })).toHaveAttribute("aria-selected", "true")
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

  it("is the same old page inside a client, narrowed to that client", () => {
    route.search = "client=a"
    render(<OpsDashboard />)
    expect(screen.getByText("Portfolio page")).toBeInTheDocument()
    expect(seen.clientId).toBe("a")
    expect(screen.getByText("Aura Aesthetics")).toBeInTheDocument()
  })
})
