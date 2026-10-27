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
import { dataSource, QUERY_CHUNK_SIZE } from "@/lib/dashkit/data-source"
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

  it("dataSource.query POSTs the queries to /api/dashboards/query", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ frames: [null] }))
    const queries = [{ metrics: [{ metric: "leads" }], window: { preset: "last_7d" } }]

    const frames = await dataSource.query(queries)

    const [endpoint, init] = apiRequest.mock.calls[0]
    expect(endpoint).toBe("/api/dashboards/query")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ queries })
    expect(frames).toEqual([null])
  })

  // A frame per query, tagged with the query's index, so order is checkable.
  const frameFor = (q) => ({ columns: [], rows: [], totals: { values: { n: q.n } }, previousAvailable: false })
  const numbered = (count) =>
    Array.from({ length: count }, (_, n) => ({ metrics: [{ metric: "spend" }], window: { preset: "last_7d" }, n }))

  it("chunks 120 queries into 3 requests and keeps order", async () => {
    apiRequest.mockImplementation(async (_endpoint, init) => {
      const { queries } = JSON.parse(init.body)
      return jsonResponse({ frames: queries.map(frameFor) })
    })
    const queries = numbered(120)

    const frames = await dataSource.query(queries)

    expect(QUERY_CHUNK_SIZE).toBe(50)
    expect(apiRequest).toHaveBeenCalledTimes(3)
    const sent = apiRequest.mock.calls.map(([endpoint, init]) => [endpoint, JSON.parse(init.body).queries.length])
    expect(sent).toEqual([
      ["/api/dashboards/query", 50],
      ["/api/dashboards/query", 50],
      ["/api/dashboards/query", 20],
    ])
    expect(frames.map((f) => f.totals.values.n)).toEqual(queries.map((q) => q.n))
  })

  it("one failed chunk yields nulls only for its queries", async () => {
    apiRequest.mockImplementation(async (_endpoint, init) => {
      const { queries } = JSON.parse(init.body)
      if (queries[0].n === 50) return jsonResponse({ detail: "boom" }, 500)
      return jsonResponse({ frames: queries.map(frameFor) })
    })
    const queries = numbered(120)

    const frames = await dataSource.query(queries)

    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(frames).toHaveLength(120)
    expect(frames.slice(0, 50).map((f) => f.totals.values.n)).toEqual(queries.slice(0, 50).map((q) => q.n))
    expect(frames.slice(50, 100)).toEqual(Array(50).fill(null))
    expect(frames.slice(100).map((f) => f.totals.values.n)).toEqual(queries.slice(100).map((q) => q.n))
  })

  it("a short answer from one chunk pads with nulls instead of shifting the next chunk", async () => {
    apiRequest.mockImplementation(async (_endpoint, init) => {
      const { queries } = JSON.parse(init.body)
      const frames = queries.map(frameFor)
      return jsonResponse({ frames: queries[0].n === 0 ? frames.slice(0, 10) : frames })
    })
    const queries = numbered(60)

    const frames = await dataSource.query(queries)

    expect(frames).toHaveLength(60)
    expect(frames.slice(10, 50)).toEqual(Array(40).fill(null))
    expect(frames.slice(50).map((f) => f.totals.values.n)).toEqual(queries.slice(50).map((q) => q.n))
  })

  it("rejects with the real error when every chunk fails", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ detail: "down" }, 503))

    await expect(dataSource.query(numbered(60))).rejects.toThrow()
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
    expect(DK_VARS.length).toBe(33)
    expect(Object.keys(themeVars)).toEqual([...DK_VARS])
    // The series colours Birdy has no token for: the teal, and dashkit's own
    // blue, red and violet for the 6th to 8th series.
    const literals = { "--dk-chart-2": "#2E9E8F", "--dk-chart-6": "#2F6FD0", "--dk-chart-7": "#CF4A3A", "--dk-chart-8": "#8F5FC2" }
    for (const name of DK_VARS) {
      if (Object.hasOwn(literals, name)) {
        expect(themeVars[name], name).toBe(literals[name])
        continue
      }
      // Birdy's tokens, not dashkit's defaults: every other value is a var()
      // or the card radius.
      expect(themeVars[name], name).toMatch(/^(var\(--[a-z0-9-]+\)|calc\(var\(--radius\) \+ 8px\))$/)
    }
    expect(themeVars["--dk-chart-5"]).toBe("var(--pd-amber)")
    // A trend split by client draws up to eight lines: no colour repeats.
    const series = Array.from({ length: 8 }, (_, i) => themeVars[`--dk-chart-${i + 1}`])
    expect(new Set(series).size).toBe(8)
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

describe("fetchBriefing", () => {
  const BODY = {
    parts: [{ text: "Spend is " }, { text: "up 4%", bold: true }],
    findings: [{ text: "Leads rose 12%", tone: "positive" }],
    generated_at: "2026-10-20T09:00:00Z",
    cached: true,
  }

  it("POSTs focus and refresh to the dashboard's briefing route and maps generated_at", async () => {
    const { fetchBriefing } = await import("@/lib/dashkit/briefing")
    apiRequest.mockResolvedValue(jsonResponse(BODY))

    const result = await fetchBriefing({ dashboardId: "d 1", focus: "lead quality", refresh: true })

    const [endpoint, init] = apiRequest.mock.calls[0]
    expect(endpoint).toBe("/api/dashboards/d%201/briefing")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ focus: "lead quality", refresh: true })
    // Exactly dashkit's BriefingResult: generatedAt, no snake_case left over.
    expect(result).toEqual({
      parts: BODY.parts,
      findings: BODY.findings,
      generatedAt: "2026-10-20T09:00:00Z",
      cached: true,
    })
  })

  it("leaves focus out when there is none", async () => {
    const { fetchBriefing } = await import("@/lib/dashkit/briefing")
    apiRequest.mockResolvedValue(jsonResponse(BODY))

    await fetchBriefing({ dashboardId: "d1", refresh: false })

    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toEqual({ refresh: false })
  })

  it.each([
    [429, /Too many refreshes/],
    [402, /out of credits/i],
    [502, /couldn.t write the briefing/i],
    [500, /couldn.t load the briefing/i],
  ])("rejects a %i with a message the widget can show", async (status, message) => {
    const { fetchBriefing } = await import("@/lib/dashkit/briefing")
    apiRequest.mockResolvedValue(jsonResponse({ detail: "server words" }, status))

    await expect(fetchBriefing({ dashboardId: "d1", refresh: true })).rejects.toThrow(message)
  })

  it("rejects when the network fails", async () => {
    const { fetchBriefing } = await import("@/lib/dashkit/briefing")
    apiRequest.mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(fetchBriefing({ dashboardId: "d1", refresh: false })).rejects.toThrow(/couldn.t load the briefing/i)
  })
})
