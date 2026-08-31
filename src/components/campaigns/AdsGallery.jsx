"use client"
import { useMemo, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid, Play, Table } from "lucide-react"

// The Ads tab's two layouts show the same metrics in the same order — the
// handoff's one shared order array. This grid is the gallery half; the table
// half is StyledTable, and both write the reorder back through the same
// onColumnOrderChange handler in MarketingContent.

// Icon-only sibling of PdSegmented. That component always renders a text label
// inside the chip, and these two options are 32px icon squares — same track,
// chip and shadow recipe, without the label span.
export function AdsViewSwitch({ value, onChange }) {
  const options = [
    { key: "table", icon: Table, label: "Table view" },
    { key: "gallery", icon: LayoutGrid, label: "Gallery view" },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Ads layout"
      className="flex shrink-0 gap-1 rounded-[9px] border border-pd-border bg-pd-divider p-[3px]"
    >
      {options.map(({ key, icon: Icon, label }) => {
        const selected = key === value
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={`flex size-8 cursor-pointer items-center justify-center rounded-[7px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary ${
              selected ? "bg-pd-surface text-pd-ink shadow-pd-segment" : "bg-transparent text-pd-faint"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

const CARD_SKELETON_COUNT = 8

export default function AdsGallery({
  rows = [],
  columns = [],
  onOrderChange,
  onStatusToggle,
  togglingRows = new Set(),
  isLoading = false,
}) {
  // One drag at a time, scoped to the card it started in — the drop-target
  // dash only lights up on that card, not on every card showing the same row.
  const [drag, setDrag] = useState({ id: null, overId: null, cardIdx: null })
  // Meta's creative CDN URLs are signed and ephemeral (see
  // facebook_cache_shape.py), so a stored thumbnail can 404 between refreshes.
  // A failed load drops the card back to the placeholder rather than showing
  // the browser's broken-image glyph.
  const [failedImages, setFailedImages] = useState(() => new Set())

  // The name lives in the card's fixed header row; everything else becomes a
  // metric row, in the shared order.
  const metricColumns = useMemo(() => columns.filter(c => c.id !== "name"), [columns])

  // The table opens sorted by spend descending; the gallery matches so
  // flicking between views doesn't shuffle the ads.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)),
    [rows]
  )

  const clearDrag = () => setDrag({ id: null, overId: null, cardIdx: null })

  const handleDrop = (targetId) => {
    const fromId = drag.id
    clearDrag()
    if (!fromId || fromId === targetId) return
    // Same shape StyledTable's handleDrop emits: the ordered visible ids with
    // the dragged one respliced in front of the target.
    const newOrder = columns.map(c => c.id).filter(id => id !== fromId)
    newOrder.splice(newOrder.indexOf(targetId), 0, fromId)
    onOrderChange?.(newOrder)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: CARD_SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[14px] border border-pd-border bg-pd-surface">
            <Skeleton className="h-[190px] w-full rounded-none" />
            <div className="flex flex-col gap-3 px-[18px] py-[14px]">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!sortedRows.length) {
    return (
      <div className="rounded-[14px] border border-pd-border bg-pd-surface px-6 py-16 text-center">
        <p className="font-pd-display text-[14px] font-semibold text-pd-ink">No ads to show</p>
        <p className="mt-1 text-[12.5px] text-pd-faint">
          Ads matching the current filters will appear here as cards.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sortedRows.map((row, cardIdx) => {
        const isActive = String(row.status).toLowerCase() === "active"
        const isToggling = togglingRows.has(row.id)
        // image_url only exists for image creatives; creative_thumbnail is
        // the video poster (or Meta's small fallback thumb).
        const thumbnail = !failedImages.has(row.id) && (row.creative_image || row.creative_thumbnail)
        const isVideo = Boolean(row.creative_video_id)

        return (
          <div key={row.id ?? cardIdx} className="overflow-hidden rounded-[14px] border border-pd-border bg-pd-surface">
            {/* Creative thumbnail, or the handoff's grey placeholder with a
                centred play badge when there is none (or the URL expired). */}
            <div className="relative flex h-[190px] items-center justify-center overflow-hidden bg-pd-divider">
              {thumbnail ? (
                <>
                  <img
                    src={thumbnail}
                    alt={row.creative_title || row.name || "Ad creative"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                    onError={() => setFailedImages(prev => new Set(prev).add(row.id))}
                  />
                  {/* A video creative wears its play badge over the poster. */}
                  {isVideo && (
                    <span className="absolute flex size-11 items-center justify-center rounded-full bg-black/45">
                      <Play className="size-4 fill-white text-white" aria-hidden="true" />
                    </span>
                  )}
                </>
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full bg-pd-border-strong">
                  <Play className="size-4 fill-pd-faint text-pd-faint" aria-hidden="true" />
                </span>
              )}
            </div>

            <div className="px-[18px] py-[14px]">
              {/* Fixed header row: name truncates with a native tooltip, never
                  wraps; the status toggle keeps its corner. */}
              <div className="mb-1.5 flex items-start justify-between gap-3 border-b border-pd-row-border pb-2.5">
                <div className="min-w-0">
                  <div className="mb-[3px] text-[11px] text-pd-faint">Ad Name</div>
                  <div
                    title={row.name}
                    className="truncate font-pd-display text-[14px] font-semibold text-pd-ink"
                  >
                    {row.name}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="mb-[3px] text-[11px] text-pd-faint">Status</div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    aria-label={`${isActive ? "Pause" : "Activate"} ${row.name || row.id}`}
                    disabled={isToggling}
                    onClick={() => onStatusToggle?.(row.id, row.status)}
                    className={`ml-auto flex h-[19px] w-[34px] cursor-pointer items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pd-primary ${
                      isActive ? "justify-end bg-pd-primary" : "justify-start bg-pd-chevron"
                    } ${isToggling ? "opacity-50" : ""}`}
                  >
                    <span className="size-[15px] rounded-full bg-white" />
                  </button>
                </div>
              </div>

              {/* The same columns the table draws, one per row, each
                  individually draggable. Straight-edged dashed top border on
                  the live drop target, per the handoff. */}
              {metricColumns.map(col => {
                const scoped = drag.cardIdx === cardIdx
                const isDragging = scoped && drag.id === col.id
                const isDropTarget = scoped && drag.overId === col.id && drag.id !== col.id
                return (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={() => setDrag({ id: col.id, overId: null, cardIdx })}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"
                      if (drag.overId !== col.id) setDrag(prev => ({ ...prev, overId: col.id }))
                    }}
                    onDragLeave={() => setDrag(prev => (prev.overId === col.id ? { ...prev, overId: null } : prev))}
                    onDrop={(e) => { e.preventDefault(); handleDrop(col.id) }}
                    onDragEnd={clearDrag}
                    className={`flex cursor-grab items-center justify-between gap-2 px-1 py-1.5 active:cursor-grabbing ${
                      isDragging ? "bg-pd-primary-tint" : ""
                    }`}
                    style={{ borderTop: `2px dashed ${isDropTarget ? "var(--pd-primary)" : "transparent"}` }}
                  >
                    <span className="truncate text-[13px] text-pd-faint">
                      {typeof col.header === "function" ? col.header() : col.header}
                    </span>
                    <span className="shrink-0 font-pd-display text-[14px] font-semibold text-pd-ink">
                      {col.render ? col.render(row[col.id], row) : (row[col.id] ?? "–")}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
