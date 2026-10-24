import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const pathnameMock = vi.hoisted(() => ({ value: "/dashboard" }))
const openBirdyChat = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/ask-birdy", () => ({ openBirdyChat, askBirdy: vi.fn() }))
const HEALTHY = {
  loading: false, balance: 40, allowance: 100, used: 60, remainingAllowance: 40,
  isOut: false, low: false, subscribed: true,
}
const creditsMock = vi.hoisted(() => ({ value: null }))
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => creditsMock.value }))
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isAdmin: false }) }))
const jobsMock = vi.hoisted(() => ({ value: [] }))
vi.mock("@/lib/jobs-store", () => ({ useJobs: () => jobsMock.value }))
vi.mock("@/components/birdy/use-birdy", () => ({ useBirdy: () => ({ state: "idle" }) }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({
  default: ({ size }) => <span data-testid="avatar" data-size={size} />,
}))
vi.mock("@/components/NotificationsDropdown", () => ({
  default: () => <button type="button" aria-label="Notifications" />,
}))

import { PageHeaderProvider, usePageHeader } from "@/components/page-header"
import {
  SidebarCredits,
  SidebarJobs,
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
  jobsMock.value = []
  localStorage.clear()
  creditsMock.value = HEALTHY
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

  it("shows the stored user's name on the account trigger", () => {
    localStorage.setItem("user", JSON.stringify({ name: "Sam Rivera" }))
    render(<AppSidebar />)
    expect(screen.getByRole("button", { name: "Account menu" }).textContent).toContain("Sam Rivera")
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

function Publisher({ content }) {
  usePageHeader(content)
  return null
}

describe("TopBar context title", () => {
  it("falls back to the title the page published", () => {
    const content = { title: <span>Published title</span> }
    render(
      <PageHeaderProvider>
        <Publisher content={content} />
        <TopBar />
      </PageHeaderProvider>
    )
    expect(screen.getByText("Published title")).toBeTruthy()
  })
})

describe("SidebarCredits", () => {
  it("is success-toned with the used count when healthy", () => {
    const { container } = render(<SidebarCredits />)
    expect(screen.getByText("60 / 100 used")).toBeTruthy()
    expect(container.querySelector(".bg-success").style.width).toBe("40%")
  })

  it("turns warning when low", () => {
    creditsMock.value = { ...HEALTHY, low: true, remainingAllowance: 10 }
    const { container } = render(<SidebarCredits />)
    expect(screen.getByText("Running low — top up")).toBeTruthy()
    expect(container.querySelector(".bg-warning").style.width).toBe("10%")
  })

  it("turns danger when out", () => {
    creditsMock.value = { ...HEALTHY, isOut: true, balance: 0, remainingAllowance: 0 }
    const { container } = render(<SidebarCredits />)
    expect(screen.getByText("Out — top up")).toBeTruthy()
    expect(container.querySelector(".bg-danger").style.width).toBe("0%")
  })
})

describe("SidebarJobs", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<SidebarJobs />)
    expect(container.firstChild).toBeNull()
  })

  it("summarises one job by label", () => {
    jobsMock.value = [{ id: 1, label: "Analysing calls", status: "running", startedAt: Date.now() }]
    render(<SidebarJobs />)
    expect(screen.getByText("Analysing calls")).toBeTruthy()
  })

  it("summarises several jobs by count", () => {
    jobsMock.value = [
      { id: 1, label: "A", status: "running", startedAt: Date.now() },
      { id: 2, label: "B", status: "running", startedAt: Date.now() },
    ]
    render(<SidebarJobs />)
    expect(screen.getByText("2 tasks running")).toBeTruthy()
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
