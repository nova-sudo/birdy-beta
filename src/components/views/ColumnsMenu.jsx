"use client"

// components/views/ColumnsMenu.jsx
// The table toolbar's "Columns" control — concept 5C from the Marketing Hub
// Columns handoff (design_handoff_hubs/design_handoff_marketing_columns).
//
// One 480×560 popover, split:
//   left rail  (160px) — saved views, then a read-only metric-source filter,
//                        then Save New View / Update View pinned to the bottom
//   right pane          — select-all header, the column list, search at the
//                         BOTTOM (not the top, deliberately)
//
// A view stores the visible column set and the source it was scoped to.
// "Default" is synthetic: it is the page's own baseline column set and cannot
// be renamed or deleted. It CAN be saved over — "Save to existing" writes the
// current columns to the page's own stored layout, which is what makes them
// come back next visit.
//
// Nothing here persists on toggle. Ticking a column changes the table
// immediately but is not written until an explicit save, so exploring which
// columns you want cannot quietly overwrite the view you were on.
//
// Pair with usePageViews for persistence:
//   const views = usePageViews("mktg_campaigns", { state, onApply, ready })
//   <ColumnsMenu columns={...} visibleColumns={...} onChange={...}
//                defaultColumns={...} views={views} />

import { useState, useRef, useEffect, useMemo } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const DEFAULT_VIEW_ID = "__default__"

// The handoff's five. Pages with a different metric catalogue pass their own
// via `sources` — the Clients table also carries HotProspector columns.
export const DEFAULT_SOURCES = [
  { id: "all", label: "All" },
  { id: "meta", label: "Meta" },
  { id: "ghl", label: "GHL" },
  { id: "tags", label: "Tags" },
  { id: "custom", label: "Custom" },
]

// Badge palette — solid semantic fills from the shared scale, one per source.
const SOURCE_STYLE = {
  meta:          { className: "bg-pd-info-bg text-pd-info", label: "Meta" },
  ghl:           { className: "bg-pd-success-bg text-pd-success", label: "GHL" },
  tags:          { className: "bg-pd-success-bg text-pd-success", label: "Tags" },
  // Birdy's own derived metrics. Shares the Metrics Hub's purple with Custom —
  // both are ours rather than a platform's — and the label is what tells a
  // built-in ratio apart from a formula the user wrote.
  birdy:         { className: "bg-pd-primary-tint text-pd-primary", label: "Birdy" },
  custom:        { className: "bg-pd-primary-tint text-pd-primary", label: "Custom" },
  hotprospector: { className: "bg-pd-amber-bg text-pd-amber", label: "HP" },
}

// Anything outside the palette still gets a readable, neutral badge rather
// than disappearing.
const NEUTRAL_BADGE = { className: "bg-pd-divider text-pd-body" }

function Tick({ on }) {
  return (
    <span
      className={cn(
        "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[4px]",
        on ? "bg-pd-primary" : "border-2 border-pd-border-strong bg-transparent"
      )}
    >
      {on && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}

function SourceBadge({ source, label }) {
  if (!source) return null
  const s = SOURCE_STYLE[source] ?? { ...NEUTRAL_BADGE, label: label ?? source }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-[7px] py-[2px] text-[11px] font-bold",
        s.className
      )}
    >
      {s.label}
    </span>
  )
}

const RAIL_LABEL =
  "text-[10px] font-bold uppercase tracking-[.04em] text-pd-faint"

// Rail rows (saved views and the source filter) share one treatment: the
// selected row keeps its own highlight and never takes the grey hover.
const railRowClass = (on, hovered) =>
  cn(
    "border-l-[3px]",
    on
      ? "border-l-pd-primary bg-pd-primary-tint"
      : hovered
        ? "border-l-transparent bg-pd-divider"
        : "border-l-transparent bg-transparent"
  )
const railTextClass = (on) =>
  on ? "font-bold text-pd-primary" : "font-medium text-pd-ink"

export default function ColumnsMenu({
  columns = [],              // [{ id, label, source }]
  visibleColumns = [],       // ids currently on
  onChange,                  // (ids) => void
  defaultColumns = [],       // the protected "Default" view's column set
  views,                     // the usePageViews return value
  sources = DEFAULT_SOURCES, // metric-filter rail options; first must be "all"
  // Persists the current columns as the page's own layout — where "Save to
  // existing" writes when no saved view is selected. Without it that button
  // has nothing to save to on Default.
  onSaveDefault,
  buttonClassName = "",
}) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState("all")
  const [search, setSearch] = useState("")
  const [hoverView, setHoverView] = useState(null)
  const [hoverSource, setHoverSource] = useState(null)

  // Whether the "Save New View" name input is open. Distinct from the
  // hook's `busy`, which means a request is actually in flight.
  const [composing, setComposing] = useState(false)
  const [newName, setNewName] = useState("")
  const [editTarget, setEditTarget] = useState(null)
  const [editValue, setEditValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [justUpdated, setJustUpdated] = useState(false)

  const flashRef = useRef(null)

  useEffect(() => () => clearTimeout(flashRef.current), [])

  const {
    views: saved = [],
    saving: busy = false,
    activeViewId,
    activeView,
    applyView,
    createView,
    updateView,
    deleteView,
  } = views || {}

  // The source filter is part of a saved view but lives here rather than on the
  // page, so it has to follow whichever view becomes active.
  useEffect(() => {
    if (activeView?.state?.source) setSource(activeView.state.source)
  }, [activeView])

  // "Default" leads the rail and is not a stored view.
  const rail = useMemo(
    () => [{ id: DEFAULT_VIEW_ID, name: "Default", protected: true }, ...saved],
    [saved]
  )
  const activeId = activeViewId ?? DEFAULT_VIEW_ID
  const activeIsStored = activeId !== DEFAULT_VIEW_ID

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return columns.filter(c => {
      if (source !== "all" && c.source !== source) return false
      if (q && !c.label.toLowerCase().includes(q)) return false
      return true
    })
  }, [columns, source, search])

  const allOn = shown.length > 0 && shown.every(c => visibleColumns.includes(c.id))

  const toggleColumn = (id) => {
    onChange?.(
      visibleColumns.includes(id)
        ? visibleColumns.filter(c => c !== id)
        : [...visibleColumns, id]
    )
  }

  // Acts on the filtered list only — "select all" means all of what you can see.
  const toggleAll = () => {
    const ids = shown.map(c => c.id)
    onChange?.(
      allOn
        ? visibleColumns.filter(id => !ids.includes(id))
        : [...new Set([...visibleColumns, ...ids])]
    )
  }

  const pickView = (view) => {
    setEditTarget(null)
    setDeleteTarget(null)
    if (view.id === DEFAULT_VIEW_ID) {
      applyView?.(null)
      onChange?.(defaultColumns)
      return
    }
    applyView?.(view.id)
  }

  const confirmSave = async () => {
    const name = newName.trim()
    if (!name) return
    const created = await createView?.(name, { visibleColumns, source })
    if (created) {
      setComposing(false)
      setNewName("")
    }
  }

  const confirmRename = async () => {
    const name = editValue.trim()
    if (!name || !editTarget) return
    const updated = await updateView?.(editTarget.id, { name })
    if (updated) setEditTarget(null)
  }

  // Saves in place with a brief "Saved ✓" flash — no dialog, per spec.
  // On a stored view that overwrites the view; on Default it writes the page's
  // own layout, so the columns you chose are the ones you come back to.
  const [saveError, setSaveError] = useState(null)

  const saveToExisting = async () => {
    setSaveError(null)
    let ok
    if (activeIsStored) {
      ok = Boolean(await updateView?.(activeId, { state: { visibleColumns, source } }))
    } else if (onSaveDefault) {
      ok = await onSaveDefault(visibleColumns) !== false
    } else {
      setSaveError("Nothing to save to")
      return
    }
    if (!ok) return
    setJustUpdated(true)
    clearTimeout(flashRef.current)
    flashRef.current = setTimeout(() => setJustUpdated(false), 1200)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteView?.(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          className={cn("h-[38px] gap-2 px-[13px] text-[13px]", buttonClassName)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          Columns
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </Button>
      </PopoverTrigger>

      {/* Portalled, so a toolbar with overflow-x-auto (the Clients page has
          one) can't clip it — CSS forces the other axis to auto too, which
          squashed this menu into a scrolling strip the height of the toolbar. */}
      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label="Columns and saved views"
        className="flex h-[560px] w-[480px] overflow-hidden rounded-2xl border-pd-border bg-pd-surface p-0 shadow-pd-popover"
      >
          {/* ── Left rail ─────────────────────────────────────────────── */}
          <div className="flex w-[160px] flex-col border-r border-pd-border bg-pd-table-head">
            <div className={`${RAIL_LABEL} border-b border-pd-border px-[14px] pb-[10px] pt-[12px]`}>
              Saved views
            </div>

            <div className="overflow-y-auto">
              {rail.map(view => {
                const on = view.id === activeId
                const hovered = hoverView === view.id
                // Pencil and trash appear only when the row is BOTH selected
                // and hovered — not on hover alone, and never on Default.
                const showActions = !view.protected && on && hovered

                if (editTarget?.id === view.id) {
                  return (
                    <div key={view.id} className="flex items-center gap-[5px] px-[11px] py-[6px]">
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") confirmRename()
                          if (e.key === "Escape") setEditTarget(null)
                        }}
                        autoFocus
                        aria-label="View name"
                        className="h-[26px] min-w-0 flex-1 rounded-full border border-primary bg-background px-[9px] text-[12px] text-pd-ink outline-none ring-4 ring-primary/15"
                      />
                      <Button
                        size="icon-xs" onClick={confirmRename} disabled={busy} aria-label="Confirm rename"
                        className="size-5 shrink-0"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </Button>
                      <button
                        type="button" onClick={() => setEditTarget(null)} aria-label="Cancel rename"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-pd-border text-pd-body hover:bg-pd-divider"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )
                }

                if (deleteTarget?.id === view.id) {
                  return (
                    <div key={view.id} className="flex flex-col gap-[6px] bg-pd-danger-surface px-[14px] py-[8px]">
                      <span className="text-[11.5px] font-semibold text-pd-body">
                        Delete &ldquo;{view.name}&rdquo;?
                      </span>
                      <div className="flex gap-[6px]">
                        <Button
                          type="button" variant="destructive" size="xs"
                          onClick={confirmDelete} disabled={busy}
                          className="flex-1"
                        >
                          Delete
                        </Button>
                        <Button
                          type="button" variant="outline" size="xs"
                          onClick={() => setDeleteTarget(null)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={view.id}
                    onMouseEnter={() => setHoverView(view.id)}
                    onMouseLeave={() => setHoverView(null)}
                    className={cn(
                      "flex items-center gap-[6px] px-[14px] py-[8px]",
                      railRowClass(on, hovered)
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => pickView(view)}
                      aria-current={on ? "true" : undefined}
                      className={cn("min-w-0 flex-1 truncate text-left text-[12.5px]", railTextClass(on))}
                    >
                      {view.name}
                    </button>
                    {/* Rendered only once the row is selected AND hovered, and
                        never for Default. Kept out of the DOM rather than made
                        transparent: an invisible 11px delete target sitting on
                        every unselected row is a trap for the mouse and for a
                        screen reader alike. */}
                    {showActions && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditTarget(view); setEditValue(view.name) }}
                          aria-label={`Rename ${view.name}`}
                          className="shrink-0 text-pd-faint hover:text-pd-body animate-in fade-in duration-150"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(view)}
                          aria-label={`Delete ${view.name}`}
                          className="shrink-0 text-pd-danger animate-in fade-in duration-150"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={`${RAIL_LABEL} px-[14px] pb-[6px] pt-[14px]`}>Metric filter</div>
            {sources.map(s => {
              const on = s.id === source
              const hovered = hoverSource === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.id)}
                  onMouseEnter={() => setHoverSource(s.id)}
                  onMouseLeave={() => setHoverSource(null)}
                  aria-pressed={on}
                  className={cn(
                    "px-[14px] py-[8px] text-left text-[12.5px]",
                    railRowClass(on, hovered),
                    railTextClass(on)
                  )}
                >
                  {s.label}
                </button>
              )
            })}

            <div className="mt-auto px-[14px] pb-[14px] pt-[9px]">
              {composing ? (
                <div className="flex flex-col gap-[6px]">
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") confirmSave()
                      if (e.key === "Escape") { setComposing(false); setNewName("") }
                    }}
                    placeholder="View name…"
                    autoFocus
                    aria-label="New view name"
                    className="h-8 w-full rounded-full border border-gray-300 bg-background px-[12px] text-[12px] text-pd-ink outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                  />
                  <div className="flex gap-[6px]">
                    <Button
                      type="button"
                      size="md"
                      onClick={confirmSave}
                      disabled={!newName.trim() || busy}
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => { setComposing(false); setNewName("") }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-[6px]">
                  {/* Above Save New View: the common case is refining the view
                      you are already on, not starting another. */}
                  <Button
                    type="button"
                    size="md"
                    onClick={saveToExisting}
                    disabled={busy}
                    className="w-full"
                  >
                    {justUpdated ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Saved
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <path d="M17 21v-8H7v8" />
                          <path d="M7 3v5h8" />
                        </svg>
                        Save to existing
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => { setComposing(true); setNewName("") }}
                    className="w-full"
                  >
                    Save New View
                  </Button>

                  {saveError && (
                    <p className="text-[10.5px] text-pd-danger">{saveError}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right pane ────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col">
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-[10px] border-b border-pd-border pb-[10px] pl-[14px] pr-[29px] pt-[12px] text-left"
            >
              <Tick on={allOn} />
              <span className={`${RAIL_LABEL} flex-1`}>Metric name</span>
              <span className={RAIL_LABEL}>Source</span>
            </button>

            <div className="flex-1 overflow-y-auto p-1">
              {shown.length === 0 ? (
                <p className="px-[14px] py-6 text-[12px] text-pd-faint">
                  No metrics match that search.
                </p>
              ) : (
                shown.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleColumn(col.id)}
                    aria-pressed={visibleColumns.includes(col.id)}
                    className="flex w-full items-center gap-[10px] rounded-xl px-[10px] py-[8px] text-left hover:bg-pd-divider"
                  >
                    <Tick on={visibleColumns.includes(col.id)} />
                    <span className="flex-1 truncate text-[12.5px] font-semibold text-pd-ink">
                      {col.label}
                    </span>
                    <SourceBadge source={col.source} />
                  </button>
                ))
              )}
            </div>

            {/* Search sits at the bottom of this pane by design, not the top. */}
            <div className="border-t border-pd-border px-[14px] py-[10px]">
              <div className="flex h-8 items-center gap-[7px] rounded-full border border-gray-300 bg-background px-[12px] text-pd-faint transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search in ${sources.find(s => s.id === source)?.label ?? "All"}…`}
                  aria-label="Search metrics"
                  className="min-w-0 flex-1 border-none bg-transparent text-[12px] text-pd-ink outline-none placeholder:text-pd-faint"
                />
              </div>
            </div>
          </div>
      </PopoverContent>
    </Popover>
  )
}
