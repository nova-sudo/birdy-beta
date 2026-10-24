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
  DashboardHeaderTitle: () => null,
  DashboardHeaderControls: () => null,
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

  it("opens the chat on Ctrl+J and the search on Ctrl+K", () => {
    renderLayout()
    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(screen.getByPlaceholderText(/Search pages/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "j", ctrlKey: true })
    expect(screen.getByRole("dialog", { name: "Birdy chat" })).toBeInTheDocument()
  })
})
