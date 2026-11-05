/**
 * The one-click starters on an empty dashboard, and the ops the "Add widget"
 * picker sends from view mode. Each list is applied to a real dashkit doc and
 * validated against Birdy's catalog (a snapshot of the backend's), so a wrong
 * metric, window, query shape or placement shows up here rather than as an
 * empty widget.
 */
import { describe, it, expect } from "vitest"
import { applyAll, createDashboard, validate } from "dashkit/core"
import { createRegistry, builtinWidgets } from "dashkit/react"
import { STARTERS, addWidgetOps, starterOps } from "@/lib/dashboard-starters"
import catalog from "@/app/hub/dashboards/__tests__/fixtures/birdy-catalog.json"

const registry = createRegistry(builtinWidgets)

const blank = () => createDashboard({ title: "Blank", id: "d1" })
const run = (doc, ops) => applyAll(doc, ops, { registry, catalog })
const heading = (id, title, level) => ({ op: "addWidget", widget: { id, type: "heading", title, data: { level } } })
const last30 = { preset: "last_30d" }

describe("dashboard starters", () => {
  it("lists the default board first, then the single-widget starters", () => {
    expect(STARTERS.map((s) => s.label)).toEqual([
      "Overview board: KPIs, trend, funnel, leaderboard and table (last 30 days)",
      "KPI strip of spend, leads, clicks and CTR (last 30 days)",
      "Spend trend by day (last 30 days)",
      "Spend by client table (last 7 days)",
    ])
  })

  it("starters validate against the v3 registry", () => {
    for (const { kind } of STARTERS) {
      const next = run(blank(), starterOps(kind, blank()))
      expect(next.version).toBe(3)
      expect(validate(next, { registry, catalog }).errors).toEqual([])
      expect(next.widgets[0]).toMatchObject({ type: "heading", data: { level: 1 } })
      // Every widget after the title is bound to a v3 query.
      for (const widget of next.widgets.slice(1)) {
        expect(widget.bindings, `${kind} ${widget.type}`).toEqual({ query: expect.any(Object) })
        expect(Object.keys(widget.bindings)).toEqual(["query"])
      }
    }
  })

  it("the default board is the KPI row, a trend over day, a funnel, a leaderboard and a table", () => {
    const next = run(blank(), starterOps("overview-board", blank()))
    const [title, strip, trend, funnel, leaders, table] = next.widgets

    expect(next.widgets.map((w) => w.type)).toEqual(["heading", "kpi-strip", "trend", "funnel", "leaderboard", "table"])
    expect(title).toMatchObject({ title: "Blank", data: { level: 1 } })
    expect(strip.bindings.query.metrics.map((m) => m.metric)).toEqual(["spend", "meta_leads", "clicks", "ctr"])
    expect(strip.bindings.query).toMatchObject({ window: last30, compare: "previous" })
    expect(trend.bindings.query).toEqual({ metrics: [{ metric: "spend" }], over: "day", window: last30 })
    expect(funnel.bindings.query).toEqual({
      metrics: [
        { metric: "impressions", label: "Impressions" },
        { metric: "clicks", label: "Clicks" },
        { metric: "meta_leads", label: "Leads" },
        { metric: "ghl_won_opps", label: "Won opps" },
      ],
      window: last30,
    })
    expect(leaders.bindings.query).toMatchObject({ by: "client", window: last30, compare: "previous" })
    expect(leaders.bindings.query.metrics[0].metric).toBe("spend")
    expect(table.bindings.query).toMatchObject({ by: "client", window: last30 })

    // Laid out in reading order: the strip under the title, then two rows of pairs.
    expect(strip.layout).toMatchObject({ x: 0, y: 1, w: 12 })
    expect([trend, funnel].map((w) => [w.layout.x, w.layout.y])).toEqual([
      [0, 4],
      [6, 4],
    ])
    expect(leaders.layout.y).toBe(trend.layout.y + trend.layout.h)
    expect([leaders.layout.x, table.layout.x]).toEqual([0, 6])
    expect(table.layout.y).toBe(leaders.layout.y)
  })

  // On an empty dashboard the starter gives it a page title first: a level-1
  // heading with the dashboard's title, then the widget placed after it.
  it("on an empty dashboard a starter adds a level-1 heading, then its widget after it", () => {
    const doc = blank()
    const ops = starterOps("kpi-strip-30d", doc)

    expect(ops[0]).toMatchObject({ op: "addWidget", widget: { type: "heading", title: "Blank", data: { level: 1 } } })
    const headingId = ops[0].widget.id
    expect(headingId).toEqual(expect.any(String))
    expect(ops).toHaveLength(2)
    // The strip shows each metric's change, so the query asks for the previous period.
    expect(ops[1]).toEqual({
      op: "addWidget",
      after: headingId,
      widget: {
        type: "kpi-strip",
        id: expect.any(String),
        query: {
          metrics: [{ metric: "spend" }, { metric: "meta_leads" }, { metric: "clicks" }, { metric: "ctr" }],
          window: last30,
          compare: "previous",
        },
      },
    })

    const next = run(doc, ops)
    const [title, strip] = next.widgets
    expect(title.layout).toEqual({ x: 0, y: 0, w: 12, h: 1 })
    expect(strip.id).toBe(ops[1].widget.id)
    expect(strip.layout).toMatchObject({ x: 0, y: 1, w: 12 })
  })

  it("trend starter queries spend over day for the last 30 days", () => {
    const next = run(blank(), starterOps("spend-trend-30d", blank()))

    const widget = next.widgets.find((w) => w.type === "trend")
    expect(widget.bindings).toEqual({ query: { metrics: [{ metric: "spend" }], over: "day", window: last30 } })
  })

  it("table starter queries spend by client for the last 7 days", () => {
    const next = run(blank(), starterOps("spend-by-client-table-7d", blank()))

    const widget = next.widgets.find((w) => w.type === "table")
    expect(widget.bindings).toEqual({ query: { metrics: [{ metric: "spend" }], by: "client", window: { preset: "last_7d" } } })
  })

  // Only the first widget under a heading uses the heading as `after`; later
  // ones chain to the widget before them, so they read in order.
  it("on a dashboard with widgets a starter chains after the last one, without another heading", () => {
    const doc = run(blank(), [
      heading("h", "Overview", 2),
      {
        op: "addWidget",
        after: "h",
        widget: { id: "k", type: "kpi", query: { metrics: [{ metric: "spend" }], window: { preset: "last_7d" } } },
      },
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

  it("the default board chains its widgets after the last one too", () => {
    const doc = run(blank(), [heading("h", "Overview", 1)])
    const ops = starterOps("overview-board", doc)

    expect(ops[0]).toMatchObject({ op: "addWidget", after: "h", widget: { type: "kpi-strip" } })
    // Each next widget goes after the one before it.
    for (let i = 1; i < ops.length; i++) expect(ops[i].after).toBe(ops[i - 1].widget.id)
    expect(run(doc, ops).widgets.map((w) => w.id)).toEqual(["h", ...ops.map((op) => op.widget.id)])
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
