"use client"
import { cn } from "@/lib/utils"

/**
 * dashkit's Frame slot: the card chrome around one widget, in Birdy's pd card
 * look (white surface, hairline border, 16px radius, soft shadow) at dashkit's
 * density. PdCard itself is not used: its section padding (20/22px) and 15px
 * heading leave too little height in a 1-row cell for a KPI and clip charts
 * in a 2-row one. Mirrors dashkit's WidgetFrame contract: while `loading` the
 * children stay put under a pulse overlay (so stale numbers don't flash away),
 * `empty` and `error` replace them. `menu` is the editor's handles and goes in
 * the header's right slot.
 *
 * The root fills its grid cell: `.dk-widget` is a flex row, so the frame needs
 * `flex-1` (dashkit's own `.dk-frame` has `flex: 1`) plus full width/height,
 * and the body flexes to the remaining height with min-h-0 so charts sized to
 * 100% have something to measure.
 *
 * The body carries dashkit's `dk-frame-body` class: that is what makes it the
 * inline-size container widgets measure their `cqi` text against, so without
 * it KPI text would track the viewport instead of the card. dashkit's own
 * 12/16px body padding is replaced (hence the `!`: dashkit's CSS is unlayered
 * and would otherwise beat Tailwind's layered utilities) by this frame's
 * spacing: the gap under the header and the card's bottom padding sit inside
 * the body as its top and bottom padding. That keeps the content box the same
 * size while giving dashkit's KPIs the room they are designed to spill into
 * when a narrow tile wraps its value and delta onto two lines; with the
 * spacing outside the body, `overflow-hidden` cut those lines off.
 * `dk-frame` and `dk-frame-title` are deliberately not used: they set
 * background, border, radius, shadow and padding that this frame owns.
 *
 * @param {string} [title]
 * @param {React.ReactNode} [menu]
 * @param {"ready"|"loading"|"empty"|"error"} state
 * @param {string} [error]
 */
export function PdFrame({ title, menu, state, error, children }) {
  let body
  if (state === "error") {
    body = (
      <div className="text-sm text-pd-danger" role="status">
        {error ?? "Something went wrong"}
      </div>
    )
  } else if (state === "empty") {
    body = <div className="text-sm text-pd-faint">No data bound</div>
  } else {
    body = (
      <>
        {children}
        {state === "loading" && <div className="dk-pulse" aria-hidden="true" />}
      </>
    )
  }

  const header = Boolean(title || menu)
  return (
    <section
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-pd-border bg-pd-surface px-4 pt-3 shadow-sm",
        state === "error" && "border-pd-danger",
      )}
    >
      {header && (
        <div className="flex min-w-0 items-center justify-between gap-2">
          {title && (
            <h3 className="min-w-0 truncate font-pd-display text-[13px] font-semibold text-pd-ink">{title}</h3>
          )}
          {menu && <div className="dk-frame-menu">{menu}</div>}
        </div>
      )}
      <div
        className={cn(
          "dk-frame-body relative min-h-0 flex-1 overflow-hidden px-0! pb-3!",
          header ? "pt-2!" : "pt-0!",
        )}
        data-state={state}
        aria-busy={state === "loading" || undefined}
      >
        {body}
      </div>
    </section>
  )
}
