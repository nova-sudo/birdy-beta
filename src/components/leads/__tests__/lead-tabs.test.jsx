import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

import { LeadAdsTab } from "../LeadAdsTab"
import { LeadProfileTab } from "../LeadProfileTab"

const attr = (platform, extra = {}) => ({
  platform, is_organic: false, ad_id: "a1", form_answers: [], utm: {}, ...extra,
})

describe("LeadAdsTab platform label", () => {
  it("expands Meta platform codes", () => {
    const { unmount } = render(<LeadAdsTab attribution={attr("fb")} />)
    expect(screen.getByText("Meta · Facebook")).toBeInTheDocument()
    unmount()
    render(<LeadAdsTab attribution={attr("ig")} />)
    expect(screen.getByText("Meta · Instagram")).toBeInTheDocument()
  })

  it("keeps existing handling for other values", () => {
    render(<LeadAdsTab attribution={attr("facebook")} />)
    expect(screen.getByText("Meta")).toBeInTheDocument()
  })
})

describe("LeadProfileTab pipeline stage", () => {
  it("is not amber when there is no stage", () => {
    render(<LeadProfileTab detail={{ contact: {}, opportunities: [], engagement: {} }} />)
    const row = screen.getByText("Pipeline stage").parentElement.querySelector("p:last-child")
    expect(row).toHaveTextContent("—")
    expect(row.className).not.toContain("text-pd-amber")
  })

  it("is amber when a stage exists", () => {
    const opportunities = [{ id: "o1", status: "open", stage_name: "Spicy Leads", created_at: "2026-07-17T10:00:00+00:00" }]
    render(<LeadProfileTab detail={{ contact: {}, opportunities, engagement: {} }} />)
    expect(screen.getByText("Spicy Leads").className).toContain("text-pd-amber")
  })
})
