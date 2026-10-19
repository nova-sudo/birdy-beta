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

  it("the primitives' revert-layer skips the raw Markdown textarea, which gets its own pd chrome", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
    // dashkit renders <textarea class="dk-input dk-textarea"> outside the Input
    // slot: reverting it would strip its border, radius and padding.
    const revert = css.match(/([^{}]*)\{\s*all:\s*revert-layer;?\s*\}/)?.[1] ?? ""
    const inputSelector = revert.split(",").map((sel) => sel.trim()).find((sel) => sel.includes(".dk-input"))
    expect(inputSelector).toContain(":not(.dk-textarea)")
    // Wrapped in :where so the rule stays at (0,1,0), below dashkit's contextual rules.
    expect(inputSelector).toContain(":where(:not(.dk-textarea))")

    const textarea = css.match(/^\.dk-root \.dk-textarea\s*\{([^}]*)\}/m)?.[1] ?? ""
    for (const decl of ["border: 1px solid var(--pd-border)", "border-radius: 12px", "padding: 8px 12px", "width: 100%", "min-height: 96px", "resize: vertical"]) {
      expect(textarea).toContain(decl)
    }
    expect(css).toMatch(/\.dk-root \.dk-textarea:focus-visible\s*\{[^}]*box-shadow/)
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
    for (const cls of ["flex-1", "w-full", "h-full", "min-h-0", "min-w-0", "rounded-2xl", "border-pd-border", "bg-pd-surface", "shadow-sm"]) {
      expect(root.classList.contains(cls)).toBe(true)
    }
    expect(container.querySelector("h3").textContent).toBe("Leads")
    const body = container.querySelector(".dk-frame-body")
    // 8px under a title row, so a 1-row KPI still fits.
    expect(body.className).toContain("pt-2!")
    expect(body.className).toContain("px-5!")
    expect(body.className).toContain("pb-5!")
    expect(body.className).toContain("overflow-hidden")

    rerender(<PdFrame state="ready"><p>12</p></PdFrame>)
    expect(container.querySelector(".dk-frame-body").className).toContain("pt-4!")
  })

  it("renders the window badge as a pill inline on the title row, between the title and the menu", () => {
    const { container } = render(
      <PdFrame title="Leads" meta="Last 30 days · all clients" menu={<button>handle</button>} state="ready">
        <p>12</p>
      </PdFrame>,
    )
    const row = container.querySelector(".dk-frame-title > .dk-frame-titlerow")
    expect(row).toBeTruthy()
    const [heading, pill, menu] = row.children
    expect(row.children).toHaveLength(3)
    expect(heading.tagName).toBe("H3")
    expect(pill.classList.contains("dk-frame-meta")).toBe(true)
    expect(menu.classList.contains("dk-frame-menu")).toBe(true)
    expect(pill.textContent).toBe("Last 30 days · all clients")
    for (const cls of ["rounded-full", "whitespace-nowrap", "text-[12px]", "max-w-full", "text-ellipsis"]) {
      expect(pill.classList.contains(cls)).toBe(true)
    }
    // Ellipsized on narrow widgets, so the full text is its tooltip.
    expect(pill.getAttribute("title")).toBe("Last 30 days · all clients")
  })

  it("renders a title row for a badge alone", () => {
    const { container } = render(<PdFrame meta="Last 7 days · 1 client" state="ready"><p>12</p></PdFrame>)
    expect(container.querySelector(".dk-frame-titlerow .dk-frame-meta").textContent).toBe("Last 7 days · 1 client")
    expect(container.querySelector(".dk-frame-body").className).toContain("pt-2!")
  })

  it("renders the menu without a title", () => {
    const { container } = render(<PdFrame menu={<button>handle</button>} state="ready"><p>12</p></PdFrame>)
    expect(screen.getByText("handle")).toBeTruthy()
    expect(container.querySelector(".dk-frame-menu")).toBeTruthy()
    expect(container.querySelector("h3")).toBeNull()
  })

  it("registry components fill all 7 dashkit slots with pd primitives", () => {
    expect(Object.keys(components).sort()).toEqual(["Button", "Frame", "Icon", "Input", "Markdown", "Menu", "Select"])
    for (const component of Object.values(components)) expect(typeof component).toBe("function")
  })
})
