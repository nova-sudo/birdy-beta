// The Birdy Insights copy on Client Detail.
//
// The card is headed with Birdy's name, so what it says has to be defensible.
// These pin down that it reports the window's figures and the client's own
// targets — never a trend, a cause, or a comparison the page doesn't hold.

import { describe, it, expect } from "vitest"
import { buildClientInsight, clientInsightPrompt } from "@/lib/client-insight"
import { ON_TRACK, BEHIND, AT_RISK } from "@/lib/client-goals"

const group = ({ name = "Aura", funnel = null, spend = 0 } = {}) => ({
  name,
  gohighlevel: { metrics: { funnel } },
  facebook: { metrics: { insights: { spend } } },
})

const goal = (label, state) => ({ label, state })
const text = (parts) => parts.map((p) => p.text).join("")

describe("with no data", () => {
  it("says so rather than reporting zeroes", () => {
    const copy = text(buildClientInsight(group(), []))
    expect(copy).toMatch(/no leads recorded for aura/i)
  })

  it("says so when the funnel exists but is empty", () => {
    const copy = text(buildClientInsight(group({ funnel: { leads: 0 } }), []))
    expect(copy).toMatch(/no leads recorded/i)
  })
})

describe("reporting the window", () => {
  it("states leads, spend and closes", () => {
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200, closes: 14 }, spend: 8742 }), [], "£"
    ))
    expect(copy).toContain("200 leads")
    expect(copy).toContain("£8,742")
    expect(copy).toContain("14")
  })

  it("omits spend when there is none", () => {
    const copy = text(buildClientInsight(group({ funnel: { leads: 200 } }), []))
    expect(copy).not.toMatch(/ad spend/i)
  })

  it("omits closes when there are none", () => {
    const copy = text(buildClientInsight(group({ funnel: { leads: 200, closes: 0 } }), []))
    expect(copy).not.toMatch(/closing/i)
  })

  it("marks the figures for emphasis, not the prose", () => {
    const parts = buildClientInsight(group({ funnel: { leads: 200 } }), [])
    const strong = parts.filter((p) => p.strong).map((p) => p.text)
    expect(strong).toContain("200 leads")
    expect(strong.join("")).not.toMatch(/brought in/)
  })
})

describe("what it says about targets", () => {
  it("says nothing is measurable when no targets are set", () => {
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200 } }),
      [goal("Revenue", null), goal("Monthly closes", null)]
    ))
    expect(copy).toMatch(/no monthly targets are set/i)
  })

  it("confirms when every measured target is on track", () => {
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200 } }),
      [goal("Revenue", ON_TRACK), goal("Monthly closes", ON_TRACK)]
    ))
    expect(copy).toMatch(/every monthly target is/i)
    expect(copy).toContain("on track")
  })

  it("names the goals that are behind", () => {
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200 } }),
      [goal("Revenue", ON_TRACK), goal("Monthly closes", BEHIND)]
    ))
    expect(copy).toMatch(/behind on/i)
    expect(copy).toContain("monthly closes")
  })

  it("joins several with a conjunction rather than a list of commas", () => {
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200 } }),
      [goal("Revenue", BEHIND), goal("Close rate", AT_RISK), goal("Monthly closes", BEHIND)]
    ))
    expect(copy).toMatch(/revenue, close rate and monthly closes/i)
  })

  it("ignores goals with no target, rather than counting them as met", () => {
    // An untargeted goal has no opinion attached; treating it as on track
    // would let an unconfigured client read as healthy prose.
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200 } }),
      [goal("Revenue", null), goal("Monthly closes", BEHIND)]
    ))
    expect(copy).toMatch(/behind on/i)
    expect(copy).not.toMatch(/revenue/i)
  })
})

describe("what it deliberately does not say", () => {
  it("claims no period-over-period movement", () => {
    // The design's sample copy says "spend is up 12%". This page holds no
    // prior period, so any percentage would be invented.
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200, closes: 14 }, spend: 8742 }),
      [goal("Revenue", ON_TRACK)]
    ))
    expect(copy).not.toMatch(/\bup \d|\bdown \d|% (more|less|higher|lower)/i)
  })

  it("names no biggest risk or ranking", () => {
    const copy = text(buildClientInsight(
      group({ funnel: { leads: 200 } }),
      [goal("Revenue", BEHIND)]
    ))
    expect(copy).not.toMatch(/biggest|worst|best|risk/i)
  })
})

describe("the Ask Birdy prompt", () => {
  it("asks a general question when nothing is behind", () => {
    const prompt = clientInsightPrompt(group(), [goal("Revenue", ON_TRACK)])
    expect(prompt).toMatch(/how is aura performing/i)
  })

  it("names the failing goals when there are some", () => {
    const prompt = clientInsightPrompt(group(), [
      goal("Revenue", BEHIND), goal("Close rate", AT_RISK),
    ])
    expect(prompt).toMatch(/behind on revenue and close rate/i)
  })

  it("falls back gracefully with no client", () => {
    expect(clientInsightPrompt(null, [])).toMatch(/this client/i)
  })
})
