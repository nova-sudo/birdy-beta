import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/link", () => ({ default: ({ children, ...props }) => <a {...props}>{children}</a> }))
vi.mock("next/head", () => ({ default: () => null }))

import PrivacyPolicy from "../privacy-policy/page"
import RefundPolicy from "../refund-policy/page"
import TermsOfService from "../terms-of-service/page"

const LEGACY = /\b(?:gray|purple|slate|zinc)-\d|\bpd-/

describe.each([
  ["Privacy Policy", PrivacyPolicy, "We do not sell, rent, or trade your personal information."],
  ["Refund Policy", RefundPolicy, "we will issue a full refund of the erroneous charge."],
  ["Terms of Service", TermsOfService, "These Terms are governed by and construed in accordance with applicable law."],
])("%s page", (title, Page, sentinel) => {
  it("keeps its legal copy", () => {
    const { container } = render(<Page />)
    expect(container.textContent).toContain(sentinel)
  })

  it("renders its headings", () => {
    render(<Page />)
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy()
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(3)
  })

  it("uses the body token at 16/1.6 and no legacy classes", () => {
    const { container } = render(<Page />)
    const root = container.querySelector(".min-h-screen")
    expect(root.className).toMatch(/text-body/)
    expect(root.className).toMatch(/text-base/)
    expect(root.className).toMatch(/leading-\[1\.6\]/)
    const classes = [...container.querySelectorAll("[class]")].map((e) => e.getAttribute("class")).join(" ")
    expect(classes).not.toMatch(LEGACY)
  })
})
