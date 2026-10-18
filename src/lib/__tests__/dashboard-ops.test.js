/**
 * Ops from Ask Birdy land on whatever the user is looking at: the live editor
 * doc, unsaved local edits included. The target here is a real dashkit
 * history, which is what the editor's imperative handle wraps.
 */
import { describe, it, expect } from "vitest"
import { createDashboard, createHistory } from "dashkit/core"
import { createRegistry, builtinWidgets } from "dashkit/react"
import { applyIncomingOps } from "@/lib/dashboard-ops"

const registry = createRegistry(builtinWidgets)
const catalog = {
  metrics: [{ key: "spend", label: "Spend", format: "currency", dimensions: ["day"] }],
  dimensions: [{ key: "day", label: "Day" }],
  windows: [{ preset: "last_7_days", label: "Last 7 days" }],
}

/** A stand-in for the editor's apiRef: same contract (never throws, returns the doc). */
function historyTarget(doc) {
  const history = createHistory(doc, { registry })
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
  const doc = createDashboard({ title: "Spend", id: "d1" })
  const sectionId = doc.sections[0].id
  const target = historyTarget(doc)
  // An edit the user made and has not saved yet.
  target.applyAll(
    [{ op: "addWidget", sectionId, widget: { type: "text", id: "local", data: { markdown: "mine" } } }],
    "user",
  )
  return { target, sectionId }
}

const ctx = { dashboardId: "d1", currentId: "d1", registry, catalog }

describe("applyIncomingOps", () => {
  it("ops apply onto the live editor doc", () => {
    const { target, sectionId } = setup()
    const ops = [{ op: "addWidget", sectionId, widget: { type: "text", id: "ai", title: "Note", data: { markdown: "hi" } } }]

    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(true)
    expect(result.error).toBeUndefined()
    const ids = target.getDoc().sections[0].widgets.map((w) => w.id)
    expect(ids).toEqual(["local", "ai"])
    expect(result.doc).toBe(target.getDoc())
    expect(result.diff.length).toBeGreaterThan(0)
    expect(result.diff.join("\n")).toMatch(/Note/)
    expect(target.getDoc().meta.lastAuthor).toBe("ai")
  })

  it("ops for a different dashboard_id are dropped", () => {
    const { target, sectionId } = setup()
    const before = target.getDoc()
    const ops = [{ op: "addWidget", sectionId, widget: { type: "text", data: { markdown: "x" } } }]

    const result = applyIncomingOps(target, ops, { ...ctx, dashboardId: "other" })

    expect(result.applied).toBe(false)
    expect(result.diff).toEqual([])
    expect(target.getDoc()).toBe(before)
  })

  it("invalid ops are rejected without changing the doc", () => {
    const { target, sectionId } = setup()
    const before = target.getDoc()
    const ops = [{ op: "moveWidget", widgetId: "nope", toSectionId: sectionId, toIndex: 0 }]

    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(false)
    expect(result.diff).toEqual([])
    expect(result.error).toMatch(/nope/)
    expect(target.getDoc()).toBe(before)
  })

  it("ops that introduce a new validation error are rejected", () => {
    const { target, sectionId } = setup()
    const before = target.getDoc()
    const ops = [
      { op: "addWidget", sectionId, widget: { type: "kpi", id: "k" } },
      { op: "setBinding", widgetId: "k", slot: "value", binding: { metric: "made_up", window: { preset: "last_7_days" } } },
    ]

    const result = applyIncomingOps(target, ops, ctx)

    expect(result.applied).toBe(false)
    expect(result.error).toMatch(/made_up/)
    expect(target.getDoc()).toBe(before)
  })
})
