import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { act } from "react"

const mocks = vi.hoisted(() => ({ pathname: "/dashboard", sidebarChildren: undefined }))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
// Spy on what the layout hands SidebarProvider; the real provider still renders.
vi.mock("@/components/ui/sidebar", async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    SidebarProvider: (props) => {
      mocks.sidebarChildren = props.children
      return actual.SidebarProvider(props)
    },
  }
})
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

  // In the browser the client's first render dropped the fork that two
  // conditional siblings under SidebarProvider create (`{!hide && shell}` plus
  // `{hide && bare}`), so every Radix useId below it came out 2 bits short of
  // the server's: sidebar "_R_3h9alb_" vs "_R_saalb_", search dialog
  // "_R_halbH1_" vs "_R_4albH1_". jsdom cannot reproduce the drop (it needs
  // Next's router around the layout), so this pins the cause: the layout hands
  // SidebarProvider ONE child, leaving no fork there for the client to lose.
  it.each(["/dashboard", "/login"])("gives SidebarProvider a single child at %s", (path) => {
    mocks.pathname = path
    mocks.sidebarChildren = undefined
    renderToString(<RootLayout><p>page body</p></RootLayout>)
    mocks.pathname = "/dashboard"
    expect(mocks.sidebarChildren).toBeDefined()
    expect(Array.isArray(mocks.sidebarChildren)).toBe(false)
  })
})
