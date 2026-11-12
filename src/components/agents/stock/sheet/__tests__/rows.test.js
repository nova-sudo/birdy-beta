import { describe, expect, it } from "vitest"
import { birdyChip, latestCards, moves, orderRows, sheetRows, summary, targetsFor, zoneOf } from "../rows"

const line = (over = {}) => ({ id: "l1", kind: "remove", state: "proposed", mode: "ask", ad_name: "Ad", ...over })
const card = (over = {}) => ({
  id: "c1",
  client_group_id: "g1",
  client_name: "Aura",
  status: "open",
  can_apply: true,
  zone: "yellow",
  lines: [],
  ...over,
})
const alert = (code, over = {}) => ({ client_group_id: "g1", code, severity: "critical", title: code, ...over })

describe("birdyChip (spec §2.2 table)", () => {
  it("spend_stopped decision is Ads stopped", () => {
    expect(birdyChip(card({ decision: "spend_stopped", lines: [line()] }), [])).toEqual({ k: "stopped" })
  })
  it("an ads stopped alert is Ads stopped", () => {
    expect(birdyChip(card(), [alert("spend_stopped")])).toEqual({ k: "stopped" })
  })
  it("open card with proposed lines counts its open lines", () => {
    const c = card({ lines: [line(), line({ id: "l2" }), line({ id: "l3", mode: "flag", state: "flagged" })] })
    expect(birdyChip(c, [])).toEqual({ k: "changes", n: 2, soon: false })
  })
  it("changes add the clock when ads stop soon", () => {
    expect(birdyChip(card({ lines: [line()] }), [alert("payment_issue")])).toEqual({ k: "changes", n: 1, soon: true })
  })
  it("no lines but a stops soon alert is Stops soon", () => {
    expect(birdyChip(card(), [alert("prepaid_low", { severity: "warning" })])).toEqual({ k: "soon" })
  })
  it("a flagged card is Check", () => {
    expect(birdyChip(card({ status: "flagged", can_apply: false, lines: [line({ mode: "flag", state: "flagged" })] }), [])).toEqual({ k: "check" })
  })
  it("a client with a problem and no card is Check", () => {
    expect(birdyChip(null, [{ client_group_id: "g1", code: "problem", severity: "warning" }])).toEqual({ k: "check" })
  })
  it("applied, partly applied and dismissed cards are Done", () => {
    for (const status of ["applied", "partly_applied", "dismissed"]) {
      expect(birdyChip(card({ status, can_apply: false, lines: [line({ state: "applied" })] }), [])).toEqual({ k: "done" })
    }
  })
  it("nothing is none", () => {
    expect(birdyChip(card({ zone: "green" }), [])).toEqual({ k: "none" })
    expect(birdyChip(null, [])).toEqual({ k: "none" })
  })
  it("another client's alert doesn't count", () => {
    expect(birdyChip(card(), [alert("spend_stopped", { client_group_id: "g2" })])).toEqual({ k: "none" })
  })
})

describe("zones", () => {
  const t = { green_under: 5, red_over: 8 }
  it("zoneOf splits on the green and red lines", () => {
    expect(zoneOf(4.99, t)).toBe("grn")
    expect(zoneOf(5, t)).toBe("amb")
    expect(zoneOf(8, t)).toBe("amb")
    expect(zoneOf(8.01, t)).toBe("red")
    expect(zoneOf(null, t)).toBe("gry")
    expect(zoneOf(3, null)).toBe("gry")
  })
  it("targetsFor prefers the client's own limits, then the default in its currency", () => {
    const settings = { zones: { currency: "GBP", green_under: 5, red_over: 8 }, clients: { g2: { zones: { green_under: 3, red_over: 4 } } } }
    expect(targetsFor(settings, "g1", "GBP")).toEqual({ green_under: 5, red_over: 8 })
    expect(targetsFor(settings, "g1", "USD")).toBeNull()
    expect(targetsFor(settings, "g2", "USD")).toEqual({ green_under: 3, red_over: 4 })
  })
})

describe("moves", () => {
  it("compares last week's zone with this week's", () => {
    const t = { green_under: 5, red_over: 8 }
    const cards = [
      card({ client_name: "Up", previous_cpl: 9, current_cpl: 4 }),
      card({ client_name: "Down", previous_cpl: 4, current_cpl: 6 }),
      card({ client_name: "Same", previous_cpl: 6, current_cpl: 7 }),
      card({ client_name: "No leads", previous_cpl: 6, current_cpl: null, zone: "red" }),
    ]
    expect(moves(cards, () => t)).toEqual({ better: ["Up"], worse: ["Down", "No leads"] })
  })
})

describe("summary", () => {
  it("counts to decide, stopped and stopping soon", () => {
    const cards = [
      card({ id: "a", client_group_id: "g1", lines: [line()] }),
      card({ id: "b", client_group_id: "g2", decision: "spend_stopped" }),
      card({ id: "c", client_group_id: "g3", zone: "green" }),
    ]
    const alerts = [alert("prepaid_low", { client_group_id: "g4" })]
    expect(summary(cards, alerts)).toEqual({ toDecide: 3, stopped: 1, soon: 1 })
  })
})

describe("sheetRows", () => {
  it("adds clients in scope with no card, opening their latest card read-only", () => {
    const rows = sheetRows({
      cards: [card({ leads: 4, current_cpl: 12.46, spend: 49.86 })],
      clientsInScope: [{ id: "g1", name: "Aura" }, { id: "g9", name: "Late" }, { id: "g8", name: "Never" }],
      latestByClient: { g9: { card_id: "old", run_id: "r0" } },
    })
    expect(rows.map((r) => [r.gid, r.cardId, r.readOnly, r.noFigures])).toEqual([
      ["g1", "c1", false, false],
      ["g9", "old", true, true],
      ["g8", null, true, true],
    ])
  })
  it("month rows come from the server", () => {
    const rows = sheetRows({ monthRows: [{ client_group_id: "g1", client_name: "Aura", leads: 10, spend: 50, cpl: 5, zone: "yellow", decided: 2 }] })
    expect(rows[0]).toMatchObject({ gid: "g1", leads: 10, cpl: 5, zone: "amb", decided: 2, readOnly: true, cardId: null })
  })
})

describe("orderRows", () => {
  const r = (name, over = {}) => ({ gid: name, name, leads: 1, cpl: 5, spend: 10, chip: { k: "none" }, ...over })
  it("most urgent: to decide first, then CPL rising, then no figures", () => {
    const rows = [
      r("Cheap", { cpl: 2 }),
      r("Blank", { cpl: null, spend: null, leads: null }),
      r("Pricey", { cpl: 9 }),
      r("Changes", { cpl: 3, chip: { k: "changes", n: 1 } }),
      r("Stopped", { cpl: 1, chip: { k: "stopped" } }),
    ]
    expect(orderRows(rows, { mode: "urgent" }).map((x) => x.name)).toEqual(["Stopped", "Changes", "Cheap", "Pricey", "Blank"])
  })
  it("best to worst ranks by the chosen column", () => {
    const rows = [r("A", { leads: 5, cpl: 4 }), r("B", { leads: 9, cpl: 6 }), r("C", { cpl: null, spend: null, leads: null })]
    expect(orderRows(rows, { mode: "best", sort: "cpl" }).map((x) => [x.name, x.rank])).toEqual([["A", 1], ["B", 2], ["C", null]])
    expect(orderRows(rows, { mode: "best", sort: "leads" }).map((x) => x.name)).toEqual(["B", "A", "C"])
  })
})

describe("latestCards", () => {
  it("takes each client's newest card", () => {
    const runs = [
      { id: "r2", clients: { g1: { card_id: "c2" } } },
      { id: "r1", clients: { g1: { card_id: "c1" }, g2: { card_id: "c3" }, g3: { state: "failed" } } },
    ]
    expect(latestCards(runs)).toEqual({ g1: { card_id: "c2", run_id: "r2" }, g2: { card_id: "c3", run_id: "r1" } })
  })
})
