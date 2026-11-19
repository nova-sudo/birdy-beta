import { describe, it, expect } from "vitest"
import { DESTINATIONS, OTHER_PAGES, activeRailId, clientDetailHref, clientHref, clientIdFromLocation, clientIdFromPath, isRebuilt } from "../nav"

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
    const id = "a b/c?d"
    expect(clientIdFromPath(clientDetailHref(id))).toBe(id)
    const [path, search] = clientHref(id).split("?")
    expect(path).toBe("/dashboard")
    expect(clientIdFromLocation(path, search)).toBe(id)
  })

  it("reads the client from the path, or from Agency Ops' address, and from nowhere else", () => {
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
  it("is true for the rebuilt pages only: the Clients list and Agency Ops, not a client's own page", () => {
    expect(isRebuilt("/clients")).toBe(true)
    expect(isRebuilt("/dashboard")).toBe(true)
    expect(isRebuilt("/dashboard/chat")).toBe(true)
    expect(isRebuilt("/dashboard/table")).toBe(true)
    expect(isRebuilt("/clients/abc")).toBe(false)
    expect(isRebuilt("/campaigns")).toBe(false)
  })
})
