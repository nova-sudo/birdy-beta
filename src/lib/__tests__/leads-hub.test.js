import { describe, expect, it } from "vitest"
import { LEADS_HREF, leadsHubRedirect } from "../leads-hub"

describe("leadsHubRedirect", () => {
  it("sends the hub to Media Buyer's Leads level", () => {
    expect(leadsHubRedirect()).toBe(LEADS_HREF)
    expect(leadsHubRedirect({})).toBe("/dashboard/table")
  })

  it("carries one client over as the table's client filter", () => {
    expect(leadsHubRedirect({ group: "g1" })).toBe("/dashboard/table?client=g1")
    expect(leadsHubRedirect(new URLSearchParams("client=g2"))).toBe("/dashboard/table?client=g2")
    expect(leadsHubRedirect({ client_group: ["g3", "g4"] })).toBe("/dashboard/table?client=g3")
  })

  it("drops what doesn't map: all clients, a list of them, an unknown range", () => {
    expect(leadsHubRedirect({ group: "all" })).toBe(LEADS_HREF)
    expect(leadsHubRedirect({ groups: "g1,g2" })).toBe(LEADS_HREF)
    expect(leadsHubRedirect({ range: "forever", q: "smith", page: "3" })).toBe(LEADS_HREF)
  })

  it("keeps a known date range", () => {
    expect(leadsHubRedirect({ range: "last_30d", group: "g1" })).toBe("/dashboard/table?client=g1&range=last_30d")
  })
})
