import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { act } from "react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/components/birdy/BirdyDefs", () => ({ default: () => null }))
vi.mock("@/lib/admin-api", () => ({ fetchMe: async () => null, stopImpersonation: vi.fn() }))

import RootLayout from "../layout"

const ids = () => [...document.querySelectorAll('[id^="radix-"]')].map((e) => e.id)

// jsdom has no server/client split, so this is the closest honest equivalent:
// render the whole document to a string (the server pass), put it in the
// document, hydrate the document, and fail on any hydration warning or
// recoverable error. It also pins the Radix ids to the server's. It guards the
// first-render tree (nothing client-only may change the element tree); it
// cannot see Next's own SSR/dev-server wrappers.
describe("RootLayout hydration", () => {
  let errors
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    errors = vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => errors.mockRestore())

  it("hydrates the server document without a mismatch", async () => {
    const html = renderToString(<RootLayout><p>page body</p></RootLayout>)
    document.documentElement.innerHTML = html.replace(/^<html[^>]*>/, "").replace(/<\/html>$/, "")
    const serverIds = ids()
    expect(serverIds.length).toBeGreaterThan(0)

    await act(async () => {
      hydrateRoot(document, <RootLayout><p>page body</p></RootLayout>, {
        onRecoverableError: (e) => errors(String(e)),
      })
    })

    const mismatches = errors.mock.calls.filter((c) => /hydrat|didn't match|did not match/i.test(c.join(" ")))
    expect(mismatches).toEqual([])
    expect(ids()).toEqual(serverIds)
  })
})
