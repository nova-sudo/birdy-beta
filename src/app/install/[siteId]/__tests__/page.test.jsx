import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/navigation", () => ({ useParams: () => ({ siteId: "site_1" }) }))

const publicRequest = vi.fn()
vi.mock("@/lib/api", () => ({
  publicRequest: (...args) => publicRequest(...args),
}))

import InstallPage from "../page"

const LEGACY = /\bpd-|text-\[\d/

function details(over = {}) {
  return {
    ok: true,
    json: async () => ({
      client_name: "Harbourside Dental",
      snippet: "<script src=x></script>",
      hit_received: false,
      known: true,
      ...over,
    }),
  }
}

describe("install page", () => {
  beforeEach(() => {
    publicRequest.mockReset()
  })

  it("sits in a centred ds Surface with no legacy classes or inline hex", async () => {
    publicRequest.mockResolvedValue(details())
    const { container } = render(<InstallPage />)
    expect(await screen.findByText("Harbourside Dental")).toBeInTheDocument()

    const surface = container.querySelector('[data-ds="surface"]')
    expect(surface.className).toMatch(/max-w-\[480px\]/)
    expect(container.querySelector('[data-ds="notice"]')).toBeTruthy()
    const classes = [...container.querySelectorAll("[class]")].map((e) => e.getAttribute("class")).join(" ")
    expect(classes).not.toMatch(LEGACY)
    const styles = [...container.querySelectorAll("[style]")].map((e) => e.getAttribute("style")).join(" ")
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it("shows the success tone once a hit has arrived", async () => {
    publicRequest.mockResolvedValue(details({ hit_received: true }))
    const { container } = render(<InstallPage />)
    expect(await screen.findByText("It's working.")).toBeInTheDocument()
    expect(container.querySelector('[data-ds="notice"]').className).toMatch(/bg-success-soft/)
  })

  it("shows an ErrorState with retry when the load fails", async () => {
    publicRequest.mockResolvedValueOnce({ ok: false, status: 500 })
    const { container } = render(<InstallPage />)
    expect(await screen.findByText(/couldn't load these instructions/i)).toBeInTheDocument()
    expect(container.querySelector('[data-ds="error-state"]')).toBeTruthy()

    publicRequest.mockResolvedValueOnce(details())
    await userEvent.click(screen.getByRole("button", { name: /try again/i }))
    expect(await screen.findByText("Harbourside Dental")).toBeInTheDocument()
  })
})
