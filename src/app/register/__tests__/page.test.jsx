import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

const publicRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  publicRequest: (...args) => publicRequest(...args),
}))

// Silk is a WebGL wallpaper and Birdy an animated SVG mascot — neither has
// anything to do with what the form submits, and Silk needs a GL context jsdom
// does not have.
vi.mock("@/components/Silk", () => ({ default: () => null }))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

import RegisterPage from "@/app/register/page"

function ok(user) {
  return {
    ok: true,
    json: async () => ({ message: "Registration successful", user }),
  }
}

async function signUp(user = userEvent.setup()) {
  await user.type(screen.getByLabelText(/email address/i), "new@agency.com")
  await user.type(screen.getByLabelText(/password/i), "hunter2hunter2")
  await user.click(screen.getByRole("button", { name: /create account/i }))
}

describe("register page", () => {
  beforeEach(() => {
    push.mockClear()
    publicRequest.mockReset()
    localStorage.clear()
  })

  it("asks for email and password only", () => {
    // Name and currency moved to the onboarding wizard — an account should
    // exist after two fields, not four.
    render(<RegisterPage />)

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryByText(/select your currency/i)).not.toBeInTheDocument()
  })

  it("posts only email and password, through publicRequest", async () => {
    publicRequest.mockResolvedValue(ok({ email: "new@agency.com", role: "user" }))
    render(<RegisterPage />)

    await signUp()

    await waitFor(() => expect(publicRequest).toHaveBeenCalled())
    const [endpoint, options] = publicRequest.mock.calls[0]
    expect(endpoint).toBe("/api/register")
    // publicRequest owns the base URL and credentials: "include" — the raw
    // fetch this replaced hardcoded the production host.
    expect(JSON.parse(options.body)).toEqual({
      email: "new@agency.com",
      password: "hunter2hunter2",
    })
  })

  it("persists the session and lands on the wizard, never /login", async () => {
    // The bug: /api/register already set the auth cookies, but ProtectedLayout
    // gates on localStorage, so a new signup was bounced straight to /login.
    const user = { email: "new@agency.com", name: null, default_currency: null, role: "user" }
    publicRequest.mockResolvedValue(ok(user))
    render(<RegisterPage />)

    await signUp()

    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"))
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(user)
    expect(localStorage.getItem("onboarding_incomplete")).toBe("1")

    const auth = JSON.parse(localStorage.getItem("user_authenticated"))
    expect(auth.value).toBe(true)
    // 30 days, matching the backend JWT_EXPIRY_MINUTES and LoginForm.
    const days = (new Date(auth.expires_at) - Date.now()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
  })

  it("shows the server's reason and stays put when registration fails", async () => {
    publicRequest.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Email already registered" }),
    })
    render(<RegisterPage />)

    await signUp()

    expect(await screen.findByText("Email already registered")).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    expect(localStorage.getItem("user_authenticated")).toBeNull()
  })
})
