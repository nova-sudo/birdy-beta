/**
 * The one-click starters on an empty dashboard, and the ops the "Add widget"
 * picker sends from view mode. Each list is applied to a real dashkit doc and
 * validated against a catalog shaped like the backend's, so a wrong slot,
 * metric or window shows up here rather than as an empty widget.
 */
import { describe, it, expect } from "vitest"
import { applyAll, createDashboard, validate } from "dashkit/core"
import { createRegistry, builtinWidgets } from "dashkit/react"
import { STARTERS, addWidgetOps, starterOps } from "@/lib/dashboard-starters"

const registry = createRegistry(builtinWidgets)
const catalog = {
  metrics: [
    { key: "spend", label: "Spend", format: "currency", dimensions: ["client", "day"] },
    { key: "meta_leads", label: "Meta leads", format: "number", dimensions: ["client"] },
    { key: "clicks", label: "Clicks", format: "number", dimensions: ["client", "day"] },
    { key: "ctr", label: "CTR", format: "percent", dimensions: ["client"] },
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
const allWidgets = (doc) => doc.sections.flatMap((s) => s.widgets)

describe("dashboard starters", () => {
  it("lists the three starters with the spec's copy", () => {
    expect(STARTERS.map((s) => s.label)).toEqual([
      "KPI strip of spend, leads, clicks and CTR (last 30 days)",
      "Spend trend by day (last 30 days)",
      "Spend by client table (last 7 days)",
    ])
  })

  // The strip shows deltas by default (showDelta), so each metric asks for
  // the previous period to compare against.
  it("starter adds bound widgets", () => {
    const doc = blank()
    const sectionId = doc.sections[0].id
    const ops = starterOps("kpi-strip-30d", { sectionId })

    expect(ops[0]).toMatchObject({ op: "addWidget", sectionId, widget: { type: "kpi-strip" } })
    const widgetId = ops[0].widget.id
    expect(widgetId).toEqual(expect.any(String))
    expect(ops.slice(1)).toEqual([
      { op: "setBinding", widgetId, slot: "a", binding: { metric: "spend", window: { preset: "last_30d" }, compare: "previous" } },
      { op: "setBinding", widgetId, slot: "b", binding: { metric: "meta_leads", window: { preset: "last_30d" }, compare: "previous" } },
      { op: "setBinding", widgetId, slot: "c", binding: { metric: "clicks", window: { preset: "last_30d" }, compare: "previous" } },
      { op: "setBinding", widgetId, slot: "d", binding: { metric: "ctr", window: { preset: "last_30d" }, compare: "previous" } },
    ])

    const next = run(doc, ops)
    expect(allWidgets(next)).toHaveLength(1)
    expect(validate(next, { registry, catalog }).errors).toEqual([])
  })

  it("trend starter binds spend by day over the last 30 days", () => {
    const doc = blank()
    const ops = starterOps("spend-trend-30d", { sectionId: doc.sections[0].id })
    const next = run(doc, ops)

    const [widget] = allWidgets(next)
    expect(widget.type).toBe("trend")
    expect(widget.bindings).toEqual({ series: { metric: "spend", by: "day", window: { preset: "last_30d" } } })
    expect(validate(next, { registry, catalog }).errors).toEqual([])
  })

  it("table starter binds spend by client over the last 7 days", () => {
    const doc = blank()
    const ops = starterOps("spend-by-client-table-7d", { sectionId: doc.sections[0].id })
    const next = run(doc, ops)

    const [widget] = allWidgets(next)
    expect(widget.type).toBe("table")
    expect(widget.bindings).toEqual({ rows: { metric: "spend", by: "client", window: { preset: "last_7d" } } })
    expect(validate(next, { registry, catalog }).errors).toEqual([])
  })

  it("a starter on a doc with no sections adds one first, in the same batch", () => {
    const doc = { ...blank(), sections: [] }
    const ops = starterOps("spend-trend-30d", {})

    expect(ops[0].op).toBe("addSection")
    const next = run(doc, ops)
    expect(next.sections).toHaveLength(1)
    expect(next.sections[0].widgets.map((w) => w.type)).toEqual(["trend"])
  })

  it("rejects an unknown starter", () => {
    expect(() => starterOps("nope", { sectionId: "s1" })).toThrow(/nope/)
  })
})

describe("addWidgetOps", () => {
  it("appends to the last section", () => {
    const doc = run(blank(), [{ op: "addSection", section: { id: "s2", title: "More" } }])
    const { ops, widgetId } = addWidgetOps(doc, "kpi")

    expect(ops).toEqual([{ op: "addWidget", sectionId: "s2", widget: { type: "kpi", id: widgetId } }])
    const next = run(doc, ops)
    expect(next.sections[1].widgets.map((w) => w.id)).toEqual([widgetId])
    expect(next.sections[0].widgets).toEqual([])
  })

  it("adds a section first when the doc has none", () => {
    const doc = { ...blank(), sections: [] }
    const { ops, widgetId } = addWidgetOps(doc, "kpi")

    expect(ops.map((o) => o.op)).toEqual(["addSection", "addWidget"])
    const next = run(doc, ops)
    expect(next.sections).toHaveLength(1)
    expect(next.sections[0].widgets.map((w) => w.id)).toEqual([widgetId])
  })
})
