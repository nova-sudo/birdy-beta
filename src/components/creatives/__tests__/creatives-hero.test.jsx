import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("swr", () => ({ default: () => ({ data: undefined }) }))
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
})
