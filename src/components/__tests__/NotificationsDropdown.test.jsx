import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

let swr = { data: undefined, isLoading: false }
vi.mock("swr", () => ({ default: () => swr }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/birdy/birdy-store", () => ({ flash: vi.fn() }))

const { default: NotificationsDropdown } = await import("@/components/NotificationsDropdown")

const real = (id, name) => ({ id, name, last_triggered_at: "2026-10-01T10:00:00Z" })

beforeEach(() => {
  swr = { data: { triggered: [real(1, "CPL too high"), real(2, "Leads dropped")] }, isLoading: false }
})

describe("NotificationsDropdown", () => {
  it("shows the unread count on the bell, built from ds parts", () => {
    const { container } = render(<NotificationsDropdown />)
    const bell = screen.getByRole("button", { name: "Notifications" })
    expect(bell.getAttribute("data-ds")).toBe("button")
    const badge = container.querySelector('[data-ds="badge"]')
    expect(badge.textContent).toBe("2")
  })

  it("shows no count when nothing has triggered", () => {
    swr = { data: { triggered: [] }, isLoading: false }
    const { container } = render(<NotificationsDropdown />)
    expect(container.querySelector('[data-ds="badge"]')).toBeNull()
  })

  it("lists the triggered alerts in a ds popover", async () => {
    const user = userEvent.setup()
    render(<NotificationsDropdown />)
    await user.click(screen.getByRole("button", { name: "Notifications" }))
    const popover = document.querySelector('[data-ds="popover"]')
    expect(popover).not.toBeNull()
    expect(popover.textContent).toContain("CPL too high")
    expect(popover.textContent).toContain("Leads dropped")
  })

  it("caps the count at 99+", () => {
    swr = { data: { triggered: Array.from({ length: 120 }, (_, i) => real(i + 1, `Alert ${i}`)) }, isLoading: false }
    const { container } = render(<NotificationsDropdown />)
    expect(container.querySelector('[data-ds="badge"]').textContent).toBe("99+")
  })
})
