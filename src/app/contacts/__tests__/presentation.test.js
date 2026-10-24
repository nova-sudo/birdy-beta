import { describe, it, expect } from "vitest"
import { toLeadFindings, toTrendSeries, MIN_TREND_POINTS } from "../presentation"

describe("toLeadFindings", () => {
  const insight = [
    { text: "Lead volume is ", strong: false },
    { text: "up 12.0%", strong: true },
    { text: ", and conversion has risen to ", strong: false },
    { text: "3.4%", strong: true },
    { text: ".", strong: false },
  ]
  const findings = [
    { tone: "success", parts: [{ text: "Beta", strong: true }, { text: " converts best at 5%", strong: false }] },
    { tone: "danger", parts: [{ text: "Acme", strong: true }, { text: " leads are down 30%", strong: false }] },
  ]

  it("leads with the headline sentence, then the findings, worst tone first", () => {
    const rows = toLeadFindings(insight, findings)
    expect(rows[0]).toMatchObject({ id: "headline", tone: "info", title: "Lead volume is up 12.0%, and conversion has risen to 3.4%." })
    expect(rows.slice(1).map((r) => r.tone)).toEqual(["danger", "success"])
  })

  it("splits a finding into its bold lead-in as title and the rest as detail", () => {
    const rows = toLeadFindings(insight, findings)
    expect(rows[1]).toMatchObject({ title: "Acme", detail: "leads are down 30%" })
  })

  it("gives nothing for an empty window, so BirdyRead shows its empty copy", () => {
    expect(toLeadFindings([{ text: "No leads", strong: false }], [], { empty: true })).toEqual([])
  })
})

describe("toTrendSeries", () => {
  const metric = { values: [1, 2], labels: ["a", "b"], tooltipLabels: ["A", "B"], pointValues: ["1.0%", "2.0%"] }

  it("keeps the formatted value as each point's tooltip display", () => {
    expect(toTrendSeries(metric)).toEqual([
      { x: "a", current: 1, tooltipLabel: "A", display: "1.0%" },
      { x: "b", current: 2, tooltipLabel: "B", display: "2.0%" },
    ])
  })

  it("withholds a series too short to be a trend", () => {
    expect(MIN_TREND_POINTS).toBe(2)
    expect(toTrendSeries({ ...metric, values: [1], labels: ["a"] })).toEqual([])
  })
})
