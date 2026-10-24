"use client"
import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, LayoutGrid, Play, Table } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Skeleton,
  Switch,
} from "@/components/ds"
import { apiRequest } from "@/lib/api"
import { cn } from "@/lib/utils"

// The Ads tab's two layouts show the same metrics in the same order — one
// shared order array. This grid is the gallery half; the table half is the ds
// DataTable, and both write the reorder back through the same
// onOrderChange handler in MarketingContent.
//
// Media-top card (mock gate, option A): 16:10 creative, the ad's name beside
// its status switch, and one row of metrics. Paged 24 to a page, so a long ad
// list never mounts more than a page of creatives and needs no windowing.

export const GALLERY_PAGE_SIZE = 24

// The metrics the card's single row carries; the rest sit behind "More metrics".
const STRIP_METRICS = 4

// Icon-only layout switch for the Ads tab: table or gallery.
export function AdsViewSwitch({ value, onChange }) {
  const options = [
    { key: "table", icon: Table, label: "Table view" },
    { key: "gallery", icon: LayoutGrid, label: "Gallery view" },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Ads layout"
      className="flex shrink-0 gap-0.5 rounded-control bg-muted p-1"
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
            className={cn(
              "flex size-6 cursor-pointer items-center justify-center rounded-sm outline-none transition-colors focus-visible:shadow-control-focus",
              selected ? "bg-background text-foreground shadow-control" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

const headerText = (col) => (typeof col.header === "function" ? col.header() : col.header)

// Video ad previews: Meta blocks the raw video `source` URL for a lot of ad
// creatives (download-protected, still processing, licensed audio, ...) even
// with full ads_read access, so this renders Meta's own ad-preview iframe
// (GET /{ad_id}/previews) instead of pulling the asset directly — that's
// Meta serving its own render rather than handing back the raw file, so it
// works for every ad regardless of those restrictions.
function VideoPreviewDialog({ row, columns, onStatusToggle, toggling, onClose }) {
  const adId = row.id
  const title = row.creative_title || row.name
  const isActive = String(row.status).toLowerCase() === "active"
  const stats = columns.filter(c => c.id !== "name").slice(0, STRIP_METRICS)
  const [state, setState] = useState({ status: "loading", previewUrl: null, width: null, height: null, error: null })

  useEffect(() => {
    let cancelled = false
    setState({ status: "loading", previewUrl: null, width: null, height: null, error: null })
    apiRequest(`/api/facebook/ad-preview/${adId}`)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) throw new Error("Meta won't show a preview for this ad. It may have been deleted, or this account can't access it.")
        if (!d.preview_url) throw new Error("No preview available for this ad")
        setState({ status: "ready", previewUrl: d.preview_url, width: d.width, height: d.height, error: null })
      })
      .catch((e) => {
        if (cancelled) return
        setState({ status: "error", previewUrl: null, width: null, height: null, error: String(e.message || e) })
      })
    return () => { cancelled = true }
  }, [adId])

  // Meta's preview iframe has a fixed intrinsic size — scale it down to fit
  // the dialog rather than cropping or leaving it oversized.
  const scale = state.width ? Math.min(1, 620 / state.width) : 1

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-4 py-3 pr-14 text-left">
          <DialogTitle className="truncate">{title || "Ad preview"}</DialogTitle>
          <DialogDescription className="text-xs">Preview rendered by Meta</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex min-h-60 items-center justify-center overflow-auto rounded-surface bg-muted p-4">
          {state.status === "loading" && (
            <Skeleton className="h-[420px] w-full max-w-[500px]" aria-hidden="true" />
          )}
          {state.status === "error" && (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">{state.error}</p>
          )}
          {state.status === "ready" && (
            <iframe
              key={state.previewUrl}
              src={state.previewUrl}
              width={state.width || 500}
              height={state.height || 720}
              scrolling="no"
              style={{ border: "none", transform: `scale(${scale})`, transformOrigin: "center" }}
              title={title || "Ad preview"}
            />
          )}
        </div>
          {/* Status and the headline numbers beside the player; below it on a phone. */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <Badge tone={isActive ? "success" : "neutral"}>{isActive ? "Active" : "Paused"}</Badge>
              <Switch
                checked={isActive}
                disabled={toggling}
                aria-label={`${isActive ? "Pause" : "Activate"} ${row.name || row.id}`}
                onCheckedChange={() => onStatusToggle?.(row.id, row.status)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stats.map(col => (
                <div key={col.id} className="flex min-w-0 flex-col gap-0.5 rounded-control bg-muted px-3 py-2">
                  <span className="num text-base font-medium text-foreground">
                    {col.render ? col.render(row[col.id], row) : (row[col.id] ?? "–")}
                  </span>
                  <span className="text-xs text-muted-foreground">{headerText(col)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  resetKey,
}) {
  // One drag at a time, scoped to the card it started in — the drop-target
  // outline only lights up on that card, not on every card showing the same row.
  const [drag, setDrag] = useState({ id: null, overId: null, cardIdx: null })
  // Meta's creative CDN URLs are signed and ephemeral (see
  // facebook_cache_shape.py), so a stored thumbnail can 404 between refreshes.
  // A failed load drops the card back to the placeholder rather than showing
  // the browser's broken-image glyph.
  const [failedImages, setFailedImages] = useState(() => new Set())
  // Which video ad's preview dialog is open, if any.
  const [previewId, setPreviewId] = useState(null)
  const [page, setPage] = useState(0)

  // A new search, tab or drill-down starts again from the first page.
  useEffect(() => { setPage(0) }, [resetKey])

  // The name lives in the card's header; everything else becomes a metric, in
  // the shared order.
  const metricColumns = useMemo(() => columns.filter(c => c.id !== "name"), [columns])

  // The table opens sorted by spend descending; the gallery matches so
  // flicking between views doesn't shuffle the ads.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)),
    [rows]
  )

  // Looked up live so the dialog's switch follows a toggle.
  const previewRow = previewId != null ? rows.find(r => r.id === previewId) : null

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / GALLERY_PAGE_SIZE))
  // A narrower filter can leave the current page past the end.
  const pageIndex = Math.min(page, pageCount - 1)
  const pageRows = useMemo(
    () => sortedRows.slice(pageIndex * GALLERY_PAGE_SIZE, (pageIndex + 1) * GALLERY_PAGE_SIZE),
    [sortedRows, pageIndex]
  )

  const clearDrag = () => setDrag({ id: null, overId: null, cardIdx: null })

  const handleDrop = (targetId) => {
    const fromId = drag.id
    clearDrag()
    if (!fromId || fromId === targetId) return
    // The ordered visible ids with the dragged one respliced in front of the target.
    const newOrder = columns.map(c => c.id).filter(id => id !== fromId)
    newOrder.splice(newOrder.indexOf(targetId), 0, fromId)
    onOrderChange?.(newOrder)
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: CARD_SKELETON_COUNT }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-surface bg-background shadow-surface">
            <Skeleton className="aspect-[16/10] w-full rounded-none" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!sortedRows.length) {
    return (
      <div className="rounded-surface bg-background shadow-surface">
        <EmptyState
          title="No ads to show"
          description="Ads matching the current filters will appear here as cards."
        />
      </div>
    )
  }

  const metricCell = (col, row, cardIdx) => {
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
        className={cn(
          "flex cursor-grab items-center justify-between gap-3 rounded-sm px-1.5 py-1 active:cursor-grabbing",
          isDragging && "bg-primary-soft",
          isDropTarget && "shadow-control-focus"
        )}
      >
        <span className="text-sm text-muted-foreground">{headerText(col)}</span>
        <span className="num shrink-0 text-sm font-medium text-foreground">
          {col.render ? col.render(row[col.id], row) : (row[col.id] ?? "–")}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pageRows.map((row, cardIdx) => {
          const isActive = String(row.status).toLowerCase() === "active"
          const isToggling = togglingRows.has(row.id)
          // image_url only exists for image creatives; creative_thumbnail is
          // the video poster (or Meta's small fallback thumb).
          const thumbnail = !failedImages.has(row.id) && (row.creative_image || row.creative_thumbnail)
          const isVideo = Boolean(row.creative_video_id)
          const strip = metricColumns.slice(0, STRIP_METRICS)
          const more = metricColumns.slice(STRIP_METRICS)

          return (
            <li
              key={row.id ?? cardIdx}
              data-slot="ads-gallery-card"
              className="overflow-hidden rounded-surface bg-background shadow-surface"
            >
              {/* Creative thumbnail, or a muted placeholder with a centred play
                  badge when there is none (or the URL expired). A video
                  creative's badge doubles as the play button — click to open
                  an overlay that fetches Meta's own preview and plays it. */}
              <div
                role={isVideo ? "button" : undefined}
                tabIndex={isVideo ? 0 : undefined}
                aria-label={isVideo ? `Play ${row.name || "ad"} preview` : undefined}
                onClick={isVideo ? () => setPreviewId(row.id) : undefined}
                onKeyDown={isVideo ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPreviewId(row.id) } } : undefined}
                className={cn(
                  "relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-muted outline-none focus-visible:shadow-control-focus",
                  isVideo && "cursor-pointer"
                )}
              >
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
                      <span className="absolute flex size-11 items-center justify-center rounded-full bg-foreground/60">
                        <Play className="size-4 fill-background text-background" aria-hidden="true" />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="flex size-11 items-center justify-center rounded-full bg-border">
                    <Play className="size-4 fill-muted-foreground text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 p-4">
                {/* Name truncates with a native tooltip, never wraps; the
                    status switch keeps its corner. */}
                <div className="flex items-center justify-between gap-3">
                  <span title={row.name} className="min-w-0 truncate text-base font-medium text-foreground">
                    {row.name}
                  </span>
                  <Switch
                    checked={isActive}
                    disabled={isToggling}
                    aria-label={`${isActive ? "Pause" : "Activate"} ${row.name || row.id}`}
                    onCheckedChange={() => onStatusToggle?.(row.id, row.status)}
                  />
                </div>

                {/* The same columns the table draws, one label-left / value-right
                    row each, individually draggable. The first four; the rest
                    on request. */}
                {strip.map(col => metricCell(col, row, cardIdx))}
                {more.length > 0 && (
                  <details>
                    <summary className="cursor-pointer list-none text-xs font-medium text-primary outline-none hover:underline focus-visible:shadow-control-focus">
                      More metrics ({more.length})
                    </summary>
                    <div className="mt-1 flex flex-col">
                      {more.map(col => metricCell(col, row, cardIdx))}
                    </div>
                  </details>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {pageCount > 1 && (
        <nav aria-label="Gallery pages" className="flex items-center justify-between gap-3 p-1">
          <p className="num text-sm text-muted-foreground">
            Page {pageIndex + 1} of {pageCount} · {sortedRows.length} ads
          </p>
          <div className="flex gap-2">
            <Button size="icon-sm" aria-label="Previous page" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}>
              <ChevronLeft />
            </Button>
            <Button size="icon-sm" aria-label="Next page" disabled={pageIndex >= pageCount - 1} onClick={() => setPage(pageIndex + 1)}>
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}

      {previewRow && (
        <VideoPreviewDialog
          row={previewRow}
          columns={columns}
          onStatusToggle={onStatusToggle}
          toggling={togglingRows.has(previewRow.id)}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  )
}
