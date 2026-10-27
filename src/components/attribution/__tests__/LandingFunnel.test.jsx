// The landing-page funnel card.
//
// What matters here is what it *doesn't* draw. The card sits on two screens
// that every client passes through, while only landing-page clients have a
// funnel at all — so every "renders nothing" case below is protecting the
// majority of clients from a card about a page they don't have.

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// next/font can't run outside Next's build, and the card only wants the class
// name it hands back — same stub the overview's own tests use.
vi.mock("@/lib/pd-fonts", () => ({ pdFontClass: "" }))

const { LandingFunnel } = await import("@/components/attribution/LandingFunnel")

const funnel = (overrides = {}) => ({
  applicable: true,
  installed: true,
  totals: { views: 1000, ad_views: 800, form_starts: 300, opt_ins: 100 },
  exits: { total: 900, before_form: 700, abandoned_form: 200, rate: 0.9 },
  stages: [
    { key: "ad_views", label: "Ad clicks", count: 800, share: null },
    { key: "views", label: "Landing views", count: 1000, share: null },
    { key: "form_starts", label: "Form started", count: 300, share: 0.3 },
    { key: "opt_ins", label: "Opted in", count: 100, share: 0.1 },
  ],
  ...overrides,
})

describe("LandingFunnel", () => {
  it("draws the four stages and the two ways a visit ended in nothing", () => {
    render(<LandingFunnel funnel={funnel()} groupId="g1" />)

    expect(screen.getByText("Landing views")).toBeInTheDocument()
    expect(screen.getByText("Form started")).toBeInTheDocument()
    expect(screen.getByText("Left before touching the form")).toBeInTheDocument()
    expect(screen.getByText("Started the form, abandoned it")).toBeInTheDocument()
    expect(screen.getByText("700")).toBeInTheDocument()
    expect(screen.getByText("200")).toBeInTheDocument()
  })

  it("takes its shares against landing views, not leads", () => {
    render(<LandingFunnel funnel={funnel()} />)
    expect(screen.getByText(/10% of landing views/)).toBeInTheDocument()
  })

  it("renders nothing for a client with no landing page", () => {
    const { container } = render(
      <LandingFunnel funnel={{ applicable: false, reason: "Instant Forms" }} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing while the first load is still in flight", () => {
    // Most clients are not landing-page clients, so a skeleton on every one of
    // their screens would be a layout jump advertising a feature they'll never
    // see.
    const { container } = render(<LandingFunnel funnel={null} loading />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing when the fetch failed", () => {
    const { container } = render(
      <LandingFunnel funnel={funnel()} error={new Error("HTTP 500")} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("separates a quiet window from a tag that was never installed", () => {
    const empty = { totals: { views: 0, ad_views: 0, form_starts: 0, opt_ins: 0 },
                    exits: { total: 0, before_form: 0, abandoned_form: 0, rate: null } }

    const live = render(<LandingFunnel funnel={funnel({ ...empty, installed: true })} />)
    expect(live.getByText(/quiet period rather than a broken tag/)).toBeInTheDocument()
    live.unmount()

    render(<LandingFunnel funnel={funnel({ ...empty, installed: false })} />)
    expect(screen.getByText(/isn't on their landing page/)).toBeInTheDocument()
  })
})
