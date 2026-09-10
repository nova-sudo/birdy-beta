// The Client Detail overview chart's headline figures.
//
// The bug these pin: the card used to print the sum of the line it drew, while
// every other figure on the page — the goals strip, the Birdy Insights card —
// read Meta's account-level insight for the same preset. Those are not the same
// number. `meta_daily_spend` is a rolling 400-day cache, so on BBL Body
// Confidence at All Time the chart summed £3,999 of cached days directly under
// a strip reading £7,814.90, and the CPL headline read £2.01 under a tile
// reading £2.81.
//
// The account figure is the accurate one. It is now the headline, and the
// shortfall in the line beneath it is stated rather than silently absorbed.

import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const { ClientTrendChart } = await import("@/components/clients/ClientTrendChart")

/** A run of days, as `meta_daily_spend` stores them. */
const spendDays = (from, to, perDay) => {
  const rows = []
  const cursor = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`
  while (cursor <= end) {
    // Formatted locally, not through toISOString — the series layer parses
    // these back locally, and a UTC round-trip shifts every row a day.
    rows.push({ date: iso(cursor), spend: perDay })
    cursor.setDate(cursor.getDate() + 1)
  }
  return rows
}

const leadDays = (from, to, perDay) =>
  spendDays(from, to, 0).map((d) => ({ date: d.date, new_leads: perDay, won: 0 }))

const group = ({ insights, spend, leads }) => ({
  id: "g1",
  facebook: { metrics: { insights }, daily_spend: spend },
  gohighlevel: { daily_leads: leads },
})

// 100 days of £10 = £1,000 plotted, against an account reporting £2,500 — the
// same shape as a 400-day cache sitting under an all-time total.
const TRUNCATED = group({
  insights: { spend: 2500, results: 1000 },
  spend: spendDays("2026-01-01", "2026-04-10", 10),
  leads: leadDays("2026-01-01", "2026-04-10", 5),
})

/** Render and switch to one of the four metric tabs. */
async function showing(metricLabel, groupData = TRUNCATED) {
  render(<ClientTrendChart group={groupData} datePreset="maximum" currencySymbol="£" />)
  await userEvent.click(screen.getByRole("radio", { name: metricLabel }))
}

describe("ClientTrendChart headlines", () => {
  it("prints the account's spend, not the sum of the truncated line", async () => {
    await showing("Spend")
    expect(screen.getByText("£2,500")).toBeInTheDocument()
    expect(screen.queryByText("£1,000")).not.toBeInTheDocument()
  })

  it("says how much of the period the line actually covers", async () => {
    await showing("Spend")
    // Twice over: the note beside the figure, and the screen-reader summary.
    expect(screen.getAllByText(/chart covers 1 Jan–10 Apr; the figure above/).length)
      .toBeGreaterThan(0)
  })

  it("stays quiet when the line does cover the headline", async () => {
    await showing(
      "Spend",
      group({
        insights: { spend: 1000, results: 500 },
        spend: spendDays("2026-01-01", "2026-04-10", 10),
        leads: leadDays("2026-01-01", "2026-04-10", 5),
      })
    )
    expect(screen.getByText("£1,000")).toBeInTheDocument()
    expect(screen.queryByText(/chart covers/)).not.toBeInTheDocument()
  })

  it("falls back to the plotted sum when the preset carries no account figure", async () => {
    // last_month and last_year arrive as stubs with no spend on them. The
    // cached daily rows are then the only measurement there is, and they are a
    // better answer than a zero.
    await showing(
      "Spend",
      group({
        insights: { total_leads: 167 },
        spend: spendDays("2026-01-01", "2026-04-10", 10),
        leads: leadDays("2026-01-01", "2026-04-10", 5),
      })
    )
    expect(screen.getByText("£1,000")).toBeInTheDocument()
  })

  it("blends CPL from Meta's own spend and results, matching the goals strip", async () => {
    // £2,500 / 1,000 results = £2.50. Dividing the plotted spend by the GHL
    // lead rows instead gave £1,000 / 500 = £2.00 — a different figure from the
    // tile immediately above it, built from two different sources.
    await showing("CPL")
    expect(screen.getByText("£2.50")).toBeInTheDocument()
    expect(screen.queryByText("£2.00")).not.toBeInTheDocument()
  })

  it("leaves the lead series alone — it measures GHL, not Meta results", async () => {
    // 100 days x 5 = 500 GHL leads, against 1,000 Meta results. They count
    // different things, so the headline stays the sum of its own line.
    await showing("Leads")
    expect(screen.getByText("500")).toBeInTheDocument()
  })
})
