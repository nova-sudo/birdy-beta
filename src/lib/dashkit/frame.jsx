"use client"
import { cn } from "@/lib/utils"

/**
 * dashkit's Frame slot: the card chrome around one widget, in Birdy's pd card
 * look (white surface, hairline border, 16px radius, soft shadow) at dashkit's
 * density. PdCard itself is not used: its section padding (20/22px) and 15px
 * heading leave too little height in a 1-row cell for a KPI. Mirrors dashkit's
 * WidgetFrame contract: while `loading` the children stay put under a pulse
 * overlay (so stale numbers don't flash away), `empty` and `error` replace
 * them.
 *
 * The header copies WidgetFrame's structure (`.dk-frame-title` >
 * `.dk-frame-titlerow` > title, `meta` pill, `menu`) so dashkit's own rules
 * lay it out: the row wraps (a long badge drops under the title on a narrow
 * widget), the title ellipsizes, and the menu (the editor's drag and resize
 * controls) stays pinned right. dashkit's 16/20px title padding is the pd
 * card's. `meta` is the window badge (`Last 30 days · all clients`); its
 * colours carry `!` because dashkit's stylesheet is unlayered and its muted
 * pill would otherwise beat Tailwind's layered utilities. The pill never
 * grows past the card (a 2-column widget is narrower than most badges): it
 * ellipsizes, with the full text as its tooltip. In a 1-row cell globals.css
 * also keeps it on the title's line, since a wrapped badge leaves a KPI no
 * height.
 *
 * The root fills its grid cell: `.dk-widget` is a flex row, so the frame needs
 * `flex-1` plus full width/height, and the body flexes to the remaining height
 * with min-h-0 so charts sized to 100% have something to measure. `dk-frame`
 * is deliberately not used: it sets the background, border, radius and shadow
 * this frame owns.
 *
 * The body carries dashkit's `dk-frame-body` class: that is what makes it the
 * inline-size container widgets measure their `cqi` text against, so without
 * it KPI text would track the viewport instead of the card. Its padding is
 * set here (hence the `!`): 20px sides and bottom like dashkit's, but only 8px
 * under a title row (dashkit uses 12px) so a 1-row KPI's value and delta still
 * fit; with no title row the body takes the card's 16px top padding itself.
 *
 * @param {string} [title]
 * @param {React.ReactNode} [menu]
 * @param {React.ReactNode} [meta]
 * @param {"ready"|"loading"|"empty"|"error"} state
 * @param {string} [error]
 */
export function PdFrame({ title, menu, meta, state, error, children }) {
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

  const header = Boolean(title || menu || meta)
  return (
    <section
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-pd-border bg-pd-surface shadow-sm",
        state === "error" && "border-pd-danger",
      )}
    >
      {header && (
        <div className="dk-frame-title px-5 pt-4">
          <div className="dk-frame-titlerow">
            {title && <h3 className="font-pd-display text-[14px] font-semibold text-pd-ink">{title}</h3>}
            {meta && (
              <span
                className="dk-frame-meta max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-pd-divider! px-2 py-0.5 text-[12px] text-pd-body!"
                title={typeof meta === "string" ? meta : undefined}
              >
                {meta}
              </span>
            )}
            {menu && <div className="dk-frame-menu">{menu}</div>}
          </div>
        </div>
      )}
      <div
        className={cn(
          "dk-frame-body relative min-h-0 flex-1 overflow-hidden px-5! pb-5!",
          header ? "pt-2!" : "pt-4!",
        )}
        data-state={state}
        aria-busy={state === "loading" || undefined}
      >
        {body}
      </div>
    </section>
  )
}
