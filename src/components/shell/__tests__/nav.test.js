import { describe, it, expect } from "vitest"
import { DESTINATIONS, OTHER_PAGES, activeRailId, clientHref, clientIdFromPath, isRebuilt } from "../nav"

describe("activeRailId", () => {
  it.each([
    ["/dashboard", "ops"],
    ["/campaigns", "buyer"],
    ["/hub/agents/media-buying", "buyer"],
    ["/hub/agents/media-buying/setup", "buyer"],
    ["/Sales-Hub", "coach"],
    ["/clients", "clients"],
    ["/clients/abc", "clients"],
    ["/settings", "settings"],
    ["/billing", "settings"],
    ["/credits", "settings"],
    ["/hub", "other"],
    ["/hub/dashboards/7", "other"],
    ["/ask-birdy", "other"],
    ["/contacts", "other"],
    ["/metrics", "other"],
    ["/alerts", "other"],
    ["/changelog", null],
    ["/clientsx", null],
  ])("%s belongs to %s", (pathname, id) => {
    expect(activeRailId(pathname)).toBe(id)
  })
})

describe("destinations", () => {
  it("opens the nearest existing page for each rail item", () => {
    expect(DESTINATIONS).toEqual({ ops: "/dashboard", buyer: "/campaigns", coach: "/Sales-Hub", clients: "/clients", settings: "/settings" })
  })

  it("lists the pages that have no tile of their own", () => {
    expect(OTHER_PAGES.map((p) => [p.label, p.href])).toEqual([["BirdyHub", "/hub"], ["Ask Birdy", "/ask-birdy"], ["Leads", "/contacts"], ["Metrics", "/metrics"], ["Alerts", "/alerts"]])
  })
})

describe("client paths", () => {
  it("round-trips an id with characters that need encoding", () => {
    const id = "hello@agency.com_17898/x"
    expect(clientIdFromPath(clientHref(id))).toBe(id)
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
  it("is true for the Clients list only, not a client's own page", () => {
    expect(isRebuilt("/clients")).toBe(true)
    expect(isRebuilt("/clients/abc")).toBe(false)
    expect(isRebuilt("/dashboard")).toBe(false)
  })
})
