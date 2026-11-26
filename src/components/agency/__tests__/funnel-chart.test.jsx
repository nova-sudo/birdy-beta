import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import "@/components/by/__tests__/jsdom"
import { FunnelChart } from "../funnel-chart"

describe("FunnelChart", () => {
  it("draws one band per step with its label, value and share of the step before", () => {
    const { container } = render(
      <FunnelChart steps={[{ key: "crm", label: "New in CRM", value: 520 }, { key: "called", label: "Called", value: 231 }, { key: "closes", label: "Closed", value: 13 }]} />
    )
    expect(container.querySelector("[data-dk='funnel']")).not.toBeNull()
    for (const label of ["New in CRM", "Called", "Closed"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    expect(screen.getAllByText("520").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/44% of previous/).length).toBeGreaterThan(0)
    // Scoped to the kit's theme, in the app's purple.
    expect(container.firstChild.className).toContain("dk-root")
    expect(container.firstChild.style.getPropertyValue("--dk-chart-1")).toBe("var(--by-accent)")
  })
})
