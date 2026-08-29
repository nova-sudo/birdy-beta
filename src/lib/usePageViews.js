// lib/usePageViews.js
// Named page views — the saved presets behind the view picker on Clients,
// Leads and Marketing.
//
// Deliberately separate from useColumnViews. That hook persists one column
// layout per page ("where I left off") and the tables keep autosaving into it
// on drag-reorder. This one stores user-named presets capturing the whole page
// state — columns, filters, sort, active tab — under a different backend field,
// so neither store can corrupt the other.
//
// Usage:
//
//   const pageState = useMemo(() => ({ columnOrder, statusFilter, sortColumn }),
//                             [columnOrder, statusFilter, sortColumn])
//
//   const views = usePageViews("clients", {
//     state: pageState,
//     onApply: (s) => {
//       setColumnOrder(s.columnOrder ?? [])
//       setStatusFilter(s.statusFilter ?? "all")
//     },
//     ready: viewsLoaded,   // hold the default until the page can accept it
//   })
//
// `state` must be plain JSON-serialisable data — no Sets, Maps or Dates. Pages
// hold row selections in Sets, so convert (or leave them out; a saved view
// should not restore a selection anyway).

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api"

const BASE = "/api/user/page-views"

// JSON.stringify is key-order sensitive, and some page state is built by
// iterating a column list whose order can vary between loads — comparing raw
// output would flag an untouched view as having unsaved changes. Sorting keys
// on the way out makes the comparison depend on content alone. Array order is
// preserved: in a filter list it is meaningful.
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  if (value && typeof value === "object") {
    const body = Object.keys(value)
      .sort()
      .map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")
    return `{${body}}`
  }
  return JSON.stringify(value) ?? "null"
}

async function readError(res, fallback) {
  try {
    const body = await res.json()
    return body?.detail || fallback
  } catch {
    return fallback
  }
}

export function usePageViews(page, { state, onApply, ready = true } = {}) {
  const [views, setViews] = useState([])
  const [defaultViewId, setDefaultViewId] = useState(null)
  const [activeViewId, setActiveViewId] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Kept in refs so the callbacks below don't need `state`/`onApply` in their
  // dependency lists — otherwise every parent render would rebuild them and
  // any effect depending on them would loop.
  const stateRef = useRef(state)
  const onApplyRef = useRef(onApply)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { onApplyRef.current = onApply }, [onApply])

  // Mirrors `views` so callbacks can read the current list without taking it as
  // a dependency. Reading it inside a setState updater instead would run the
  // side effects twice under StrictMode.
  const viewsRef = useRef(views)
  useEffect(() => { viewsRef.current = views }, [views])

  // Guards the one-shot default application; reset whenever `page` changes.
  const appliedDefault = useRef(false)

  // ── load ────────────────────────────────────────────────────────────────
  // `page` is not always fixed: Marketing swaps it per tab, so each tab shows
  // its own views. Everything derived from the old page is cleared first.
  useEffect(() => {
    let cancelled = false

    setLoaded(false)
    setViews([])
    setDefaultViewId(null)
    setActiveViewId(null)
    appliedDefault.current = false

    async function load() {
      try {
        const res = await apiRequest(`${BASE}?page=${encodeURIComponent(page)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setViews(data.views || [])
        setDefaultViewId(data.default_view_id ?? null)
      } catch (err) {
        // A failed load is not worth a toast — the page still works, the user
        // just sees no saved views. Saving surfaces its own errors.
        console.warn(`[usePageViews] Could not load views for "${page}":`, err)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [page])

  // ── apply the default once, when the page says it can take it ───────────
  useEffect(() => {
    if (!loaded || !ready || appliedDefault.current) return
    appliedDefault.current = true
    if (!defaultViewId) return
    const view = views.find(v => v.id === defaultViewId)
    if (!view) return
    onApplyRef.current?.(view.state || {})
    setActiveViewId(view.id)
  }, [loaded, ready, defaultViewId, views])

  const activeView = useMemo(
    () => views.find(v => v.id === activeViewId) || null,
    [views, activeViewId]
  )

  // Whether the page has drifted from the view it is sitting on, so the picker
  // can offer "Update view" rather than silently discarding the change.
  const isDirty = useMemo(() => {
    if (!activeView || state === undefined) return false
    try {
      return stableStringify(state) !== stableStringify(activeView.state ?? {})
    } catch {
      return false
    }
  }, [activeView, state])

  // ── apply ───────────────────────────────────────────────────────────────
  const applyView = useCallback((viewId) => {
    if (viewId === null) {
      setActiveViewId(null)
      return
    }
    const view = viewsRef.current.find(v => v.id === viewId)
    if (!view) return
    onApplyRef.current?.(view.state || {})
    setActiveViewId(view.id)
  }, [])

  // ── create ──────────────────────────────────────────────────────────────
  // `explicitState` wins over the `state` option when the caller holds part of
  // the state itself — ColumnsMenu owns the source filter, for instance.
  const createView = useCallback(async (name, explicitState) => {
    setSaving(true)
    try {
      const res = await apiRequest(BASE, {
        method: "POST",
        body: JSON.stringify({
          page,
          name,
          state: explicitState ?? stateRef.current ?? {},
        }),
      })
      if (!res.ok) throw new Error(await readError(res, "Failed to save view"))
      const view = await res.json()
      setViews(prev => [...prev, view])
      setActiveViewId(view.id)
      // The backend makes the first view on a page the default; mirror that
      // locally so the picker's "Default" marker is right without a refetch.
      setDefaultViewId(prev => prev ?? view.id)
      toast.success(`Saved "${view.name}"`)
      return view
    } catch (err) {
      toast.error(err.message || "Failed to save view")
      return null
    } finally {
      setSaving(false)
    }
  }, [page])

  // ── update (rename, overwrite state, or both) ───────────────────────────
  const updateView = useCallback(async (viewId, { name, state: nextState } = {}) => {
    setSaving(true)
    try {
      const body = { page }
      if (name !== undefined) body.name = name
      if (nextState !== undefined) body.state = nextState
      const res = await apiRequest(`${BASE}/${viewId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await readError(res, "Failed to update view"))
      const view = await res.json()
      setViews(prev => prev.map(v => (v.id === viewId ? view : v)))
      toast.success(`Updated "${view.name}"`)
      return view
    } catch (err) {
      toast.error(err.message || "Failed to update view")
      return null
    } finally {
      setSaving(false)
    }
  }, [page])

  // Overwrite a view with whatever is on screen right now.
  const saveOverActiveView = useCallback(async () => {
    if (!activeViewId) return null
    return updateView(activeViewId, { state: stateRef.current ?? {} })
  }, [activeViewId, updateView])

  // ── delete ──────────────────────────────────────────────────────────────
  const deleteView = useCallback(async (viewId) => {
    setSaving(true)
    try {
      const res = await apiRequest(
        `${BASE}/${viewId}?page=${encodeURIComponent(page)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error(await readError(res, "Failed to delete view"))

      const remaining = viewsRef.current.filter(v => v.id !== viewId)
      const promoted = remaining[0]?.id ?? null
      setViews(remaining)
      // Mirror the backend's rule: a default pointing at a deleted view moves
      // to the first survivor, or clears when none are left.
      setDefaultViewId(prev => (prev === viewId ? promoted : prev))
      setActiveViewId(prev => (prev === viewId ? null : prev))
      toast.success("View deleted")
      return true
    } catch (err) {
      toast.error(err.message || "Failed to delete view")
      return false
    } finally {
      setSaving(false)
    }
  }, [page])

  // ── default ─────────────────────────────────────────────────────────────
  const setDefault = useCallback(async (viewId) => {
    const previous = defaultViewId
    setDefaultViewId(viewId)   // optimistic — this is a one-field toggle
    try {
      const res = await apiRequest(`${BASE}/default`, {
        method: "PUT",
        body: JSON.stringify({ page, view_id: viewId }),
      })
      if (!res.ok) throw new Error(await readError(res, "Failed to set default view"))
      toast.success(viewId ? "Default view set" : "Default view cleared")
      return true
    } catch (err) {
      setDefaultViewId(previous)
      toast.error(err.message || "Failed to set default view")
      return false
    }
  }, [page, defaultViewId])

  return {
    views,
    activeViewId,
    activeView,
    defaultViewId,
    loaded,
    saving,
    isDirty,
    applyView,
    createView,
    updateView,
    saveOverActiveView,
    deleteView,
    setDefault,
  }
}
