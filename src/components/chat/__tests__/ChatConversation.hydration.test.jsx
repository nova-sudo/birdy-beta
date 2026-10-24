// /ask-birdy threw React hydration error 418 in production: the AI-credentials cache
// was read from localStorage while rendering, so a returning user's first
// client render (the composer) differed from the server's (the "add your key"
// state). Same honest-equivalent guard as the root layout test: render to a
// string with no localStorage, hydrate it with the cache present, and fail on
// any hydration error.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { act } from "react"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ configured: true }) })),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/useClientGroups", () => ({ useClientGroups: () => ({ clientGroups: [] }) }))
vi.mock("@/components/birdy/BirdyAvatar", () => ({ default: () => <span data-testid="birdy-avatar" /> }))

import ChatConversation from "../ChatConversation"

describe("ChatConversation hydration", () => {
  let errors
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    Element.prototype.scrollTo = vi.fn()
    errors = vi.spyOn(console, "error").mockImplementation(() => {})
    localStorage.clear()
  })
  afterEach(() => {
    errors.mockRestore()
    localStorage.clear()
  })

  it("hydrates the server markup when a configured-key cache exists on the client", async () => {
    // Server pass: no localStorage, so nothing is cached.
    const html = renderToString(<ChatConversation sessionId={null} />)

    localStorage.setItem("aiCredentialsIntegration", JSON.stringify({ configured: true, provider: "anthropic" }))
    const host = document.createElement("div")
    document.body.appendChild(host)
    host.innerHTML = html

    await act(async () => {
      hydrateRoot(host, <ChatConversation sessionId={null} />, {
        onRecoverableError: (e) => errors(String(e)),
      })
    })

    const mismatches = errors.mock.calls.filter((c) => /hydrat|didn't match|did not match|#418|#423/i.test(c.join(" ")))
    expect(mismatches).toEqual([])
    // After mount the cache is honoured: the composer is there.
    expect(host.querySelector("textarea")).not.toBeNull()
    host.remove()
  })
})
