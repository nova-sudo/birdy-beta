// The landing-page funnel card.
//
// What matters here is what it *doesn't* draw. The card sits on two screens
// that every client passes through, while only landing-page clients have a
// funnel at all — so every "renders nothing" case below is protecting the
// majority of clients from a card about a page they don't have.

import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

// next/font can't run outside Next's build, and the card only wants the class
// name it hands back — same stub the overview's own tests use.
vi.mock("@/lib/fonts", () => ({ pdFontClass: "" }))

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

  it("draws the stages as a FunnelBar, with shares against landing views, not the first step", () => {
    render(<LandingFunnel funnel={funnel()} />)
    const bar = document.querySelector('[data-ds="funnel-bar"]')
    expect(bar).not.toBeNull()
    expect(screen.getByText(/shares are of landing views/)).toBeInTheDocument()
    // 300/1000 and 100/1000, not 300/800 of ad clicks.
    expect(within(bar).getByText("30.0%")).toBeInTheDocument()
    expect(within(bar).getByText("10.0%")).toBeInTheDocument()
    // Ad clicks are a slice of the views, so there is no conversion into views.
    const conv = bar.querySelector('[data-slot="funnel-conversions"]')
    expect(conv.children[1].textContent).toBe("—")
  })

  it("links to the tracking setup", () => {
    render(<LandingFunnel funnel={funnel()} groupId="g1" />)
    expect(screen.getByRole("link", { name: /Tracking setup/ })).toHaveAttribute("href", "/clients/g1/tracking")
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
