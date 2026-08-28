// Named page views hook — the data layer behind ViewPicker.
//
// The API is mocked at apiRequest so these cover the hook's own bookkeeping:
// applying the default once the page is ready, dirty detection, and keeping the
// default pointer honest when a view is deleted.

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

const apiRequest = vi.fn()
vi.mock("@/lib/api", () => ({ apiRequest: (...args) => apiRequest(...args) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const { usePageViews } = await import("@/lib/usePageViews")

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const fail = (status, detail) => ({
  ok: false,
  status,
  json: async () => ({ detail }),
})

const view = (id, name, state = {}) => ({
  id,
  name,
  state,
  created_at: "2026-08-28T00:00:00",
  updated_at: "2026-08-28T00:00:00",
})

/** Queue the initial GET, then let each test add its own responses. */
function seed({ views = [], default_view_id = null } = {}) {
  apiRequest.mockReset()
  apiRequest.mockResolvedValueOnce(ok({ views, default_view_id }))
}

beforeEach(() => {
  apiRequest.mockReset()
})

describe("loading", () => {
  it("exposes the views it loaded", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: null })

    const { result } = renderHook(() => usePageViews("clients"))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.views.map(v => v.name)).toEqual(["Alpha"])
  })

  it("requests only the page it was given", async () => {
    seed()
    renderHook(() => usePageViews("contacts"))

    await waitFor(() => expect(apiRequest).toHaveBeenCalled())
    expect(apiRequest.mock.calls[0][0]).toBe("/api/user/page-views?page=contacts")
  })

  it("survives a failed load without throwing", async () => {
    apiRequest.mockReset()
    apiRequest.mockRejectedValueOnce(new Error("offline"))

    const { result } = renderHook(() => usePageViews("clients"))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.views).toEqual([])
  })
})

describe("applying the default view", () => {
  it("applies the default once the page is ready", async () => {
    seed({
      views: [view("a", "Alpha", { statusFilter: "active" })],
      default_view_id: "a",
    })
    const onApply = vi.fn()

    const { result } = renderHook(() =>
      usePageViews("clients", { onApply, ready: true })
    )

    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ statusFilter: "active" }))
    expect(result.current.activeViewId).toBe("a")
  })

  it("holds the default back until the page says it is ready", async () => {
    seed({ views: [view("a", "Alpha", { x: 1 })], default_view_id: "a" })
    const onApply = vi.fn()

    const { result, rerender } = renderHook(
      ({ ready }) => usePageViews("clients", { onApply, ready }),
      { initialProps: { ready: false } }
    )

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(onApply).not.toHaveBeenCalled()

    rerender({ ready: true })
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ x: 1 }))
  })

  it("applies the default only once, not on every rerender", async () => {
    seed({ views: [view("a", "Alpha", { x: 1 })], default_view_id: "a" })
    const onApply = vi.fn()

    const { rerender } = renderHook(() =>
      usePageViews("clients", { onApply, ready: true })
    )

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
    rerender()
    rerender()
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it("does nothing when the page has no default", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: null })
    const onApply = vi.fn()

    const { result } = renderHook(() =>
      usePageViews("clients", { onApply, ready: true })
    )

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(onApply).not.toHaveBeenCalled()
    expect(result.current.activeViewId).toBeNull()
  })
})

describe("dirty detection", () => {
  const renderWithState = async (state, saved) => {
    seed({ views: [view("a", "Alpha", saved)], default_view_id: "a" })
    const hook = renderHook(
      ({ s }) => usePageViews("clients", { state: s, onApply: () => {}, ready: true }),
      { initialProps: { s: state } }
    )
    await waitFor(() => expect(hook.result.current.activeViewId).toBe("a"))
    return hook
  }

  it("is clean when the page matches the active view", async () => {
    const { result } = await renderWithState({ a: 1, b: 2 }, { a: 1, b: 2 })
    expect(result.current.isDirty).toBe(false)
  })

  it("ignores key order", async () => {
    const { result } = await renderWithState({ b: 2, a: 1 }, { a: 1, b: 2 })
    expect(result.current.isDirty).toBe(false)
  })

  it("ignores nested key order too", async () => {
    const { result } = await renderWithState(
      { cols: { z: true, a: false } },
      { cols: { a: false, z: true } }
    )
    expect(result.current.isDirty).toBe(false)
  })

  it("still respects array order, which is user-chosen", async () => {
    const { result } = await renderWithState({ order: ["a", "b"] }, { order: ["b", "a"] })
    expect(result.current.isDirty).toBe(true)
  })

  it("flags a changed value", async () => {
    const { result } = await renderWithState({ a: 1 }, { a: 2 })
    expect(result.current.isDirty).toBe(true)
  })

  it("is never dirty with no active view", async () => {
    seed({ views: [view("a", "Alpha", { a: 1 })], default_view_id: null })
    const { result } = renderHook(() =>
      usePageViews("clients", { state: { a: 999 }, ready: true })
    )
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.isDirty).toBe(false)
  })
})

describe("creating", () => {
  it("posts the current state and makes the new view active", async () => {
    seed()
    apiRequest.mockResolvedValueOnce(ok(view("new", "Mine", { a: 1 })))

    const { result } = renderHook(() =>
      usePageViews("clients", { state: { a: 1 }, ready: true })
    )
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.createView("Mine") })

    const [, options] = apiRequest.mock.calls[1]
    expect(JSON.parse(options.body)).toEqual({
      page: "clients",
      name: "Mine",
      state: { a: 1 },
    })
    expect(result.current.views).toHaveLength(1)
    expect(result.current.activeViewId).toBe("new")
  })

  it("marks the first view as the default, mirroring the backend", async () => {
    seed()
    apiRequest.mockResolvedValueOnce(ok(view("first", "First")))

    const { result } = renderHook(() => usePageViews("clients", { state: {}, ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.createView("First") })
    expect(result.current.defaultViewId).toBe("first")
  })

  it("leaves an existing default alone", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok(view("b", "Beta")))

    const { result } = renderHook(() => usePageViews("clients", { state: {}, ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.createView("Beta") })
    expect(result.current.defaultViewId).toBe("a")
  })

  it("returns null and adds nothing when the name is taken", async () => {
    seed()
    apiRequest.mockResolvedValueOnce(fail(409, 'A view named "Mine" already exists'))

    const { result } = renderHook(() => usePageViews("clients", { state: {}, ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    let created
    await act(async () => { created = await result.current.createView("Mine") })
    expect(created).toBeNull()
    expect(result.current.views).toEqual([])
  })
})

describe("applying", () => {
  it("applies a view's state and marks it active", async () => {
    seed({ views: [view("a", "Alpha", { q: 1 }), view("b", "Beta", { q: 2 })] })
    const onApply = vi.fn()

    const { result } = renderHook(() => usePageViews("clients", { onApply, ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => { result.current.applyView("b") })

    expect(onApply).toHaveBeenCalledWith({ q: 2 })
    expect(result.current.activeViewId).toBe("b")
  })

  it("clears the active view without applying anything", async () => {
    seed({ views: [view("a", "Alpha", { q: 1 })], default_view_id: "a" })
    const onApply = vi.fn()

    const { result } = renderHook(() => usePageViews("clients", { onApply, ready: true }))
    await waitFor(() => expect(result.current.activeViewId).toBe("a"))
    onApply.mockClear()

    act(() => { result.current.applyView(null) })

    expect(result.current.activeViewId).toBeNull()
    expect(onApply).not.toHaveBeenCalled()
  })

  it("ignores an unknown id", async () => {
    seed({ views: [view("a", "Alpha")] })
    const onApply = vi.fn()

    const { result } = renderHook(() => usePageViews("clients", { onApply, ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => { result.current.applyView("nope") })
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe("updating", () => {
  it("saveOverActiveView writes the current page state to the active view", async () => {
    seed({ views: [view("a", "Alpha", { n: 1 })], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok(view("a", "Alpha", { n: 2 })))

    const { result } = renderHook(() =>
      usePageViews("clients", { state: { n: 2 }, onApply: () => {}, ready: true })
    )
    await waitFor(() => expect(result.current.activeViewId).toBe("a"))

    await act(async () => { await result.current.saveOverActiveView() })

    const [url, options] = apiRequest.mock.calls[1]
    expect(url).toBe("/api/user/page-views/a")
    expect(options.method).toBe("PATCH")
    expect(JSON.parse(options.body)).toEqual({ page: "clients", state: { n: 2 } })
    expect(result.current.isDirty).toBe(false)
  })

  it("saveOverActiveView is a no-op with no active view", async () => {
    seed({ views: [view("a", "Alpha")] })

    const { result } = renderHook(() => usePageViews("clients", { state: {}, ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    let out
    await act(async () => { out = await result.current.saveOverActiveView() })
    expect(out).toBeNull()
    expect(apiRequest).toHaveBeenCalledTimes(1)   // the initial GET only
  })

  it("a rename sends only the name", async () => {
    seed({ views: [view("a", "Alpha", { n: 1 })] })
    apiRequest.mockResolvedValueOnce(ok(view("a", "Renamed", { n: 1 })))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.updateView("a", { name: "Renamed" }) })

    expect(JSON.parse(apiRequest.mock.calls[1][1].body)).toEqual({
      page: "clients",
      name: "Renamed",
    })
    expect(result.current.views[0].name).toBe("Renamed")
  })
})

describe("deleting", () => {
  it("removes the view", async () => {
    seed({ views: [view("a", "Alpha"), view("b", "Beta")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok({ success: true }))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.deleteView("b") })
    expect(result.current.views.map(v => v.id)).toEqual(["a"])
  })

  it("moves the default to a survivor, matching the backend", async () => {
    seed({ views: [view("a", "Alpha"), view("b", "Beta")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok({ success: true }))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.deleteView("a") })
    expect(result.current.defaultViewId).toBe("b")
  })

  it("clears the default when the last view goes", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok({ success: true }))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.deleteView("a") })
    expect(result.current.defaultViewId).toBeNull()
  })

  it("deactivates the view it just deleted", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok({ success: true }))

    const { result } = renderHook(() =>
      usePageViews("clients", { onApply: () => {}, ready: true })
    )
    await waitFor(() => expect(result.current.activeViewId).toBe("a"))

    await act(async () => { await result.current.deleteView("a") })
    expect(result.current.activeViewId).toBeNull()
  })

  it("keeps the list intact when the request fails", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(fail(500, "boom"))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.deleteView("a") })
    expect(result.current.views).toHaveLength(1)
    expect(result.current.defaultViewId).toBe("a")
  })
})

describe("the default pointer", () => {
  it("updates optimistically", async () => {
    seed({ views: [view("a", "Alpha"), view("b", "Beta")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok({ success: true }))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.setDefault("b") })
    expect(result.current.defaultViewId).toBe("b")
  })

  it("rolls back when the request fails", async () => {
    seed({ views: [view("a", "Alpha"), view("b", "Beta")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(fail(500, "boom"))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.setDefault("b") })
    expect(result.current.defaultViewId).toBe("a")
  })

  it("can be cleared", async () => {
    seed({ views: [view("a", "Alpha")], default_view_id: "a" })
    apiRequest.mockResolvedValueOnce(ok({ success: true }))

    const { result } = renderHook(() => usePageViews("clients", { ready: true }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => { await result.current.setDefault(null) })
    expect(result.current.defaultViewId).toBeNull()
  })
})
