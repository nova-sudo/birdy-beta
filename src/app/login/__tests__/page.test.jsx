import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}))

const publicRequest = vi.fn()
const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  publicRequest: (...args) => publicRequest(...args),
  apiRequest: (...args) => apiRequest(...args),
}))

const checkAndRefreshExpiredTokens = vi.fn()
vi.mock("@/lib/checkExpiredTokens", () => ({
  checkAndRefreshExpiredTokens: (...args) => checkAndRefreshExpiredTokens(...args),
}))
vi.mock("@/lib/prefetch", () => ({ prefetchAfterLogin: vi.fn() }))

// Stands in for the dynamically imported Silk, which needs a GL context.
vi.mock("@/components/Silk", () => ({ default: () => <div data-testid="silk" /> }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

import LoginPage from "@/app/login/page"

const LEGACY = new RegExp(["\\bp", "d-|text-\\[\\d"].join(""))

describe("login page", () => {
  beforeEach(() => {
    push.mockClear()
    publicRequest.mockReset()
    apiRequest.mockReset()
    checkAndRefreshExpiredTokens.mockReset()
    localStorage.clear()
  })

  it("renders ds fields and the switch-page link", async () => {
    const { container } = render(<LoginPage />)
    expect(await screen.findByLabelText(/email address/i)).toHaveAttribute("data-ds", "input")
    expect(container.querySelector('[data-ds="label"]')).toBeTruthy()
    expect(container.querySelector('[data-ds="button"][type="submit"]')).toBeTruthy()
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register")
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/billing/terms-of-service")
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/billing/privacy-policy")
  })

  it("marks the submit busy while the request is pending", async () => {
    publicRequest.mockReturnValue(new Promise(() => {}))
    render(<LoginPage />)
    await userEvent.type(await screen.findByLabelText(/email address/i), "a@b.com")
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))
    expect(await screen.findByRole("button", { name: /signing in/i })).toHaveAttribute("aria-busy", "true")
  })

  it("still loads Silk dynamically into the panel", async () => {
    render(<LoginPage />)
    expect(await screen.findByTestId("silk")).toBeInTheDocument()
  })

  it("has no legacy classes and no inline hex", async () => {
    const { container } = render(<LoginPage />)
    await screen.findByLabelText(/email address/i)
    const classes = [...container.querySelectorAll("[class]")].map((e) => e.getAttribute("class")).join(" ")
    expect(classes).not.toMatch(LEGACY)
    const styles = [...container.querySelectorAll("[style]")].map((e) => e.getAttribute("style")).join(" ")
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it("shows the server's error in a danger notice", async () => {
    publicRequest.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Invalid email or password" }),
    })
    const { container } = render(<LoginPage />)
    await userEvent.type(await screen.findByLabelText(/email address/i), "a@b.com")
    await userEvent.type(screen.getByLabelText("Password"), "wrongwrong")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))

    const text = await screen.findByText("Invalid email or password")
    expect(screen.getByRole("alert")).toBe(text.closest('[data-ds="notice"]'))
    const notice = text.closest('[data-ds="notice"]')
    expect(notice).toBe(container.querySelector('[data-ds="notice"]'))
    expect(notice.className).toMatch(/bg-danger-soft/)
    expect(push).not.toHaveBeenCalled()
  })

  it("signs in, stores the session and pushes to the dashboard", async () => {
    publicRequest.mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Login successful", user: { role: "user", email: "a@b.com" } }),
    })
    apiRequest.mockResolvedValue({ ok: true, json: async () => ({ completed: true }) })
    checkAndRefreshExpiredTokens.mockImplementation(async (path) => path)
    render(<LoginPage />)
    await userEvent.type(await screen.findByLabelText(/email address/i), "a@b.com")
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2")
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(push).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem("user")).email).toBe("a@b.com")
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
