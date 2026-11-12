import { describe, expect, it } from "vitest"
import { openingMessage, quickReplies } from "../opening"

const card = (over = {}) => ({
  id: "c1",
  client_group_id: "g1",
  client_name: "Cloud Nine Beauty",
  currency: "GBP",
  status: "open",
  can_apply: true,
  zone: "red",
  previous_cpl: 12.57,
  current_cpl: 5.9,
  leads: 19,
  ads_live: 3,
  lines: [
    { id: "l1", kind: "remove", state: "proposed", mode: "ask", ad_name: "New Format Test (11)", spend: 27, leads: 0, cpl: null, flags: [] },
    { id: "l2", kind: "remove", state: "proposed", mode: "ask", ad_name: "New Format Test (122)", spend: 16.01, leads: 1, cpl: 16.01, flags: [] },
  ],
  ...over,
})
const billing = { client_group_id: "g1", code: "payment_issue", severity: "critical", title: "Payment problem on the ad account", detail: "The account is in its payment grace period." }

describe("openingMessage", () => {
  it("numbers lines with verbs and reasons", () => {
    const m = openingMessage(card(), { alerts: [], targets: { green_under: 4, red_over: 6 } })
    expect(m.lines).toEqual([
      { n: 1, id: "l1", verb: "Remove", tone: "danger", ad: "New Format Test (11)", reason: "No leads on £27 spent." },
      { n: 2, id: "l2", verb: "Remove", tone: "danger", ad: "New Format Test (122)", reason: "£16.01 a lead on 1 lead, 2.7× its £6 limit." },
    ])
    expect(m.question).toBe("Want me to do all 2?")
  })

  it("effect counts remaining live ads", () => {
    expect(openingMessage(card(), {}).effect).toBe("Yes to all 2 leaves 1 ad live.")
    expect(openingMessage(card({ ads_live: 5 }), {}).effect).toBe("Yes to all 2 leaves 3 ads live.")
    expect(openingMessage(card({ ads_live: null }), {}).effect).toBeUndefined()
    const one = card({ lines: [card().lines[0], { id: "l3", kind: "revive", state: "proposed", mode: "ask", ad_name: "Old", spend: 40, leads: 8, cpl: 5 }] })
    expect(openingMessage(one, {}).lines[1]).toMatchObject({ verb: "Turn back on", tone: "success" })
  })

  it("billing alert headline first", () => {
    const m = openingMessage(card(), { alerts: [billing, { client_group_id: "g2", code: "spend_stopped", title: "No spend yesterday" }] })
    expect(m.alert).toEqual({ headline: "Payment problem on the ad account", detail: "The account is in its payment grace period." })
  })

  it("read-only card has pastNote and no question", () => {
    const decided = card({ status: "applied", can_apply: false, lines: card().lines.map((ln) => ({ ...ln, state: "applied" })) })
    const m = openingMessage(decided, { readOnly: true })
    expect(m.question).toBeUndefined()
    expect(m.effect).toBeUndefined()
    expect(m.pastNote).toBe("Read-only. Both changes were applied. CPL went from £12.57 to £5.90, on 19 leads.")
    expect(m.lines.map((l) => l.state)).toEqual(["Applied", "Applied"])
  })

  it("a card with nothing to do says what Birdy checked", () => {
    const m = openingMessage(card({ lines: [], zone: "green", thought_process: "CPL is £3.00, in the green zone (under £4.00). No changes." }), {})
    expect(m.lines).toEqual([])
    expect(m.question).toBeUndefined()
    expect(m.note).toBe("CPL is £3.00, in the green zone (under £4.00). No changes.")
  })
})

describe("quickReplies", () => {
  it("quick replies include Set targets only without target", () => {
    const keys = (r) => r.map((x) => x.k)
    expect(keys(quickReplies(card(), { alerts: [billing], hasTarget: true }))).toEqual(["yes_all", "why", "alert_q", "draft", "link"])
    expect(keys(quickReplies(card(), { alerts: [], hasTarget: false }))).toEqual(["yes_all", "why", "draft", "targets"])
  })

  it("uses the spec's labels", () => {
    const r = quickReplies(card(), { alerts: [billing], hasTarget: true })
    expect(r.map((x) => x.label)).toEqual(["Yes to all 2", "Why this?", "What happens if it isn't paid?", "Draft a client message", "Open billing in Meta"])
    expect(r.find((x) => x.k === "link").href).toMatch(/^https:\/\/business\.facebook\.com\//)
  })

  it("a read-only card offers no action", () => {
    expect(quickReplies(card(), { readOnly: true, hasTarget: true }).some((x) => x.k === "yes_all")).toBe(false)
  })
})
