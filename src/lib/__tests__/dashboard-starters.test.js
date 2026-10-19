/**
 * The one-click starters on an empty dashboard, and the ops the "Add widget"
 * picker sends from view mode. Each list is applied to a real dashkit doc and
 * validated against a catalog shaped like the backend's, so a wrong slot,
 * metric, window or placement shows up here rather than as an empty widget.
 */
import { describe, it, expect } from "vitest"
import { applyAll, createDashboard, validate } from "dashkit/core"
import { createRegistry, builtinWidgets } from "dashkit/react"
import { STARTERS, addWidgetOps, starterOps } from "@/lib/dashboard-starters"

const registry = createRegistry(builtinWidgets)
const catalog = {
  metrics: [
    { key: "spend", label: "Spend", format: "currency", dimensions: ["client", "day"] },
    { key: "meta_leads", label: "Meta leads", format: "integer", dimensions: ["client"] },
    { key: "clicks", label: "Clicks", format: "integer", dimensions: ["client", "day"] },
    { key: "ctr", label: "CTR", format: "percentage", dimensions: ["client"] },
  ],
  dimensions: [
    { key: "client", label: "Client" },
    { key: "day", label: "Day" },
  ],
  windows: [
    { preset: "last_7d", label: "Last 7 days" },
    { preset: "last_30d", label: "Last 30 days" },
  ],
}

const blank = () => createDashboard({ title: "Blank", id: "d1" })
const run = (doc, ops) => applyAll(doc, ops, { registry })
const heading = (id, title, level) => ({ op: "addWidget", widget: { id, type: "heading", title, data: { level } } })

describe("dashboard starters", () => {
  it("lists the three starters with the spec's copy", () => {
    expect(STARTERS.map((s) => s.label)).toEqual([
      "KPI strip of spend, leads, clicks and CTR (last 30 days)",
      "Spend trend by day (last 30 days)",
      "Spend by client table (last 7 days)",
    ])
  })

  it("starters validate under v2", () => {
    for (const { kind } of STARTERS) {
      const next = run(blank(), starterOps(kind, blank()))
      expect(next.version).toBe(2)
      expect(next.sections).toBeUndefined()
      expect(validate(next, { registry, catalog }).errors).toEqual([])
      expect(next.widgets.map((w) => w.type)).toEqual(["heading", expect.not.stringMatching(/^heading$/)])
    }
  })

  // On an empty dashboard the starter gives it a page title first: a level-1
  // heading with the dashboard's title, then the widget placed after it.
  it("on an empty dashboard a starter adds a level-1 heading, then its widget after it", () => {
    const doc = blank()
    const ops = starterOps("kpi-strip-30d", doc)

    expect(ops[0]).toMatchObject({ op: "addWidget", widget: { type: "heading", title: "Blank", data: { level: 1 } } })
    const headingId = ops[0].widget.id
    expect(headingId).toEqual(expect.any(String))
    expect(ops[1]).toMatchObject({ op: "addWidget", after: headingId, widget: { type: "kpi-strip" } })
    expect(ops.some((op) => "sectionId" in op || /Section/.test(op.op))).toBe(false)
    const widgetId = ops[1].widget.id
    // The strip shows deltas by default (showDelta), so each metric asks for
    // the previous period to compare against.
    expect(ops.slice(2)).toEqual([
      { op: "setBinding", widgetId, slot: "a", binding: { metric: "spend", window: { preset: "last_30d" }, compare: "previous" } },
      { op: "setBinding", widgetId, slot: "b", binding: { metric: "meta_leads", window: { preset: "last_30d" }, compare: "previous" } },
      { op: "setBinding", widgetId, slot: "c", binding: { metric: "clicks", window: { preset: "last_30d" }, compare: "previous" } },
      { op: "setBinding", widgetId, slot: "d", binding: { metric: "ctr", window: { preset: "last_30d" }, compare: "previous" } },
    ])

    const next = run(doc, ops)
    const [title, strip] = next.widgets
    expect(title.layout).toEqual({ x: 0, y: 0, w: 12, h: 1 })
    expect(strip.id).toBe(widgetId)
    expect(strip.layout).toMatchObject({ x: 0, y: 1, w: 12 })
  })

  it("trend starter binds spend by day over the last 30 days", () => {
    const next = run(blank(), starterOps("spend-trend-30d", blank()))

    const widget = next.widgets.find((w) => w.type === "trend")
    expect(widget.bindings).toEqual({ series: { metric: "spend", by: "day", window: { preset: "last_30d" } } })
  })

  it("table starter binds spend by client over the last 7 days", () => {
    const next = run(blank(), starterOps("spend-by-client-table-7d", blank()))

    const widget = next.widgets.find((w) => w.type === "table")
    expect(widget.bindings).toEqual({ rows: { metric: "spend", by: "client", window: { preset: "last_7d" } } })
  })

  // Only the first widget under a heading uses the heading as `after`; later
  // ones chain to the widget before them, so they read in order.
  it("on a dashboard with widgets a starter chains after the last one, without another heading", () => {
    const doc = run(blank(), [
      heading("h", "Overview", 2),
      { op: "addWidget", after: "h", widget: { id: "k", type: "kpi", bindings: { value: { metric: "spend", window: { preset: "last_7d" } } } } },
    ])
    const ops = starterOps("spend-trend-30d", doc)

    expect(ops[0]).toMatchObject({ op: "addWidget", after: "k", widget: { type: "trend" } })
    expect(ops.filter((op) => op.widget?.type === "heading")).toEqual([])
    const next = run(doc, ops)
    const trend = next.widgets.find((w) => w.type === "trend")
    // A 6-wide trend fits to the right of the 3-wide KPI, on its row.
    expect(trend.layout).toMatchObject({ x: 3, y: 1 })
    expect(validate(next, { registry, catalog }).errors).toEqual([])
  })

  it("a heading-only dashboard gets the widget under that heading", () => {
    const doc = run(blank(), [heading("h", "Overview", 1)])
    const ops = starterOps("spend-trend-30d", doc)

    expect(ops[0]).toMatchObject({ op: "addWidget", after: "h", widget: { type: "trend" } })
    expect(run(doc, ops).widgets.map((w) => w.id)).toEqual(["h", ops[0].widget.id])
  })

  it("rejects an unknown starter", () => {
    expect(() => starterOps("nope", blank())).toThrow(/nope/)
  })
})

describe("addWidgetOps", () => {
  it("adds the first widget of an empty dashboard at the top, with no heading", () => {
    const { ops, widgetId } = addWidgetOps(blank(), "kpi")

    expect(ops).toEqual([{ op: "addWidget", widget: { type: "kpi", id: widgetId } }])
    const next = run(blank(), ops)
    expect(next.widgets.map((w) => [w.id, w.layout.x, w.layout.y])).toEqual([[widgetId, 0, 0]])
  })

  it("chains after the dashboard's last widget, in reading order", () => {
    const doc = run(blank(), [
      heading("h", "Overview", 2),
      { op: "addWidget", after: "h", widget: { id: "a", type: "text", data: { markdown: "a" } } },
      { op: "addWidget", after: "a", widget: { id: "b", type: "text", data: { markdown: "b" } } },
    ])
    const { ops, widgetId } = addWidgetOps(doc, "table")

    expect(ops).toEqual([{ op: "addWidget", after: "b", widget: { type: "table", id: widgetId } }])
    const next = run(doc, ops)
    expect(next.widgets.at(-1).id).toBe(widgetId)
  })
})
