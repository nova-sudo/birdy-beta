/**
 * The dashkit adapters are only glue, so what is worth locking down is the
 * seam: that they reach the backend through Birdy's apiRequest (cookies, the
 * 401 redirect) at exactly the paths the API serves, and that the theme maps
 * every dashkit variable onto a Birdy token instead of leaving a default.
 */
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
import { render, screen } from "@testing-library/react"
import { PdFrame } from "@/lib/dashkit/frame"
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
    const doc = { id: "abc", title: "Mine", sections: [] }

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
  it("globals.css .dk-root block declares the same vars as dkTheme", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
    const block = css.match(/^\.dk-root\s*\{([^}]*)\}/m)?.[1] ?? ""
    const parse = (text) =>
      Object.fromEntries(
        [...text.matchAll(/(--dk-[a-z-]+)\s*:\s*([^;}]+)/g)].map(([, k, v]) => [k, v.trim()]),
      )
    expect(parse(block)).toEqual(parse(dkTheme))
    expect(Object.keys(parse(block))).toHaveLength(14)
  })

  it("theme string maps all 14 vars", () => {
    const decls = dkTheme.match(/--dk-[a-z-]+:/g) ?? []
    expect(decls).toHaveLength(14)

    const expected = {
      "--dk-bg": "var(--pd-canvas)",
      "--dk-card": "var(--pd-surface)",
      "--dk-fg": "var(--pd-ink)",
      "--dk-muted": "var(--pd-muted)",
      "--dk-border": "var(--pd-border)",
      "--dk-accent": "var(--pd-primary)",
      "--dk-success": "var(--pd-success)",
      "--dk-danger": "var(--pd-danger)",
      "--dk-warning": "var(--pd-warning)",
      "--dk-info": "var(--pd-info)",
      "--dk-radius": "var(--radius)",
      "--dk-shadow": "var(--pd-shadow-popover)",
      "--dk-font": "var(--font-pd-body)",
      "--dk-font-display": "var(--font-pd-display)",
    }
    for (const [name, value] of Object.entries(expected)) {
      expect(dkTheme).toContain(`${name}:${value}`)
    }
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

describe("PdFrame", () => {
  it("keeps children visible under a pulse while loading", () => {
    const { container } = render(<PdFrame title="Leads" state="loading"><p>12</p></PdFrame>)
    expect(screen.getByText("12")).toBeTruthy()
    expect(container.querySelector(".dk-pulse")).toBeTruthy()
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy()
  })

  it("renders the menu in the header and replaces children when empty or errored", () => {
    const { rerender } = render(
      <PdFrame title="Leads" menu={<button>handle</button>} state="empty"><p>12</p></PdFrame>,
    )
    expect(screen.getByText("handle")).toBeTruthy()
    expect(screen.getByText("No data bound")).toBeTruthy()
    expect(screen.queryByText("12")).toBeNull()

    rerender(<PdFrame title="Leads" state="error" error="Boom"><p>12</p></PdFrame>)
    expect(screen.getByRole("status").textContent).toBe("Boom")
  })

  it("body is dashkit's inline-size container and data-state tracks state", () => {
    for (const state of ["ready", "loading", "empty", "error"]) {
      const { container, unmount } = render(<PdFrame title="Leads" state={state}><p>12</p></PdFrame>)
      const body = container.querySelector(".dk-frame-body")
      expect(body).toBeTruthy()
      expect(body.getAttribute("data-state")).toBe(state)
      unmount()
    }
  })

  it("fills its grid cell and keeps its spacing inside the body for KPIs to spill into", () => {
    const { container, rerender } = render(<PdFrame title="Leads" state="ready"><p>12</p></PdFrame>)
    const root = container.firstElementChild
    for (const cls of ["flex-1", "w-full", "h-full", "min-h-0", "min-w-0", "rounded-2xl", "border-pd-border", "bg-pd-surface"]) {
      expect(root.classList.contains(cls)).toBe(true)
    }
    expect(container.querySelector("h3").textContent).toBe("Leads")
    const body = container.querySelector(".dk-frame-body")
    expect(body.className).toContain("pt-2!")
    expect(body.className).toContain("pb-3!")
    expect(body.className).toContain("overflow-hidden")

    rerender(<PdFrame state="ready"><p>12</p></PdFrame>)
    expect(container.querySelector(".dk-frame-body").className).toContain("pt-0!")
  })

  it("renders the menu without a title", () => {
    const { container } = render(<PdFrame menu={<button>handle</button>} state="ready"><p>12</p></PdFrame>)
    expect(screen.getByText("handle")).toBeTruthy()
    expect(container.querySelector(".dk-frame-menu")).toBeTruthy()
    expect(container.querySelector("h3")).toBeNull()
  })

  it("registry components override only Frame and Markdown", () => {
    expect(Object.keys(components).sort()).toEqual(["Frame", "Markdown"])
  })
})
