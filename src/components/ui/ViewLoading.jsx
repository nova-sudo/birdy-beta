// components/ui/ViewLoading.jsx
// Shown on Campaign Hub, Lead Hub, and Client Hub while the user's
// saved column-view is being fetched from the server.
// Drop this file in components/ui/ and import it in each hub page.

export function ViewLoading() {
  return (
    <div className="flex flex-col items-center justify-center w-full py-24 gap-4 select-none">
      {/* Spinner */}
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-600 animate-spin" />
      </div>

      {/* Message */}
      <p className="text-sm font-medium text-muted-foreground tracking-wide">
        Loading your custom view…
      </p>

      {/* Skeleton table preview */}
      <div className="w-full max-w-4xl mt-4 rounded-lg border bg-card overflow-hidden">
        {/* Header row */}
        <div className="flex gap-3 px-4 py-3 border-b bg-muted/40">
          {[180, 120, 100, 100, 100, 80].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-muted animate-pulse"
              style={{ width: w, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: 6 }).map((_, row) => (
          <div
            key={row}
            className={`flex gap-3 px-4 py-4 border-b last:border-0 ${row % 2 === 0 ? "bg-[#F4F3F9]/60" : "bg-white"}`}
          >
            {[160, 110, 90, 90, 90, 70].map((w, col) => (
              <div
                key={col}
                className="h-3 rounded bg-muted/70 animate-pulse"
                style={{ width: w, animationDelay: `${(row * 6 + col) * 40}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}