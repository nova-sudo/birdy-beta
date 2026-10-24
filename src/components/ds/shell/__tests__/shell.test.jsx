import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const pathnameMock = vi.hoisted(() => ({ value: "/dashboard" }))
const openBirdyChat = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/ask-birdy", () => ({ openBirdyChat, askBirdy: vi.fn() }))
vi.mock("@/hooks/useCredits", () => ({
  useCredits: () => ({
    loading: false, balance: 40, allowance: 100, used: 60, remainingAllowance: 40,
    isOut: false, low: false, subscribed: true,
  }),
}))
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isAdmin: false }) }))
vi.mock("@/lib/jobs-store", () => ({ useJobs: () => [] }))
vi.mock("@/components/birdy/use-birdy", () => ({ useBirdy: () => ({ state: "idle" }) }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({
  default: ({ size }) => <span data-testid="avatar" data-size={size} />,
}))
vi.mock("@/components/NotificationsDropdown", () => ({
  default: () => <button type="button" aria-label="Notifications" />,
}))
vi.mock("@/components/dashboard-controls", () => ({
  DashboardHeaderTitle: () => null,
  DashboardHeaderControls: () => null,
}))

import {
  AppSidebar,
  TopBar,
  PageHeader,
  SystemBanner,
  MobileNavSheet,
  NAV_ITEMS,
} from "@/components/ds"

beforeEach(() => {
  pathnameMock.value = "/dashboard"
  openBirdyChat.mockClear()
})

describe("AppSidebar", () => {
  it("renders the nav links in NAV_ITEMS order", () => {
    render(<AppSidebar />)
    const nav = screen.getByRole("navigation", { name: "Main" })
    const links = Array.from(nav.querySelectorAll("a"))
    expect(links).toHaveLength(9)
    expect(links.map((a) => a.getAttribute("href"))).toEqual(NAV_ITEMS.map((i) => i.href))
  })

  it("marks the item whose path contains the current route as current", () => {
    pathnameMock.value = "/clients/abc"
    render(<AppSidebar />)
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull()
  })

  it("caps a badge at 99+", () => {
    const items = [{ ...NAV_ITEMS[0], badge: () => 120 }]
    render(<AppSidebar items={items} />)
    expect(screen.getByText("99+")).toBeTruthy()
  })

  it("truncates a long agency name", () => {
    render(<AppSidebar agencyName="An Extremely Long Agency Name Incorporated Worldwide" />)
    const name = screen.getByText(/An Extremely Long/)
    expect(name.className).toContain("truncate")
  })

  it("opens the Birdy chat from the Ask Birdy segment", () => {
    render(<AppSidebar />)
    fireEvent.click(screen.getByRole("tab", { name: "Ask Birdy" }))
    expect(openBirdyChat).toHaveBeenCalledTimes(1)
  })

  it("carries data-ds", () => {
    const { container } = render(<AppSidebar />)
    expect(container.querySelector('[data-ds="app-sidebar"]')).toBeTruthy()
  })
})

describe("TopBar", () => {
  it("renders the title, a menu button and the Ask Birdy action", () => {
    const onMenu = vi.fn()
    render(<TopBar title="Clients" actions={<button>Export</button>} onMenuClick={onMenu} />)
    expect(screen.getByText("Clients")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(onMenu).toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole("button", { name: /Ask Birdy/ })[0])
    expect(openBirdyChat).toHaveBeenCalled()
  })

  it("can shrink below its content so it fits at 390px", () => {
    const { container } = render(<TopBar title="A very long page title" />)
    const bar = container.querySelector('[data-ds="top-bar"]')
    expect(bar.className).toContain("min-w-0")
    expect(screen.getByText("A very long page title").closest("[class*='truncate']")).toBeTruthy()
    // Search is an icon button below md; the pill text is not rendered.
    expect(screen.getByRole("button", { name: "Search" }).className).toContain("md:hidden")
  })
})

describe("PageHeader", () => {
  it("renders an h1 at text-2xl with description and actions", () => {
    render(<PageHeader eyebrow="Portfolio" title="Clients" description="All accounts" actions={<button>New</button>} />)
    const h1 = screen.getByRole("heading", { level: 1, name: "Clients" })
    expect(h1.className).toContain("text-2xl")
    expect(screen.getByText("All accounts")).toBeTruthy()
    expect(screen.getByText("Portfolio")).toBeTruthy()
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy()
  })
})

describe("SystemBanner", () => {
  it("is a status region and dismisses", () => {
    const onDismiss = vi.fn()
    render(
      <SystemBanner tone="danger" onDismiss={onDismiss} action={<a href="/x">Fix</a>}>
        Meta is disconnected
      </SystemBanner>
    )
    const banner = screen.getByRole("status")
    expect(banner.className).toContain("bg-danger-soft")
    expect(screen.getByText("Meta is disconnected")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("has no dismiss button without onDismiss", () => {
    render(<SystemBanner tone="info">Heads up</SystemBanner>)
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull()
  })
})

describe("MobileNavSheet", () => {
  it("renders the sidebar inside a left sheet when open", () => {
    render(<MobileNavSheet open onOpenChange={() => {}} />)
    const sheet = document.querySelector('[data-ds="sheet"]')
    expect(sheet.getAttribute("data-side")).toBe("left")
    expect(sheet.querySelector('[data-ds="app-sidebar"]')).toBeTruthy()
  })
})
