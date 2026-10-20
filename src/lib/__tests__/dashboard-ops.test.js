/**
 * Ops from Ask Birdy land on whatever the user is looking at: the live editor
 * doc, unsaved local edits included. The target here is a real dashkit
 * history, which is what the editor's imperative handle wraps.
 */
import { describe, it, expect } from "vitest"
import { applyAll, createDashboard, createHistory, migrate } from "dashkit/core"
import { createRegistry, builtinWidgets } from "dashkit/react"
import { applyIncomingOps } from "@/lib/dashboard-ops"

const registry = createRegistry(builtinWidgets)
const catalog = {
  metrics: [
    { key: "spend", label: "Spend", format: "currency", dimensions: ["client"], over: true, additive: true },
    { key: "ctr", label: "CTR", format: "percentage", dimensions: ["client"], over: true, additive: false },
  ],
  dimensions: [{ key: "client", label: "Client" }],
  windows: [{ preset: "last_7_days", label: "Last 7 days" }],
}

/** A stand-in for the editor's apiRef: same contract (never throws, returns the doc). */
function historyTarget(doc) {
  const history = createHistory(doc, { registry, catalog })
  return {
    history,
    getDoc: () => history.doc,
    applyAll(ops, author) {
      try {
        return history.applyAll(ops, author)
      } catch {
        return history.doc
      }
    },
  }
}

function setup() {
  const doc = applyAll(
    createDashboard({ title: "Spend", id: "d1" }),
    [{ op: "addWidget", widget: { id: "h", type: "heading", title: "Overview", data: {} } }],
    { registry },
  )
  const target = historyTarget(doc)
  // An edit the user made and has not saved yet.
  target.applyAll(
    [{ op: "addWidget", after: "h", widget: { type: "text", id: "local", data: { markdown: "mine" } } }],
    "user",
  )
  return { target }
}

const ctx = { dashboardId: "d1", currentId: "d1", registry, catalog }
const query = (metric, extra = {}) => ({ metrics: [{ metric }], window: { preset: "last_7_days" }, ...extra })
const kpi = (id, metric, extra = {}) => ({
  op: "addWidget",
  ...extra,
  widget: { type: "kpi", id, title: `KPI ${id}`, query: query(metric) },
})

describe("applyIncomingOps", () => {
  it("ops apply onto the live editor doc", () => {
    const { target } = setup()
    const ops = [{ op: "addWidget", after: "local", widget: { type: "text", id: "ai", title: "Note", data: { markdown: "hi" } } }]

    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(true)
    expect(result.error).toBeUndefined()
    expect(target.getDoc().widgets.map((w) => w.id)).toEqual(["h", "local", "ai"])
    expect(result.doc).toBe(target.getDoc())
    expect(result.diff.length).toBeGreaterThan(0)
    expect(result.diff.join("\n")).toMatch(/Note/)
    expect(target.getDoc().meta.lastAuthor).toBe("ai")
  })

  it("Birdy's heading level change applies to a migrated v1 section", () => {
    const v1 = {
      id: "d1",
      version: 1,
      title: "Spend",
      sections: [{ id: "s1", title: "Overview", widgets: [] }],
      meta: { createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z", lastAuthor: "user" },
    }
    const target = historyTarget(migrate(v1, { registry }))

    const result = applyIncomingOps(target, [{ op: "updateWidgetData", widgetId: "s1", patch: { level: 1 } }], ctx)

    expect(result.applied).toBe(true)
    expect(target.getDoc().widgets[0]).toMatchObject({ id: "s1", type: "heading", data: { level: 1 } })
  })

  it("ops for a different dashboard_id are dropped", () => {
    const { target } = setup()
    const before = target.getDoc()
    const ops = [{ op: "addWidget", widget: { type: "text", data: { markdown: "x" } } }]

    const result = applyIncomingOps(target, ops, { ...ctx, dashboardId: "other" })

    expect(result.applied).toBe(false)
    expect(result.diff).toEqual([])
    expect(target.getDoc()).toBe(before)
  })

  it("invalid ops are rejected without changing the doc", () => {
    const { target } = setup()
    const before = target.getDoc()
    const ops = [{ op: "moveWidget", widgetId: "nope", to: { x: 0, y: 0 } }]

    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(false)
    expect(result.diff).toEqual([])
    expect(result.error).toMatch(/nope/)
    expect(target.getDoc()).toBe(before)
  })

  it("the removed section ops are rejected", () => {
    const { target } = setup()
    const before = target.getDoc()

    const result = applyIncomingOps(target, [{ op: "addSection", section: { id: "s2", title: "More" } }], ctx)

    expect(result.applied).toBe(false)
    expect(result.error).toBeTruthy()
    expect(target.getDoc()).toBe(before)
  })

  it("ops that introduce a new validation error are rejected, naming the widget", () => {
    const { target } = setup()
    const before = target.getDoc()

    const result = applyIncomingOps(target, [kpi("k", "made_up", { after: "local" })], ctx)

    expect(result.applied).toBe(false)
    expect(result.error).toBe('KPI k: Unknown metric "made_up"')
    expect(target.getDoc()).toBe(before)
  })

  // validate() reports `widgets.<i>…` paths, and every op re-sorts widgets by
  // row and column, so an error already on the dashboard changes index when a
  // widget lands above it. Keyed by widget id it is still the same error.
  it("error paths map widgets.N to titles", () => {
    const { target } = setup()
    // A KPI whose metric has since left the catalog: already broken, at the bottom.
    const broken = target.applyAll([kpi("old", "retired", { at: { x: 0, y: 20 } })], "user")
    expect(broken.widgets.at(-1).id).toBe("old")

    // Birdy adds a widget above it: the broken KPI moves from widgets.2 to widgets.3.
    const ops = [{ op: "addWidget", at: { x: 0, y: 0 }, widget: { type: "text", id: "top", data: { markdown: "top" } } }]
    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(true)
    expect(target.getDoc().widgets.findIndex((w) => w.id === "old")).not.toBe(broken.widgets.findIndex((w) => w.id === "old"))

    // A new bad value on the same widget is new, and is reported by its title.
    const rebind = [{ op: "setQuery", widgetId: "old", query: query("other_bad") }]
    const second = applyIncomingOps(target, rebind, ctx)
    expect(second.applied).toBe(false)
    expect(second.error).toBe('KPI old: Unknown metric "other_bad"')
  })
  it("Birdy's setQuery rebinds a widget, and clearQuery unbinds it", () => {
    const { target } = setup()
    target.applyAll([kpi("k", "spend", { after: "local" })], "user")

    const set = applyIncomingOps(target, [{ op: "setQuery", widgetId: "k", query: query("ctr", { compare: "previous" }) }], ctx)

    expect(set.applied).toBe(true)
    expect(target.getDoc().widgets.find((w) => w.id === "k").bindings).toEqual({ query: query("ctr", { compare: "previous" }) })
    expect(target.getDoc().meta.lastAuthor).toBe("ai")

    // An unbound data widget is a draft, as the palette's own widgets are, not an error.
    const cleared = applyIncomingOps(target, [{ op: "clearQuery", widgetId: "k" }], ctx)

    expect(cleared.applied).toBe(true)
    expect(cleared.error).toBeUndefined()
    expect(target.getDoc().widgets.find((w) => w.id === "k").bindings).toBeUndefined()
  })

  it("a setQuery that breaks the widget's query rules is rejected with dashkit's message", () => {
    const { target } = setup()
    target.applyAll([kpi("k", "spend", { after: "local" })], "user")
    const before = target.getDoc()

    const result = applyIncomingOps(target, [{ op: "setQuery", widgetId: "k", query: query("spend", { by: "client" }) }], ctx)

    expect(result.applied).toBe(false)
    expect(result.error).toMatch(/by/)
    expect(target.getDoc()).toBe(before)
  })

  // The editor's history checks rules that need the catalog (a donut needs an
  // additive metric); the dry run must too, or it would pass what the editor rejects.
  it("the dry run checks catalog rules: a donut of a non-additive metric is rejected", () => {
    const { target } = setup()
    const ops = [
      {
        op: "addWidget",
        after: "local",
        widget: { type: "chart", id: "c", data: { chart: "donut", orientation: "vertical", stacked: false }, query: query("ctr", { by: "client" }) },
      },
    ]
    const before = target.getDoc()

    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(false)
    expect(result.error).toMatch(/CTR|ctr|additive|donut/i)
    expect(target.getDoc()).toBe(before)
  })
})
