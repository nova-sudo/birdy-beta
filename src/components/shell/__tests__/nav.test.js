import { describe, it, expect } from "vitest"
import { DESTINATIONS, activeRailId, clientDetailHref, clientHref, clientHrefFrom, clientIdFromLocation, clientIdFromPath, isRebuilt, sectionBase } from "../nav"

describe("activeRailId", () => {
  it.each([
    ["/dashboard", "ops"],
    ["/campaigns", "buyer"],
    ["/media-buyer", "buyer"],
    ["/media-buyer/table", "buyer"],
    ["/sales-coach", "coach"],
    ["/sales-coach/chat", "coach"],
    ["/hub/agents/media-buying", "buyer"],
    ["/hub/agents/media-buying/setup", "buyer"],
    ["/Sales-Hub", "coach"],
    ["/clients", "clients"],
    ["/clients/abc", "clients"],
    ["/settings", "settings"],
    ["/billing", "settings"],
    ["/credits", "settings"],
    ["/metrics", "settings"],
    // BirdyHub and Ask Birdy have no tile any more.
    ["/hub", null],
    ["/ask-birdy", null],
    // The Leads hub is retired; its address only redirects, and a lead page belongs to no tile.
    ["/contacts/c1", null],
    ["/alerts", "settings"],
    ["/changelog", null],
    ["/clientsx", null],
  ])("%s belongs to %s", (pathname, id) => {
    expect(activeRailId(pathname)).toBe(id)
  })
})

describe("destinations", () => {
  it("opens the nearest existing page for each rail item", () => {
    expect(DESTINATIONS).toEqual({ ops: "/dashboard", buyer: "/media-buyer", coach: "/sales-coach", clients: "/clients", settings: "/settings" })
  })
})

describe("client paths", () => {
  it("round-trips an id with characters that need encoding", () => {
    const id = "a b/c?d"
    expect(clientIdFromPath(clientDetailHref(id))).toBe(id)
    const [path, search] = clientHref(id).split("?")
    expect(path).toBe("/dashboard")
    expect(clientIdFromLocation(path, search)).toBe(id)
  })

  it("reads the client from the path, or from Birdy's address, and from nowhere else", () => {
    expect(clientIdFromLocation("/clients/abc", "")).toBe("abc")
    expect(clientIdFromLocation("/dashboard", "client=abc&range=last_30d")).toBe("abc")
    expect(clientIdFromLocation("/dashboard", "")).toBeNull()
    expect(clientIdFromLocation("/campaigns", "client=abc")).toBeNull()
  })

  it("reads the client from nested client pages and nothing from other pages", () => {
    expect(clientIdFromPath("/clients/abc/tracking")).toBe("abc")
    expect(clientIdFromPath("/clients")).toBeNull()
    expect(clientIdFromPath("/dashboard")).toBeNull()
  })

  it("survives a badly encoded address", () => {
    expect(clientIdFromPath("/clients/%E0%A4%A")).toBe("%E0%A4%A")
  })
})

describe("isRebuilt", () => {
  it("is true for the rebuilt pages only: the Clients list and Birdy, not a client's own page", () => {
    expect(isRebuilt("/clients")).toBe(true)
    expect(isRebuilt("/dashboard")).toBe(true)
    expect(isRebuilt("/dashboard/chat")).toBe(true)
    expect(isRebuilt("/dashboard/table")).toBe(true)
    expect(isRebuilt("/dashboard/suggestions")).toBe(true)
    expect(isRebuilt("/clients/abc")).toBe(false)
    expect(isRebuilt("/campaigns")).toBe(false)
  })

  it("is true for Marketing Guru's and Sales Coach's four tabs, and not the old hubs", () => {
    for (const base of ["/media-buyer", "/sales-coach"]) {
      for (const tab of ["", "/chat", "/table", "/suggestions", "/context"]) expect(isRebuilt(`${base}${tab}`)).toBe(true)
      expect(isRebuilt(`${base}/other`)).toBe(false)
    }
    expect(isRebuilt("/Sales-Hub")).toBe(false)
  })

  it("is true for Reports, one report's page and Projections", () => {
    for (const path of ["/dashboard/reports", "/dashboard/reports/r1", "/media-buyer/reports", "/media-buyer/reports/morning", "/media-buyer/projections"]) {
      expect(isRebuilt(path)).toBe(true)
    }
    expect(isRebuilt("/hub/reports")).toBe(false)
  })

  it("is true for Settings", () => {
    expect(isRebuilt("/settings")).toBe(true)
  })
})

describe("agent sections and clients", () => {
  it("knows which section a path is in", () => {
    expect(sectionBase("/media-buyer/chat")).toBe("/media-buyer")
    expect(sectionBase("/sales-coach")).toBe("/sales-coach")
    expect(sectionBase("/dashboard/table")).toBe("/dashboard")
    expect(sectionBase("/campaigns")).toBeNull()
  })

  it("reads the client a section is narrowed to", () => {
    expect(clientIdFromLocation("/media-buyer/table", "client=abc")).toBe("abc")
    expect(clientIdFromLocation("/sales-coach", "client=x%20y")).toBe("x y")
  })

  it("keeps a client picked inside Marketing Guru or Sales Coach in that section and tab", () => {
    expect(clientHrefFrom("/media-buyer/table", "a b")).toBe("/media-buyer/table?client=a%20b")
    expect(clientHrefFrom("/sales-coach", "a")).toBe("/sales-coach?client=a")
    expect(clientHrefFrom("/dashboard/chat", "a")).toBe("/dashboard?client=a")
    // Context is the same page inside a client, in every section.
    expect(clientHrefFrom("/dashboard/context", "a")).toBe("/dashboard/context?client=a")
    expect(clientHrefFrom("/media-buyer/context", "a")).toBe("/media-buyer/context?client=a")
    expect(clientHrefFrom("/campaigns", "a")).toBe("/dashboard?client=a")
  })
})

describe("railHref", () => {
  it("carries the client and the date range between the agent sections", async () => {
    const { railHref } = await import("../nav");
    expect(railHref("coach", "?client=a%40b.com_1&range=last_30d&view=leads")).toBe("/sales-coach?client=a%40b.com_1&range=last_30d");
    expect(railHref("ops", "?client=c1")).toBe("/dashboard?client=c1");
    expect(railHref("buyer", "")).toBe("/media-buyer");
  });

  it("opens Clients and Settings plain", async () => {
    const { railHref } = await import("../nav");
    expect(railHref("clients", "?client=c1")).toBe("/clients");
    expect(railHref("settings", "?client=c1")).toBe("/settings");
  });
});
