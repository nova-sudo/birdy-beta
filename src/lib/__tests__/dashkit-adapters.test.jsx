/**
 * The dashkit adapters are only glue, so what is worth locking down is the
 * seam: that they reach the backend through Birdy's apiRequest (cookies, the
 * 401 redirect) at exactly the paths the API serves, and that the theme maps
 * every dashkit variable onto a Birdy token instead of leaving a default.
 */
// The theme block in globals.css must stay unlayered and after dashkit's
// import: dashkit's defaults sit on :where(.dk-root), so an unlayered
// .dk-root rule wins, while one inside @layer would lose to them.
import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  apiRequest: vi.fn(),
  API_BASE_URL: "http://api.test",
}))

import { apiRequest } from "@/lib/api"
import { store } from "@/lib/dashkit/store"
import { dataSource } from "@/lib/dashkit/data-source"
import { dkTheme } from "@/lib/dashkit/theme"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DK_VARS } from "dashkit/react"
import { components } from "@/lib/dashkit/registry"

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, statusText: "", text: async () => JSON.stringify(body) }
}

beforeEach(() => {
  apiRequest.mockReset()
})

describe("dashkit adapters", () => {
  it("store.save PUTs /api/dashboards/:id through apiRequest", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ id: "abc" }))
    const doc = { id: "abc", version: 2, title: "Mine", widgets: [] }

    await store.save(doc)

    const [endpoint, init] = apiRequest.mock.calls[0]
    expect(endpoint).toBe("/api/dashboards/abc")
    expect(init.method).toBe("PUT")
    expect(JSON.parse(init.body)).toEqual(doc)
  })

  it("store.list GETs /api/dashboards and unwraps items", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ items: [{ id: "a", title: "A" }] }))

    expect(await store.list()).toEqual([{ id: "a", title: "A" }])
    expect(apiRequest.mock.calls[0][0]).toBe("/api/dashboards")
  })

  it("dataSource.resolve POSTs bindings", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ slots: [null], errors: [] }))
    const bindings = [{ metric: "leads", window: "last_7d" }]
    const shapes = ["value"]

    const slots = await dataSource.resolve(bindings, shapes)

    const [endpoint, init] = apiRequest.mock.calls[0]
    expect(endpoint).toBe("/api/dashboards/resolve")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ bindings, shapes })
    expect(slots).toEqual([null])
  })

  it("dataSource.resolve splits 60 bindings into two POSTs and joins the slots in order", async () => {
    apiRequest.mockImplementation(async (_endpoint, init) => {
      const { bindings } = JSON.parse(init.body)
      return jsonResponse({ slots: bindings.map((b) => ({ shape: "value", value: b.n })), errors: [] })
    })
    const bindings = Array.from({ length: 60 }, (_, n) => ({ metric: "spend", window: { preset: "last_7d" }, n }))
    const shapes = bindings.map(() => "value")

    const slots = await dataSource.resolve(bindings, shapes)

    expect(apiRequest).toHaveBeenCalledTimes(2)
    const sent = apiRequest.mock.calls.map(([, init]) => JSON.parse(init.body))
    expect(sent.map((b) => b.bindings.length)).toEqual([50, 10])
    expect(sent.map((b) => b.shapes.length)).toEqual([50, 10])
    expect(slots.map((s) => s.value)).toEqual(bindings.map((b) => b.n))
  })

  it("a failing chunk yields nulls for its own range only", async () => {
    apiRequest.mockImplementation(async (_endpoint, init) => {
      const { bindings } = JSON.parse(init.body)
      if (bindings[0].n === 50) return jsonResponse({ detail: "boom" }, 500)
      return jsonResponse({ slots: bindings.map((b) => ({ shape: "value", value: b.n })), errors: [] })
    })
    const bindings = Array.from({ length: 120 }, (_, n) => ({ metric: "spend", window: { preset: "last_7d" }, n }))

    const slots = await dataSource.resolve(bindings)

    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(slots).toHaveLength(120)
    expect(slots.slice(0, 50).map((s) => s.value)).toEqual(bindings.slice(0, 50).map((b) => b.n))
    expect(slots.slice(50, 100)).toEqual(Array(50).fill(null))
    expect(slots.slice(100).map((s) => s.value)).toEqual(bindings.slice(100).map((b) => b.n))
  })

  it("rejects with the real error when every chunk fails", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ detail: "down" }, 503))
    const bindings = Array.from({ length: 60 }, () => ({ metric: "spend", window: { preset: "last_7d" } }))

    await expect(dataSource.resolve(bindings)).rejects.toThrow()
  })

  it("dataSource.catalog GETs /api/dashboards/catalog", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ metrics: [] }))

    await dataSource.catalog()

    expect(apiRequest.mock.calls[0][0]).toBe("/api/dashboards/catalog")
  })
})

describe("dashkit theme", () => {
  // Comments dropped, so prose about selectors or @layer doesn't count as CSS.
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  const parse = (text) =>
    Object.fromEntries([...text.matchAll(/(--dk-[a-z0-9-]+)\s*:\s*([^;}]+)/g)].map(([, k, v]) => [k, v.trim()]))
  const themeVars = parse(dkTheme)

  it("theme maps every DK_VARS entry", () => {
    expect(DK_VARS.length).toBeGreaterThanOrEqual(29)
    expect(Object.keys(themeVars)).toEqual([...DK_VARS])
    for (const name of DK_VARS) {
      // Birdy's tokens, not dashkit's defaults: every value is a var() or one
      // of the two literals Birdy has no token for.
      expect(themeVars[name], name).toMatch(/^(var\(--[a-z0-9-]+\)|calc\(var\(--radius\) \+ 8px\)|#2E9E8F)$/)
    }
    expect(themeVars["--dk-chart-2"]).toBe("#2E9E8F")
    expect(themeVars["--dk-font-display"]).toBe("var(--font-bricolage)")
    expect(themeVars["--dk-font"]).toBe("var(--font-inter)")
    expect(themeVars["--dk-accent"]).toBe("var(--pd-primary)")
    expect(themeVars["--dk-bg"]).toBe("var(--pd-canvas)")
    expect(themeVars["--dk-shadow-pop"]).toBe("var(--pd-shadow-popover)")
  })

  it("globals.css .dk-root block declares the same vars as dkTheme", () => {
    const block = css.match(/^\.dk-root\s*\{([^}]*)\}/m)?.[1] ?? ""
    expect(parse(block)).toEqual(themeVars)
  })

  it("the .dk-root block is unlayered and comes after dashkit's stylesheet", () => {
    const importAt = css.indexOf('@import "dashkit/styles.css";')
    const blockAt = css.search(/^\.dk-root\s*\{/m)
    expect(importAt).toBeGreaterThan(-1)
    expect(blockAt).toBeGreaterThan(importAt)
    // Nothing between the top of the file and the block opens a layer.
    expect(css.slice(0, blockAt)).not.toMatch(/@layer/)
  })

  it("only the theme block targets dashkit: the 0.2 bridge rules are gone", () => {
    const rules = [...css.matchAll(/^([^\n{}]*\.dk-[^{]*)\{/gm)].map(([, sel]) => sel.trim())
    expect(rules).toEqual([".dk-root"])
    expect(css).not.toMatch(/revert-layer/)
  })

  it("the host passes no component overrides but Markdown", () => {
    expect(Object.keys(components)).toEqual(["Markdown"])
  })
})

describe("dashkitFetch", () => {
  it("strips the API origin only from the start of the url", async () => {
    const { dashkitFetch } = await import("@/lib/dashkit/fetch")
    apiRequest.mockResolvedValue(jsonResponse({}))

    await dashkitFetch("http://api.test/api/dashboards?next=http://api.test/x", { method: "GET" })

    expect(apiRequest.mock.calls[0][0]).toBe("/api/dashboards?next=http://api.test/x")
  })
})
