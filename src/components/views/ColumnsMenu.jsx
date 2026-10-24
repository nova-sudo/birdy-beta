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
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@/components/ds"
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

// Badge tone per source (ds Badge tones). Birdy's own derived metrics share
// the primary tone with Custom, since both are ours rather than a platform's,
// and the label is what tells a built-in ratio apart from a formula the user
// wrote.
const SOURCE_STYLE = {
  meta:          { tone: "info", label: "Meta" },
  ghl:           { tone: "success", label: "GHL" },
  tags:          { tone: "success", label: "Tags" },
  birdy:         { tone: "primary", label: "Birdy" },
  custom:        { tone: "primary", label: "Custom" },
  hotprospector: { tone: "warning", label: "HP" },
}

// Anything outside the palette still gets a readable, neutral badge rather
// than disappearing.
const NEUTRAL_TONE = "neutral"

function Tick({ on }) {
  return (
    <span
      className={cn(
        "flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-sm",
        on ? "bg-primary" : "bg-background shadow-control"
      )}
    >
      {on && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </span>
  )
}

function SourceBadge({ source, label }) {
  if (!source) return null
  const s = SOURCE_STYLE[source] ?? { tone: NEUTRAL_TONE, label: label ?? source }
  return <Badge tone={s.tone}>{s.label}</Badge>
}

const RAIL_LABEL =
  "text-xs font-medium uppercase tracking-wide text-muted-foreground"

// Rail rows (saved views and the source filter) share one treatment: the
// selected row keeps its own highlight and never takes the grey hover.
const railRowClass = (on, hovered) =>
  cn(
    "border-l-[3px]",
    on
      ? "border-l-primary bg-primary-soft"
      : hovered
        ? "border-l-transparent bg-muted"
        : "border-l-transparent bg-transparent"
  )
const railTextClass = (on) =>
  on ? "font-bold text-primary" : "font-medium text-foreground"

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
          size="sm"
          className={buttonClassName}
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
        className="flex h-[560px] w-[480px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-surface border-border bg-background p-0 shadow-floating"
      >
          {/* ── Left rail ─────────────────────────────────────────────── */}
          <div className="flex w-[160px] flex-col border-r border-border bg-muted">
            <div className={`${RAIL_LABEL} border-b border-border px-[14px] pb-[10px] pt-[12px]`}>
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
                        className="h-[26px] min-w-0 flex-1 rounded-control bg-background px-[9px] text-xs text-foreground shadow-control outline-none focus-visible:shadow-control-focus"
                      />
                      <Button
                        size="icon-sm" onClick={confirmRename} disabled={busy} aria-label="Confirm rename"
                        className="size-5 shrink-0"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </Button>
                      <button
                        type="button" onClick={() => setEditTarget(null)} aria-label="Cancel rename"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-control text-body shadow-control hover:bg-muted"
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
                    <div key={view.id} className="flex flex-col gap-[6px] bg-danger-soft px-[14px] py-[8px]">
                      <span className="text-xs font-semibold text-body">
                        Delete &ldquo;{view.name}&rdquo;?
                      </span>
                      <div className="flex gap-[6px]">
                        <Button
                          type="button" variant="destructive" size="sm"
                          onClick={confirmDelete} disabled={busy}
                          className="flex-1"
                        >
                          Delete
                        </Button>
                        <Button
                          type="button" variant="outline" size="sm"
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
                      className={cn("min-w-0 flex-1 truncate text-left text-xs", railTextClass(on))}
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
                          className="shrink-0 text-muted-foreground hover:text-foreground animate-in fade-in duration-150"
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
                          className="shrink-0 text-danger-ink animate-in fade-in duration-150"
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
                    "px-[14px] py-[8px] text-left text-xs",
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
                    className="h-8 w-full rounded-control bg-background px-[12px] text-xs text-foreground shadow-control outline-none focus-visible:shadow-control-focus"
                  />
                  <div className="flex gap-[6px]">
                    <Button
                      type="button"
                      size="sm"
                      onClick={confirmSave}
                      disabled={!newName.trim() || busy}
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
                    size="sm"
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
                    size="sm"
                    onClick={() => { setComposing(true); setNewName("") }}
                    className="w-full"
                  >
                    Save New View
                  </Button>

                  {saveError && (
                    <p className="text-xs text-danger-ink">{saveError}</p>
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
              className="flex items-center gap-[10px] border-b border-border pb-[10px] pl-[14px] pr-[29px] pt-[12px] text-left"
            >
              <Tick on={allOn} />
              <span className={`${RAIL_LABEL} flex-1`}>Metric name</span>
              <span className={RAIL_LABEL}>Source</span>
            </button>

            <div className="flex-1 overflow-y-auto p-1">
              {shown.length === 0 ? (
                <p className="px-[14px] py-6 text-xs text-muted-foreground">
                  No metrics match that search.
                </p>
              ) : (
                shown.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleColumn(col.id)}
                    aria-pressed={visibleColumns.includes(col.id)}
                    className="flex w-full items-center gap-[10px] rounded-control px-[10px] py-[8px] text-left hover:bg-muted"
                  >
                    <Tick on={visibleColumns.includes(col.id)} />
                    <span className="flex-1 truncate text-xs font-semibold text-foreground">
                      {col.label}
                    </span>
                    <SourceBadge source={col.source} />
                  </button>
                ))
              )}
            </div>

            {/* Search sits at the bottom of this pane by design, not the top. */}
            <div className="border-t border-border px-[14px] py-[10px]">
              <div className="flex h-8 items-center gap-[7px] rounded-control bg-background px-[12px] text-muted-foreground shadow-control transition-shadow duration-200 focus-within:shadow-control-focus">
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
                  className="min-w-0 flex-1 border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
      </PopoverContent>
    </Popover>
  )
}
