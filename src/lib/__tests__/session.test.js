/**
 * The proxy decides whether someone sees the app or gets sent to /login,
 * before any of their code runs. The case that matters most is the one that is
 * easy to get wrong and impossible to miss in production: a valid session that
 * predates this cookie must not be bounced.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { parseSession, isExpired, SESSION_COOKIE } from "@/lib/session"
import { proxy } from "@/proxy"

const HOUR = 60 * 60 * 1000

function requestWith(pathname, cookieValue) {
  return {
    nextUrl: { pathname },
    url: `https://app.example.com${pathname}`,
    cookies: {
      get: (name) =>
        name === SESSION_COOKIE && cookieValue !== undefined
          ? { value: cookieValue }
          : undefined,
    },
  }
}

function cookieFor({ exp, role = null, ob = false }) {
  return encodeURIComponent(JSON.stringify({ exp, role, ob }))
}

const signedIn = () => cookieFor({ exp: Date.now() + HOUR })
const expired = () => cookieFor({ exp: Date.now() - HOUR })

/** Where did middleware send them? null means "it let them through". */
function destinationOf(response) {
  const location = response?.headers?.get?.("location")
  return location ? new URL(location).pathname + new URL(location).search : null
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe("parseSession", () => {
  it("treats a corrupt cookie as no hint rather than as signed out", () => {
    // A cookie from an older shape, or one a user mangled, must not be able to
    // lock them out — it falls through to the client checks.
    expect(parseSession("not-json")).toBeNull()
    expect(parseSession(encodeURIComponent(JSON.stringify({ nope: 1 })))).toBeNull()
    expect(parseSession(undefined)).toBeNull()
  })

  it("reads back what was written", () => {
    const exp = Date.now() + HOUR
    expect(parseSession(cookieFor({ exp, role: "admin", ob: true }))).toEqual({
      exp,
      role: "admin",
      ob: true,
    })
  })

  it("knows an expiry when it sees one", () => {
    expect(isExpired({ exp: Date.now() - 1 })).toBe(true)
    expect(isExpired({ exp: Date.now() + HOUR })).toBe(false)
    expect(isExpired(null)).toBe(true)
  })
})

describe("proxy (the request interceptor Next 16 renamed from middleware)", () => {
  it("lets a session with no cookie through", () => {
    // The whole reason this is conservative: every session that existed before
    // the cookie did has no cookie, and is still perfectly valid. Redirecting
    // on absence would sign the entire userbase out on one deploy.
    expect(destinationOf(proxy(requestWith("/clients", undefined)))).toBeNull()
    expect(destinationOf(proxy(requestWith("/admin", undefined)))).toBeNull()
  })

  it("sends an expired session to login, remembering where it was going", () => {
    expect(destinationOf(proxy(requestWith("/clients", expired())))).toBe(
      "/login?redirect=%2Fclients"
    )
  })

  it("leaves an expired session alone on a public page", () => {
    expect(destinationOf(proxy(requestWith("/login", expired())))).toBeNull()
  })

  it("keeps a signed-in user out of login and register", () => {
    expect(destinationOf(proxy(requestWith("/login", signedIn())))).toBe("/clients")
    expect(destinationOf(proxy(requestWith("/register", signedIn())))).toBe("/clients")
  })

  it("lets a signed-in user reach the app", () => {
    expect(destinationOf(proxy(requestWith("/clients", signedIn())))).toBeNull()
  })

  it("holds an unfinished signup in the wizard", () => {
    const midSignup = cookieFor({ exp: Date.now() + HOUR, ob: true })
    expect(destinationOf(proxy(requestWith("/clients", midSignup)))).toBe("/onboarding")
    // ...but not in a loop once they're there.
    expect(destinationOf(proxy(requestWith("/onboarding", midSignup)))).toBeNull()
  })

  it("keeps non-admins out of the admin console", () => {
    expect(destinationOf(proxy(requestWith("/admin", signedIn())))).toBe("/dashboard")
    expect(destinationOf(proxy(requestWith("/admin/users", signedIn())))).toBe("/dashboard")

    const admin = cookieFor({ exp: Date.now() + HOUR, role: "admin" })
    expect(destinationOf(proxy(requestWith("/admin/users", admin)))).toBeNull()
  })
})

describe("an admin's only place is the admin console", () => {
  const admin = (extra = {}) => cookieFor({ exp: Date.now() + HOUR, role: "admin", ...extra })

  it("sends a signed-in admin from any app screen to /admin", () => {
    for (const path of ["/dashboard", "/clients", "/campaigns", "/settings", "/ask-birdy"]) {
      expect(destinationOf(proxy(requestWith(path, admin())))).toBe("/admin")
    }
  })

  it("never puts an admin in onboarding, even with a stale onboarding flag", () => {
    expect(destinationOf(proxy(requestWith("/onboarding", admin({ ob: true }))))).toBe("/admin")
    expect(destinationOf(proxy(requestWith("/clients", admin({ ob: true }))))).toBe("/admin")
  })

  it("sends an admin from login and sign-up to the console", () => {
    expect(destinationOf(proxy(requestWith("/login", admin())))).toBe("/admin")
    expect(destinationOf(proxy(requestWith("/register", admin())))).toBe("/admin")
  })

  it("lets an admin use every console page", () => {
    expect(destinationOf(proxy(requestWith("/admin", admin())))).toBeNull()
    expect(destinationOf(proxy(requestWith("/admin/agencies", admin())))).toBeNull()
  })

  it("lets an impersonating admin into the agency's app, whose role is not admin", () => {
    const impersonating = cookieFor({ exp: Date.now() + HOUR, role: "user" })
    expect(destinationOf(proxy(requestWith("/dashboard", impersonating)))).toBeNull()
    expect(destinationOf(proxy(requestWith("/admin", impersonating)))).toBe("/dashboard")
  })
})

describe("rewriteSessionRole", () => {
  it("changes the role and keeps the expiry, clearing the onboarding flag", async () => {
    const { rewriteSessionRole, readSession, writeSession } = await import("@/lib/session")
    const exp = Date.now() + HOUR
    writeSession({ expiresAt: new Date(exp).toISOString(), role: "admin", onboardingIncomplete: true })

    rewriteSessionRole("user")

    const s = readSession()
    expect(s.role).toBe("user")
    expect(s.ob).toBe(false)
    expect(Math.abs(s.exp - exp)).toBeLessThan(1000)
  })
})
