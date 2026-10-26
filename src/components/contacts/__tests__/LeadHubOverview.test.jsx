import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// ─── Lead Hub hero ───────────────────────────────────────────────────────────
// Five figures as ds MetricTabsChart tabs over the selected figure's trend,
// with Birdy's read (ds BirdyRead) beside it. Figures come from the same
// daily series as before.

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn(() => Promise.resolve({ ok: false })) }))

import { LeadHubOverview } from "@/components/contacts/LeadHubOverview"

// Built from parts so the legacy-class audit grep does not hit this guard.
const LEGACY_PREFIX = "p" + "d-"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  // Local calendar date, like the window the component computes; toISOString is UTC
  // and lands on the wrong day around local midnight.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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
    expect(document.querySelector(`[class*='${LEGACY_PREFIX}']`)).toBeNull()
  })

  it("colours fewer lost leads as good news and fewer leads as bad", () => {
    // This week: 4 leads, 1 lost a day. The week before: 8 leads, 5 lost a day.
    const groups = [
      {
        ...GROUPS[0],
        gohighlevel: {
          daily_leads: [
            ...[1, 2, 3, 4].map((o) => row(o)),
            ...[9, 10, 11, 12].map((o) => row(o, { new_leads: 8, lost: 5 })),
          ],
        },
      },
    ]
    render(<LeadHubOverview {...base} clientGroups={groups} />)
    const lost = screen.getByRole("tab", { name: /Lost leads/ }).querySelector('[data-ds="delta"]')
    expect(lost).toHaveTextContent(/^Down/)
    expect(lost).toHaveAttribute("data-tone", "good")
    expect(lost).toHaveTextContent("vs previous period")
    const leads = screen.getByRole("tab", { name: /Total leads/ }).querySelector('[data-ds="delta"]')
    expect(leads).toHaveTextContent(/^Down/)
    expect(leads).toHaveAttribute("data-tone", "bad")
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
