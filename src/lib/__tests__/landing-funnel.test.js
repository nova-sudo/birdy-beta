// The landing-page funnel card's presentation layer.
//
// The backend already counted it; what these cover is the reading the card
// puts on top of the counts — that shares are of landing views rather than of
// the stage above, that the drop-off keeps adding up when the counters
// disagree, and that the verdict stays quiet unless one side genuinely
// dominates. A banner that names a problem on every screen is a banner people
// learn to skip.

import { describe, it, expect } from "vitest"
import {
  buildExitSplit,
  buildLandingSteps,
  diagnoseLandingFunnel,
} from "@/lib/landing-funnel"

const funnel = ({ views = 1000, ad_views = 800, form_starts = 300, opt_ins = 100, exits, stages } = {}) => ({
  applicable: true,
  totals: { views, ad_views, form_starts, opt_ins },
  exits: exits ?? {
    total: views - opt_ins,
    before_form: views - form_starts,
    abandoned_form: form_starts - opt_ins,
    rate: views ? (views - opt_ins) / views : null,
  },
  stages: stages ?? [
    { key: "ad_views", label: "Ad clicks", count: ad_views, share: null },
    { key: "views", label: "Landing views", count: views, share: null },
    { key: "form_starts", label: "Form started", count: form_starts, share: views ? form_starts / views : null },
    { key: "opt_ins", label: "Opted in", count: opt_ins, share: views ? opt_ins / views : null },
  ],
})

const byKey = (stages) => Object.fromEntries(stages.map((s) => [s.key, s]))

describe("buildLandingSteps", () => {
  it("gives every stage a label, a short label where it has one, and a numeric value", () => {
    const steps = buildLandingSteps(funnel())
    expect(steps).toHaveLength(4)
    expect(steps.map((s) => s.value)).toEqual([800, 1000, 300, 100])
    expect(byKey(steps).ad_views.shortLabel).toBe("Ads")
  })

  it("passes shares through as fractions of landing views", () => {
    const steps = byKey(buildLandingSteps(funnel({ views: 1204, opt_ins: 118 })))
    expect(steps.opt_ins.share).toBeCloseTo(118 / 1204)
  })

  it("keeps the cohort and its ad slice share-less, explicitly", () => {
    const steps = byKey(buildLandingSteps(funnel()))
    expect(steps.views.share).toBeNull()
    expect(steps.ad_views.share).toBeNull()
  })

  it("carries a signed delta only where the server sent one", () => {
    const withDelta = funnel()
    withDelta.stages[3] = { ...withDelta.stages[3], direction: "down", delta: 12.5 }
    withDelta.stages[2] = { ...withDelta.stages[2], direction: "up", delta: 4 }

    const steps = byKey(buildLandingSteps(withDelta))
    expect(steps.opt_ins.delta).toBe(-12.5)
    expect(steps.form_starts.delta).toBe(4)
    expect(steps.views.delta).toBeUndefined()
  })

  it("draws nothing for a client with no funnel", () => {
    expect(buildLandingSteps(null)).toBeNull()
    expect(buildLandingSteps({ applicable: false })).toBeNull()
  })
})

describe("buildExitSplit", () => {
  it("splits the people who left into the two fixes they point at", () => {
    const split = buildExitSplit(funnel({ views: 1000, form_starts: 300, opt_ins: 100 }))
    const rows = byKey(split.rows)

    expect(split.totalLabel).toBe("900")
    expect(rows.before_form.count).toBe(700)
    expect(rows.abandoned_form.count).toBe(200)
    expect(rows.before_form.count + rows.abandoned_form.count).toBe(split.total)
  })

  it("says nothing about an empty window", () => {
    expect(buildExitSplit(funnel({ views: 0, form_starts: 0, opt_ins: 0 }))).toBeNull()
  })
})

describe("diagnoseLandingFunnel", () => {
  it("blames the form when more people abandon it than never try it", () => {
    const verdict = diagnoseLandingFunnel(
      funnel({ views: 1000, form_starts: 800, opt_ins: 100 })
    )
    expect(verdict.state).toBe("problem")
    expect(verdict.title).toMatch(/form/i)
  })

  it("blames the page when almost nobody reaches the form", () => {
    const verdict = diagnoseLandingFunnel(
      funnel({ views: 1000, form_starts: 120, opt_ins: 100 })
    )
    expect(verdict.state).toBe("problem")
    expect(verdict.title).toMatch(/never reach/i)
  })

  it("stays quiet on a window too small to read a rate off", () => {
    expect(diagnoseLandingFunnel(funnel({ views: 8, form_starts: 1, opt_ins: 0 }))).toBeNull()
  })

  it("reports the rate, naming no stage, when neither side dominates", () => {
    // 600 left before the form, 300 abandoned it: a real split, no single
    // stage to name.
    expect(
      diagnoseLandingFunnel(funnel({ views: 1000, form_starts: 400, opt_ins: 100 }))
    ).toMatchObject({ state: "healthy" })
  })
})
