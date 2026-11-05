import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const swrData = vi.hoisted(() => ({ summary: undefined, days: undefined }))
const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }) }))
vi.mock("@/lib/agents-api", () => ({ applyWorkItem: vi.fn(async () => ({ ok: true, redirect: "/campaigns/creatives/new?scale=t9" })) }))
vi.mock("swr", () => ({
  default: (key) => ({ data: key === "/api/dashboard/summary" ? swrData.summary : Array.isArray(key) ? swrData.days : undefined }),
  mutate: vi.fn(),
}))
vi.mock("@/lib/creatives-api", () => ({ useCreativeTests: () => ({ tests: [], isLoading: false }) }))
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import { CreativesHero, heroFigures } from "../CreativesHero"

const t = (status, s) => ({ id: status, status, summary: { currency: "GBP", ...s }, ads: [] })

describe("CreativesHero", () => {
  it("derives the six figures from the summaries", () => {
    const f = heroFigures([
      t("testing", { spend: 100, leads: 4, hook_rate: 30 }),
      t("testing", { spend: 300, leads: 6, hook_rate: 40 }),
      t("winner", { spend: 50, leads: 2 }),
      t("loser", { spend: 50, leads: 0 }),
    ])
    expect(f).toMatchObject({ live: 2, spend: 500, leads: 12, win_rate: 0.5 })
    expect(f.cpl).toBeCloseTo(500 / 12)
    expect(f.hook).toBe(35)
  })

  it("renders the six tabs and Birdy's empty state", () => {
    render(<CreativesHero tests={[t("testing", { spend: 100, leads: 4 })]} />)
    for (const l of ["Tests live", "Test spend", "Leads", "Blended CPL", "Hook rate", "Win rate"])
      expect(screen.getByRole("tab", { name: new RegExp(l) })).toBeInTheDocument()
    expect(screen.getByText(/Nothing needs you right now/)).toBeInTheDocument()
  })

  it("feeds Birdy's read from open creative_ suggestions only, and apply follows the redirect", async () => {
    swrData.summary = {
      suggestions: [
        { id: "s1", rule_id: "creative_adopt", severity: "OPPORTUNITY", title: "Scale CT-0009", description: "Winner", creative_test_id: "t9" },
        { id: "s2", rule_id: "pause_over_target", severity: "HIGH", title: "Pause a campaign" },
      ],
    }
    render(<CreativesHero tests={[t("testing", { spend: 100, leads: 4 })]} />)
    expect(screen.getByText("Scale CT-0009.")).toBeInTheDocument()
    expect(screen.queryByText("Pause a campaign")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Do it" }))
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/campaigns/creatives/new?scale=t9"))
    swrData.summary = undefined
  })

  it("opens on Tests live with a daily series instead of an empty plot", () => {
    const row = (date, spend) => ({ date, spend: String(spend), impressions: "100", actions: [] })
    swrData.days = [
      { id: "a", ads: [{ currency: "GBP", meta: { ad_id: "m1" } }], days: { m1: [row("2026-10-01", 10), row("2026-10-02", 10), row("2026-10-03", 10)] } },
      { id: "b", ads: [{ currency: "USD", meta: { ad_id: "m2" } }], days: { m2: [row("2026-10-02", 5), row("2026-10-03", 5)] } },
    ]
    render(<CreativesHero tests={[t("testing", { spend: 100, leads: 4 }), { ...t("testing", { spend: 5, leads: 1 }), id: "b" }]} />)
    expect(screen.getByRole("tab", { name: /Tests live/, selected: true })).toBeInTheDocument()
    expect(screen.queryByText(/No daily data yet/)).toBeNull()
    swrData.days = undefined
  })
})
