import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

const pathnameMock = vi.hoisted(() => ({ value: "/dashboard" }))

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock.value,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("next/dynamic", () => ({
  default: () => function ChatStub() {
    return <div role="dialog" aria-label="Birdy chat" />
  },
}))
vi.mock("@/lib/fonts", () => ({ fontVariables: "" }))
vi.mock("@/components/ProtectedLayout", () => ({ default: ({ children }) => <>{children}</> }))
vi.mock("@/components/swr-provider", () => ({ default: ({ children }) => <>{children}</> }))
vi.mock("@/components/birdy/BirdyDefs", () => ({ default: () => null }))
vi.mock("@/components/ImpersonationBar", () => ({ default: () => null }))
vi.mock("@/components/NotificationsDropdown", () => ({ default: () => null }))
vi.mock("@/components/birdy/use-birdy", () => ({ useBirdy: () => ({ state: "idle" }) }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: () => <span /> }))
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isAdmin: false }) }))
vi.mock("@/hooks/useCredits", () => ({
  CreditsProvider: ({ children }) => <>{children}</>,
  useCredits: () => ({
    loading: false, balance: 40, allowance: 100, used: 60, remainingAllowance: 40,
    isOut: false, low: false, subscribed: true,
  }),
}))
vi.mock("@/lib/jobs-store", () => ({ useJobs: () => [] }))
vi.mock("@/components/dashboard-controls", () => ({
  DashboardControlsProvider: ({ children }) => <>{children}</>,
}))

import RootLayout from "../layout"
import { ASK_BIRDY_EVENT } from "@/lib/ask-birdy"

function renderLayout() {
  return render(<RootLayout><p>page body</p></RootLayout>)
}

describe("RootLayout shell", () => {
  beforeEach(() => {
    pathnameMock.value = "/dashboard"
    // cmdk (the search palette) needs these; jsdom has neither.
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    Element.prototype.scrollIntoView ??= () => {}
  })

  it("renders the navigation and a main inside the rounded frame", () => {
    renderLayout()
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument()
    const main = screen.getByRole("main")
    expect(main.closest('[class*="rounded-frame"]')).not.toBeNull()
    expect(main).toHaveTextContent("page body")
  })

  it("puts the top bar on the canvas above the page card, and the page in the 1360 column", () => {
    renderLayout()
    const surface = document.querySelector('[data-slot="page-surface"]')
    expect(surface).toHaveClass("md:mr-2", "md:mb-2", "md:rounded-frame", "shadow-surface")
    expect(surface.querySelector('[data-ds="top-bar"]')).toBeNull()
    const column = screen.getByText("page body").parentElement
    expect(column).toHaveClass("max-w-[1360px]", "mx-auto", "px-4", "pt-6", "md:px-10", "md:pt-9", "md:pb-10")
  })

  it("collapses the sidebar to its rail from the top-bar trigger", () => {
    renderLayout()
    const rail = document.querySelector('[data-ds="app-sidebar"]')
    expect(rail.getAttribute("data-state")).toBe("expanded")
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }))
    expect(rail.getAttribute("data-state")).toBe("collapsed")
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }))
    expect(rail.getAttribute("data-state")).toBe("expanded")
  })

  it("remembers the collapsed rail across reloads, without animating it in", () => {
    localStorage.clear()
    const first = renderLayout()
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }))
    expect(localStorage.getItem("birdy.sidebarCollapsed")).toBe("1")
    first.unmount()

    renderLayout()
    const rail = document.querySelector('[data-ds="app-sidebar"]')
    expect(rail.getAttribute("data-state")).toBe("collapsed")
    expect(rail.className).not.toContain("transition-[width]")

    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }))
    expect(localStorage.getItem("birdy.sidebarCollapsed")).toBe("0")
    expect(rail.className).toContain("transition-[width]")
    localStorage.clear()
  })

  it("holds a data-main-fill page to main's height", () => {
    render(<RootLayout><div data-main-fill>chat</div></RootLayout>)
    const column = screen.getByText("chat").parentElement
    expect(column).toHaveClass("has-[[data-main-fill]]:min-h-0", "flex-1", "flex-col")
  })

  it("renders no navigation on shell-less routes", () => {
    pathnameMock.value = "/login"
    renderLayout()
    expect(screen.queryByRole("navigation")).toBeNull()
    expect(screen.getByText("page body")).toBeInTheDocument()
  })

  it("opens the chat dialog when a question is announced", () => {
    renderLayout()
    expect(screen.queryByRole("dialog")).toBeNull()
    act(() => {
      window.dispatchEvent(new CustomEvent(ASK_BIRDY_EVENT, { detail: { message: "hi" } }))
    })
    expect(screen.getByRole("dialog", { name: "Birdy chat" })).toBeInTheDocument()
  })

  // Opening the mobile sheet runs before any palette test: a palette left
  // mounted by a finished test (Radix keeps closing content until an
  // animationend that jsdom never fires) leaves a second focus trap behind,
  // and two traps fighting over focus spin forever.
  it("closes the mobile navigation sheet on a route change", () => {
    const { rerender } = renderLayout()
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }))
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument()
    pathnameMock.value = "/clients"
    rerender(<RootLayout><p>page body</p></RootLayout>)
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("opens the chat on Ctrl+J", () => {
    renderLayout()
    fireEvent.keyDown(window, { key: "j", ctrlKey: true })
    expect(screen.getByRole("dialog", { name: "Birdy chat" })).toBeInTheDocument()
  })

  it("opens the search on Ctrl+K", () => {
    renderLayout()
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(screen.getByPlaceholderText(/Search pages/)).toBeInTheDocument()
  })

  it("sends the typed text to Birdy when the Ask row is chosen", () => {
    const heard = vi.fn()
    const onAsk = (e) => heard(e.detail)
    window.addEventListener(ASK_BIRDY_EVENT, onAsk)
    renderLayout()
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    fireEvent.change(screen.getByPlaceholderText(/Search pages/), { target: { value: "roas this week" } })
    fireEvent.click(screen.getByText("Ask Birdy: roas this week"))
    window.removeEventListener(ASK_BIRDY_EVENT, onAsk)
    expect(heard).toHaveBeenCalledWith({ message: "roas this week" })
    expect(screen.getByRole("dialog", { name: "Birdy chat" })).toBeInTheDocument()
  })
})
