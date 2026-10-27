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
  buildLandingStages,
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

describe("buildLandingStages", () => {
  it("gives every stage an icon and a tone", () => {
    const stages = buildLandingStages(funnel())
    expect(stages).toHaveLength(4)
    expect(stages.every((s) => s.icon && s.tone)).toBe(true)
  })

  it("formats counts and shares for the stepper", () => {
    const stages = byKey(buildLandingStages(funnel({ views: 1204, opt_ins: 118 })))
    expect(stages.views.count).toBe("1,204")
    expect(stages.opt_ins.share).toBe("9.8%")
  })

  it("leaves the cohort and its ad slice without a share", () => {
    const stages = byKey(buildLandingStages(funnel()))
    expect(stages.views.share).toBeNull()
    expect(stages.ad_views.share).toBeNull()
  })

  it("carries a delta only where the server sent one", () => {
    const withDelta = funnel()
    withDelta.stages[3] = { ...withDelta.stages[3], direction: "down", delta: 12.5 }

    const stages = byKey(buildLandingStages(withDelta))
    expect(stages.opt_ins).toMatchObject({ direction: "down", delta: 12.5 })
    expect(stages.views.direction).toBeUndefined()
  })

  it("draws nothing for a client with no funnel", () => {
    expect(buildLandingStages(null)).toBeNull()
    expect(buildLandingStages({ applicable: false })).toBeNull()
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
