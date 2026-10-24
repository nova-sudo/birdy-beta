import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { RELEASES } from "@/lib/changelog"
const { default: ChangelogPage } = await import("@/app/changelog/page")

describe("changelog page", () => {
  it("renders a Surface per release, newest first, with the version and date", () => {
    const { container } = render(<ChangelogPage />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("What's new in Birdy")
    expect(container.querySelectorAll('[data-ds="surface"]').length).toBe(RELEASES.length)
    expect(screen.getByRole("heading", { level: 2, name: RELEASES[0].version })).toBeTruthy()
    expect(container.querySelector(`time[datetime="${RELEASES[0].date}"]`)).not.toBeNull()
  })

  it("renders change categories as Badges", () => {
    const { container } = render(<ChangelogPage />)
    expect(container.querySelectorAll('[data-ds="badge"]').length).toBeGreaterThan(1)
  })
})
