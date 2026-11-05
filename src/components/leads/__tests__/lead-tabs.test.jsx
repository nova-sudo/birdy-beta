import { describe, it, expect } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

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

describe("CallMedia without a recording", () => {
  it("says there is no recording instead of showing nothing", async () => {
    const { CallMedia } = await import("../LeadCallsTab")
    const { container } = render(<CallMedia call={{ id: "c1", transcript: "Hi" }} />)
    expect(screen.getByText("No recording")).toBeInTheDocument()
    expect(container.querySelector("audio")).toBeNull()
    expect(screen.getByText("Transcript")).toBeInTheDocument()
  })

  it("shows Play recording, then the player, when the dialer sent one", async () => {
    const { CallMedia } = await import("../LeadCallsTab")
    const { container } = render(<CallMedia call={{ id: "c2", recording_url: "https://x.test/r" }} />)
    expect(container.querySelector("audio")).toBeNull()
    expect(screen.queryByText("No recording")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Play recording" }))
    expect(container.querySelector("audio")).toHaveAttribute("src", "https://x.test/r")
  })
})
