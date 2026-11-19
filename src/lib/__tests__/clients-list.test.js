import { describe, it, expect } from "vitest"
import {
  DEFAULT_COLUMNS, formatCell, inTab, lastSynced, nextSort, overTarget, readState, searchRows, sortRows, statusOf, tabCounts, writeState,
} from "../clients-list"

const OPTS = { ranges: ["last_7d", "last_30d"], defaultRange: "last_7d" }
const row = (name, listStatus, meta_spend, extra = {}) => ({ name, listStatus, meta_spend, ...extra })

describe("statusOf", () => {
  it("maps hand-set health onto the list's statuses", () => {
    expect(statusOf({ client_status: "Active", health: "Critical" })).toBe("danger")
    expect(statusOf({ client_status: "Active", health: "Warning" })).toBe("warning")
    expect(statusOf({ client_status: "Active", health: "Healthy" })).toBe("ok")
  })

  it("treats a client with no health recorded as on track", () => {
    expect(statusOf({ client_status: "Active" })).toBe("ok")
    expect(statusOf({ client_status: "Active", health: "nonsense" })).toBe("ok")
  })

  it("ignores health on an inactive client", () => {
    expect(statusOf({ client_status: "Inactive", health: "Critical" })).toBe("off")
  })
})

describe("tabs", () => {
  it("puts both Critical and Warning under At risk, and inactive clients only under Inactive", () => {
    expect(inTab("danger", "risk")).toBe(true)
    expect(inTab("warning", "risk")).toBe(true)
    expect(inTab("ok", "risk")).toBe(false)
    expect(inTab("off", "all")).toBe(false)
    expect(inTab("off", "off")).toBe(true)
    expect(inTab("ok", "off")).toBe(false)
  })

  it("counts so that At risk and On track add up to All active", () => {
    const counts = tabCounts([row("a", "danger"), row("b", "warning"), row("c", "ok"), row("d", "ok"), row("e", "off")])
    expect(counts).toEqual({ all: 4, risk: 2, ok: 2, off: 1 })
    expect(counts.risk + counts.ok).toBe(counts.all)
  })
})

describe("sortRows", () => {
  const rows = [row("Zed", "ok", 50), row("Amy", "danger", 10), row("Bob", "warning", 99), row("Cat", "ok", 80), row("Dan", "danger", 30)]

  it("defaults to most urgent first: Critical, then Warning, then On track by spend", () => {
    expect(sortRows(rows, null).map((r) => r.name)).toEqual(["Dan", "Amy", "Bob", "Cat", "Zed"])
  })

  it("sorts a number column both ways", () => {
    expect(sortRows(rows, { id: "meta_spend", dir: "desc" }).map((r) => r.meta_spend)).toEqual([99, 80, 50, 30, 10])
    expect(sortRows(rows, { id: "meta_spend", dir: "asc" }).map((r) => r.meta_spend)).toEqual([10, 30, 50, 80, 99])
  })

  it("keeps rows with no value last whichever way the column is sorted", () => {
    const withGaps = [row("a", "ok", 5, { x: null }), row("b", "ok", 5, { x: 3 }), row("c", "ok", 5, { x: undefined }), row("d", "ok", 5, { x: 1 })]
    expect(sortRows(withGaps, { id: "x", dir: "desc" }).map((r) => r.name)).toEqual(["b", "d", "a", "c"])
    expect(sortRows(withGaps, { id: "x", dir: "asc" }).map((r) => r.name)).toEqual(["d", "b", "a", "c"])
  })

  it("sorts names by alphabet, ignoring case, with numbers in order", () => {
    const names = [row("clinic 10", "ok", 1), row("Clinic 9", "ok", 1), row("aura", "ok", 1)]
    expect(sortRows(names, { id: "name", dir: "asc" }).map((r) => r.name)).toEqual(["aura", "Clinic 9", "clinic 10"])
  })

  it("does not change the list it was given", () => {
    const before = rows.map((r) => r.name)
    sortRows(rows, { id: "meta_spend", dir: "asc" })
    expect(rows.map((r) => r.name)).toEqual(before)
  })
})

describe("nextSort", () => {
  it("cycles a number column: highest first, lowest first, back to the default", () => {
    const one = nextSort(null, "meta_spend")
    const two = nextSort(one, "meta_spend")
    expect(one).toEqual({ id: "meta_spend", dir: "desc" })
    expect(two).toEqual({ id: "meta_spend", dir: "asc" })
    expect(nextSort(two, "meta_spend")).toBeNull()
  })

  it("starts names at A to Z and a different column from its own first order", () => {
    expect(nextSort(null, "name")).toEqual({ id: "name", dir: "asc" })
    expect(nextSort({ id: "name", dir: "asc" }, "meta_spend")).toEqual({ id: "meta_spend", dir: "desc" })
  })
})

describe("searchRows", () => {
  const rows = [row("Healthy Glow", "ok", 1), row("Aura", "ok", 1)]
  it("matches part of a name, ignoring case and outer spaces", () => {
    expect(searchRows(rows, "  GLOW ").map((r) => r.name)).toEqual(["Healthy Glow"])
  })
  it("returns everything for an empty search", () => {
    expect(searchRows(rows, "   ")).toHaveLength(2)
  })
})

describe("address state", () => {
  it("round-trips a full state", () => {
    const state = { tab: "risk", q: "glow", sort: { id: "meta_spend", dir: "desc" }, range: "last_30d" }
    expect(readState(writeState(state, OPTS), OPTS)).toEqual(state)
  })

  it("writes nothing for the defaults", () => {
    expect(writeState({ tab: "all", q: "", sort: null, range: "last_7d" }, OPTS)).toBe("")
  })

  it("falls back to defaults for unknown values", () => {
    expect(readState("?tab=bogus&sort=meta_spend-sideways&range=last_century", OPTS)).toEqual({ tab: "all", q: "", sort: null, range: "last_7d" })
  })

  it("keeps a column id that contains hyphens", () => {
    expect(readState("?sort=tag-vip-desc", OPTS).sort).toEqual({ id: "tag-vip", dir: "desc" })
  })
})

describe("formatCell", () => {
  it("shows a dash for a value that was never measured", () => {
    expect(formatCell(null, "meta_spend")).toBe("—")
    expect(formatCell(undefined, "hp_connect_rate")).toBe("—")
    expect(formatCell(Number.NaN, "meta_spend")).toBe("—")
  })

  it("writes money in the account's currency", () => {
    expect(formatCell(1234.5, "meta_spend", { currencySymbol: "£" })).toBe("£1,234.50")
    expect(formatCell(3, "cost_per_lead", { currencySymbol: "£" })).toBe("£3.00")
  })

  it("writes rates as percentages and counts as whole numbers", () => {
    expect(formatCell(28.456, "hp_connect_rate")).toBe("28.46%")
    expect(formatCell(1200, "meta_leads")).toBe("1,200")
  })

  it("formats a custom metric by its chosen format", () => {
    const customMetrics = [{ id: "m1", formatType: "percentage" }, { id: "m2", formatType: "currency" }, { id: "m3" }]
    expect(formatCell(0.256, "m1", { customMetrics })).toBe("25.60%")
    expect(formatCell(9, "m2", { customMetrics, currencySymbol: "£" })).toBe("£9.00")
    expect(formatCell(1500, "m3", { customMetrics })).toBe("1,500")
  })
})

describe("overTarget", () => {
  it("is true only when a target exists and the cost is above it", () => {
    expect(overTarget(12.46, 6)).toBe(true)
    expect(overTarget(5, 6)).toBe(false)
    expect(overTarget(6, 6)).toBe(false)
    expect(overTarget(12, null)).toBe(false)
    expect(overTarget(12, 0)).toBe(false)
    expect(overTarget(null, 6)).toBe(false)
  })
})

describe("lastSynced", () => {
  const now = Date.parse("2026-11-19T12:00:00Z")
  it("reads the newest sync across clients, treating zone-less times as UTC", () => {
    const groups = [{ last_meta_refresh: "2026-11-19T11:48:00" }, { last_ghl_refresh: "2026-11-19T09:00:00Z" }]
    expect(lastSynced(groups, now)).toBe("12 min ago")
  })
  it("uses hours and days for older syncs", () => {
    expect(lastSynced([{ last_hp_refresh: "2026-11-19T07:00:00Z" }], now)).toBe("5 h ago")
    expect(lastSynced([{ last_meta_refresh: "2026-11-17T12:00:00Z" }], now)).toBe("2 days ago")
  })
  it("returns null when nothing has synced", () => {
    expect(lastSynced([{}, { last_meta_refresh: "" }], now)).toBeNull()
  })
})

describe("defaults", () => {
  it("shows spend, leads, cost per lead and the share of leads called", () => {
    expect(DEFAULT_COLUMNS).toEqual(["meta_spend", "meta_leads", "cost_per_lead", "hp_connect_rate"])
  })
})
