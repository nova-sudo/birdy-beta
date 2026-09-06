// Who has a call centre, and what a funnel does when one client doesn't.
//
// The whole change hangs on one stored field, `call_log_provider`, and on the
// difference between a zero and a hole. A client who told us at onboarding
// that they don't call their leads has no HotProspector cache, so every sum
// over it is a well-formatted 0 — which reads as "a quiet week" and means
// "we have no source for this".

import { describe, it, expect } from "vitest"
import {
  groupHasCallCentre,
  portfolioHasCallCentre,
  scopeHasCallCentre,
  LINK_SALES_TOOL_HREF,
  NO_CALL_CENTRE,
} from "@/lib/call-centre-availability"
import { buildFunnelStages, formatStageCount } from "@/lib/client-funnel"
import { diagnoseFunnel } from "@/lib/portfolio-metrics"

const g = (id, provider, extra = {}) => ({ id, call_log_provider: provider, ...extra })
const byId = (stages) => Object.fromEntries(stages.map((s) => [s.id, s]))

describe("groupHasCallCentre", () => {
  it("says no only for the stored 'none'", () => {
    expect(groupHasCallCentre(g("a", NO_CALL_CENTRE))).toBe(false)
    expect(groupHasCallCentre(g("a", "ghl"))).toBe(true)
    expect(groupHasCallCentre(g("a", "hotprospector"))).toBe(true)
  })

  it("reads a stored value in any casing", () => {
    // The API normalises on write, but the collection predates that guard —
    // client-status.js carries the same scar for the same reason.
    expect(groupHasCallCentre(g("a", " NONE "))).toBe(false)
  })

  it("treats an absent field as connected", () => {
    // The field only started being projected with this change. A missing value
    // means "we don't know yet", and greying a client's real call figures on a
    // stale payload is a worse failure than the zero this replaces.
    expect(groupHasCallCentre({ id: "a" })).toBe(true)
    expect(groupHasCallCentre(undefined)).toBe(true)
  })
})

describe("scopeHasCallCentre", () => {
  const groups = [g("quiet", NO_CALL_CENTRE), g("loud", "hotprospector")]

  it("answers for the selected client", () => {
    expect(scopeHasCallCentre(groups, "quiet")).toBe(false)
    expect(scopeHasCallCentre(groups, "loud")).toBe(true)
  })

  it("keeps a mixed portfolio available under 'all'", () => {
    // The sums are still true — of fewer clients. Only the all-none case has
    // nothing behind it.
    expect(scopeHasCallCentre(groups, "all")).toBe(true)
    expect(scopeHasCallCentre([g("quiet", NO_CALL_CENTRE)], "all")).toBe(false)
  })

  it("does not grey out a list that hasn't arrived", () => {
    expect(scopeHasCallCentre([], "all")).toBe(true)
    expect(scopeHasCallCentre(null, "all")).toBe(true)
    // A selection that matches nothing is mid-load, not misconfigured.
    expect(scopeHasCallCentre(groups, "gone")).toBe(true)
  })
})

describe("portfolioHasCallCentre", () => {
  it("only counts active clients, like the dashboard's own totals", () => {
    // aggregatePortfolio sums activeGroups(...), so asking about a client that
    // contributes nothing to those sums would answer a different question.
    const groups = [
      g("quiet", NO_CALL_CENTRE, { client_status: "Active" }),
      g("archived", "hotprospector", { client_status: "Inactive" }),
    ]
    expect(portfolioHasCallCentre(groups)).toBe(false)
  })

  it("is available as soon as one active client dials", () => {
    const groups = [
      g("quiet", NO_CALL_CENTRE, { client_status: "Active" }),
      g("loud", "hotprospector", { client_status: "active" }),
    ]
    expect(portfolioHasCallCentre(groups)).toBe(true)
  })
})

describe("the funnel's one call-centre stage", () => {
  const funnel = { leads: 200, in_crm: 120, called: 0, closes: 18 }
  const withProvider = (provider) => ({
    call_log_provider: provider,
    gohighlevel: { metrics: { funnel } },
  })

  it("marks Called unavailable and nothing else", () => {
    // Leads is Meta, In CRM and Closes are GHL opportunities. Exactly one
    // stage of the four is something a dialler reports.
    const stages = byId(buildFunnelStages(withProvider(NO_CALL_CENTRE)))
    expect(stages.called.unavailable).toBe(true)
    expect(stages.leads.unavailable).toBeUndefined()
    expect(stages.in_crm.unavailable).toBeUndefined()
    expect(stages.closes.unavailable).toBeUndefined()
  })

  it("leaves the stages below it intact", () => {
    // The point of the cohort framing: every stage is measured against the
    // window's contacts, not against the stage above it, so Closes does not
    // pass through Called and does not become unknowable when Called does. A
    // drop-off funnel would have had to blank everything downstream.
    const stages = byId(buildFunnelStages(withProvider(NO_CALL_CENTRE)))
    expect(stages.closes.count).toBe(18)
    expect(stages.closes.share).toBeCloseTo(18 / 200)
  })

  it("shows a dash rather than the zero it would have summed to", () => {
    const stages = byId(buildFunnelStages(withProvider(NO_CALL_CENTRE)))
    expect(formatStageCount(stages.called)).toBe("—")
    expect(formatStageCount(stages.leads)).toBe("200")
    // `count` stays a number: callers do arithmetic on it, and a stage that
    // renders correctly while breaking a sum has only moved the bug.
    expect(typeof stages.called.count).toBe("number")
  })

  it("drops the share, because a percentage of nothing is not a percentage", () => {
    const stages = byId(buildFunnelStages(withProvider(NO_CALL_CENTRE)))
    expect(stages.called.share).toBeNull()
  })

  it("carries no delta, so the verdict can never blame call coverage", () => {
    const previous = { leads: 400, in_crm: 300, called: 300, closes: 40 }
    const stages = buildFunnelStages(withProvider(NO_CALL_CENTRE), previous)
    const called = byId(stages).called

    expect(called.direction).toBeUndefined()
    expect(called.delta).toBeUndefined()

    // Every other stage fell, so the diagnosis has plenty to say — it just
    // must not say it about the stage nobody measured.
    const verdict = diagnoseFunnel(stages)
    expect(verdict.title).not.toContain("call coverage")
  })

  it("still counts Called for a client who does dial", () => {
    const dialling = {
      call_log_provider: "hotprospector",
      gohighlevel: { metrics: { funnel: { ...funnel, called: 150 } } },
    }
    const called = byId(buildFunnelStages(dialling)).called

    expect(called.unavailable).toBeUndefined()
    expect(called.count).toBe(150)
    expect(formatStageCount(called)).toBe("150")
  })
})

describe("the way out", () => {
  it("points at the Settings tab that already owns the connect dialog", () => {
    // Not a new flow: Settings → Integrations has had the HotProspector
    // credentials dialog all along, and its tab is addressable.
    expect(LINK_SALES_TOOL_HREF).toBe("/settings?tab=integrations")
  })
})
