import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const publicRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  publicRequest: (...args) => publicRequest(...args),
}))
vi.mock("@/components/birdy/Birdy", () => ({ default: () => null }))

import Home from "@/app/page"

const LEGACY = new RegExp(["\\bp", "d-|text-\\[\\d"].join(""))

describe("landing page", () => {
  beforeEach(() => {
    publicRequest.mockReset()
    localStorage.clear()
  })

  it("renders its ds widgets", () => {
    const { container } = render(<Home />)
    expect(container.querySelector('[data-ds="input"]')).toBeTruthy()
    expect(container.querySelector('[data-ds="button"]')).toBeTruthy()
    expect(screen.getByText("Coming soon")).toBeInTheDocument()
  })

  it("has no legacy classes and no inline hex", () => {
    const { container } = render(<Home />)
    const classes = [...container.querySelectorAll("[class]")].map((e) => e.getAttribute("class")).join(" ")
    expect(classes).not.toMatch(LEGACY)
    const styles = [...container.querySelectorAll("[style]")].map((e) => e.getAttribute("style")).join(" ")
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it("joins the waitlist and remembers the email", async () => {
    publicRequest.mockResolvedValue({ status: 200 })
    render(<Home />)
    await userEvent.type(screen.getByLabelText("Email address"), "me@agency.com")
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }))

    expect(await screen.findByText(/You're on the List/)).toBeInTheDocument()
    expect(publicRequest).toHaveBeenCalledWith("/api/waitlist", expect.objectContaining({ method: "POST" }))
    expect(localStorage.getItem("birdy_waitlist_email")).toBe("me@agency.com")
  })

  it("treats a 409 as already on the list", async () => {
    publicRequest.mockResolvedValue({ status: 409 })
    render(<Home />)
    await userEvent.type(screen.getByLabelText("Email address"), "me@agency.com")
    await userEvent.click(screen.getByRole("button", { name: /join the waitlist/i }))
    expect(await screen.findByText(/Already on the List/)).toBeInTheDocument()
  })

  it("shows the already state for a stored email", async () => {
    localStorage.setItem("birdy_waitlist_email", "me@agency.com")
    render(<Home />)
    await waitFor(() => expect(screen.getByText(/Already on the List/)).toBeInTheDocument())
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument()
  })
})
