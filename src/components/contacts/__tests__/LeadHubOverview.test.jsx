import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Lead Hub hero ───────────────────────────────────────────────────────────
// Five figures as ds MetricTabsChart tabs over the selected figure's trend,
// with Birdy's read (ds BirdyRead) beside it. Figures come from the same
// daily series as before.

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(() => Promise.resolve({ ok: false })) }))

import { LeadHubOverview } from "@/components/contacts/LeadHubOverview"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return d.toISOString().slice(0, 10)
}

const row = (offset, over = {}) => ({
  date: day(offset), new_leads: 4, new_contacts: 2, open: 1, won: 1, lost: 1, abandoned: 0, ...over,
})

const GROUPS = [
  {
    id: "g1", name: "Acme", ghl_location_id: "loc",
    gohighlevel: { daily_leads: [row(1), row(2), row(3), row(4)] },
  },
]

const base = { clientGroups: GROUPS, groupsLoading: false, datePreset: "last_7d", selectedClientGroup: "all" }

beforeEach(() => vi.clearAllMocks())

describe("LeadHubOverview", () => {
  it("draws the five figures as ds metric tabs and Birdy's read beside them", () => {
    render(<LeadHubOverview {...base} />)
    const chart = document.querySelector('[data-ds="metric-tabs-chart"]')
    expect(chart).not.toBeNull()
    const tabs = within(chart).getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual([
      expect.stringMatching(/Total leads\s*16/),
      expect.stringMatching(/Total contacts\s*8/),
      expect.stringMatching(/Open leads\s*4/),
      expect.stringMatching(/Lost leads\s*4/),
      expect.stringMatching(/Conversion rate/),
    ])
    expect(document.querySelector('[data-ds="birdy-read"]')).not.toBeNull()
    expect(document.querySelector("[class*='pd-']")).toBeNull()
  })

  it("selects another figure's trend", async () => {
    const user = userEvent.setup()
    render(<LeadHubOverview {...base} />)
    await user.click(screen.getByRole("tab", { name: /Lost leads/ }))
    expect(screen.getByRole("tab", { name: /Lost leads/ })).toHaveAttribute("aria-selected", "true")
  })

  it("says so when the window is too short to draw a trend", () => {
    render(<LeadHubOverview {...base} datePreset="today" clientGroups={[{ ...GROUPS[0], gohighlevel: { daily_leads: [row(0)] } }]} />)
    expect(screen.getByText("Pick 7 days or longer to see a trend.")).toBeInTheDocument()
  })

  it("states the load failure instead of zeroes, with a retry", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<LeadHubOverview {...base} clientGroups={[]} groupsError="HTTP 500" onRetry={onRetry} />)
    expect(document.querySelector('[data-ds="error-state"]')).not.toBeNull()
    expect(screen.getByText("Couldn't load your client data")).toBeInTheDocument()
    expect(screen.getByText(/HTTP 500/)).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
