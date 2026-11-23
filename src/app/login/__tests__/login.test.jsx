import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
let search = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search,
}))

const publicRequest = vi.fn()
const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  publicRequest: (...args) => publicRequest(...args),
  apiRequest: (...args) => apiRequest(...args),
}))

const checkTokens = vi.fn()
vi.mock("@/lib/checkExpiredTokens", () => ({
  checkAndRefreshExpiredTokens: (...args) => checkTokens(...args),
}))
const prefetch = vi.fn()
vi.mock("@/lib/prefetch", () => ({ prefetchAfterLogin: () => prefetch() }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

import LoginPage from "@/app/login/page"

const json = (body, ok = true) => ({ ok, json: async () => body })
const USER = { email: "me@agency.com", role: "user", default_currency: "GBP" }

async function signIn(user = userEvent.setup()) {
  await user.type(screen.getByLabelText("Email"), "me@agency.com")
  await user.type(screen.getByLabelText("Password"), "secret-pass")
  await user.click(screen.getByRole("button", { name: /^sign in$/i }))
}

describe("login page", () => {
  beforeEach(() => {
    push.mockClear()
    publicRequest.mockReset()
    apiRequest.mockReset()
    checkTokens.mockReset()
    prefetch.mockClear()
    search = new URLSearchParams()
    localStorage.clear()
    document.cookie = "birdy_session=; max-age=0; path=/"
  })

  it("does not submit until both fields are filled with a valid email", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    await user.click(screen.getByRole("button", { name: /^sign in$/i }))
    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "x")
    await user.click(screen.getByRole("button", { name: /^sign in$/i }))

    expect(screen.getByLabelText("Email")).toBeInvalid()
    expect(publicRequest).not.toHaveBeenCalled()
  })

  it("shows and hides the password", async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    const field = screen.getByLabelText("Password")
    expect(field).toHaveAttribute("type", "password")

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(field).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: "Hide password" }))
    expect(field).toHaveAttribute("type", "password")
  })

  it("posts the credentials and goes on to the dashboard", async () => {
    publicRequest.mockResolvedValue(json({ message: "Login successful", user: USER }))
    apiRequest.mockResolvedValue(json({ completed: true }))
    checkTokens.mockImplementation(async (to) => to)
    render(<LoginPage />)

    await signIn()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    const [endpoint, options] = publicRequest.mock.calls[0]
    expect(endpoint).toBe("/api/login")
    expect(options.method).toBe("POST")
    expect(JSON.parse(options.body)).toEqual({ email: "me@agency.com", password: "secret-pass" })
    expect(apiRequest).toHaveBeenCalledWith("/api/onboarding/status")
    expect(prefetch).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(USER)
    expect(JSON.parse(localStorage.getItem("user_authenticated")).value).toBe(true)
    expect(localStorage.getItem("user_default_currency")).toBe("GBP")
  })

  it("honours ?redirect= after sign-in", async () => {
    search = new URLSearchParams("redirect=/clients/abc")
    publicRequest.mockResolvedValue(json({ message: "Login successful", user: USER }))
    apiRequest.mockResolvedValue(json({ completed: true }))
    checkTokens.mockImplementation(async (to) => to)
    render(<LoginPage />)

    await signIn()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clients/abc"))
    expect(checkTokens).toHaveBeenCalledWith("/clients/abc")
  })

  it("sends an account that has not finished setup to /welcome", async () => {
    publicRequest.mockResolvedValue(json({ message: "Login successful", user: USER }))
    apiRequest.mockResolvedValue(json({ completed: false }))
    render(<LoginPage />)

    await signIn()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome"))
    expect(localStorage.getItem("onboarding_incomplete")).toBe("1")
    expect(checkTokens).not.toHaveBeenCalled()
  })

  it("holds a finished account that has no plan in setup", async () => {
    publicRequest.mockResolvedValue(json({ message: "Login successful", user: USER }))
    apiRequest.mockResolvedValue(json({ completed: true, needs_plan: true }))
    render(<LoginPage />)

    await signIn()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/welcome"))
    expect(localStorage.getItem("onboarding_incomplete")).toBe("1")
    expect(decodeURIComponent(document.cookie)).toContain('"ob":true')
    expect(checkTokens).not.toHaveBeenCalled()
  })

  it("lets a finished account with a plan into the app", async () => {
    publicRequest.mockResolvedValue(json({ message: "Login successful", user: USER }))
    apiRequest.mockResolvedValue(json({ completed: true, needs_plan: false }))
    checkTokens.mockImplementation(async (to) => to)
    render(<LoginPage />)

    await signIn()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"))
    expect(localStorage.getItem("onboarding_incomplete")).toBeNull()
  })

  it("sends an admin to the admin console", async () => {
    publicRequest.mockResolvedValue(json({ message: "Login successful", user: { ...USER, role: "admin" } }))
    render(<LoginPage />)

    await signIn()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"))
    expect(apiRequest).not.toHaveBeenCalled()
    expect(prefetch).not.toHaveBeenCalled()
  })

  it("shows the server's reason and stays put when sign-in fails", async () => {
    publicRequest.mockResolvedValue(json({ detail: "Invalid email or password" }, false))
    render(<LoginPage />)

    await signIn()

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password")
    expect(push).not.toHaveBeenCalled()
    expect(localStorage.getItem("user_authenticated")).toBeNull()
  })

  it("falls back to a generic message when the request throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    publicRequest.mockRejectedValue(new Error("network"))
    render(<LoginPage />)

    await signIn()

    expect(await screen.findByRole("alert")).toHaveTextContent("Login failed. Please try again.")
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled()
  })

  it("links to sign-up and the legal pages, and draws the team without fetching", () => {
    render(<LoginPage />)
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register")
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/billing/terms-of-service")
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/billing/privacy-policy")
    expect(screen.getByRole("img", { name: /question goes to Birdy/ })).toBeInTheDocument()
    // There is no reset flow in the app, so there is no "Forgot?" link.
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument()
    expect(publicRequest).not.toHaveBeenCalled()
    expect(apiRequest).not.toHaveBeenCalled()
  })
})
