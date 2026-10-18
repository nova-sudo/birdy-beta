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

  it("dataSource.catalog GETs /api/dashboards/catalog", async () => {
    apiRequest.mockResolvedValue(jsonResponse({ metrics: [] }))

    await dataSource.catalog()

    expect(apiRequest.mock.calls[0][0]).toBe("/api/dashboards/catalog")
  })
})

describe("dashkit theme", () => {
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

  it("registry components override only Frame and Markdown", () => {
    expect(Object.keys(components).sort()).toEqual(["Frame", "Markdown"])
  })
})
