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
  PageCard,
} from "@/components/ds"
import AdminShell from "@/components/admin/AdminShell"

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

  it("marks the current row with data-active and leaves its icon untinted", () => {
    pathnameMock.value = "/clients/abc"
    render(<AppSidebar />)
    const row = screen.getByRole("link", { name: "Clients" })
    expect(row.getAttribute("data-active")).toBe("true")
    expect(row).toHaveClass("h-10", "md:h-8", "rounded-control-sm", "data-[active=true]:bg-raised")
    expect(row.querySelector("svg").getAttribute("class")).not.toContain("text-primary")
  })

  it("is 256 wide and draws the account trigger as a brand tile over a label", () => {
    const { container } = render(<AppSidebar agencyName="Northwind" />)
    expect(container.querySelector('[data-ds="app-sidebar"]')).toHaveClass("w-64")
    const trigger = screen.getByRole("button", { name: "Account menu" })
    const tile = trigger.querySelector('[data-slot="brand-tile"]')
    expect(tile.textContent).toBe("N")
    expect(tile).toHaveClass("size-8", "rounded-[9px]")
    expect(trigger.textContent).toContain("Northwind")
  })

  it("captions the account trigger, but not on the minimal admin sidebar", () => {
    const { unmount } = render(<AppSidebar agencyName="Northwind" />)
    expect(screen.getByRole("button", { name: "Account menu" }).textContent).toContain("Agency workspace")
    unmount()
    render(<AppSidebar agencyName="Admin" minimal />)
    expect(screen.getByRole("button", { name: "Account menu" }).textContent).toBe("A" + "Admin")
  })

  it("takes a caption override", () => {
    render(<AppSidebar agencyName="Northwind" caption="3 clients" />)
    expect(screen.getByRole("button", { name: "Account menu" }).textContent).toContain("3 clients")
  })

  it("animates its width only when asked", () => {
    const { container, rerender } = render(<AppSidebar />)
    const aside = () => container.querySelector('[data-ds="app-sidebar"]')
    expect(aside().className).not.toContain("transition-[width]")
    rerender(<AppSidebar animated />)
    expect(aside().className).toContain("motion-safe:transition-[width]")
  })

  it("collapses to the 56 rail: icons only, names kept for assistive tech", () => {
    const { container } = render(<AppSidebar collapsed />)
    const aside = container.querySelector('[data-ds="app-sidebar"]')
    expect(aside.getAttribute("data-state")).toBe("collapsed")
    expect(aside).toHaveClass("w-14")
    expect(screen.queryByRole("tab", { name: "Ask Birdy" })).toBeNull()
    expect(screen.getByRole("link", { name: "Clients" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy()
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

  it("sits on the canvas: 52 tall, no border, no fill", () => {
    const { container } = render(<TopBar title="Clients" />)
    const bar = container.querySelector('[data-ds="top-bar"]')
    expect(bar).toHaveClass("h-[52px]")
    expect(bar.className).not.toMatch(/border-b|bg-background/)
  })

  it("toggles the sidebar from its trigger", () => {
    const onToggle = vi.fn()
    render(<TopBar title="Clients" onToggleSidebar={onToggle} />)
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it("shows Ask Birdy as a small secondary button with two key caps", () => {
    render(<TopBar title="Clients" />)
    const ask = screen.getAllByRole("button", { name: /Ask Birdy/ }).find((b) => b.textContent.includes("Ask Birdy"))
    expect(ask).toHaveClass("h-8", "pr-1.5")
    expect(ask.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2)
  })
})

describe("TopBar minimal", () => {
  it("keeps the title, actions and menu button but drops search, Ask Birdy, the bell and the toggle", () => {
    const onMenu = vi.fn()
    render(<TopBar minimal title="Admin" actions={<button>Back</button>} onMenuClick={onMenu} />)
    expect(screen.getByText("Admin")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(onMenu).toHaveBeenCalled()
    for (const name of ["Search", /Ask Birdy/, "Notifications", "Toggle sidebar"]) {
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })
})

describe("PageCard", () => {
  it("is the white page card under the top bar, with main in the 1360 column", () => {
    render(<PageCard><p>page body</p></PageCard>)
    const card = document.querySelector('[data-ds="page-card"]')
    expect(card).toHaveAttribute("data-slot", "page-surface")
    expect(card).toHaveClass("bg-background", "shadow-surface", "md:mr-2", "md:mb-2", "md:rounded-frame")
    const main = screen.getByRole("main")
    expect(card.contains(main)).toBe(true)
    expect(screen.getByText("page body").parentElement).toHaveClass("max-w-[1360px]", "mx-auto", "px-4", "md:px-6", "xl:px-10", "md:pt-9")
  })
})

describe("AdminShell", () => {
  it("sits on the canvas like the main shell: borderless top bar over the page card", () => {
    render(<AdminShell><p>admin body</p></AdminShell>)
    const bar = document.querySelector('[data-ds="top-bar"]')
    expect(bar).toHaveClass("h-[52px]")
    expect(bar.className).not.toMatch(/border-b|bg-background/)
    expect(screen.getByRole("heading", { level: 1, name: "Admin" })).toBeTruthy()
    expect(screen.getByText("Internal")).toBeTruthy()
    expect(screen.getByRole("link", { name: /Back to Birdy/ })).toHaveAttribute("href", "/dashboard")
    // The admin console is its own tool: no assistant, search or bell up there.
    expect(screen.queryByRole("button", { name: /Ask Birdy/ })).toBeNull()

    const card = document.querySelector('[data-ds="page-card"]')
    expect(card.contains(bar)).toBe(false)
    expect(card).toHaveTextContent("admin body")
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy()
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
  it("renders an h1 at 32px with description and actions", () => {
    render(<PageHeader eyebrow="Portfolio" title="Clients" description="All accounts" actions={<button>New</button>} />)
    const h1 = screen.getByRole("heading", { level: 1, name: "Clients" })
    expect(h1.className).toContain("text-[32px]")
    expect(screen.getByText("All accounts")).toBeTruthy()
    expect(screen.getByText("Portfolio")).toBeTruthy()
    expect(screen.getByRole("button", { name: "New" })).toBeTruthy()
  })

  it("lets the period and actions wrap instead of widening the page on a phone", () => {
    render(<PageHeader title="Clients" period={<span>Period</span>} actions={<button>New</button>} />)
    const row = document.querySelector('[data-slot="page-header-actions"]')
    // flex-wrap with a width cap, not shrink-0: a fixed-width row overflowed 390px by 110px.
    expect(row).toHaveClass("flex-wrap", "max-w-full")
    expect(row).not.toHaveClass("shrink-0")
  })

  it("titles at 26 on a phone and 32 from md, with tracking", () => {
    render(<PageHeader title="Clients" description="All accounts" />)
    const h1 = screen.getByRole("heading", { level: 1 })
    expect(h1).toHaveClass("text-[26px]", "md:text-[32px]", "md:leading-9", "tracking-[-0.02em]")
    expect(screen.getByText("All accounts")).toHaveClass("text-sm", "md:text-base")
  })

  it("renders titleExtra, leading and a back link", () => {
    render(
      <PageHeader
        title="Acme"
        titleExtra={<span>Active</span>}
        leading={<span>Logo</span>}
        backButton={{ label: "Clients", href: "/clients" }}
      />
    )
    expect(screen.getByText("Active")).toBeTruthy()
    expect(screen.getByText("Logo")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Clients" }).getAttribute("href")).toBe("/clients")
  })

  it("puts the period first in the actions row, which fills the width on a phone", () => {
    render(<PageHeader title="Clients" period={<span>Period</span>} actions={<button>New</button>} />)
    const row = document.querySelector('[data-slot="page-header-actions"]')
    expect(row.firstChild.textContent).toBe("Period")
    expect(row).toHaveClass("max-md:w-full", "md:ml-auto")
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

  it("keeps the account trigger clear of the sheet's close button", () => {
    render(<MobileNavSheet open onOpenChange={() => {}} />)
    const sheet = document.querySelector('[data-ds="sheet"]')
    const header = sheet.querySelector('[data-slot="sidebar-header"]')
    expect(header).toHaveClass("pr-10")
    expect(header.contains(screen.getByRole("button", { name: "Account menu" }))).toBe(true)
  })
})
