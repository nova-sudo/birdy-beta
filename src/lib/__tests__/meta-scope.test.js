import { describe, it, expect } from "vitest"
import {
  unassignedText, campaignsSummary, scopeChipLabel, sharesMetaAccount, remainderOwner,
} from "@/lib/meta-scope"
import { normalizeGroupInfo } from "@/lib/normalize-group"

describe("unassignedText", () => {
  it("is singular for one campaign", () => {
    expect(unassignedText({ unassigned: [{ id: "c1", name: "A" }] })).toBe("1 unassigned campaign")
  })
  it("is plural otherwise", () => {
    expect(unassignedText({ unassigned: [{ id: "a" }, { id: "b" }] })).toBe("2 unassigned campaigns")
  })
  it("is null when nothing is unassigned or there is no scope", () => {
    expect(unassignedText({ unassigned: [] })).toBeNull()
    expect(unassignedText(null)).toBeNull()
  })
})

describe("campaignsSummary", () => {
  it("shows n of total in selected mode", () => {
    expect(campaignsSummary({ mode: "selected", selected: 3, total: 9 })).toBe("3 of 9")
  })
  it("shows All campaigns otherwise", () => {
    expect(campaignsSummary({ mode: "all", selected: 9, total: 9 })).toBe("All campaigns")
  })
})

describe("scopeChipLabel", () => {
  it("labels a selected scope", () => {
    expect(scopeChipLabel({ mode: "selected", selected: 4 })).toBe("Meta: 4 campaigns")
    expect(scopeChipLabel({ mode: "selected", selected: 1 })).toBe("Meta: 1 campaign")
  })
  it("is null for all mode or no scope", () => {
    expect(scopeChipLabel({ mode: "all" })).toBeNull()
    expect(scopeChipLabel(null)).toBeNull()
  })
})

describe("sharesMetaAccount", () => {
  const groups = [
    { id: "g1", meta_ad_account_id: "act_1" },
    { id: "g2", meta_ad_account_id: "act_2" },
  ]
  it("is true when another group uses the account", () => {
    expect(sharesMetaAccount(groups, "act_1")).toBe(true)
  })
  it("ignores the group itself and missing accounts", () => {
    expect(sharesMetaAccount(groups, "act_1", "g1")).toBe(false)
    expect(sharesMetaAccount(groups, "act_9")).toBe(false)
    expect(sharesMetaAccount(groups, "")).toBe(false)
  })
  it("matches with or without the act_ prefix", () => {
    expect(sharesMetaAccount(groups, "2")).toBe(true)
  })
})

describe("remainderOwner", () => {
  const groups = [
    { id: "g3", name: "Newer", meta_ad_account_id: "act_1", meta_campaign_ids: null, created_at: "2026-05-01" },
    { id: "g1", name: "Older", meta_ad_account_id: "act_1", meta_campaign_ids: null, created_at: "2026-01-01" },
    { id: "g2", name: "Listed", meta_ad_account_id: "act_1", meta_campaign_ids: ["c1"], created_at: "2025-01-01" },
  ]
  it("is the oldest group on the account still on all campaigns", () => {
    expect(remainderOwner(groups, "act_1")).toBe("Older")
  })
  it("is null when every group already has a list", () => {
    expect(remainderOwner([groups[2]], "act_1")).toBeNull()
  })
})

describe("normalizeGroupInfo", () => {
  it("passes the campaign scope through", () => {
    const scope = { mode: "selected", selected: 1, total: 2, shared: true, unassigned: [] }
    const g = normalizeGroupInfo({ name: "Acme", meta_campaign_ids: ["c1"], meta_scope: scope }, "g1")
    expect(g.meta_campaign_ids).toEqual(["c1"])
    expect(g.meta_scope).toEqual(scope)
  })
  it("keeps null meaning all campaigns", () => {
    const g = normalizeGroupInfo({ name: "Acme" }, "g1")
    expect(g.meta_campaign_ids).toBeNull()
    expect(g.meta_scope).toBeNull()
  })
})
