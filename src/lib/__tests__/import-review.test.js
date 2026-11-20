import { describe, it, expect } from "vitest"
import { MAX_IMPORT_SELECTION, autoCheckedIds, importPayload, listedAccounts, orderRows, resolveRows, rowMatches } from "../import-review"

const account = (location_id, name, extra = {}) => ({ location_id, name, already_imported: false, leads_recent_90: true, leads_recent_7: false, status_default: "active", fb_match: null, ...extra })

describe("listedAccounts", () => {
  it("drops imported sub-accounts and those with no lead in 90 days, but keeps unknown recency", () => {
    const review = { accounts: [account("a", "A", { already_imported: true }), account("b", "B", { leads_recent_90: false }), account("c", "C", { leads_recent_90: null }), account("d", "D")] }
    const { unimported, accounts, hasRecency } = listedAccounts(review)
    expect(unimported.map((a) => a.location_id)).toEqual(["b", "c", "d"])
    expect(accounts.map((a) => a.location_id)).toEqual(["c", "d"])
    expect(hasRecency).toBe(true)
  })

  it("copes with no review yet", () => {
    expect(listedAccounts(null)).toEqual({ unimported: [], accounts: [], hasRecency: false })
  })
})

describe("autoCheckedIds", () => {
  it("ticks only sub-accounts with a lead in the last 7 days", () => {
    const ids = autoCheckedIds([account("a", "A", { leads_recent_7: true }), account("b", "B")])
    expect([...ids]).toEqual(["a"])
  })

  it("caps the pre-selection, keeping the most recent leads", () => {
    const many = Array.from({ length: MAX_IMPORT_SELECTION + 5 }, (_, i) => account(`l${i}`, `L${i}`, { leads_recent_7: true, last_lead_at: new Date(2026, 0, i + 1).toISOString() }))
    const ids = autoCheckedIds(many)
    expect(ids.size).toBe(MAX_IMPORT_SELECTION)
    expect(ids.has(`l${MAX_IMPORT_SELECTION + 4}`)).toBe(true)
    expect(ids.has("l0")).toBe(false)
  })
})

describe("resolveRows", () => {
  const accounts = [account("a", "Aura", { fb_match: { id: "act_1", name: "Aura Ads" }, fb_suggestion: { id: "act_9", name: "Near miss" } }), account("b", "Bolt", { status_default: "inactive" })]

  it("uses the server's defaults until the user edits a row", () => {
    const [a, b] = resolveRows(accounts, {}, new Set(["a"]))
    expect(a).toMatchObject({ importChecked: true, birdyName: "Aura", fb: { id: "act_1" }, status: "active", leadSource: "unknown" })
    expect(b).toMatchObject({ importChecked: false, fb: null, status: "inactive" })
  })

  it("offers the near-miss ad account without selecting it", () => {
    const [a] = resolveRows([account("a", "Aura", { fb_suggestion: { id: "act_9", name: "Near miss" } })], {}, new Set())
    expect(a.fb).toBeNull()
    expect(a.suggestion).toEqual({ id: "act_9", name: "Near miss" })
  })

  it("lets an edit override every default, including unticking and clearing the ad account", () => {
    const [a] = resolveRows(accounts, { a: { import: false, birdyName: "Aura Clinic", fb: null, status: "inactive", leadSource: "instant_form" } }, new Set(["a"]))
    expect(a).toMatchObject({ importChecked: false, birdyName: "Aura Clinic", fb: null, status: "inactive", leadSource: "instant_form" })
  })
})

describe("orderRows and rowMatches", () => {
  const rows = [
    { location_id: "1", name: "Zed", birdyName: "Zed", importChecked: false },
    { location_id: "2", name: "clinic 10", birdyName: "clinic 10", importChecked: true },
    { location_id: "3", name: "Clinic 9", birdyName: "Renamed", importChecked: true, fb: { name: "Glow Ads" } },
    { location_id: "4", name: "Amy", birdyName: "Amy", importChecked: false, suggestion: { name: "Maybe Ads" } },
  ]

  it("puts ticked rows first, each block A to Z on the GoHighLevel name", () => {
    expect(orderRows(rows).map((r) => r.location_id)).toEqual(["3", "2", "4", "1"])
  })

  it("searches the Birdy name, the GoHighLevel name, the ad account and the suggestion", () => {
    expect(rows.filter((r) => rowMatches(r, "renamed")).map((r) => r.location_id)).toEqual(["3"])
    expect(rows.filter((r) => rowMatches(r, "clinic")).map((r) => r.location_id)).toEqual(["2", "3"])
    expect(rows.filter((r) => rowMatches(r, "glow")).map((r) => r.location_id)).toEqual(["3"])
    expect(rows.filter((r) => rowMatches(r, "maybe")).map((r) => r.location_id)).toEqual(["4"])
    expect(rows.filter((r) => rowMatches(r, ""))).toHaveLength(4)
  })
})

describe("importPayload", () => {
  it("sends only ticked rows, with the edited name, ad account, status and lead source", () => {
    const resolved = [
      { location_id: "a", name: "Aura", birdyName: "  Aura Clinic ", importChecked: true, fb: { id: "act_1", currency: "GBP" }, status: "active", leadSource: "instant_form" },
      { location_id: "b", name: "Bolt", birdyName: "   ", importChecked: true, fb: null, status: "inactive", leadSource: "unknown" },
      { location_id: "c", name: "Cat", birdyName: "Cat", importChecked: false, fb: null, status: "active", leadSource: "unknown" },
    ]
    expect(importPayload(resolved)).toEqual([
      { location_id: "a", name: "Aura Clinic", meta_ad_account_id: "act_1", ad_account_currency: "GBP", client_status: "Active", lead_collection_method: "instant_form" },
      { location_id: "b", name: "Bolt", meta_ad_account_id: null, ad_account_currency: null, client_status: "Inactive", lead_collection_method: "unknown" },
    ])
  })
})
