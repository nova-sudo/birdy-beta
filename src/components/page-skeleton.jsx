import { Skeleton } from "@/components/ui/skeleton"

/**
 * What a hub looks like before its route has arrived.
 *
 * Next renders a route's loading.jsx while it fetches that route's chunk and
 * RSC payload — the gap between clicking a nav item and the page existing.
 * Without one the old page simply sits there, so a slow chunk reads as a dead
 * click rather than as loading.
 *
 * The shell around this (sidebar, header) is in the layout and never
 * unmounts, so only the page area needs filling. The shapes are deliberately
 * generic: a row of stat tiles over a wide panel, which is what every hub
 * opens with. A skeleton that mimics one hub exactly would be wrong on the
 * other four, and wrong is worse than approximate — it makes the real content
 * look like it moved when it lands.
 */
export default function PageSkeleton({ tiles = 4, rows = 6 }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
