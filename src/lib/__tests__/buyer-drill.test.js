import { describe, expect, it } from "vitest"
import { AGENCY_DRILL, CLIENT_DRILL, applyDrill, clearDrill, drillInto, drillNames, drillQuery, drillTrail, filtersAt, readDrill, stepTo } from "../buyer-drill"

const rows = [
  { id: "a:1", groupId: "a", campaignId: "c1", adsetId: "s1", adId: "1" },
  { id: "a:2", groupId: "a", campaignId: "c1", adsetId: "s2", adId: "2" },
  { id: "a:3", groupId: "a", campaignId: "c2", adsetId: "s3", adId: "3" },
  { id: "b:4", groupId: "b", campaignId: "c9", adsetId: "s9", adId: "4" },
]

describe("filtersAt", () => {
  it("applies a client everywhere and each other filter only below its own level", () => {
    const keys = (level) => filtersAt(level).map((f) => f.key)
    expect(keys("clients")).toEqual(["group"])
    expect(keys("campaigns")).toEqual(["group"])
    expect(keys("adsets")).toEqual(["group", "campaign"])
    expect(keys("ads")).toEqual(["group", "campaign", "adset"])
    expect(keys("leads")).toEqual(["group", "campaign", "adset", "ad"])
  })
})

describe("applyDrill", () => {
  it("narrows rows by every filter that applies at the level", () => {
    expect(applyDrill(rows, "ads", { group: "a", campaign: "c1" }).map((r) => r.id)).toEqual(["a:1", "a:2"])
    expect(applyDrill(rows, "ads", { group: "a", campaign: "c1", adset: "s2" }).map((r) => r.id)).toEqual(["a:2"])
    expect(applyDrill(rows, "leads", { ad: "3" }).map((r) => r.id)).toEqual(["a:3"])
  })

  it("keeps a filter the level doesn't use aside rather than applying it", () => {
    // On Campaigns, an ad set filter means nothing; only the client narrows.
    expect(applyDrill(rows, "campaigns", { group: "a", adset: "s1" }).map((r) => r.id)).toEqual(["a:1", "a:2", "a:3"])
  })

  it("returns the rows untouched with no filter", () => {
    expect(applyDrill(rows, "ads", {})).toBe(rows)
  })
})

describe("drillInto", () => {
  it("goes from a client to its campaigns", () => {
    expect(drillInto("clients", { id: "a", groupId: "a" })).toEqual({ level: "campaigns", drill: { group: "a" } })
  })

  it("carries everything a row sits under, down to an ad's leads", () => {
    expect(drillInto("campaigns", rows[0])).toEqual({ level: "adsets", drill: { group: "a", campaign: "c1" } })
    expect(drillInto("adsets", rows[0])).toEqual({ level: "ads", drill: { group: "a", campaign: "c1", adset: "s1" } })
    expect(drillInto("ads", rows[0])).toEqual({ level: "leads", drill: { group: "a", campaign: "c1", adset: "s1", ad: "1" } })
  })

  it("stops at the leads", () => {
    expect(drillInto("leads", rows[0])).toBeNull()
  })
})

describe("clearDrill and stepTo", () => {
  const drill = { group: "a", campaign: "c1", adset: "s1", ad: "1" }
  it("removes a filter with everything under it", () => {
    expect(clearDrill(drill, "adset")).toEqual({ group: "a", campaign: "c1" })
    expect(clearDrill(drill, "group")).toEqual({})
    expect(clearDrill(drill, "ad")).toEqual({ group: "a", campaign: "c1", adset: "s1" })
  })
  it("steps back to a filter, showing the level under it", () => {
    expect(stepTo(drill, "campaign")).toEqual({ level: "adsets", drill: { group: "a", campaign: "c1" } })
    expect(stepTo(drill, "group")).toEqual({ level: "campaigns", drill: { group: "a" } })
  })
})

describe("the address", () => {
  it("reads the level and filters back", () => {
    expect(readDrill(new URLSearchParams("level=ads&group=a&campaign=c1&range=last_30d"))).toEqual({ level: "ads", drill: { group: "a", campaign: "c1" } })
    expect(readDrill(new URLSearchParams("level=nonsense"))).toEqual({ level: "clients", drill: {} })
  })

  it("writes them, keeping the rest of the address and leaving the plain table plain", () => {
    const search = new URLSearchParams("range=last_30d&level=ads&adset=old")
    expect(drillQuery(search, "leads", { group: "a", ad: "1" })).toBe("range=last_30d&level=leads&group=a&ad=1")
    expect(drillQuery(search, "clients", {})).toBe("range=last_30d")
  })

  it("round-trips", () => {
    const drill = { group: "a", campaign: "c1", adset: "s1", ad: "1" }
    expect(readDrill(new URLSearchParams(drillQuery(null, "leads", drill)))).toEqual({ level: "leads", drill })
  })
})

describe("drillTrail", () => {
  const groups = [{ id: "a", name: "Aura", facebook: { campaigns: [{ id: "c1", name: "Body Sculpt" }], adsets: [{ id: "s1", name: "Women 30+" }], ads: [{ id: "1", name: "Timelapse" }] } }]
  it("names each filter, outermost first, from every campaign, ad set and ad", () => {
    expect(drillTrail({ ad: "1", group: "a", campaign: "c1" }, drillNames(groups))).toEqual([
      { key: "group", noun: "Client", id: "a", name: "Aura" },
      { key: "campaign", noun: "Campaign", id: "c1", name: "Body Sculpt" },
      { key: "ad", noun: "Ad", id: "1", name: "Timelapse" },
    ])
  })
  it("says a name is unknown rather than inventing one", () => {
    expect(drillTrail({ campaign: "gone" }, drillNames(groups))[0].name).toBeNull()
  })
})

describe("inside one client", () => {
  it("has no Clients level and no client filter, and opens on Campaigns", () => {
    expect(CLIENT_DRILL.levels).toEqual(["campaigns", "adsets", "ads", "leads"])
    expect(filtersAt("leads", CLIENT_DRILL).map((f) => f.key)).toEqual(["campaign", "adset", "ad"])
    expect(filtersAt("campaigns", CLIENT_DRILL)).toEqual([])
    expect(readDrill(new URLSearchParams(""), CLIENT_DRILL)).toEqual({ level: "campaigns", drill: {} })
  })

  it("ignores an agency level and client filter in the address", () => {
    expect(readDrill(new URLSearchParams("client=a&level=clients&group=b&campaign=c1"), CLIENT_DRILL)).toEqual({ level: "campaigns", drill: { campaign: "c1" } })
  })

  it("keeps the client and view in the address and drops a stray group", () => {
    const search = new URLSearchParams("client=a&view=ads&group=b")
    expect(drillQuery(search, "adsets", { campaign: "c1" }, CLIENT_DRILL)).toBe("client=a&view=ads&level=adsets&campaign=c1")
    expect(drillQuery(search, "campaigns", {}, CLIENT_DRILL)).toBe("client=a&view=ads")
    // A place that opens on Ads leaves that level out instead.
    expect(drillQuery(search, "ads", {}, { ...CLIENT_DRILL, first: "ads" })).toBe("client=a&view=ads")
    expect(drillQuery(search, "clients", {}, CLIENT_DRILL)).toBe("client=a&view=ads")
  })

  it("drills a campaign to its ad sets without adding a client", () => {
    expect(drillInto("campaigns", { id: "c1", groupId: "a", campaignId: "c1" }, CLIENT_DRILL)).toEqual({ level: "adsets", drill: { campaign: "c1" } })
    expect(drillInto("ads", { id: "1", groupId: "a", campaignId: "c1", adsetId: "s1", adId: "1" }, CLIENT_DRILL)).toEqual({ level: "leads", drill: { campaign: "c1", adset: "s1", ad: "1" } })
    expect(drillInto("leads", {}, CLIENT_DRILL)).toBeNull()
    expect(drillInto("clients", { id: "a" }, CLIENT_DRILL)).toBeNull()
  })

  it("narrows rows by the client's filters only", () => {
    expect(applyDrill(rows, "ads", { group: "b", campaign: "c1" }, CLIENT_DRILL).map((r) => r.id)).toEqual(["a:1", "a:2"])
    expect(drillTrail({ group: "a", campaign: "c1" }, () => "Body Sculpt", CLIENT_DRILL).map((c) => c.key)).toEqual(["campaign"])
  })

  it("keeps the agency's behaviour as the default", () => {
    expect(AGENCY_DRILL.first).toBe("clients")
    expect(readDrill(new URLSearchParams("")).level).toBe("clients")
  })
})
