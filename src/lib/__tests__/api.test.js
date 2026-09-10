/**
 * What these lock down is the CORS shape of the request, not its result.
 *
 * A GET that carries any non-safelisted header stops being a "simple" request
 * and costs an OPTIONS round-trip before the real one — ~350ms against the
 * deployed backend, re-paid per URL because the preflight cache is keyed that
 * way. So the assertion worth making is a negative one: on a GET we send no
 * headers at all, and on nothing do we send Authorization.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/components/birdy/birdy-store", () => ({
  setBusy: vi.fn(),
  flash: vi.fn(),
}))

import { apiRequest, publicRequest } from "@/lib/api"

function lastFetchInit() {
  return global.fetch.mock.calls.at(-1)[1]
}

function headerNames() {
  return Object.keys(lastFetchInit().headers).map((k) => k.toLowerCase())
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
  localStorage.setItem("auth_token", "a-token-nothing-reads")
})

describe("apiRequest", () => {
  it("sends a GET with no headers, so the browser skips the preflight", async () => {
    await apiRequest("/api/client-groups?date_preset=last_7d")

    expect(headerNames()).toEqual([])
  })

  it("never sends Authorization — the API only reads the auth_token cookie", async () => {
    await apiRequest("/api/client-groups")
    expect(headerNames()).not.toContain("authorization")

    await apiRequest("/api/alerts", { method: "POST", body: "{}" })
    expect(headerNames()).not.toContain("authorization")
  })

  it("sends the cookie, which is what actually authenticates", async () => {
    await apiRequest("/api/client-groups")

    expect(lastFetchInit().credentials).toBe("include")
  })

  it("describes a body when there is one", async () => {
    await apiRequest("/api/alerts", {
      method: "POST",
      body: JSON.stringify({ name: "x" }),
    })

    expect(lastFetchInit().headers["Content-Type"]).toBe("application/json")
  })

  it("omits the content type on a DELETE that carries no body", async () => {
    await apiRequest("/api/dashboard/suggestions/1", { method: "DELETE" })

    expect(headerNames()).toEqual([])
  })

  it("leaves a caller's own content type alone", async () => {
    await apiRequest("/api/upload", {
      method: "POST",
      body: "a,b,c",
      headers: { "content-type": "text/csv" },
    })

    expect(lastFetchInit().headers["content-type"]).toBe("text/csv")
    expect(headerNames()).toEqual(["content-type"])
  })
})

describe("publicRequest", () => {
  it("sends no headers on a GET", async () => {
    await publicRequest("/api/status")

    expect(headerNames()).toEqual([])
  })

  it("describes a login body", async () => {
    await publicRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.c" }),
    })

    expect(lastFetchInit().headers["Content-Type"]).toBe("application/json")
  })
})
